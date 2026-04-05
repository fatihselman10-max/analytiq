package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string

	// Channel Provider Keys
	WhatsAppToken      string
	WhatsAppPhoneID    string
	WhatsAppVerifyToken string
	TelegramBotToken   string
	InstagramToken              string
	InstagramAppSecret          string
	InstagramWebhookVerifyToken string
	FacebookPageToken  string
	FacebookAppSecret  string
	TwitterAPIKey      string
	TwitterAPISecret   string
	TwitterBearerToken string
	VKAccessToken      string
	VKGroupID          string
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPassword       string
	IMAPHost           string
	IMAPPort           string
	IMAPUser           string
	IMAPPassword       string
	AnthropicAPIKey    string

	// Shopify
	ShopifyStoreDomain string
	ShopifyAccessToken string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/repliq?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),

		WhatsAppToken:       os.Getenv("WHATSAPP_TOKEN"),
		WhatsAppPhoneID:     os.Getenv("WHATSAPP_PHONE_ID"),
		WhatsAppVerifyToken: os.Getenv("WHATSAPP_VERIFY_TOKEN"),
		TelegramBotToken:    os.Getenv("TELEGRAM_BOT_TOKEN"),
		InstagramToken:              os.Getenv("INSTAGRAM_TOKEN"),
		InstagramAppSecret:          os.Getenv("INSTAGRAM_APP_SECRET"),
		InstagramWebhookVerifyToken: getEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "messe-verify"),
		FacebookPageToken:   os.Getenv("FACEBOOK_PAGE_TOKEN"),
		FacebookAppSecret:   os.Getenv("FACEBOOK_APP_SECRET"),
		TwitterAPIKey:       os.Getenv("TWITTER_API_KEY"),
		TwitterAPISecret:    os.Getenv("TWITTER_API_SECRET"),
		TwitterBearerToken:  os.Getenv("TWITTER_BEARER_TOKEN"),
		VKAccessToken:       os.Getenv("VK_ACCESS_TOKEN"),
		VKGroupID:           os.Getenv("VK_GROUP_ID"),
		SMTPHost:            getEnv("SMTP_HOST", ""),
		SMTPPort:            getEnv("SMTP_PORT", "587"),
		SMTPUser:            os.Getenv("SMTP_USER"),
		SMTPPassword:        os.Getenv("SMTP_PASSWORD"),
		IMAPHost:            os.Getenv("IMAP_HOST"),
		IMAPPort:            getEnv("IMAP_PORT", "993"),
		IMAPUser:            os.Getenv("IMAP_USER"),
		IMAPPassword:        os.Getenv("IMAP_PASSWORD"),
		AnthropicAPIKey:     os.Getenv("ANTHROPIC_API_KEY"),

		ShopifyStoreDomain: os.Getenv("SHOPIFY_STORE_DOMAIN"),
		ShopifyAccessToken: os.Getenv("SHOPIFY_ACCESS_TOKEN"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
