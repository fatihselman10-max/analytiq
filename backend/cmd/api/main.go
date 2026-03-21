package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/repliq/backend/internal/auth"
	"github.com/repliq/backend/internal/config"
	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/handlers"
	"github.com/repliq/backend/internal/middleware"
	"github.com/repliq/backend/internal/services/bot"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/services/channel/instagram"
	"github.com/repliq/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	authService := auth.NewService(cfg.JWTSecret)

	// Channel registry & service
	registry := channel.NewRegistry()
	registry.RegisterFactory("instagram", func(config map[string]string) channel.Provider {
		return instagram.NewInstagramProvider(config)
	})

	// Register channel providers from DB
	func() {
		ctx := context.Background()
		rows, err := db.Pool.Query(ctx,
			`SELECT type, credentials FROM channels WHERE is_active = true AND credentials IS NOT NULL AND credentials != '' AND credentials != '{}'`)
		if err != nil {
			log.Printf("Warning: failed to load channels from DB: %v", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var chType, creds string
			if err := rows.Scan(&chType, &creds); err != nil {
				continue
			}
			var config map[string]string
			if err := json.Unmarshal([]byte(creds), &config); err != nil {
				continue
			}
			switch chType {
			case "instagram":
				if config["access_token"] != "" {
					registry.Register(instagram.NewInstagramProvider(config))
					log.Printf("Registered Instagram provider from DB")
				}
			}
		}
	}()

	// Fallback: register from env vars if not already registered
	if _, err := registry.Get("instagram"); err != nil {
		if token := cfg.InstagramToken; token != "" {
			config := map[string]string{
				"page_id":      os.Getenv("INSTAGRAM_PAGE_ID"),
				"access_token": token,
				"app_secret":   cfg.InstagramAppSecret,
			}
			registry.Register(instagram.NewInstagramProvider(config))
			log.Printf("Registered Instagram provider from env vars")

			// Also update DB channel credentials so everything stays in sync
			ctx := context.Background()
			credsJSON, _ := json.Marshal(config)
			db.Pool.Exec(ctx,
				`UPDATE channels SET credentials = $1, updated_at = NOW() WHERE type = 'instagram' AND is_active = true AND (credentials IS NULL OR credentials = '{}')`,
				string(credsJSON))
		}
	}

	channelService := channel.NewService(db, registry)

	// Bot engine
	botEngine := bot.NewEngine(db)

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Handlers
	authHandler := handlers.NewAuthHandler(db, authService)
	conversationHandler := handlers.NewConversationHandler(db)
	messageHandler := handlers.NewMessageHandler(db, channelService, hub)
	webhookHandler := handlers.NewWebhookHandler(db, channelService, registry, botEngine, hub)
	channelHandler := handlers.NewChannelHandler(db)
	contactHandler := handlers.NewContactHandler(db)
	reportHandler := handlers.NewReportHandler(db)
	botHandler := handlers.NewBotHandler(db)
	teamHandler := handlers.NewTeamHandler(db)
	cannedHandler := handlers.NewCannedHandler(db)
	tagHandler := handlers.NewTagHandler(db)
	wsHandler := handlers.NewWSHandler(hub, authService)

	// Router
	r := gin.Default()
	r.Use(middleware.CORSMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Auth routes (public)
	authGroup := r.Group("/api/v1/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	// Webhook routes (public)
	webhooks := r.Group("/api/v1/webhooks")
	{
		webhooks.POST("/whatsapp", webhookHandler.HandleWebhook("whatsapp"))
		webhooks.GET("/whatsapp", webhookHandler.VerifyWebhook)
		webhooks.POST("/instagram", webhookHandler.HandleWebhook("instagram"))
		webhooks.POST("/telegram", webhookHandler.HandleWebhook("telegram"))
		webhooks.POST("/facebook", webhookHandler.HandleWebhook("facebook"))
		webhooks.GET("/facebook", webhookHandler.VerifyWebhook)
		webhooks.POST("/twitter", webhookHandler.HandleWebhook("twitter"))
		webhooks.POST("/vk", webhookHandler.HandleWebhook("vk"))
		webhooks.POST("/livechat", webhookHandler.HandleLiveChatMessage)
	}

	// WebSocket
	r.GET("/ws", wsHandler.Handle)

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(middleware.AuthMiddleware(authService))
	{
		// Conversations
		api.GET("/conversations", conversationHandler.List)
		api.GET("/conversations/:id", conversationHandler.Get)
		api.PATCH("/conversations/:id", conversationHandler.Update)
		api.POST("/conversations/:id/assign", conversationHandler.Assign)
		api.POST("/conversations/:id/tags", conversationHandler.AddTag)
		api.DELETE("/conversations/:id/tags/:tag_id", conversationHandler.RemoveTag)

		// Messages
		api.GET("/conversations/:id/messages", messageHandler.List)
		api.POST("/conversations/:id/messages", messageHandler.Reply)
		api.POST("/conversations/:id/notes", messageHandler.AddNote)

		// Channels
		api.GET("/channels", channelHandler.List)
		api.POST("/channels", channelHandler.Create)
		api.PATCH("/channels/:id", channelHandler.Update)
		api.DELETE("/channels/:id", channelHandler.Delete)

		// Contacts
		api.GET("/contacts", contactHandler.List)
		api.GET("/contacts/:id", contactHandler.Get)
		api.PATCH("/contacts/:id", contactHandler.Update)

		// Reports
		api.GET("/reports/overview", reportHandler.Overview)
		api.GET("/reports/agents", reportHandler.Agents)
		api.GET("/reports/channels", reportHandler.Channels)

		// Bot
		api.GET("/bot/rules", botHandler.ListRules)
		api.POST("/bot/rules", botHandler.CreateRule)
		api.PUT("/bot/rules/:id", botHandler.UpdateRule)
		api.DELETE("/bot/rules/:id", botHandler.DeleteRule)
		api.PATCH("/bot/rules/:id/toggle", botHandler.ToggleRule)
		api.GET("/bot/logs", botHandler.ListLogs)

		// Team
		api.GET("/team/members", teamHandler.ListMembers)
		api.PATCH("/team/members/:user_id", teamHandler.UpdateMember)
		api.DELETE("/team/members/:user_id", teamHandler.DeleteMember)
		api.GET("/organization", teamHandler.GetOrganization)
		api.PATCH("/organization", teamHandler.UpdateOrganization)

		// Canned responses
		api.GET("/canned-responses", cannedHandler.List)
		api.POST("/canned-responses", cannedHandler.Create)
		api.PUT("/canned-responses/:id", cannedHandler.Update)
		api.DELETE("/canned-responses/:id", cannedHandler.Delete)

		// Tags
		api.GET("/tags", tagHandler.List)
		api.POST("/tags", tagHandler.Create)
		api.DELETE("/tags/:id", tagHandler.Delete)
	}

	// Admin only routes
	admin := api.Group("")
	admin.Use(middleware.RequireRole("owner", "admin"))
	{
		admin.POST("/team/invite", authHandler.InviteMember)
	}

	// Graceful shutdown
	go func() {
		if err := r.Run(":" + cfg.Port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")
}
