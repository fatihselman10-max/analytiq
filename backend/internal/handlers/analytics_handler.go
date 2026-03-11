package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type AnalyticsHandler struct {
	db *database.DB
}

func NewAnalyticsHandler(db *database.DB) *AnalyticsHandler {
	return &AnalyticsHandler{db: db}
}

// GetAdPerformance returns advertising performance across all platforms
func (h *AnalyticsHandler) GetAdPerformance(c *gin.Context) {
	userID := c.GetInt64("user_id")
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))
	platform := c.Query("platform") // meta, google, tiktok or empty for all

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Summary metrics
	query := `SELECT COALESCE(SUM(spend), 0), COALESCE(SUM(impressions), 0),
	          COALESCE(SUM(clicks), 0), COALESCE(SUM(conversions), 0), COALESCE(SUM(revenue), 0)
	          FROM ad_spend WHERE user_id = $1 AND date BETWEEN $2 AND $3`
	args := []interface{}{userID, startDate, endDate}
	if platform != "" {
		query += ` AND platform = $4`
		args = append(args, platform)
	}

	var totalSpend, totalRevenue float64
	var totalImpressions, totalClicks, totalConversions int64
	_ = h.db.Pool.QueryRow(ctx, query, args...).Scan(
		&totalSpend, &totalImpressions, &totalClicks, &totalConversions, &totalRevenue,
	)

	roas := 0.0
	if totalSpend > 0 {
		roas = totalRevenue / totalSpend
	}
	cpc := 0.0
	if totalClicks > 0 {
		cpc = totalSpend / float64(totalClicks)
	}
	ctr := 0.0
	if totalImpressions > 0 {
		ctr = float64(totalClicks) / float64(totalImpressions) * 100
	}

	// Daily breakdown
	dailyQuery := `SELECT date, SUM(spend), SUM(impressions), SUM(clicks), SUM(conversions), SUM(revenue)
	               FROM ad_spend WHERE user_id = $1 AND date BETWEEN $2 AND $3`
	dailyArgs := []interface{}{userID, startDate, endDate}
	if platform != "" {
		dailyQuery += ` AND platform = $4`
		dailyArgs = append(dailyArgs, platform)
	}
	dailyQuery += ` GROUP BY date ORDER BY date`

	rows, _ := h.db.Pool.Query(ctx, dailyQuery, dailyArgs...)
	var dailyData []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var d time.Time
			var spend, rev float64
			var imp, clk, conv int64
			if rows.Scan(&d, &spend, &imp, &clk, &conv, &rev) == nil {
				dayRoas := 0.0
				if spend > 0 {
					dayRoas = rev / spend
				}
				dailyData = append(dailyData, map[string]interface{}{
					"date":        d.Format("2006-01-02"),
					"spend":       spend,
					"impressions": imp,
					"clicks":      clk,
					"conversions": conv,
					"revenue":     rev,
					"roas":        dayRoas,
				})
			}
		}
	}

	// Campaign breakdown
	campQuery := `SELECT campaign_id, campaign_name, platform,
	              SUM(spend), SUM(impressions), SUM(clicks), SUM(conversions), SUM(revenue)
	              FROM ad_spend WHERE user_id = $1 AND date BETWEEN $2 AND $3`
	campArgs := []interface{}{userID, startDate, endDate}
	if platform != "" {
		campQuery += ` AND platform = $4`
		campArgs = append(campArgs, platform)
	}
	campQuery += ` GROUP BY campaign_id, campaign_name, platform ORDER BY SUM(spend) DESC LIMIT 20`

	campRows, _ := h.db.Pool.Query(ctx, campQuery, campArgs...)
	var campaigns []map[string]interface{}
	if campRows != nil {
		defer campRows.Close()
		for campRows.Next() {
			var cid, cname, plt string
			var spend, rev float64
			var imp, clk, conv int64
			if campRows.Scan(&cid, &cname, &plt, &spend, &imp, &clk, &conv, &rev) == nil {
				campRoas := 0.0
				if spend > 0 {
					campRoas = rev / spend
				}
				campaigns = append(campaigns, map[string]interface{}{
					"campaign_id":   cid,
					"campaign_name": cname,
					"platform":      plt,
					"spend":         spend,
					"impressions":   imp,
					"clicks":        clk,
					"conversions":   conv,
					"revenue":       rev,
					"roas":          campRoas,
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"summary": gin.H{
			"total_spend":       totalSpend,
			"total_impressions": totalImpressions,
			"total_clicks":      totalClicks,
			"total_conversions": totalConversions,
			"total_revenue":     totalRevenue,
			"roas":              roas,
			"cpc":               cpc,
			"ctr":               ctr,
		},
		"daily":     dailyData,
		"campaigns": campaigns,
	})
}

// GetProfitAnalysis returns detailed P&L analysis
func (h *AnalyticsHandler) GetProfitAnalysis(c *gin.Context) {
	userID := c.GetInt64("user_id")
	startDate := c.DefaultQuery("start_date", time.Now().AddDate(0, 0, -30).Format("2006-01-02"))
	endDate := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var totalRevenue, totalShipping, totalDiscount, totalTax, totalCommission float64
	var totalOrders int
	_ = h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_amount),0), COALESCE(SUM(shipping_amount),0),
		        COALESCE(SUM(discount_amount),0), COALESCE(SUM(tax_amount),0),
		        COALESCE(SUM(commission_amount),0), COUNT(*)
		 FROM orders WHERE user_id = $1 AND order_date BETWEEN $2 AND $3 AND status != 'cancelled'`,
		userID, startDate, endDate,
	).Scan(&totalRevenue, &totalShipping, &totalDiscount, &totalTax, &totalCommission, &totalOrders)

	var totalCOGS float64
	_ = h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(oi.cost_price * oi.quantity), 0)
		 FROM order_items oi JOIN orders o ON o.id = oi.order_id
		 WHERE o.user_id = $1 AND o.order_date BETWEEN $2 AND $3 AND o.status != 'cancelled'`,
		userID, startDate, endDate,
	).Scan(&totalCOGS)

	var totalAdSpend float64
	_ = h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(spend), 0) FROM ad_spend
		 WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
		userID, startDate, endDate,
	).Scan(&totalAdSpend)

	grossProfit := totalRevenue - totalCOGS
	netProfit := grossProfit - totalCommission - totalAdSpend - totalShipping

	grossMargin := 0.0
	if totalRevenue > 0 {
		grossMargin = (grossProfit / totalRevenue) * 100
	}
	netMargin := 0.0
	if totalRevenue > 0 {
		netMargin = (netProfit / totalRevenue) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"revenue":         totalRevenue,
		"cogs":            totalCOGS,
		"gross_profit":    grossProfit,
		"gross_margin":    grossMargin,
		"commission":      totalCommission,
		"ad_spend":        totalAdSpend,
		"shipping_cost":   totalShipping,
		"discount":        totalDiscount,
		"tax":             totalTax,
		"net_profit":      netProfit,
		"net_margin":      netMargin,
		"total_orders":    totalOrders,
		"aov":             func() float64 { if totalOrders > 0 { return totalRevenue / float64(totalOrders) }; return 0 }(),
	})
}
