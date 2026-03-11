package tiktok

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/services/advertising"
)

const tiktokAdsBase = "https://business-api.tiktok.com/open_api/v1.3"

type Client struct {
	accessToken  string
	advertiserID string
	http         *http.Client
}

func NewClient(accessToken, advertiserID string) *Client {
	return &Client{
		accessToken:  accessToken,
		advertiserID: advertiserID,
		http:         &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) GetPlatformName() string {
	return "tiktok"
}

func (c *Client) TestConnection(ctx context.Context) error {
	url := fmt.Sprintf("%s/advertiser/info/?advertiser_ids=[\"%s\"]", tiktokAdsBase, c.advertiserID)
	_, err := c.doRequest(ctx, url)
	return err
}

func (c *Client) GetCampaigns(ctx context.Context) ([]advertising.Campaign, error) {
	url := fmt.Sprintf("%s/campaign/get/?advertiser_id=%s&page_size=100", tiktokAdsBase, c.advertiserID)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp tiktokCampaignsResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	campaigns := make([]advertising.Campaign, 0, len(resp.Data.List))
	for _, tc := range resp.Data.List {
		campaigns = append(campaigns, advertising.Campaign{
			ID:        tc.CampaignID,
			Name:      tc.CampaignName,
			Status:    tc.Status,
			Budget:    tc.Budget,
			Objective: tc.ObjectiveType,
		})
	}

	return campaigns, nil
}

func (c *Client) GetCampaignInsights(ctx context.Context, startDate, endDate time.Time) ([]advertising.CampaignInsight, error) {
	url := fmt.Sprintf(
		"%s/report/integrated/get/?advertiser_id=%s&report_type=BASIC&dimensions=[\"campaign_id\",\"stat_time_day\"]&metrics=[\"campaign_name\",\"spend\",\"impressions\",\"clicks\",\"conversion\",\"total_complete_payment_rate\",\"complete_payment\",\"total_complete_payment\",\"cpc\",\"cpm\",\"ctr\"]&data_level=AUCTION_CAMPAIGN&start_date=%s&end_date=%s&page_size=100",
		tiktokAdsBase, c.advertiserID,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
	)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp tiktokReportResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	insights := make([]advertising.CampaignInsight, 0, len(resp.Data.List))
	for _, r := range resp.Data.List {
		roas := 0.0
		if r.Metrics.Spend > 0 {
			roas = r.Metrics.TotalCompletePayment / r.Metrics.Spend
		}

		insights = append(insights, advertising.CampaignInsight{
			CampaignID:   r.Dimensions.CampaignID,
			CampaignName: r.Metrics.CampaignName,
			Date:         r.Dimensions.StatTimeDay,
			Impressions:  r.Metrics.Impressions,
			Clicks:       r.Metrics.Clicks,
			Spend:        r.Metrics.Spend,
			Conversions:  r.Metrics.Conversion,
			Revenue:      r.Metrics.TotalCompletePayment,
			ROAS:         roas,
			CPC:          r.Metrics.CPC,
			CPM:          r.Metrics.CPM,
			CTR:          r.Metrics.CTR,
			Currency:     "TRY",
		})
	}

	return insights, nil
}

func (c *Client) GetAdSetInsights(ctx context.Context, campaignID string, startDate, endDate time.Time) ([]advertising.AdSetInsight, error) {
	url := fmt.Sprintf(
		"%s/report/integrated/get/?advertiser_id=%s&report_type=BASIC&dimensions=[\"adgroup_id\",\"stat_time_day\"]&metrics=[\"adgroup_name\",\"campaign_id\",\"spend\",\"impressions\",\"clicks\",\"conversion\",\"total_complete_payment\",\"cpc\",\"cpm\",\"ctr\"]&data_level=AUCTION_ADGROUP&start_date=%s&end_date=%s&filtering=[{\"field_name\":\"campaign_ids\",\"filter_type\":\"IN\",\"filter_value\":[\"%s\"]}]&page_size=100",
		tiktokAdsBase, c.advertiserID,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		campaignID,
	)

	body, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	var resp tiktokAdGroupReportResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	insights := make([]advertising.AdSetInsight, 0, len(resp.Data.List))
	for _, r := range resp.Data.List {
		roas := 0.0
		if r.Metrics.Spend > 0 {
			roas = r.Metrics.TotalCompletePayment / r.Metrics.Spend
		}

		insights = append(insights, advertising.AdSetInsight{
			AdSetID:     r.Dimensions.AdGroupID,
			AdSetName:   r.Metrics.AdGroupName,
			CampaignID:  r.Metrics.CampaignID,
			Date:        r.Dimensions.StatTimeDay,
			Impressions: r.Metrics.Impressions,
			Clicks:      r.Metrics.Clicks,
			Spend:       r.Metrics.Spend,
			Conversions: r.Metrics.Conversion,
			Revenue:     r.Metrics.TotalCompletePayment,
			ROAS:        roas,
			CPC:         r.Metrics.CPC,
			CPM:         r.Metrics.CPM,
			CTR:         r.Metrics.CTR,
		})
	}

	return insights, nil
}

func (c *Client) doRequest(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Access-Token", c.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("TikTok API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("TikTok API error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// TikTok Ads API response types
type tiktokCampaignsResponse struct {
	Data struct {
		List []struct {
			CampaignID    string  `json:"campaign_id"`
			CampaignName  string  `json:"campaign_name"`
			Status        string  `json:"operation_status"`
			Budget        float64 `json:"budget"`
			ObjectiveType string  `json:"objective_type"`
		} `json:"list"`
	} `json:"data"`
}

type tiktokReportResponse struct {
	Data struct {
		List []struct {
			Dimensions struct {
				CampaignID  string `json:"campaign_id"`
				StatTimeDay string `json:"stat_time_day"`
			} `json:"dimensions"`
			Metrics struct {
				CampaignName         string  `json:"campaign_name"`
				Impressions          int64   `json:"impressions,string"`
				Clicks               int64   `json:"clicks,string"`
				Spend                float64 `json:"spend,string"`
				Conversion           int64   `json:"conversion,string"`
				TotalCompletePayment float64 `json:"total_complete_payment,string"`
				CPC                  float64 `json:"cpc,string"`
				CPM                  float64 `json:"cpm,string"`
				CTR                  float64 `json:"ctr,string"`
			} `json:"metrics"`
		} `json:"list"`
	} `json:"data"`
}

type tiktokAdGroupReportResponse struct {
	Data struct {
		List []struct {
			Dimensions struct {
				AdGroupID   string `json:"adgroup_id"`
				StatTimeDay string `json:"stat_time_day"`
			} `json:"dimensions"`
			Metrics struct {
				AdGroupName          string  `json:"adgroup_name"`
				CampaignID           string  `json:"campaign_id"`
				Impressions          int64   `json:"impressions,string"`
				Clicks               int64   `json:"clicks,string"`
				Spend                float64 `json:"spend,string"`
				Conversion           int64   `json:"conversion,string"`
				TotalCompletePayment float64 `json:"total_complete_payment,string"`
				CPC                  float64 `json:"cpc,string"`
				CPM                  float64 `json:"cpm,string"`
				CTR                  float64 `json:"ctr,string"`
			} `json:"metrics"`
		} `json:"list"`
	} `json:"data"`
}
