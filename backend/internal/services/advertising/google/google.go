package google

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/analytiq/backend/internal/services/advertising"
)

const googleAdsAPIBase = "https://googleads.googleapis.com/v16"

type Client struct {
	developerToken string
	customerID     string
	accessToken    string
	refreshToken   string
	http           *http.Client
}

func NewClient(developerToken, customerID, accessToken, refreshToken string) *Client {
	return &Client{
		developerToken: developerToken,
		customerID:     customerID,
		accessToken:    accessToken,
		refreshToken:   refreshToken,
		http:           &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) GetPlatformName() string {
	return "google"
}

func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.GetCampaigns(ctx)
	return err
}

func (c *Client) GetCampaigns(ctx context.Context) ([]advertising.Campaign, error) {
	query := `SELECT campaign.id, campaign.name, campaign.status, campaign.campaign_budget
	          FROM campaign WHERE campaign.status != 'REMOVED'`

	body, err := c.executeGAQL(ctx, query)
	if err != nil {
		return nil, err
	}

	var resp googleSearchResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	campaigns := make([]advertising.Campaign, 0, len(resp.Results))
	for _, r := range resp.Results {
		campaigns = append(campaigns, advertising.Campaign{
			ID:     r.Campaign.ID,
			Name:   r.Campaign.Name,
			Status: r.Campaign.Status,
		})
	}

	return campaigns, nil
}

func (c *Client) GetCampaignInsights(ctx context.Context, startDate, endDate time.Time) ([]advertising.CampaignInsight, error) {
	query := fmt.Sprintf(`SELECT
		campaign.id, campaign.name,
		segments.date,
		metrics.impressions, metrics.clicks, metrics.cost_micros,
		metrics.conversions, metrics.conversions_value,
		metrics.average_cpc, metrics.average_cpm, metrics.ctr
		FROM campaign
		WHERE segments.date BETWEEN '%s' AND '%s'
		AND campaign.status != 'REMOVED'`,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
	)

	body, err := c.executeGAQL(ctx, query)
	if err != nil {
		return nil, err
	}

	var resp googleInsightsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	insights := make([]advertising.CampaignInsight, 0, len(resp.Results))
	for _, r := range resp.Results {
		spend := float64(r.Metrics.CostMicros) / 1_000_000
		roas := 0.0
		if spend > 0 {
			roas = r.Metrics.ConversionsValue / spend
		}

		insights = append(insights, advertising.CampaignInsight{
			CampaignID:   r.Campaign.ID,
			CampaignName: r.Campaign.Name,
			Date:         r.Segments.Date,
			Impressions:  r.Metrics.Impressions,
			Clicks:       r.Metrics.Clicks,
			Spend:        spend,
			Conversions:  int64(r.Metrics.Conversions),
			Revenue:      r.Metrics.ConversionsValue,
			ROAS:         roas,
			CPC:          float64(r.Metrics.AverageCPC) / 1_000_000,
			CPM:          float64(r.Metrics.AverageCPM) / 1_000_000,
			CTR:          r.Metrics.CTR,
			Currency:     "TRY",
		})
	}

	return insights, nil
}

func (c *Client) GetAdSetInsights(ctx context.Context, campaignID string, startDate, endDate time.Time) ([]advertising.AdSetInsight, error) {
	query := fmt.Sprintf(`SELECT
		ad_group.id, ad_group.name, campaign.id,
		segments.date,
		metrics.impressions, metrics.clicks, metrics.cost_micros,
		metrics.conversions, metrics.conversions_value,
		metrics.average_cpc, metrics.average_cpm, metrics.ctr
		FROM ad_group
		WHERE campaign.id = %s
		AND segments.date BETWEEN '%s' AND '%s'`,
		campaignID,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
	)

	body, err := c.executeGAQL(ctx, query)
	if err != nil {
		return nil, err
	}

	var resp googleAdGroupInsightsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	insights := make([]advertising.AdSetInsight, 0, len(resp.Results))
	for _, r := range resp.Results {
		spend := float64(r.Metrics.CostMicros) / 1_000_000
		roas := 0.0
		if spend > 0 {
			roas = r.Metrics.ConversionsValue / spend
		}

		insights = append(insights, advertising.AdSetInsight{
			AdSetID:     r.AdGroup.ID,
			AdSetName:   r.AdGroup.Name,
			CampaignID:  r.Campaign.ID,
			Date:        r.Segments.Date,
			Impressions: r.Metrics.Impressions,
			Clicks:      r.Metrics.Clicks,
			Spend:       spend,
			Conversions: int64(r.Metrics.Conversions),
			Revenue:     r.Metrics.ConversionsValue,
			ROAS:        roas,
			CPC:         float64(r.Metrics.AverageCPC) / 1_000_000,
			CPM:         float64(r.Metrics.AverageCPM) / 1_000_000,
			CTR:         r.Metrics.CTR,
		})
	}

	return insights, nil
}

func (c *Client) executeGAQL(ctx context.Context, query string) ([]byte, error) {
	custID := strings.ReplaceAll(c.customerID, "-", "")
	url := fmt.Sprintf("%s/customers/%s/googleAds:searchStream", googleAdsAPIBase, custID)

	payload := fmt.Sprintf(`{"query": "%s"}`, query)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("developer-token", c.developerToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Google Ads API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Google Ads API error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// Google Ads API response types
type googleSearchResponse struct {
	Results []struct {
		Campaign struct {
			ID     string `json:"id"`
			Name   string `json:"name"`
			Status string `json:"status"`
		} `json:"campaign"`
	} `json:"results"`
}

type googleInsightsResponse struct {
	Results []struct {
		Campaign struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"campaign"`
		Segments struct {
			Date string `json:"date"`
		} `json:"segments"`
		Metrics googleMetrics `json:"metrics"`
	} `json:"results"`
}

type googleAdGroupInsightsResponse struct {
	Results []struct {
		AdGroup struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"adGroup"`
		Campaign struct {
			ID string `json:"id"`
		} `json:"campaign"`
		Segments struct {
			Date string `json:"date"`
		} `json:"segments"`
		Metrics googleMetrics `json:"metrics"`
	} `json:"results"`
}

type googleMetrics struct {
	Impressions      int64   `json:"impressions,string"`
	Clicks           int64   `json:"clicks,string"`
	CostMicros       int64   `json:"costMicros,string"`
	Conversions      float64 `json:"conversions"`
	ConversionsValue float64 `json:"conversionsValue"`
	AverageCPC       int64   `json:"averageCpc,string"`
	AverageCPM       int64   `json:"averageCpm,string"`
	CTR              float64 `json:"ctr"`
}
