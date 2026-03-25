package bot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

type OplogClient struct {
	baseURL  string
	tenantID string
	token    string
}

func NewOplogClient() *OplogClient {
	return &OplogClient{
		baseURL:  "https://api.oplog.one/openapi/v1",
		tenantID: os.Getenv("OPLOG_TENANT_ID"),
		token:    os.Getenv("OPLOG_TOKEN"),
	}
}

func (o *OplogClient) IsConfigured() bool {
	return o.tenantID != "" && o.token != ""
}

type OplogOrder struct {
	ReferenceNumber string          `json:"referenceNumber"`
	State           string          `json:"state"`
	OrderCreatedAt  string          `json:"orderCreatedAt"`
	ShippedAt       string          `json:"shippedAt"`
	DeliveredAt     string          `json:"deliveredAt"`
	Customer        OplogCustomer   `json:"customer"`
	ShippingAddress OplogAddress    `json:"shippingAddress"`
	ShippingInfo    OplogShipping   `json:"shippingInfo"`
	LineItems       []OplogLineItem `json:"lineItems"`
	Payment         OplogPayment    `json:"payment"`
}

type OplogCustomer struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
}

type OplogAddress struct {
	City    string `json:"city"`
	Country string `json:"country"`
}

type OplogShipping struct {
	ShippingCompany    string `json:"shippingCompany"`
	ShippingTrackingId string `json:"shippingTrackingId"`
	ShippingState      string `json:"shippingState"`
	TrackingUrl        string `json:"trackingUrl"`
}

type OplogLineItem struct {
	SKU         string  `json:"sku"`
	ProductName string  `json:"productName"`
	Amount      int     `json:"amountInOrder"`
	Price       float64 `json:"price"`
}

type OplogPayment struct {
	TotalPaymentAmount float64 `json:"totalPaymentAmount"`
	Currency           string  `json:"currency"`
}

// ExtractOrderNumbers finds 4-6 digit numbers in a message that could be order numbers.
// Catches all formats: #8494, sipariş 8494, 8494 numaralı, just "8494" near order-related words, etc.
func ExtractOrderNumbers(message string) []string {
	// Simple approach: find all 4-6 digit numbers in the message
	digitPattern := regexp.MustCompile(`\b(\d{4,6})\b`)
	matches := digitPattern.FindAllStringSubmatch(message, 5)

	seen := map[string]bool{}
	var results []string
	for _, m := range matches {
		if len(m) > 1 && !seen[m[1]] {
			seen[m[1]] = true
			results = append(results, m[1])
		}
	}
	return results
}

// LookupOrder fetches a single order from Oplog API by reference number.
func (o *OplogClient) LookupOrder(ctx context.Context, refNo string) (*OplogOrder, error) {
	url := fmt.Sprintf("%s/SalesOrders/%s", o.baseURL, refNo)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Tenant-Id", o.tenantID)
	req.Header.Set("Authorization", o.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, nil // order not found
	}
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("oplog API error %d: %s", resp.StatusCode, string(body))
	}

	var order OplogOrder
	if err := json.NewDecoder(resp.Body).Decode(&order); err != nil {
		return nil, err
	}
	return &order, nil
}

// FormatOrderContext builds a Turkish summary of the order for the AI prompt.
func FormatOrderContext(order *OplogOrder) string {
	stateMap := map[string]string{
		"Created":              "Oluşturuldu",
		"Approved":             "Onaylandı",
		"Picking":              "Hazırlanıyor",
		"Picked":               "Toplandı",
		"Packing":              "Paketleniyor",
		"Packed":               "Paketlendi",
		"ReadyToShip":          "Kargoya Hazır",
		"Shipped":              "Kargoya Verildi",
		"Delivered":            "Teslim Edildi",
		"Cancelled":            "İptal Edildi",
		"ReturnStarted":        "İade Başlatıldı",
		"Returned":             "İade Edildi",
	}

	durum := order.State
	if tr, ok := stateMap[order.State]; ok {
		durum = tr
	}

	summary := fmt.Sprintf("SİPARİŞ BİLGİSİ (#%s):\n", order.ReferenceNumber)
	summary += fmt.Sprintf("- Durum: %s\n", durum)
	summary += fmt.Sprintf("- Müşteri: %s %s\n", order.Customer.FirstName, order.Customer.LastName)

	if order.OrderCreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, order.OrderCreatedAt); err == nil {
			daysSince := int(time.Since(t).Hours() / 24)
			summary += fmt.Sprintf("- Sipariş Tarihi: %s (%d gün önce)\n", t.Format("02.01.2006"), daysSince)
		}
	}

	// Products + pre-order detection
	// All main products are pre-order (kimono, pantolon, atlet, t-shirt)
	preOrderKeywords := []string{"KİMONO", "KIMONO", "PANTOLON", "ATLET", "T-SHIRT", "TSHIRT", "TİŞÖRT", "TISORT"}
	hasPreOrder := false
	if len(order.LineItems) > 0 {
		summary += "- Ürünler: "
		for i, item := range order.LineItems {
			if i > 0 {
				summary += ", "
			}
			summary += fmt.Sprintf("%s (x%d)", item.ProductName, item.Amount)
			nameUpper := strings.ToUpper(item.ProductName)
			for _, kw := range preOrderKeywords {
				if strings.Contains(nameUpper, kw) {
					hasPreOrder = true
					break
				}
			}
		}
		summary += "\n"
	}
	if hasPreOrder && order.State != "Shipped" && order.State != "Delivered" {
		var daysSinceOrder int
		if order.OrderCreatedAt != "" {
			if t, err := time.Parse(time.RFC3339, order.OrderCreatedAt); err == nil {
				daysSinceOrder = int(time.Since(t).Hours() / 24)
			}
		}
		if daysSinceOrder > 21 {
			summary += fmt.Sprintf("- UYARI: Bu PRE-ORDER sipariş %d gündür bekliyor, 21 günü aştı! Müşteriyi hemen müşteri hizmetlerine yönlendir.\n", daysSinceOrder)
		} else {
			summary += fmt.Sprintf("- NOT: Bu sipariş PRE-ORDER ürün içeriyor. Teslimat süresi 14-21 gündür. Sipariş %d gündür işlemde, süre normal.\n", daysSinceOrder)
		}
	}

	if order.Payment.TotalPaymentAmount > 0 {
		summary += fmt.Sprintf("- Toplam Tutar: %.2f %s\n", order.Payment.TotalPaymentAmount, order.Payment.Currency)
	}

	// Shipping
	if order.ShippingInfo.ShippingCompany != "" {
		summary += fmt.Sprintf("- Kargo Firması: %s\n", order.ShippingInfo.ShippingCompany)
	}
	if order.ShippingInfo.ShippingTrackingId != "" {
		summary += fmt.Sprintf("- Kargo Takip No: %s\n", order.ShippingInfo.ShippingTrackingId)
	}
	if order.ShippingInfo.ShippingState != "" {
		summary += fmt.Sprintf("- Kargo Durumu: %s\n", order.ShippingInfo.ShippingState)
	}
	if order.ShippingInfo.TrackingUrl != "" {
		summary += fmt.Sprintf("- Takip Linki: %s\n", order.ShippingInfo.TrackingUrl)
	}

	if order.ShippedAt != "" {
		if t, err := time.Parse(time.RFC3339, order.ShippedAt); err == nil {
			summary += fmt.Sprintf("- Kargoya Verilme: %s\n", t.Format("02.01.2006"))
		}
	}
	if order.DeliveredAt != "" {
		if t, err := time.Parse(time.RFC3339, order.DeliveredAt); err == nil {
			summary += fmt.Sprintf("- Teslim Tarihi: %s\n", t.Format("02.01.2006"))
		}
	}

	if order.ShippingAddress.City != "" {
		summary += fmt.Sprintf("- Teslimat Şehri: %s\n", order.ShippingAddress.City)
	}

	return summary
}
