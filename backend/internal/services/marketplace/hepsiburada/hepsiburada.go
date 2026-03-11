package hepsiburada

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/services/marketplace"
)

const baseURL = "https://mpop-sit.hepsiburada.com"

type Client struct {
	apiKey    string
	merchantID string
	http      *http.Client
}

func NewClient(apiKey, merchantID string) *Client {
	return &Client{
		apiKey:     apiKey,
		merchantID: merchantID,
		http:       &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) GetPlatformName() string {
	return "hepsiburada"
}

func (c *Client) TestConnection(ctx context.Context) error {
	url := fmt.Sprintf("%s/orders/merchantid/%s?limit=1", baseURL, c.merchantID)
	_, err := c.doRequest(ctx, "GET", url)
	return err
}

func (c *Client) GetOrders(ctx context.Context, startDate, endDate time.Time, page int) (*marketplace.OrdersResponse, error) {
	offset := page * 50
	url := fmt.Sprintf("%s/orders/merchantid/%s?beginDate=%s&endDate=%s&offset=%d&limit=50",
		baseURL, c.merchantID,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		offset,
	)

	body, err := c.doRequest(ctx, "GET", url)
	if err != nil {
		return nil, err
	}

	var resp hbOrdersResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	orders := make([]marketplace.Order, 0)
	// Group line items by order number
	orderMap := make(map[string]*marketplace.Order)

	for _, item := range resp.Items {
		o, exists := orderMap[item.OrderNumber]
		if !exists {
			orderDate, _ := time.Parse("2006-01-02T15:04:05", item.OrderDate)
			o = &marketplace.Order{
				PlatformOrderID: item.OrderNumber,
				Status:          mapHBStatus(item.Status),
				CustomerName:    item.CustomerName,
				City:            item.City,
				Currency:        "TRY",
				OrderDate:       orderDate,
			}
			orderMap[item.OrderNumber] = o
		}

		lineItem := marketplace.OrderItem{
			ProductID:   item.HepsiburadaSku,
			SKU:         item.MerchantSku,
			Barcode:     item.Barcode,
			ProductName: item.ProductName,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice,
			TotalPrice:  item.UnitPrice * float64(item.Quantity),
			Commission:  item.CommissionAmount,
		}
		o.Items = append(o.Items, lineItem)
		o.TotalAmount += lineItem.TotalPrice
		o.SubtotalAmount += lineItem.TotalPrice
		o.CommissionAmount += lineItem.Commission
	}

	for _, o := range orderMap {
		orders = append(orders, *o)
	}

	return &marketplace.OrdersResponse{
		Orders:     orders,
		TotalCount: resp.TotalCount,
		Page:       page,
		HasMore:    offset+50 < resp.TotalCount,
	}, nil
}

func (c *Client) GetProducts(ctx context.Context, page int) (*marketplace.ProductsResponse, error) {
	offset := page * 50
	url := fmt.Sprintf("%s/listings/merchantid/%s?offset=%d&limit=50",
		baseURL, c.merchantID, offset)

	body, err := c.doRequest(ctx, "GET", url)
	if err != nil {
		return nil, err
	}

	var resp hbProductsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	products := make([]marketplace.Product, 0, len(resp.Listings))
	for _, l := range resp.Listings {
		products = append(products, marketplace.Product{
			PlatformProductID: l.HepsiburadaSku,
			SKU:               l.MerchantSku,
			Barcode:           l.Barcode,
			Name:              l.ProductName,
			Price:             l.Price,
			Stock:             l.AvailableStock,
		})
	}

	return &marketplace.ProductsResponse{
		Products:   products,
		TotalCount: resp.TotalCount,
		Page:       page,
		HasMore:    offset+50 < resp.TotalCount,
	}, nil
}

func (c *Client) GetOrderDetail(ctx context.Context, orderID string) (*marketplace.OrderDetail, error) {
	url := fmt.Sprintf("%s/orders/merchantid/%s?orderNumber=%s", baseURL, c.merchantID, orderID)
	body, err := c.doRequest(ctx, "GET", url)
	if err != nil {
		return nil, err
	}

	var resp hbOrdersResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if len(resp.Items) == 0 {
		return nil, fmt.Errorf("order not found")
	}

	item := resp.Items[0]
	orderDate, _ := time.Parse("2006-01-02T15:04:05", item.OrderDate)
	order := marketplace.Order{
		PlatformOrderID: item.OrderNumber,
		Status:          mapHBStatus(item.Status),
		CustomerName:    item.CustomerName,
		City:            item.City,
		Currency:        "TRY",
		TotalAmount:     item.UnitPrice * float64(item.Quantity),
		OrderDate:       orderDate,
	}

	for _, it := range resp.Items {
		order.Items = append(order.Items, marketplace.OrderItem{
			ProductID:   it.HepsiburadaSku,
			SKU:         it.MerchantSku,
			ProductName: it.ProductName,
			Quantity:    it.Quantity,
			UnitPrice:   it.UnitPrice,
			TotalPrice:  it.UnitPrice * float64(it.Quantity),
			Commission:  it.CommissionAmount,
		})
	}

	return &marketplace.OrderDetail{Order: order}, nil
}

func (c *Client) doRequest(ctx context.Context, method, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Basic "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

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

func mapHBStatus(status string) string {
	switch status {
	case "Open":
		return "pending"
	case "Shipped":
		return "shipped"
	case "Delivered":
		return "delivered"
	case "Cancelled":
		return "cancelled"
	default:
		return "unknown"
	}
}

// Hepsiburada API types
type hbOrdersResponse struct {
	Items      []hbOrderItem `json:"items"`
	TotalCount int           `json:"totalCount"`
}

type hbOrderItem struct {
	OrderNumber      string  `json:"orderNumber"`
	Status           string  `json:"status"`
	OrderDate        string  `json:"orderDate"`
	CustomerName     string  `json:"customerName"`
	City             string  `json:"city"`
	HepsiburadaSku   string  `json:"hepsiburadaSku"`
	MerchantSku      string  `json:"merchantSku"`
	Barcode          string  `json:"barcode"`
	ProductName      string  `json:"productName"`
	Quantity         int     `json:"quantity"`
	UnitPrice        float64 `json:"unitPrice"`
	CommissionAmount float64 `json:"commissionAmount"`
}

type hbProductsResponse struct {
	Listings   []hbListing `json:"listings"`
	TotalCount int         `json:"totalCount"`
}

type hbListing struct {
	HepsiburadaSku string  `json:"hepsiburadaSku"`
	MerchantSku    string  `json:"merchantSku"`
	Barcode        string  `json:"barcode"`
	ProductName    string  `json:"productName"`
	Price          float64 `json:"price"`
	AvailableStock int     `json:"availableStock"`
}
