package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/analytiq/backend/internal/auth"
	"github.com/analytiq/backend/internal/config"
	"github.com/analytiq/backend/internal/database"
	"github.com/analytiq/backend/internal/handlers"
	"github.com/analytiq/backend/internal/middleware"
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

	// Handlers
	authHandler := handlers.NewAuthHandler(db, authService)
	dashboardHandler := handlers.NewDashboardHandler(db)
	ordersHandler := handlers.NewOrdersHandler(db)
	integrationHandler := handlers.NewIntegrationHandler(db)
	analyticsHandler := handlers.NewAnalyticsHandler(db)

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

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(middleware.AuthMiddleware(authService))
	{
		// Dashboard
		api.GET("/dashboard/overview", dashboardHandler.GetOverview)

		// Orders
		api.GET("/orders", ordersHandler.ListOrders)
		api.GET("/orders/:id", ordersHandler.GetOrder)

		// Integrations
		api.GET("/integrations", integrationHandler.ListIntegrations)
		api.POST("/integrations", integrationHandler.CreateIntegration)
		api.DELETE("/integrations/:id", integrationHandler.DeleteIntegration)
		api.POST("/integrations/:id/sync", integrationHandler.SyncIntegration)

		// Analytics
		api.GET("/analytics/ads", analyticsHandler.GetAdPerformance)
		api.GET("/analytics/profit", analyticsHandler.GetProfitAnalysis)
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
