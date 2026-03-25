package bot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type ShopifyClient struct {
	storeDomain string
	accessToken string
	httpClient  *http.Client
}

func NewShopifyClient() *ShopifyClient {
	return &ShopifyClient{
		storeDomain: os.Getenv("SHOPIFY_STORE_DOMAIN"),
		accessToken: os.Getenv("SHOPIFY_ACCESS_TOKEN"),
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *ShopifyClient) IsConfigured() bool {
	return s.storeDomain != "" && s.accessToken != ""
}

// ShopifyOrder represents a Shopify order from Admin API
type ShopifyOrder struct {
	ID                 int64              `json:"id"`
	OrderNumber        int                `json:"order_number"`
	Name               string             `json:"name"` // e.g. "#8715"
	Email              string             `json:"email"`
	Phone              string             `json:"phone"`
	CreatedAt          string             `json:"created_at"`
	FinancialStatus    string             `json:"financial_status"`
	FulfillmentStatus  string             `json:"fulfillment_status"`
	TotalPrice         string             `json:"total_price"`
	Currency           string             `json:"currency"`
	Note               string             `json:"note"`
	Customer           ShopifyCustomer    `json:"customer"`
	LineItems          []ShopifyLineItem  `json:"line_items"`
	ShippingAddress    *ShopifyAddress    `json:"shipping_address"`
	Fulfillments       []ShopifyFulfillment `json:"fulfillments"`
	CancelledAt        string             `json:"cancelled_at"`
	Tags               string             `json:"tags"`
}

type ShopifyCustomer struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
}

type ShopifyLineItem struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	Quantity    int     `json:"quantity"`
	Price       string  `json:"price"`
	SKU         string  `json:"sku"`
	VariantTitle string `json:"variant_title"`
	ProductID   int64   `json:"product_id"`
}

type ShopifyAddress struct {
	City     string `json:"city"`
	Province string `json:"province"`
	Country  string `json:"country"`
	Address1 string `json:"address1"`
}

type ShopifyFulfillment struct {
	ID              int64  `json:"id"`
	Status          string `json:"status"`
	TrackingNumber  string `json:"tracking_number"`
	TrackingCompany string `json:"tracking_company"`
	TrackingURL     string `json:"tracking_url"`
	CreatedAt       string `json:"created_at"`
}

type ShopifyProduct struct {
	ID          int64             `json:"id"`
	Title       string            `json:"title"`
	BodyHTML    string            `json:"body_html"`
	Vendor      string            `json:"vendor"`
	ProductType string            `json:"product_type"`
	Status      string            `json:"status"`
	Tags        string            `json:"tags"`
	Variants    []ShopifyVariant  `json:"variants"`
}

type ShopifyVariant struct {
	ID                int64  `json:"id"`
	Title             string `json:"title"`
	Price             string `json:"price"`
	CompareAtPrice    string `json:"compare_at_price"`
	SKU               string `json:"sku"`
	InventoryQuantity int    `json:"inventory_quantity"`
	Option1           string `json:"option1"`
	Option2           string `json:"option2"`
}

func (s *ShopifyClient) apiGet(ctx context.Context, endpoint string) ([]byte, error) {
	url := fmt.Sprintf("https://%s/admin/api/2024-01%s", s.storeDomain, endpoint)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Shopify-Access-Token", s.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("shopify API error %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}

// LookupOrderByNumber searches for a Shopify order by order number (e.g. "8715")
func (s *ShopifyClient) LookupOrderByNumber(ctx context.Context, orderNumber string) (*ShopifyOrder, error) {
	body, err := s.apiGet(ctx, fmt.Sprintf("/orders.json?name=%s&status=any&limit=1", orderNumber))
	if err != nil {
		return nil, err
	}

	var result struct {
		Orders []ShopifyOrder `json:"orders"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if len(result.Orders) == 0 {
		return nil, nil
	}
	return &result.Orders[0], nil
}

// LookupOrdersByEmail searches Shopify orders by customer email
func (s *ShopifyClient) LookupOrdersByEmail(ctx context.Context, email string) ([]ShopifyOrder, error) {
	body, err := s.apiGet(ctx, fmt.Sprintf("/orders.json?email=%s&status=any&limit=5", email))
	if err != nil {
		return nil, err
	}

	var result struct {
		Orders []ShopifyOrder `json:"orders"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result.Orders, nil
}

// SearchProducts searches Shopify products by title keyword
func (s *ShopifyClient) SearchProducts(ctx context.Context, query string) ([]ShopifyProduct, error) {
	body, err := s.apiGet(ctx, fmt.Sprintf("/products.json?title=%s&limit=5&status=active", query))
	if err != nil {
		return nil, err
	}

	var result struct {
		Products []ShopifyProduct `json:"products"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result.Products, nil
}

// FormatShopifyOrderContext builds a Turkish summary of the Shopify order for the AI prompt.
func FormatShopifyOrderContext(order *ShopifyOrder) string {
	summary := fmt.Sprintf("SHOPIFY SİPARİŞ BİLGİSİ (%s):\n", order.Name)

	// Financial status
	financialMap := map[string]string{
		"paid":               "Ödendi",
		"pending":            "Ödeme Bekliyor",
		"refunded":           "İade Edildi",
		"partially_refunded": "Kısmi İade",
		"voided":             "İptal Edildi",
	}
	financial := order.FinancialStatus
	if tr, ok := financialMap[order.FinancialStatus]; ok {
		financial = tr
	}
	summary += fmt.Sprintf("- Ödeme Durumu: %s\n", financial)

	// Fulfillment status
	fulfillmentMap := map[string]string{
		"fulfilled": "Kargolandı",
		"partial":   "Kısmen Kargolandı",
		"":          "Hazırlanıyor",
	}
	fulfillment := order.FulfillmentStatus
	if tr, ok := fulfillmentMap[order.FulfillmentStatus]; ok {
		fulfillment = tr
	}
	summary += fmt.Sprintf("- Kargo Durumu: %s\n", fulfillment)

	// Customer
	summary += fmt.Sprintf("- Müşteri: %s %s\n", order.Customer.FirstName, order.Customer.LastName)

	// Order date + days since
	if order.CreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, order.CreatedAt); err == nil {
			daysSince := int(time.Since(t).Hours() / 24)
			summary += fmt.Sprintf("- Sipariş Tarihi: %s (%d gün önce)\n", t.Format("02.01.2006"), daysSince)
		}
	}

	// Line items + pre-order detection
	hasPreOrder := false
	if len(order.LineItems) > 0 {
		summary += "- Ürünler: "
		for i, item := range order.LineItems {
			if i > 0 {
				summary += ", "
			}
			label := item.Title
			if item.VariantTitle != "" && item.VariantTitle != "Default Title" {
				label += " (" + item.VariantTitle + ")"
			}
			summary += fmt.Sprintf("%s x%d", label, item.Quantity)
		}
		summary += "\n"

		// Pre-order detection: check tags or if product is in Stoq preorder system
		// Most LessandRomance products are preorder, so check fulfillment
		if order.FulfillmentStatus == "" || order.FulfillmentStatus == "null" {
			hasPreOrder = true
		}
	}

	// Tags can indicate preorder
	if strings.Contains(strings.ToLower(order.Tags), "pre-order") || strings.Contains(strings.ToLower(order.Tags), "preorder") {
		hasPreOrder = true
	}

	// Pre-order context
	if hasPreOrder && order.FulfillmentStatus != "fulfilled" && order.CancelledAt == "" {
		var daysSinceOrder int
		if order.CreatedAt != "" {
			if t, err := time.Parse(time.RFC3339, order.CreatedAt); err == nil {
				daysSinceOrder = int(time.Since(t).Hours() / 24)
			}
		}
		if daysSinceOrder > 21 {
			summary += fmt.Sprintf("- UYARI: Bu sipariş %d gündür bekliyor, 21 günlük pre-order süresini aştı! Müşteriyi bilgilendir ve temsilciye yönlendir.\n", daysSinceOrder)
		} else if daysSinceOrder > 14 {
			summary += fmt.Sprintf("- NOT: Bu PRE-ORDER sipariş %d gündür işlemde. 14-21 gün arası teslimat süresi içinde, müşteriyi bilgilendir.\n", daysSinceOrder)
		} else {
			summary += fmt.Sprintf("- NOT: Bu PRE-ORDER sipariş %d gündür işlemde. Teslimat süresi 14-21 iş günüdür, süreç normal.\n", daysSinceOrder)
		}
	}

	// Total price
	summary += fmt.Sprintf("- Toplam Tutar: %s %s\n", order.TotalPrice, order.Currency)

	// Fulfillment / tracking info
	for _, f := range order.Fulfillments {
		if f.TrackingCompany != "" {
			summary += fmt.Sprintf("- Kargo Firması: %s\n", f.TrackingCompany)
		}
		if f.TrackingNumber != "" {
			summary += fmt.Sprintf("- Kargo Takip No: %s\n", f.TrackingNumber)
		}
		if f.TrackingURL != "" {
			summary += fmt.Sprintf("- Takip Linki: %s\n", f.TrackingURL)
		}
		if f.CreatedAt != "" {
			if t, err := time.Parse(time.RFC3339, f.CreatedAt); err == nil {
				summary += fmt.Sprintf("- Kargoya Verilme: %s\n", t.Format("02.01.2006"))
			}
		}
	}

	// Shipping address
	if order.ShippingAddress != nil && order.ShippingAddress.City != "" {
		summary += fmt.Sprintf("- Teslimat Şehri: %s\n", order.ShippingAddress.City)
	}

	// Cancelled
	if order.CancelledAt != "" {
		summary += "- DURUM: Bu sipariş İPTAL EDİLMİŞ.\n"
	}

	return summary
}

// FormatShopifyProductContext builds product info for the AI prompt.
func FormatShopifyProductContext(products []ShopifyProduct) string {
	if len(products) == 0 {
		return ""
	}

	summary := "ÜRÜN BİLGİLERİ (Shopify):\n"
	for _, p := range products {
		summary += fmt.Sprintf("\n%s:\n", p.Title)
		if len(p.Variants) > 0 {
			summary += fmt.Sprintf("- Fiyat: %s TL\n", p.Variants[0].Price)
			if p.Variants[0].CompareAtPrice != "" {
				summary += fmt.Sprintf("- Eski Fiyat: %s TL\n", p.Variants[0].CompareAtPrice)
			}

			// Collect available sizes
			var sizes []string
			for _, v := range p.Variants {
				label := v.Option1
				if v.Option2 != "" {
					label += "/" + v.Option2
				}
				sizes = append(sizes, label)
			}
			if len(sizes) > 0 {
				summary += fmt.Sprintf("- Bedenler: %s\n", strings.Join(sizes, ", "))
			}
		}
		// All products are preorder via Stoq
		summary += "- Stok: Pre-order (Stoq) - Sipariş verilebilir, teslimat 14-21 iş günü\n"

		if p.Tags != "" {
			summary += fmt.Sprintf("- Etiketler: %s\n", p.Tags)
		}
	}
	return summary
}

// ExtractProductQuery detects product-related questions in a Turkish message.
func ExtractProductQuery(message string) string {
	msg := strings.ToLower(message)

	productKeywords := []string{
		"ürün", "urun", "fiyat", "beden", "renk", "stok", "stoq",
		"kimono", "pantolon", "atlet", "elbise", "t-shirt", "tişört",
		"boxer", "bandana", "şort", "sort",
		"ne zaman gelir", "teslimat", "pre-order", "preorder", "ön sipariş",
		"kaç gün", "kac gun", "ne kadar sürer",
	}

	hasProductQuestion := false
	for _, kw := range productKeywords {
		if strings.Contains(msg, kw) {
			hasProductQuestion = true
			break
		}
	}

	if !hasProductQuestion {
		return ""
	}

	// Try to extract the specific product name from the message
	// Look for known product types
	knownProducts := map[string]string{
		"kimono":   "kimono",
		"pantolon": "pantolon",
		"atlet":    "atlet",
		"elbise":   "elbise",
		"t-shirt":  "t-shirt",
		"tişört":   "t-shirt",
		"tisort":   "t-shirt",
		"boxer":    "boxer",
		"bandana":  "bandana",
		"şort":     "boxer short",
		"sort":     "boxer short",
	}

	for keyword, query := range knownProducts {
		if strings.Contains(msg, keyword) {
			return query
		}
	}

	// Generic product question without specific product
	return ""
}

// CombineOrderContext merges Oplog and Shopify order data into a unified context.
func CombineOrderContext(oplogOrder *OplogOrder, shopifyOrder *ShopifyOrder) string {
	var parts []string

	if shopifyOrder != nil {
		parts = append(parts, FormatShopifyOrderContext(shopifyOrder))
	}

	if oplogOrder != nil {
		parts = append(parts, FormatOrderContext(oplogOrder))
	}

	if len(parts) == 0 {
		return ""
	}

	if len(parts) == 2 {
		// Both sources have data - add a combined analysis hint
		combined := strings.Join(parts, "\n")
		combined += "\nANALİZ NOTU: Yukarıda hem Shopify (sipariş detayları, ürün bilgisi) hem Oplog (depo/kargo durumu) verileri var. "
		combined += "Shopify siparişin ödeme ve ürün detaylarını, Oplog ise depo ve kargo sürecini gösterir. "
		combined += "İkisini birlikte değerlendirerek müşteriye en doğru bilgiyi ver. "
		combined += "Eğer Shopify'da sipariş var ama Oplog'da yoksa, sipariş henüz depoya iletilmemiş demektir."
		return combined
	}

	return parts[0]
}

func init() {
	log.Println("[Shopify] Client module loaded")
}
