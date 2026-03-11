package advertising

import (
	"context"
	"time"
)

// AdPlatformClient is the interface all advertising integrations must implement
type AdPlatformClient interface {
	// GetCampaigns fetches all campaigns
	GetCampaigns(ctx context.Context) ([]Campaign, error)
	// GetCampaignInsights fetches performance data for a date range
	GetCampaignInsights(ctx context.Context, startDate, endDate time.Time) ([]CampaignInsight, error)
	// GetAdSetInsights fetches ad set level performance data
	GetAdSetInsights(ctx context.Context, campaignID string, startDate, endDate time.Time) ([]AdSetInsight, error)
	// TestConnection validates the API credentials
	TestConnection(ctx context.Context) error
	// GetPlatformName returns the platform identifier
	GetPlatformName() string
}

type Campaign struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	Budget    float64 `json:"budget"`
	Objective string  `json:"objective"`
}

type CampaignInsight struct {
	CampaignID   string  `json:"campaign_id"`
	CampaignName string  `json:"campaign_name"`
	Date         string  `json:"date"`
	Impressions  int64   `json:"impressions"`
	Clicks       int64   `json:"clicks"`
	Spend        float64 `json:"spend"`
	Conversions  int64   `json:"conversions"`
	Revenue      float64 `json:"revenue"`
	ROAS         float64 `json:"roas"`
	CPC          float64 `json:"cpc"`
	CPM          float64 `json:"cpm"`
	CTR          float64 `json:"ctr"`
	Currency     string  `json:"currency"`
}

type AdSetInsight struct {
	AdSetID      string  `json:"ad_set_id"`
	AdSetName    string  `json:"ad_set_name"`
	CampaignID   string  `json:"campaign_id"`
	Date         string  `json:"date"`
	Impressions  int64   `json:"impressions"`
	Clicks       int64   `json:"clicks"`
	Spend        float64 `json:"spend"`
	Conversions  int64   `json:"conversions"`
	Revenue      float64 `json:"revenue"`
	ROAS         float64 `json:"roas"`
	CPC          float64 `json:"cpc"`
	CPM          float64 `json:"cpm"`
	CTR          float64 `json:"ctr"`
}
