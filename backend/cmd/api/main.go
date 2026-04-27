package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/repliq/backend/internal/auth"
	"github.com/repliq/backend/internal/config"
	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/handlers"
	"github.com/repliq/backend/internal/middleware"
	"github.com/repliq/backend/internal/services/activity"
	"github.com/repliq/backend/internal/services/bot"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/services/channel/email"
	"github.com/repliq/backend/internal/services/channel/instagram"
	tgpkg "github.com/repliq/backend/internal/services/channel/telegram"
	vkprovider "github.com/repliq/backend/internal/services/channel/vk"
	"github.com/repliq/backend/internal/services/journey"
	"github.com/repliq/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func runMigrations(db *database.DB) {
	ctx := context.Background()
	migrations := []struct {
		name string
		sql  string
	}{
		{"011_attachment_data", `
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_data BYTEA;
`},
		{"013_customer_products", `
ALTER TABLE customers ADD COLUMN IF NOT EXISTS interested_products TEXT NOT NULL DEFAULT '';
`},
		{"014_customer_tracking_fields", `
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sent_catalogs TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sent_kartelas TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sent_samples TEXT NOT NULL DEFAULT '';
`},
		{"015_contact_role", `
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_role VARCHAR(50) NOT NULL DEFAULT '';
`},
		{"017_auto_replies", `
CREATE TABLE IF NOT EXISTS auto_replies (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    channel_type VARCHAR(50) NOT NULL DEFAULT '',
    country VARCHAR(100) NOT NULL DEFAULT '',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    only_first_message BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`},
		{"016_conversation_customer_link", `
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
`},
		{"012_pipeline_activities", `
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'new_contact';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pipeline_updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_customers_pipeline ON customers(org_id, pipeline_stage);

CREATE TABLE IF NOT EXISTS customer_activities (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    channel VARCHAR(50) NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON customer_activities(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_org ON customer_activities(org_id, created_at DESC);
`},
		{"009_customers", `
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL DEFAULT '',
    country VARCHAR(100) NOT NULL DEFAULT '',
    segment INT NOT NULL DEFAULT 4,
    customer_type VARCHAR(100) NOT NULL DEFAULT '',
    customer_type_other VARCHAR(255) NOT NULL DEFAULT '',
    source VARCHAR(50) NOT NULL DEFAULT '',
    source_detail VARCHAR(255) NOT NULL DEFAULT '',
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    instagram VARCHAR(255) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    orders TEXT NOT NULL DEFAULT '',
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_segment ON customers(org_id, segment);
CREATE INDEX IF NOT EXISTS idx_customers_org_country ON customers(org_id, country);
CREATE INDEX IF NOT EXISTS idx_customers_org_assigned ON customers(org_id, assigned_to);
CREATE TABLE IF NOT EXISTS customer_channels (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,
    channel_identifier VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_id, channel_type)
);
CREATE TABLE IF NOT EXISTS segment_history (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    old_segment INT NOT NULL,
    new_segment INT NOT NULL,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_segment_history_org ON segment_history(org_id, changed_at DESC);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Genel';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(org_id, category);
`},
		{"018_activity_approval", `
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS detected_by VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS confidence INT NOT NULL DEFAULT 100;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS source_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS source_text TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_activities_status ON customer_activities(org_id, status, created_at DESC);
`},
		{"019_customer_social_channels", `
ALTER TABLE customers ADD COLUMN IF NOT EXISTS website VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vk VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(50) NOT NULL DEFAULT '';
`},
		{"021_customer_events", `
CREATE TABLE IF NOT EXISTS customer_events (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id BIGINT REFERENCES contacts(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT '',
    title VARCHAR(500) NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    amount_cents BIGINT,
    currency CHAR(3),
    external_id VARCHAR(255),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_events_contact ON customer_events(org_id, contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_org_time ON customer_events(org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_external ON customer_events(org_id, source, external_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON contacts(org_id, (LOWER(email))) WHERE email IS NOT NULL AND email != '';
`},
		{"020_fabrics", `
CREATE TABLE IF NOT EXISTS fabrics (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    season VARCHAR(10) NOT NULL DEFAULT '',
    width VARCHAR(30) NOT NULL DEFAULT '',
    composition VARCHAR(255) NOT NULL DEFAULT '',
    gauge VARCHAR(30) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, code)
);
CREATE INDEX IF NOT EXISTS idx_fabrics_org ON fabrics(org_id);
CREATE INDEX IF NOT EXISTS idx_fabrics_season ON fabrics(org_id, season);
CREATE TABLE IF NOT EXISTS fabric_images (
    id BIGSERIAL PRIMARY KEY,
    fabric_id BIGINT NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL DEFAULT '',
    file_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
    file_size BIGINT NOT NULL DEFAULT 0,
    file_data BYTEA NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fabric_images_fabric ON fabric_images(fabric_id, sort_order);
`},
	}

	for _, m := range migrations {
		_, err := db.Pool.Exec(ctx, m.sql)
		if err != nil {
			log.Printf("Migration %s warning: %v", m.name, err)
		} else {
			log.Printf("Migration %s applied successfully", m.name)
		}
	}
}

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations on startup
	runMigrations(db)

	authService := auth.NewService(cfg.JWTSecret)

	// Ensure team member passwords are set
	func() {
		ctx := context.Background()
		users := []struct{ email, password string }{
			{"samet@messetekstil.com", "Samet2026!"},
			{"meryem@messetekstil.com", "Meryem2026!"},
		}
		for _, u := range users {
			var currentHash string
			err := db.Pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE email = $1`, u.email).Scan(&currentHash)
			if err != nil {
				continue
			}
			if len(currentHash) > 0 && !authService.CheckPassword(u.password, currentHash) {
				newHash, err := authService.HashPassword(u.password)
				if err != nil {
					continue
				}
				db.Pool.Exec(ctx, `UPDATE users SET password_hash = $1 WHERE email = $2`, newHash, u.email)
				log.Printf("Password set for %s", u.email)
			}
		}
	}()

	// Channel registry & service
	registry := channel.NewRegistry()
	registry.RegisterFactory("instagram", func(config map[string]string) channel.Provider {
		return instagram.NewInstagramProvider(config)
	})
	registry.RegisterFactory("email", func(config map[string]string) channel.Provider {
		return email.NewEmailProvider(config)
	})
	registry.RegisterFactory("telegram", func(config map[string]string) channel.Provider {
		return tgpkg.NewTelegramProvider(config)
	})
	registry.RegisterFactory("vk", func(config map[string]string) channel.Provider {
		return vkprovider.NewVKProvider(config)
	})

	// Register channel providers from DB
	func() {
		ctx := context.Background()
		rows, err := db.Pool.Query(ctx,
			`SELECT type, COALESCE(credentials::text, '{}') FROM channels WHERE is_active = true AND credentials IS NOT NULL AND credentials::text != '{}' AND credentials::text != 'null'`)
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
			case "telegram":
				if config["bot_token"] != "" {
					registry.Register(tgpkg.NewTelegramProvider(config))
					log.Printf("Registered Telegram provider from DB")
				}
			case "vk":
				if config["access_token"] != "" {
					registry.Register(vkprovider.NewVKProvider(config))
					log.Printf("Registered VK provider from DB")
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

	// Journey service — unified customer timeline (Shopify events + messages)
	journeyService := journey.NewService(db)
	channelService.Journey = journeyService

	// Activity analyzer (auto-detects pending CRM activities from messages)
	activityService := activity.NewService(db, cfg.AnthropicAPIKey)
	channelService.IncomingHook = activityService.AnalyzeIncoming

	// Start IMAP poller for email channels
	func() {
		ctx := context.Background()
		rows, err := db.Pool.Query(ctx,
			`SELECT id, COALESCE(credentials::text, '{}') FROM channels WHERE type = 'email' AND is_active = true AND credentials IS NOT NULL AND credentials::text != '{}' AND credentials::text != 'null'`)
		if err != nil {
			log.Printf("Warning: failed to load email channels: %v", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var chID int64
			var credsStr string
			if err := rows.Scan(&chID, &credsStr); err != nil {
				continue
			}
			var creds map[string]string
			if err := json.Unmarshal([]byte(credsStr), &creds); err != nil {
				continue
			}
			if creds["imap_host"] != "" && creds["smtp_user"] != "" {
				poller := email.NewIMAPPoller(db, channelService, chID, creds)
				go poller.Start()
				log.Printf("Started IMAP poller for email channel %d (%s)", chID, creds["smtp_user"])
			}
		}
	}()

	// Auto-resolve: close conversations where agent replied but no customer follow-up
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			<-ticker.C
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			result, err := db.Pool.Exec(ctx,
				`UPDATE conversations SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
				 WHERE status IN ('open', 'pending')
				   AND id IN (
				     SELECT c.id FROM conversations c
				     JOIN LATERAL (
				       SELECT sender_type, created_at FROM messages
				       WHERE conversation_id = c.id AND is_internal = false
				       ORDER BY created_at DESC LIMIT 1
				     ) last_msg ON true
				     WHERE c.status IN ('open', 'pending')
				       AND last_msg.sender_type IN ('agent', 'bot')
				       AND last_msg.created_at < NOW() - INTERVAL '24 hours'
				   )`)
			if err != nil {
				log.Printf("Auto-resolve error: %v", err)
			} else if result.RowsAffected() > 0 {
				log.Printf("Auto-resolved %d conversations", result.RowsAffected())
			}
			cancel()
		}
	}()

	// Bot engine
	botEngine := bot.NewEngine(db)

	// AI Bot (with Oplog + Shopify integration)
	aiBot := bot.NewAIBot(db, cfg.AnthropicAPIKey)
	if cfg.ShopifyStoreDomain != "" && cfg.ShopifyAccessToken != "" {
		log.Printf("Shopify integration enabled for %s", cfg.ShopifyStoreDomain)
	}

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Instagram DM poller - fetches messages via API every 30s
	igPoller := instagram.NewPoller(db, channelService, hub)
	go igPoller.Start(30 * time.Second)

	// Handlers
	authHandler := handlers.NewAuthHandler(db, authService)
	conversationHandler := handlers.NewConversationHandler(db)
	messageHandler := handlers.NewMessageHandler(db, channelService, hub)
	webhookHandler := handlers.NewWebhookHandler(db, channelService, registry, botEngine, aiBot, hub, cfg.InstagramWebhookVerifyToken)
	channelHandler := handlers.NewChannelHandler(db)
	contactHandler := handlers.NewContactHandler(db)
	reportHandler := handlers.NewReportHandler(db)
	botHandler := handlers.NewBotHandler(db)
	aiBotHandler := handlers.NewAIBotHandler(db)
	teamHandler := handlers.NewTeamHandler(db)
	cannedHandler := handlers.NewCannedHandler(db)
	tagHandler := handlers.NewTagHandler(db)
	businessHoursHandler := handlers.NewBusinessHoursHandler(db)
	slaHandler := handlers.NewSLAHandler(db)
	csatHandler := handlers.NewCSATHandler(db)
	automationHandler := handlers.NewAutomationHandler(db)
	kbHandler := handlers.NewKBHandler(db)
	taskHandler := handlers.NewTaskHandler(db)
	customerHandler := handlers.NewCustomerHandler(db)
	fabricHandler := handlers.NewFabricHandler(db)
	briefingService := bot.NewBriefingService(db, cfg.AnthropicAPIKey)
	briefingHandler := handlers.NewBriefingHandler(briefingService)
	autoReplyHandler := handlers.NewAutoReplyHandler(db)
	journeyHandler := handlers.NewJourneyHandler(journeyService)
	shopifyWebhookHandler := handlers.NewShopifyWebhookHandler(journeyService)
	wsHandler := handlers.NewWSHandler(hub, authService)

	// Router
	r := gin.Default()
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.RateLimiter())

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

	// CSAT public endpoint (customers submit ratings)
	r.POST("/api/v1/csat/submit", csatHandler.SubmitRating)

	// Accept invite (public - no auth needed)
	r.POST("/api/v1/auth/accept-invite", authHandler.AcceptInvite)

	// Webhook routes (public)
	webhooks := r.Group("/api/v1/webhooks")
	{
		webhooks.POST("/whatsapp", webhookHandler.HandleWebhook("whatsapp"))
		webhooks.GET("/whatsapp", webhookHandler.VerifyWebhook)
		webhooks.POST("/instagram", webhookHandler.HandleWebhook("instagram"))
		webhooks.GET("/instagram", webhookHandler.VerifyWebhook)
		webhooks.POST("/telegram", webhookHandler.HandleWebhook("telegram"))
		webhooks.POST("/facebook", webhookHandler.HandleWebhook("facebook"))
		webhooks.GET("/facebook", webhookHandler.VerifyWebhook)
		webhooks.POST("/twitter", webhookHandler.HandleWebhook("twitter"))
		webhooks.POST("/vk", webhookHandler.HandleWebhook("vk"))
		webhooks.POST("/email", webhookHandler.HandleWebhook("email"))
		webhooks.POST("/livechat", webhookHandler.HandleLiveChatMessage)
		webhooks.POST("/shopify", shopifyWebhookHandler.Handle)
	}

	// WebSocket
	r.GET("/ws", wsHandler.Handle)

	// Public fabric image (no auth, so <img> tags can load)
	r.GET("/api/v1/fabric-images/:id", fabricHandler.ServeImage)

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(middleware.AuthMiddleware(authService))
	{
		// Conversations
		api.GET("/conversations", conversationHandler.List)
		api.GET("/conversations/:id", conversationHandler.Get)
		api.PATCH("/conversations/:id", conversationHandler.Update)
		api.POST("/conversations/:id/assign", conversationHandler.Assign)
		api.POST("/conversations/bulk", conversationHandler.BulkUpdate)
		api.POST("/conversations/:id/tags", conversationHandler.AddTag)
		api.DELETE("/conversations/:id/tags/:tag_id", conversationHandler.RemoveTag)
		api.POST("/conversations/:id/link-customer", conversationHandler.LinkCustomer)
		api.DELETE("/conversations/:id/link-customer", conversationHandler.UnlinkCustomer)

		// Messages
		api.GET("/conversations/:id/messages", messageHandler.List)
		api.POST("/conversations/:id/messages", messageHandler.Reply)
		api.POST("/conversations/:id/notes", messageHandler.AddNote)
		api.POST("/conversations/:id/upload", messageHandler.Upload)
		api.GET("/files/:id", messageHandler.ServeFile)

		// Channels
		api.GET("/channels", channelHandler.List)
		api.POST("/channels", channelHandler.Create)
		api.PATCH("/channels/:id", channelHandler.Update)
		api.DELETE("/channels/:id", channelHandler.Delete)

		// Contacts
		api.GET("/contacts", contactHandler.List)
		api.GET("/contacts/:id", contactHandler.Get)
		api.PATCH("/contacts/:id", contactHandler.Update)
		api.GET("/contacts/:id/journey", journeyHandler.GetByContact)

		// Reports
		api.GET("/reports/overview", reportHandler.Overview)
		api.GET("/reports/agents", reportHandler.Agents)
		api.GET("/reports/channels", reportHandler.Channels)
		api.GET("/reports/messages", reportHandler.MessageAnalytics)

		// AI Bot
		api.GET("/ai-bot/config", aiBotHandler.GetConfig)
		api.POST("/ai-bot/config", aiBotHandler.SaveConfig)
		api.PATCH("/ai-bot/toggle", aiBotHandler.Toggle)
		api.GET("/ai-bot/usage", aiBotHandler.GetUsage)
		api.POST("/ai-bot/test", aiBotHandler.TestMessage)
		api.PATCH("/ai-bot/test-senders", aiBotHandler.SetTestSenders)

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

		// Business Hours
		api.GET("/business-hours", businessHoursHandler.Get)
		api.POST("/business-hours", businessHoursHandler.Save)
		api.PATCH("/business-hours/toggle", businessHoursHandler.Toggle)

		// CSAT
		api.GET("/csat/config", csatHandler.GetConfig)
		api.POST("/csat/config", csatHandler.SaveConfig)
		api.GET("/csat/responses", csatHandler.GetResponses)

		// Automations
		api.GET("/automations", automationHandler.List)
		api.POST("/automations", automationHandler.Create)
		api.PUT("/automations/:id", automationHandler.Update)
		api.DELETE("/automations/:id", automationHandler.Delete)
		api.PATCH("/automations/:id/toggle", automationHandler.Toggle)

		// SLA
		api.GET("/sla/policy", slaHandler.GetPolicy)
		api.POST("/sla/policy", slaHandler.SavePolicy)
		api.GET("/sla/statuses", slaHandler.GetConversationsSLA)

		// Knowledge Base
		api.GET("/kb/categories", kbHandler.ListCategories)
		api.POST("/kb/categories", kbHandler.CreateCategory)
		api.PUT("/kb/categories/:id", kbHandler.UpdateCategory)
		api.DELETE("/kb/categories/:id", kbHandler.DeleteCategory)
		api.GET("/kb/articles", kbHandler.ListArticles)
		api.GET("/kb/articles/:id", kbHandler.GetArticle)
		api.POST("/kb/articles", kbHandler.CreateArticle)
		api.PUT("/kb/articles/:id", kbHandler.UpdateArticle)
		api.DELETE("/kb/articles/:id", kbHandler.DeleteArticle)

		// Tasks
		api.GET("/tasks", taskHandler.List)
		api.POST("/tasks", taskHandler.Create)
		api.PUT("/tasks/:id", taskHandler.Update)
		api.DELETE("/tasks/:id", taskHandler.Delete)
		api.POST("/tasks/:id/notes", taskHandler.AddNote)
		api.PATCH("/tasks/:id/status", taskHandler.MoveStatus)

		// Customers (CRM)
		api.GET("/customers", customerHandler.List)
		api.GET("/customers/:id", customerHandler.Get)
		api.POST("/customers", customerHandler.Create)
		api.PUT("/customers/:id", customerHandler.Update)
		api.DELETE("/customers/:id", customerHandler.Delete)
		api.POST("/customers/:id/channels", customerHandler.AddChannel)
		api.DELETE("/customers/:id/channels/:channel_id", customerHandler.RemoveChannel)
		api.POST("/customers/import", customerHandler.Import)
		api.PATCH("/customers/:id/pipeline", customerHandler.UpdatePipelineStage)
		api.GET("/customers/:id/activities", customerHandler.ListActivities)
		api.POST("/customers/:id/activities", customerHandler.CreateActivity)
		api.GET("/activities/pending", customerHandler.ListPendingActivities)
		api.POST("/activities/:id/approve", customerHandler.ApprovePendingActivity)
		api.POST("/activities/:id/reject", customerHandler.RejectPendingActivity)
		api.DELETE("/activities/:id", customerHandler.DeleteActivity)
		api.GET("/activities/stats", customerHandler.PendingActivityStats)
		api.GET("/reports/crm/pipeline", customerHandler.PipelineOverview)
		api.GET("/reports/patron", customerHandler.PatronFeed)
		api.GET("/reports/briefing", briefingHandler.GetBriefing)

		// CRM Reports
		api.GET("/reports/crm/segments", customerHandler.SegmentOverview)
		api.GET("/reports/crm/segment-changes", customerHandler.SegmentChanges)
		api.GET("/reports/crm/weekly-new", customerHandler.WeeklyNew)

		// Auto Replies
		api.GET("/auto-replies", autoReplyHandler.List)
		api.POST("/auto-replies", autoReplyHandler.Create)
		api.PUT("/auto-replies/:id", autoReplyHandler.Update)
		api.DELETE("/auto-replies/:id", autoReplyHandler.Delete)

		// Tags
		api.GET("/tags", tagHandler.List)
		api.POST("/tags", tagHandler.Create)
		api.DELETE("/tags/:id", tagHandler.Delete)

		// Fabrics (catalog)
		api.GET("/fabrics", fabricHandler.List)
		api.GET("/fabrics/:id", fabricHandler.Get)
		api.POST("/fabrics", fabricHandler.Create)
		api.PUT("/fabrics/:id", fabricHandler.Update)
		api.DELETE("/fabrics/:id", fabricHandler.Delete)
		api.POST("/fabrics/:id/images", fabricHandler.UploadImage)
		api.DELETE("/fabric-images/:id", fabricHandler.DeleteImage)
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
