package meta

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/services/advertising"
)

const graphAPIBase = "https://graph.facebook.com/v19.0"

type Client struct {
	accessToken string
	adAccountID string
	http        *http.Client
}

func NewClient(accessToken, adAccountID string) *Client {
	return &Client{
		accessToken: accessToken,
		adAccountID: adAccountID,
		http:        &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) GetPlatformName() string {
	return "meta"
}

func (c *Client) TestConnection(ctx context.Context) error {
	url := fmt.Sprintf("%s/act_%s?fields=name,account_status&access_token=%s",
		graphAPIBase, c.adAccountID, c.accessToken)
	_, err := c.doRequest(ctx, url)
	return err
}

func (c *Client) GetCampaigns(ctx context.Context) ([]advertising.Campaign, error) {
	url := fmt.Sprintf("%s/act_%s/campaigns?fields=id,name,status,daily_budget,objective&access_token=%s",
		graphAPIBase, c.adAccountID, c.accessToken)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp metaCampaignsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	campaigns := make([]advertising.Campaign, 0, len(resp.Data))
	for _, mc := range resp.Data {
		campaigns = append(campaigns, advertising.Campaign{
			ID:        mc.ID,
			Name:      mc.Name,
			Status:    mc.Status,
			Budget:    mc.DailyBudget / 100, // Meta returns in cents
			Objective: mc.Objective,
		})
	}

	return campaigns, nil
}

func (c *Client) GetCampaignInsights(ctx context.Context, startDate, endDate time.Time) ([]advertising.CampaignInsight, error) {
	url := fmt.Sprintf(
		"%s/act_%s/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values,cpc,cpm,ctr&time_range={\"since\":\"%s\",\"until\":\"%s\"}&time_increment=1&level=campaign&access_token=%s",
		graphAPIBase, c.adAccountID,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		c.accessToken,
	)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp metaInsightsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	insights := make([]advertising.CampaignInsight, 0, len(resp.Data))
	for _, mi := range resp.Data {
		conversions := int64(0)
		revenue := 0.0

		for _, a := range mi.Actions {
			if a.ActionType == "purchase" || a.ActionType == "offsite_conversion.fb_pixel_purchase" {
				conversions += int64(a.Value)
			}
		}
		for _, av := range mi.ActionValues {
			if av.ActionType == "purchase" || av.ActionType == "offsite_conversion.fb_pixel_purchase" {
				revenue += av.Value
			}
		}

		roas := 0.0
		if mi.Spend > 0 {
			roas = revenue / mi.Spend
		}

		insights = append(insights, advertising.CampaignInsight{
			CampaignID:   mi.CampaignID,
			CampaignName: mi.CampaignName,
			Date:         mi.DateStart,
			Impressions:  mi.Impressions,
			Clicks:       mi.Clicks,
			Spend:        mi.Spend,
			Conversions:  conversions,
			Revenue:      revenue,
			ROAS:         roas,
			CPC:          mi.CPC,
			CPM:          mi.CPM,
			CTR:          mi.CTR,
			Currency:     "TRY",
		})
	}

	return insights, nil
}

func (c *Client) GetAdSetInsights(ctx context.Context, campaignID string, startDate, endDate time.Time) ([]advertising.AdSetInsight, error) {
	url := fmt.Sprintf(
		"%s/%s/insights?fields=adset_id,adset_name,campaign_id,impressions,clicks,spend,actions,action_values,cpc,cpm,ctr&time_range={\"since\":\"%s\",\"until\":\"%s\"}&time_increment=1&level=adset&access_token=%s",
		graphAPIBase, campaignID,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		c.accessToken,
	)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp metaAdSetInsightsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	insights := make([]advertising.AdSetInsight, 0, len(resp.Data))
	for _, mi := range resp.Data {
		conversions := int64(0)
		revenue := 0.0
		for _, a := range mi.Actions {
			if a.ActionType == "purchase" {
				conversions += int64(a.Value)
			}
		}
		for _, av := range mi.ActionValues {
			if av.ActionType == "purchase" {
				revenue += av.Value
			}
		}

		roas := 0.0
		if mi.Spend > 0 {
			roas = revenue / mi.Spend
		}

		insights = append(insights, advertising.AdSetInsight{
			AdSetID:     mi.AdSetID,
			AdSetName:   mi.AdSetName,
			CampaignID:  mi.CampaignID,
			Date:        mi.DateStart,
			Impressions: mi.Impressions,
			Clicks:      mi.Clicks,
			Spend:       mi.Spend,
			Conversions: conversions,
			Revenue:     revenue,
			ROAS:        roas,
			CPC:         mi.CPC,
			CPM:         mi.CPM,
			CTR:         mi.CTR,
		})
	}

	return insights, nil
}

func (c *Client) doRequest(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Meta API error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// Meta API response types
type metaCampaignsResponse struct {
	Data []struct {
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		Status      string  `json:"status"`
		DailyBudget float64 `json:"daily_budget,string"`
		Objective   string  `json:"objective"`
	} `json:"data"`
}

type metaInsightsResponse struct {
	Data []metaInsight `json:"data"`
}

type metaInsight struct {
	CampaignID   string        `json:"campaign_id"`
	CampaignName string        `json:"campaign_name"`
	DateStart    string        `json:"date_start"`
	Impressions  int64         `json:"impressions,string"`
	Clicks       int64         `json:"clicks,string"`
	Spend        float64       `json:"spend,string"`
	CPC          float64       `json:"cpc,string"`
	CPM          float64       `json:"cpm,string"`
	CTR          float64       `json:"ctr,string"`
	Actions      []metaAction  `json:"actions"`
	ActionValues []metaActionValue `json:"action_values"`
}

type metaAction struct {
	ActionType string  `json:"action_type"`
	Value      float64 `json:"value,string"`
}

type metaActionValue struct {
	ActionType string  `json:"action_type"`
	Value      float64 `json:"value,string"`
}

type metaAdSetInsightsResponse struct {
	Data []metaAdSetInsight `json:"data"`
}

type metaAdSetInsight struct {
	AdSetID      string        `json:"adset_id"`
	AdSetName    string        `json:"adset_name"`
	CampaignID   string        `json:"campaign_id"`
	DateStart    string        `json:"date_start"`
	Impressions  int64         `json:"impressions,string"`
	Clicks       int64         `json:"clicks,string"`
	Spend        float64       `json:"spend,string"`
	CPC          float64       `json:"cpc,string"`
	CPM          float64       `json:"cpm,string"`
	CTR          float64       `json:"ctr,string"`
	Actions      []metaAction  `json:"actions"`
	ActionValues []metaActionValue `json:"action_values"`
}
