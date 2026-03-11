package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string

	// Marketplace API Keys
	TrendyolAPIKey     string
	TrendyolSellerID   string
	HepsiburadaAPIKey  string
	N11APIKey          string
	N11APISecret       string
	AmazonSellerID     string
	AmazonMWSAuthToken string
	CiceksepetiAPIKey  string

	// E-commerce Platform Keys
	ShopifyAPIKey    string
	ShopifyAPISecret string

	// Advertising Platform Keys
	MetaAccessToken   string
	MetaAdAccountID   string
	GoogleAdsDevToken string
	GoogleAdsClientID string
	TikTokAccessToken string
	TikTokAdvertiserID string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/analytiq?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),

		TrendyolAPIKey:     os.Getenv("TRENDYOL_API_KEY"),
		TrendyolSellerID:   os.Getenv("TRENDYOL_SELLER_ID"),
		HepsiburadaAPIKey:  os.Getenv("HEPSIBURADA_API_KEY"),
		N11APIKey:          os.Getenv("N11_API_KEY"),
		N11APISecret:       os.Getenv("N11_API_SECRET"),
		AmazonSellerID:     os.Getenv("AMAZON_SELLER_ID"),
		AmazonMWSAuthToken: os.Getenv("AMAZON_MWS_AUTH_TOKEN"),
		CiceksepetiAPIKey:  os.Getenv("CICEKSEPETI_API_KEY"),

		ShopifyAPIKey:    os.Getenv("SHOPIFY_API_KEY"),
		ShopifyAPISecret: os.Getenv("SHOPIFY_API_SECRET"),

		MetaAccessToken:    os.Getenv("META_ACCESS_TOKEN"),
		MetaAdAccountID:    os.Getenv("META_AD_ACCOUNT_ID"),
		GoogleAdsDevToken:  os.Getenv("GOOGLE_ADS_DEV_TOKEN"),
		GoogleAdsClientID:  os.Getenv("GOOGLE_ADS_CLIENT_ID"),
		TikTokAccessToken:  os.Getenv("TIKTOK_ACCESS_TOKEN"),
		TikTokAdvertiserID: os.Getenv("TIKTOK_ADVERTISER_ID"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
