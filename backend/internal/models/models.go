package models

import (
	"time"
)

// User represents a platform user (merchant)
type User struct {
	ID           int64     `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	FullName     string    `json:"full_name" db:"full_name"`
	Company      string    `json:"company" db:"company"`
	Plan         string    `json:"plan" db:"plan"` // free, starter, pro, enterprise
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Integration represents a connected platform
type Integration struct {
	ID           int64     `json:"id" db:"id"`
	UserID       int64     `json:"user_id" db:"user_id"`
	Platform     string    `json:"platform" db:"platform"`         // trendyol, hepsiburada, shopify, meta, etc.
	PlatformType string    `json:"platform_type" db:"platform_type"` // marketplace, ecommerce, advertising
	Credentials  string    `json:"-" db:"credentials"`             // encrypted JSON
	Status       string    `json:"status" db:"status"`             // active, inactive, error
	LastSyncAt   *time.Time `json:"last_sync_at" db:"last_sync_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Order represents a unified order from any platform
type Order struct {
	ID              int64      `json:"id" db:"id"`
	UserID          int64      `json:"user_id" db:"user_id"`
	IntegrationID   int64      `json:"integration_id" db:"integration_id"`
	Platform        string     `json:"platform" db:"platform"`
	PlatformOrderID string     `json:"platform_order_id" db:"platform_order_id"`
	Status          string     `json:"status" db:"status"`
	CustomerName    string     `json:"customer_name" db:"customer_name"`
	CustomerEmail   string     `json:"customer_email" db:"customer_email"`
	Currency        string     `json:"currency" db:"currency"`
	TotalAmount     float64    `json:"total_amount" db:"total_amount"`
	SubtotalAmount  float64    `json:"subtotal_amount" db:"subtotal_amount"`
	ShippingAmount  float64    `json:"shipping_amount" db:"shipping_amount"`
	DiscountAmount  float64    `json:"discount_amount" db:"discount_amount"`
	TaxAmount       float64    `json:"tax_amount" db:"tax_amount"`
	CommissionAmount float64   `json:"commission_amount" db:"commission_amount"`
	NetProfit       float64    `json:"net_profit" db:"net_profit"`
	City            string     `json:"city" db:"city"`
	OrderDate       time.Time  `json:"order_date" db:"order_date"`
	ShippedAt       *time.Time `json:"shipped_at" db:"shipped_at"`
	DeliveredAt     *time.Time `json:"delivered_at" db:"delivered_at"`
	CancelledAt     *time.Time `json:"cancelled_at" db:"cancelled_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
}

// OrderItem represents a line item in an order
type OrderItem struct {
	ID            int64   `json:"id" db:"id"`
	OrderID       int64   `json:"order_id" db:"order_id"`
	ProductID     string  `json:"product_id" db:"product_id"`
	SKU           string  `json:"sku" db:"sku"`
	Barcode       string  `json:"barcode" db:"barcode"`
	ProductName   string  `json:"product_name" db:"product_name"`
	Quantity      int     `json:"quantity" db:"quantity"`
	UnitPrice     float64 `json:"unit_price" db:"unit_price"`
	TotalPrice    float64 `json:"total_price" db:"total_price"`
	CostPrice     float64 `json:"cost_price" db:"cost_price"`
	Commission    float64 `json:"commission" db:"commission"`
}

// Product represents a unified product across platforms
type Product struct {
	ID          int64     `json:"id" db:"id"`
	UserID      int64     `json:"user_id" db:"user_id"`
	SKU         string    `json:"sku" db:"sku"`
	Barcode     string    `json:"barcode" db:"barcode"`
	Name        string    `json:"name" db:"name"`
	Brand       string    `json:"brand" db:"brand"`
	Category    string    `json:"category" db:"category"`
	CostPrice   float64   `json:"cost_price" db:"cost_price"`
	ImageURL    string    `json:"image_url" db:"image_url"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// AdSpend represents advertising spend data
type AdSpend struct {
	ID            int64     `json:"id" db:"id"`
	UserID        int64     `json:"user_id" db:"user_id"`
	IntegrationID int64     `json:"integration_id" db:"integration_id"`
	Platform      string    `json:"platform" db:"platform"` // meta, google, tiktok
	CampaignID    string    `json:"campaign_id" db:"campaign_id"`
	CampaignName  string    `json:"campaign_name" db:"campaign_name"`
	AdSetID       string    `json:"ad_set_id" db:"ad_set_id"`
	AdSetName     string    `json:"ad_set_name" db:"ad_set_name"`
	Impressions   int64     `json:"impressions" db:"impressions"`
	Clicks        int64     `json:"clicks" db:"clicks"`
	Spend         float64   `json:"spend" db:"spend"`
	Conversions   int64     `json:"conversions" db:"conversions"`
	Revenue       float64   `json:"revenue" db:"revenue"`
	ROAS          float64   `json:"roas" db:"roas"`
	CPC           float64   `json:"cpc" db:"cpc"`
	CPM           float64   `json:"cpm" db:"cpm"`
	CTR           float64   `json:"ctr" db:"ctr"`
	Date          time.Time `json:"date" db:"date"`
	Currency      string    `json:"currency" db:"currency"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// DailySummary holds aggregated daily metrics
type DailySummary struct {
	ID             int64     `json:"id" db:"id"`
	UserID         int64     `json:"user_id" db:"user_id"`
	Date           time.Time `json:"date" db:"date"`
	TotalRevenue   float64   `json:"total_revenue" db:"total_revenue"`
	TotalOrders    int       `json:"total_orders" db:"total_orders"`
	TotalAdSpend   float64   `json:"total_ad_spend" db:"total_ad_spend"`
	TotalProfit    float64   `json:"total_profit" db:"total_profit"`
	AOV            float64   `json:"aov" db:"aov"` // Average Order Value
	ROAS           float64   `json:"roas" db:"roas"`
	ConversionRate float64   `json:"conversion_rate" db:"conversion_rate"`
	Platform       string    `json:"platform" db:"platform"` // per-platform or "all"
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// Attribution tracks which ad led to which order
type Attribution struct {
	ID            int64     `json:"id" db:"id"`
	UserID        int64     `json:"user_id" db:"user_id"`
	OrderID       int64     `json:"order_id" db:"order_id"`
	AdSpendID     int64     `json:"ad_spend_id" db:"ad_spend_id"`
	CampaignID    string    `json:"campaign_id" db:"campaign_id"`
	AdPlatform    string    `json:"ad_platform" db:"ad_platform"`
	ClickID       string    `json:"click_id" db:"click_id"`
	UTMSource     string    `json:"utm_source" db:"utm_source"`
	UTMMedium     string    `json:"utm_medium" db:"utm_medium"`
	UTMCampaign   string    `json:"utm_campaign" db:"utm_campaign"`
	UTMContent    string    `json:"utm_content" db:"utm_content"`
	Model         string    `json:"model" db:"model"` // last_click, first_click, linear
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}
