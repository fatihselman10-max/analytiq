package handlers

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/analytiq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type OrdersHandler struct {
	db *database.DB
}

func NewOrdersHandler(db *database.DB) *OrdersHandler {
	return &OrdersHandler{db: db}
}

type OrderDetail struct {
	ID               int64       `json:"id"`
	Platform         string      `json:"platform"`
	PlatformOrderID  string      `json:"platform_order_id"`
	Status           string      `json:"status"`
	CustomerName     string      `json:"customer_name"`
	CustomerEmail    string      `json:"customer_email"`
	City             string      `json:"city"`
	Currency         string      `json:"currency"`
	TotalAmount      float64     `json:"total_amount"`
	SubtotalAmount   float64     `json:"subtotal_amount"`
	ShippingAmount   float64     `json:"shipping_amount"`
	DiscountAmount   float64     `json:"discount_amount"`
	TaxAmount        float64     `json:"tax_amount"`
	CommissionAmount float64     `json:"commission_amount"`
	NetProfit        float64     `json:"net_profit"`
	OrderDate        string      `json:"order_date"`
	Items            []ItemDetail `json:"items"`
}

type ItemDetail struct {
	ProductName string  `json:"product_name"`
	SKU         string  `json:"sku"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	TotalPrice  float64 `json:"total_price"`
	CostPrice   float64 `json:"cost_price"`
	Commission  float64 `json:"commission"`
}

type OrdersListResponse struct {
	Orders     []OrderSummary `json:"orders"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PerPage    int            `json:"per_page"`
	TotalPages int            `json:"total_pages"`
}

func (h *OrdersHandler) ListOrders(c *gin.Context) {
	userID := c.GetInt64("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	platform := c.Query("platform")
	status := c.Query("status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Build dynamic query
	query := `SELECT id, platform, platform_order_id, customer_name, total_amount, status, order_date
	          FROM orders WHERE user_id = $1`
	countQuery := `SELECT COUNT(*) FROM orders WHERE user_id = $1`
	args := []interface{}{userID}
	argIdx := 2

	if platform != "" {
		query += ` AND platform = $` + strconv.Itoa(argIdx)
		countQuery += ` AND platform = $` + strconv.Itoa(argIdx)
		args = append(args, platform)
		argIdx++
	}
	if status != "" {
		query += ` AND status = $` + strconv.Itoa(argIdx)
		countQuery += ` AND status = $` + strconv.Itoa(argIdx)
		args = append(args, status)
		argIdx++
	}
	if startDate != "" {
		query += ` AND order_date >= $` + strconv.Itoa(argIdx)
		countQuery += ` AND order_date >= $` + strconv.Itoa(argIdx)
		args = append(args, startDate)
		argIdx++
	}
	if endDate != "" {
		query += ` AND order_date <= $` + strconv.Itoa(argIdx)
		countQuery += ` AND order_date <= $` + strconv.Itoa(argIdx)
		args = append(args, endDate)
		argIdx++
	}
	if search != "" {
		query += ` AND (customer_name ILIKE $` + strconv.Itoa(argIdx) + ` OR platform_order_id ILIKE $` + strconv.Itoa(argIdx) + `)`
		countQuery += ` AND (customer_name ILIKE $` + strconv.Itoa(argIdx) + ` OR platform_order_id ILIKE $` + strconv.Itoa(argIdx) + `)`
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Get total count
	var total int
	_ = h.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)

	// Get orders
	query += ` ORDER BY order_date DESC LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)
	args = append(args, perPage, offset)

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	defer rows.Close()

	var orders []OrderSummary
	for rows.Next() {
		var o OrderSummary
		var orderDate time.Time
		if err := rows.Scan(&o.ID, &o.Platform, &o.PlatformOrderID, &o.CustomerName, &o.TotalAmount, &o.Status, &orderDate); err == nil {
			o.OrderDate = orderDate.Format("2006-01-02 15:04")
			orders = append(orders, o)
		}
	}

	c.JSON(http.StatusOK, OrdersListResponse{
		Orders:     orders,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: int(math.Ceil(float64(total) / float64(perPage))),
	})
}

func (h *OrdersHandler) GetOrder(c *gin.Context) {
	userID := c.GetInt64("user_id")
	orderID, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var o OrderDetail
	var orderDate time.Time
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, platform, platform_order_id, status, customer_name, customer_email,
		        city, currency, total_amount, subtotal_amount, shipping_amount,
		        discount_amount, tax_amount, commission_amount, net_profit, order_date
		 FROM orders WHERE id = $1 AND user_id = $2`,
		orderID, userID,
	).Scan(&o.ID, &o.Platform, &o.PlatformOrderID, &o.Status, &o.CustomerName,
		&o.CustomerEmail, &o.City, &o.Currency, &o.TotalAmount, &o.SubtotalAmount,
		&o.ShippingAmount, &o.DiscountAmount, &o.TaxAmount, &o.CommissionAmount,
		&o.NetProfit, &orderDate)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	o.OrderDate = orderDate.Format("2006-01-02 15:04:05")

	// Get order items
	rows, err := h.db.Pool.Query(ctx,
		`SELECT product_name, sku, quantity, unit_price, total_price, cost_price, commission
		 FROM order_items WHERE order_id = $1`, orderID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var item ItemDetail
			if err := rows.Scan(&item.ProductName, &item.SKU, &item.Quantity,
				&item.UnitPrice, &item.TotalPrice, &item.CostPrice, &item.Commission); err == nil {
				o.Items = append(o.Items, item)
			}
		}
	}

	c.JSON(http.StatusOK, o)
}
