package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/repliq/backend/internal/services/journey"
)

type ShopifyWebhookHandler struct {
	journey       *journey.Service
	webhookSecret string
	defaultOrgID  int64
}

func NewShopifyWebhookHandler(js *journey.Service) *ShopifyWebhookHandler {
	orgID := int64(1)
	if v := os.Getenv("SHOPIFY_WEBHOOK_ORG_ID"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			orgID = n
		}
	}
	return &ShopifyWebhookHandler{
		journey:       js,
		webhookSecret: os.Getenv("SHOPIFY_WEBHOOK_SECRET"),
		defaultOrgID:  orgID,
	}
}

func (h *ShopifyWebhookHandler) verifyHMAC(body []byte, headerHMAC string) bool {
	if h.webhookSecret == "" || headerHMAC == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.webhookSecret))
	mac.Write(body)
	computed := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(computed), []byte(headerHMAC))
}

func (h *ShopifyWebhookHandler) Handle(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body failed"})
		return
	}

	hmacHeader := c.GetHeader("X-Shopify-Hmac-Sha256")
	topic := c.GetHeader("X-Shopify-Topic")
	shopDomain := c.GetHeader("X-Shopify-Shop-Domain")

	if !h.verifyHMAC(body, hmacHeader) {
		log.Printf("[SHOPIFY-WEBHOOK] HMAC failed topic=%s shop=%s", topic, shopDomain)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "bad HMAC"})
		return
	}

	// Ack fast; process async so Shopify doesn't retry on slow DB.
	go h.process(topic, shopDomain, body)
	c.Status(http.StatusOK)
}

func (h *ShopifyWebhookHandler) process(topic, shopDomain string, body []byte) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Printf("[SHOPIFY-WEBHOOK] bad payload topic=%s: %v", topic, err)
		return
	}

	email := firstNonEmpty(
		getStr(payload, "email"),
		getStr(payload, "contact_email"),
		getNestedStr(payload, "customer", "email"),
	)
	name := buildName(payload)
	phone := firstNonEmpty(getStr(payload, "phone"), getNestedStr(payload, "customer", "phone"))

	if email == "" {
		// Without email we can't attach to a contact yet. Skip (MVP).
		log.Printf("[SHOPIFY-WEBHOOK] skip topic=%s reason=no_email", topic)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	contactID, err := h.journey.FindOrCreateContactByEmail(ctx, h.defaultOrgID, email, name, phone)
	if err != nil {
		log.Printf("[SHOPIFY-WEBHOOK] upsert contact failed: %v", err)
		return
	}

	ev, ok := mapTopic(topic, payload)
	if !ok {
		return
	}

	ev.OrgID = h.defaultOrgID
	ev.ContactID = contactID
	ev.Source = "shopify"
	// Stash the shop domain in metadata for traceability
	if ev.Metadata == nil {
		ev.Metadata = map[string]interface{}{}
	}
	ev.Metadata["shop_domain"] = shopDomain
	ev.Metadata["topic"] = topic

	if _, err := h.journey.Insert(ctx, ev); err != nil {
		log.Printf("[SHOPIFY-WEBHOOK] insert event failed topic=%s: %v", topic, err)
		return
	}
	log.Printf("[SHOPIFY-WEBHOOK] topic=%s contact=%d event=%s", topic, contactID, ev.EventType)
}

func mapTopic(topic string, p map[string]interface{}) (journey.InsertParams, bool) {
	amt := parsePriceCents(p, "total_price")
	currency := getStr(p, "currency")
	orderName := getStr(p, "name")
	itemCount := countLineItems(p)
	extID := coerceID(p)

	switch topic {
	case "carts/create", "carts/update":
		title := fmt.Sprintf("Sepet güncellendi — %d ürün, %s", itemCount, formatAmount(amt, currency))
		return journey.InsertParams{
			EventType:   "cart_updated",
			Title:       title,
			Metadata:    p,
			AmountCents: amt,
			Currency:    currency,
			ExternalID:  firstNonEmpty(getStr(p, "token"), extID),
		}, true

	case "checkouts/create":
		title := fmt.Sprintf("Checkout başladı — %s", formatAmount(amt, currency))
		return journey.InsertParams{
			EventType:   "checkout_started",
			Title:       title,
			Metadata:    p,
			AmountCents: amt,
			Currency:    currency,
			ExternalID:  firstNonEmpty(getStr(p, "token"), extID),
		}, true

	case "checkouts/update":
		// If completed, skip — orders/create will fire.
		if getStr(p, "completed_at") != "" {
			return journey.InsertParams{}, false
		}
		title := fmt.Sprintf("Checkout güncellendi — %s", formatAmount(amt, currency))
		return journey.InsertParams{
			EventType:   "checkout_progress",
			Title:       title,
			Metadata:    p,
			AmountCents: amt,
			Currency:    currency,
			ExternalID:  firstNonEmpty(getStr(p, "token"), extID),
		}, true

	case "orders/create":
		title := fmt.Sprintf("Sipariş %s oluşturuldu — %s", orderName, formatAmount(amt, currency))
		return journey.InsertParams{
			EventType:   "order_placed",
			Title:       title,
			Metadata:    p,
			AmountCents: amt,
			Currency:    currency,
			ExternalID:  extID,
		}, true

	case "orders/paid":
		title := fmt.Sprintf("Sipariş %s ödendi — %s", orderName, formatAmount(amt, currency))
		return journey.InsertParams{
			EventType:   "order_paid",
			Title:       title,
			Metadata:    p,
			AmountCents: amt,
			Currency:    currency,
			ExternalID:  extID,
		}, true

	case "orders/fulfilled":
		title := fmt.Sprintf("Sipariş %s kargolandı", orderName)
		return journey.InsertParams{
			EventType:  "order_fulfilled",
			Title:      title,
			Metadata:   p,
			ExternalID: extID,
		}, true

	case "orders/cancelled":
		title := fmt.Sprintf("Sipariş %s iptal edildi", orderName)
		return journey.InsertParams{
			EventType:  "order_cancelled",
			Title:      title,
			Metadata:   p,
			ExternalID: extID,
		}, true

	case "customers/create":
		title := "Shopify hesabı oluşturuldu"
		return journey.InsertParams{
			EventType:  "signup",
			Title:      title,
			Metadata:   p,
			ExternalID: extID,
		}, true
	}

	return journey.InsertParams{}, false
}

// --- helpers ---

func getStr(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return strings.TrimSpace(x)
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(x)
	}
	return ""
}

func getNestedStr(m map[string]interface{}, keys ...string) string {
	cur := m
	for i, k := range keys {
		if cur == nil {
			return ""
		}
		if i == len(keys)-1 {
			return getStr(cur, k)
		}
		next, ok := cur[k].(map[string]interface{})
		if !ok {
			return ""
		}
		cur = next
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func buildName(p map[string]interface{}) string {
	// Try customer.{first_name, last_name}, then shipping_address, then billing_address
	candidates := []map[string]interface{}{
		asMap(p["customer"]),
		asMap(p["shipping_address"]),
		asMap(p["billing_address"]),
		p,
	}
	for _, m := range candidates {
		first := getStr(m, "first_name")
		last := getStr(m, "last_name")
		if first != "" || last != "" {
			return strings.TrimSpace(first + " " + last)
		}
	}
	return ""
}

func asMap(v interface{}) map[string]interface{} {
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	return nil
}

func parsePriceCents(p map[string]interface{}, key string) *int64 {
	s := getStr(p, key)
	if s == "" {
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	cents := int64(f*100 + 0.5)
	return &cents
}

func countLineItems(p map[string]interface{}) int {
	arr, ok := p["line_items"].([]interface{})
	if !ok {
		return 0
	}
	total := 0
	for _, it := range arr {
		m := asMap(it)
		if m == nil {
			continue
		}
		q := getStr(m, "quantity")
		if n, err := strconv.Atoi(q); err == nil {
			total += n
		} else {
			total++
		}
	}
	return total
}

func formatAmount(cents *int64, currency string) string {
	if cents == nil {
		return ""
	}
	amount := float64(*cents) / 100.0
	if currency == "" {
		return fmt.Sprintf("%.2f", amount)
	}
	return fmt.Sprintf("%.2f %s", amount, currency)
}

func coerceID(p map[string]interface{}) string {
	v, ok := p["id"]
	if !ok || v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	}
	return ""
}
