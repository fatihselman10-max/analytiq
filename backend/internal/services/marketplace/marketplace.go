package marketplace

import (
	"context"
	"time"
)

// MarketplaceClient is the interface all marketplace integrations must implement
type MarketplaceClient interface {
	// GetOrders fetches orders from the marketplace within a date range
	GetOrders(ctx context.Context, startDate, endDate time.Time, page int) (*OrdersResponse, error)
	// GetProducts fetches the product catalog
	GetProducts(ctx context.Context, page int) (*ProductsResponse, error)
	// GetOrderDetail fetches detailed info for a specific order
	GetOrderDetail(ctx context.Context, orderID string) (*OrderDetail, error)
	// TestConnection validates the API credentials
	TestConnection(ctx context.Context) error
	// GetPlatformName returns the platform identifier
	GetPlatformName() string
}

type OrdersResponse struct {
	Orders     []Order `json:"orders"`
	TotalCount int     `json:"total_count"`
	Page       int     `json:"page"`
	HasMore    bool    `json:"has_more"`
}

type Order struct {
	PlatformOrderID string      `json:"platform_order_id"`
	Status          string      `json:"status"`
	CustomerName    string      `json:"customer_name"`
	CustomerEmail   string      `json:"customer_email"`
	City            string      `json:"city"`
	Currency        string      `json:"currency"`
	TotalAmount     float64     `json:"total_amount"`
	SubtotalAmount  float64     `json:"subtotal_amount"`
	ShippingAmount  float64     `json:"shipping_amount"`
	DiscountAmount  float64     `json:"discount_amount"`
	TaxAmount       float64     `json:"tax_amount"`
	CommissionAmount float64    `json:"commission_amount"`
	Items           []OrderItem `json:"items"`
	OrderDate       time.Time   `json:"order_date"`
	ShippedAt       *time.Time  `json:"shipped_at"`
	DeliveredAt     *time.Time  `json:"delivered_at"`
	CancelledAt     *time.Time  `json:"cancelled_at"`
}

type OrderItem struct {
	ProductID   string  `json:"product_id"`
	SKU         string  `json:"sku"`
	Barcode     string  `json:"barcode"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	TotalPrice  float64 `json:"total_price"`
	Commission  float64 `json:"commission"`
}

type OrderDetail struct {
	Order
	RawData map[string]interface{} `json:"raw_data"`
}

type ProductsResponse struct {
	Products   []Product `json:"products"`
	TotalCount int       `json:"total_count"`
	Page       int       `json:"page"`
	HasMore    bool      `json:"has_more"`
}

type Product struct {
	PlatformProductID string  `json:"platform_product_id"`
	SKU               string  `json:"sku"`
	Barcode           string  `json:"barcode"`
	Name              string  `json:"name"`
	Brand             string  `json:"brand"`
	Category          string  `json:"category"`
	Price             float64 `json:"price"`
	Stock             int     `json:"stock"`
	ImageURL          string  `json:"image_url"`
}
