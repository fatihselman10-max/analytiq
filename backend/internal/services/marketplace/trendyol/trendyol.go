package trendyol

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/services/marketplace"
)

const baseURL = "https://api.trendyol.com/sapigw"

type Client struct {
	apiKey    string
	apiSecret string
	sellerID  string
	http      *http.Client
}

func NewClient(apiKey, apiSecret, sellerID string) *Client {
	return &Client{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		sellerID:  sellerID,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) GetPlatformName() string {
	return "trendyol"
}

func (c *Client) TestConnection(ctx context.Context) error {
	url := fmt.Sprintf("%s/suppliers/%s/orders?size=1", baseURL, c.sellerID)
	_, err := c.doRequest(ctx, "GET", url)
	return err
}

func (c *Client) GetOrders(ctx context.Context, startDate, endDate time.Time, page int) (*marketplace.OrdersResponse, error) {
	startMs := startDate.UnixMilli()
	endMs := endDate.UnixMilli()
	size := 50

	url := fmt.Sprintf("%s/suppliers/%s/orders?startDate=%d&endDate=%d&page=%d&size=%d",
		baseURL, c.sellerID, startMs, endMs, page, size)

	body, err := c.doRequest(ctx, "GET", url)
	if err != nil {
		return nil, err
	}

	var resp trendyolOrdersResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	orders := make([]marketplace.Order, 0, len(resp.Content))
	for _, to := range resp.Content {
		order := marketplace.Order{
			PlatformOrderID: fmt.Sprintf("%d", to.OrderNumber),
			Status:          mapStatus(to.Status),
			CustomerName:    to.ShipmentAddress.FullName,
			City:            to.ShipmentAddress.City,
			Currency:        "TRY",
			TotalAmount:     to.TotalPrice,
			OrderDate:       time.UnixMilli(to.OrderDate),
		}

		for _, line := range to.Lines {
			item := marketplace.OrderItem{
				ProductID:   fmt.Sprintf("%d", line.ProductContentID),
				SKU:         line.MerchantSku,
				Barcode:     line.Barcode,
				ProductName: line.ProductName,
				Quantity:    line.Quantity,
				UnitPrice:   line.Price,
				TotalPrice:  line.Price * float64(line.Quantity),
				Commission:  line.Price * float64(line.Quantity) * getCommissionRate(line.ProductCategory),
			}
			order.Items = append(order.Items, item)
			order.SubtotalAmount += item.TotalPrice
			order.CommissionAmount += item.Commission
		}

		if to.Status == "Cancelled" {
			cancelTime := time.UnixMilli(to.OrderDate)
			order.CancelledAt = &cancelTime
		}

		orders = append(orders, order)
	}

	return &marketplace.OrdersResponse{
		Orders:     orders,
		TotalCount: resp.TotalElements,
		Page:       resp.Page,
		HasMore:    resp.Page < resp.TotalPages-1,
	}, nil
}

func (c *Client) GetProducts(ctx context.Context, page int) (*marketplace.ProductsResponse, error) {
	url := fmt.Sprintf("%s/suppliers/%s/products?page=%d&size=50", baseURL, c.sellerID, page)

	body, err := c.doRequest(ctx, "GET", url)
	if err != nil {
		return nil, err
	}

	var resp trendyolProductsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	products := make([]marketplace.Product, 0, len(resp.Content))
	for _, tp := range resp.Content {
		products = append(products, marketplace.Product{
			PlatformProductID: fmt.Sprintf("%d", tp.ID),
			SKU:               tp.StockCode,
			Barcode:           tp.Barcode,
			Name:              tp.Title,
			Brand:             tp.Brand,
			Category:          tp.CategoryName,
			Price:             tp.SalePrice,
			Stock:             tp.Quantity,
			ImageURL:          tp.ImageURL,
		})
	}

	return &marketplace.ProductsResponse{
		Products:   products,
		TotalCount: resp.TotalElements,
		Page:       resp.Page,
		HasMore:    resp.Page < resp.TotalPages-1,
	}, nil
}

func (c *Client) GetOrderDetail(ctx context.Context, orderID string) (*marketplace.OrderDetail, error) {
	url := fmt.Sprintf("%s/suppliers/%s/orders?orderNumber=%s", baseURL, c.sellerID, orderID)

	body, err := c.doRequest(ctx, "GET", url)
	if err != nil {
		return nil, err
	}

	var resp trendyolOrdersResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(resp.Content) == 0 {
		return nil, fmt.Errorf("order not found")
	}

	to := resp.Content[0]
	order := marketplace.Order{
		PlatformOrderID: fmt.Sprintf("%d", to.OrderNumber),
		Status:          mapStatus(to.Status),
		CustomerName:    to.ShipmentAddress.FullName,
		City:            to.ShipmentAddress.City,
		Currency:        "TRY",
		TotalAmount:     to.TotalPrice,
		OrderDate:       time.UnixMilli(to.OrderDate),
	}

	for _, line := range to.Lines {
		order.Items = append(order.Items, marketplace.OrderItem{
			ProductID:   fmt.Sprintf("%d", line.ProductContentID),
			SKU:         line.MerchantSku,
			Barcode:     line.Barcode,
			ProductName: line.ProductName,
			Quantity:    line.Quantity,
			UnitPrice:   line.Price,
			TotalPrice:  line.Price * float64(line.Quantity),
		})
	}

	return &marketplace.OrderDetail{Order: order}, nil
}

func (c *Client) doRequest(ctx context.Context, method, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.apiKey, c.apiSecret)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("%s - SelfIntegration", c.sellerID))

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

func mapStatus(status string) string {
	switch status {
	case "Created":
		return "pending"
	case "Picking":
		return "processing"
	case "Shipped":
		return "shipped"
	case "Delivered":
		return "delivered"
	case "Cancelled":
		return "cancelled"
	case "UnDelivered":
		return "returned"
	default:
		return "unknown"
	}
}

func getCommissionRate(category string) float64 {
	// Trendyol commission rates vary by category (approximate)
	return 0.15 // default 15%, should be configurable
}

// Trendyol API response types
type trendyolOrdersResponse struct {
	Page          int              `json:"page"`
	Size          int              `json:"size"`
	TotalPages    int              `json:"totalPages"`
	TotalElements int              `json:"totalElements"`
	Content       []trendyolOrder  `json:"content"`
}

type trendyolOrder struct {
	OrderNumber     int64                `json:"orderNumber"`
	Status          string               `json:"status"`
	OrderDate       int64                `json:"orderDate"`
	TotalPrice      float64              `json:"totalPrice"`
	Lines           []trendyolOrderLine  `json:"lines"`
	ShipmentAddress trendyolAddress      `json:"shipmentAddress"`
}

type trendyolOrderLine struct {
	ProductContentID int64   `json:"productContentId"`
	MerchantSku      string  `json:"merchantSku"`
	Barcode          string  `json:"barcode"`
	ProductName      string  `json:"productName"`
	ProductCategory  string  `json:"productCategory"`
	Quantity         int     `json:"quantity"`
	Price            float64 `json:"price"`
}

type trendyolAddress struct {
	FullName string `json:"fullName"`
	City     string `json:"city"`
}

type trendyolProductsResponse struct {
	Page          int                `json:"page"`
	Size          int                `json:"size"`
	TotalPages    int                `json:"totalPages"`
	TotalElements int                `json:"totalElements"`
	Content       []trendyolProduct  `json:"content"`
}

type trendyolProduct struct {
	ID           int64   `json:"id"`
	Title        string  `json:"title"`
	StockCode    string  `json:"stockCode"`
	Barcode      string  `json:"barcode"`
	Brand        string  `json:"brand"`
	CategoryName string  `json:"categoryName"`
	SalePrice    float64 `json:"salePrice"`
	Quantity     int     `json:"quantity"`
	ImageURL     string  `json:"imageUrl"`
}
