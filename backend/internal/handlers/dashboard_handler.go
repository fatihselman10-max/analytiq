package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	db *database.DB
}

func NewDashboardHandler(db *database.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

type DashboardOverview struct {
	TotalRevenue   float64            `json:"total_revenue"`
	TotalOrders    int                `json:"total_orders"`
	TotalAdSpend   float64            `json:"total_ad_spend"`
	TotalProfit    float64            `json:"total_profit"`
	AOV            float64            `json:"aov"`
	ROAS           float64            `json:"roas"`
	RevenueByDay   []DailyMetric      `json:"revenue_by_day"`
	TopProducts    []ProductMetric    `json:"top_products"`
	PlatformSplit  []PlatformMetric   `json:"platform_split"`
	RecentOrders   []OrderSummary     `json:"recent_orders"`
}

type DailyMetric struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Orders  int     `json:"orders"`
	AdSpend float64 `json:"ad_spend"`
	Profit  float64 `json:"profit"`
}

type ProductMetric struct {
	SKU        string  `json:"sku"`
	Name       string  `json:"name"`
	Revenue    float64 `json:"revenue"`
	Quantity   int     `json:"quantity"`
	Profit     float64 `json:"profit"`
}

type PlatformMetric struct {
	Platform string  `json:"platform"`
	Revenue  float64 `json:"revenue"`
	Orders   int     `json:"orders"`
	Share    float64 `json:"share"` // percentage
}

type OrderSummary struct {
	ID              int64   `json:"id"`
	Platform        string  `json:"platform"`
	PlatformOrderID string  `json:"platform_order_id"`
	CustomerName    string  `json:"customer_name"`
	TotalAmount     float64 `json:"total_amount"`
	Status          string  `json:"status"`
	OrderDate       string  `json:"order_date"`
}

func (h *DashboardHandler) GetOverview(c *gin.Context) {
	userID := c.GetInt64("user_id")
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	overview := DashboardOverview{}

	// Total revenue and orders
	err := h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
		 FROM orders WHERE user_id = $1 AND order_date BETWEEN $2 AND $3 AND status != 'cancelled'`,
		userID, startDate, endDate,
	).Scan(&overview.TotalRevenue, &overview.TotalOrders)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch revenue data"})
		return
	}

	// Total ad spend
	_ = h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(spend), 0) FROM ad_spend
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
		userID, startDate, endDate,
	).Scan(&overview.TotalAdSpend)

	// Calculate derived metrics
	if overview.TotalOrders > 0 {
		overview.AOV = overview.TotalRevenue / float64(overview.TotalOrders)
	}
	if overview.TotalAdSpend > 0 {
		overview.ROAS = overview.TotalRevenue / overview.TotalAdSpend
	}

	// Revenue by day
	rows, err := h.db.Pool.Query(ctx,
		`SELECT order_date::date as d, COALESCE(SUM(total_amount), 0), COUNT(*)
		 FROM orders WHERE user_id = $1 AND order_date BETWEEN $2 AND $3 AND status != 'cancelled'
		 GROUP BY d ORDER BY d`,
		userID, startDate, endDate,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var m DailyMetric
			var d time.Time
			if err := rows.Scan(&d, &m.Revenue, &m.Orders); err == nil {
				m.Date = d.Format("2006-01-02")
				overview.RevenueByDay = append(overview.RevenueByDay, m)
			}
		}
	}

	// Platform split
	pRows, err := h.db.Pool.Query(ctx,
		`SELECT platform, COALESCE(SUM(total_amount), 0), COUNT(*)
		 FROM orders WHERE user_id = $1 AND order_date BETWEEN $2 AND $3 AND status != 'cancelled'
		 GROUP BY platform ORDER BY SUM(total_amount) DESC`,
		userID, startDate, endDate,
	)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var m PlatformMetric
			if err := pRows.Scan(&m.Platform, &m.Revenue, &m.Orders); err == nil {
				if overview.TotalRevenue > 0 {
					m.Share = (m.Revenue / overview.TotalRevenue) * 100
				}
				overview.PlatformSplit = append(overview.PlatformSplit, m)
			}
		}
	}

	// Top products
	tpRows, err := h.db.Pool.Query(ctx,
		`SELECT oi.sku, oi.product_name, SUM(oi.total_price), SUM(oi.quantity),
		        SUM(oi.total_price - oi.cost_price * oi.quantity - oi.commission)
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 WHERE o.user_id = $1 AND o.order_date BETWEEN $2 AND $3 AND o.status != 'cancelled'
		 GROUP BY oi.sku, oi.product_name
		 ORDER BY SUM(oi.total_price) DESC LIMIT 10`,
		userID, startDate, endDate,
	)
	if err == nil {
		defer tpRows.Close()
		for tpRows.Next() {
			var m ProductMetric
			if err := tpRows.Scan(&m.SKU, &m.Name, &m.Revenue, &m.Quantity, &m.Profit); err == nil {
				overview.TopProducts = append(overview.TopProducts, m)
			}
		}
	}

	// Recent orders
	roRows, err := h.db.Pool.Query(ctx,
		`SELECT id, platform, platform_order_id, customer_name, total_amount, status, order_date
		 FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 20`,
		userID,
	)
	if err == nil {
		defer roRows.Close()
		for roRows.Next() {
			var o OrderSummary
			var orderDate time.Time
			if err := roRows.Scan(&o.ID, &o.Platform, &o.PlatformOrderID, &o.CustomerName, &o.TotalAmount, &o.Status, &orderDate); err == nil {
				o.OrderDate = orderDate.Format("2006-01-02 15:04")
				overview.RecentOrders = append(overview.RecentOrders, o)
			}
		}
	}

	overview.TotalProfit = overview.TotalRevenue - overview.TotalAdSpend

	c.JSON(http.StatusOK, overview)
}
