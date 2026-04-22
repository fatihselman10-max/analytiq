package models

import (
	"time"
)

type Organization struct {
	ID        int64     `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Slug      string    `json:"slug" db:"slug"`
	Plan      string    `json:"plan" db:"plan"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type User struct {
	ID           int64     `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	FullName     string    `json:"full_name" db:"full_name"`
	AvatarURL    string    `json:"avatar_url" db:"avatar_url"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type OrgMember struct {
	OrgID     int64     `json:"org_id" db:"org_id"`
	UserID    int64     `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Channel struct {
	ID          int64     `json:"id" db:"id"`
	OrgID       int64     `json:"org_id" db:"org_id"`
	Type        string    `json:"type" db:"type"`
	Name        string    `json:"name" db:"name"`
	Credentials string    `json:"credentials" db:"credentials"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type Contact struct {
	ID          int64     `json:"id" db:"id"`
	OrgID       int64     `json:"org_id" db:"org_id"`
	ExternalID  string    `json:"external_id" db:"external_id"`
	ChannelType string    `json:"channel_type" db:"channel_type"`
	Name        string    `json:"name" db:"name"`
	Email       string    `json:"email" db:"email"`
	Phone       string    `json:"phone" db:"phone"`
	AvatarURL   string    `json:"avatar_url" db:"avatar_url"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type Conversation struct {
	ID              int64      `json:"id" db:"id"`
	OrgID           int64      `json:"org_id" db:"org_id"`
	ChannelID       *int64     `json:"channel_id" db:"channel_id"`
	ContactID       *int64     `json:"contact_id" db:"contact_id"`
	AssignedTo      *int64     `json:"assigned_to" db:"assigned_to"`
	CustomerID      *int64     `json:"customer_id" db:"customer_id"`
	Status          string     `json:"status" db:"status"`
	Priority        string     `json:"priority" db:"priority"`
	Subject         string     `json:"subject" db:"subject"`
	LastMessageAt   *time.Time `json:"last_message_at" db:"last_message_at"`
	FirstResponseAt *time.Time `json:"first_response_at" db:"first_response_at"`
	ResolvedAt      *time.Time `json:"resolved_at" db:"resolved_at"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`

	// Joined fields (not in DB directly)
	Contact      *Contact `json:"contact,omitempty"`
	AssignedUser *User    `json:"assigned_user,omitempty"`
	ChannelType  string   `json:"channel_type,omitempty"`
	LastMessage  string   `json:"last_message,omitempty"`
	Tags         []Tag    `json:"tags,omitempty"`
}

type Tag struct {
	ID        int64     `json:"id" db:"id"`
	OrgID     int64     `json:"org_id" db:"org_id"`
	Name      string    `json:"name" db:"name"`
	Color     string    `json:"color" db:"color"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Message struct {
	ID             int64     `json:"id" db:"id"`
	ConversationID int64     `json:"conversation_id" db:"conversation_id"`
	SenderType     string    `json:"sender_type" db:"sender_type"`
	SenderID       *int64    `json:"sender_id" db:"sender_id"`
	Content        string    `json:"content" db:"content"`
	ContentType    string    `json:"content_type" db:"content_type"`
	IsInternal     bool      `json:"is_internal" db:"is_internal"`
	ExternalID     string    `json:"external_id" db:"external_id"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`

	// Joined
	SenderName string       `json:"sender_name,omitempty"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type Attachment struct {
	ID        int64     `json:"id" db:"id"`
	MessageID int64     `json:"message_id" db:"message_id"`
	FileName  string    `json:"file_name" db:"file_name"`
	FileURL   string    `json:"file_url" db:"file_url"`
	FileType  string    `json:"file_type" db:"file_type"`
	FileSize  int64     `json:"file_size" db:"file_size"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CannedResponse struct {
	ID        int64     `json:"id" db:"id"`
	OrgID     int64     `json:"org_id" db:"org_id"`
	Shortcut  string    `json:"shortcut" db:"shortcut"`
	Title     string    `json:"title" db:"title"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type BotRule struct {
	ID               int64     `json:"id" db:"id"`
	OrgID            int64     `json:"org_id" db:"org_id"`
	Name             string    `json:"name" db:"name"`
	Keywords         []string  `json:"keywords" db:"keywords"`
	MatchType        string    `json:"match_type" db:"match_type"`
	ResponseTemplate string    `json:"response_template" db:"response_template"`
	IsActive         bool      `json:"is_active" db:"is_active"`
	Priority         int       `json:"priority" db:"priority"`
	ChannelTypes     []string  `json:"channel_types" db:"channel_types"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type BotLog struct {
	ID             int64     `json:"id" db:"id"`
	OrgID          int64     `json:"org_id" db:"org_id"`
	RuleID         *int64    `json:"rule_id" db:"rule_id"`
	ConversationID *int64    `json:"conversation_id" db:"conversation_id"`
	MatchedKeyword string    `json:"matched_keyword" db:"matched_keyword"`
	Action         string    `json:"action" db:"action"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`

	// Joined
	RuleName string `json:"rule_name,omitempty"`
}

// Business Hours
type BusinessHours struct {
	ID             int64     `json:"id" db:"id"`
	OrgID          int64     `json:"org_id" db:"org_id"`
	IsEnabled      bool      `json:"is_enabled" db:"is_enabled"`
	Timezone       string    `json:"timezone" db:"timezone"`
	Schedule       string    `json:"schedule" db:"schedule"`
	AwayMessage    string    `json:"away_message" db:"away_message"`
	WelcomeMessage string    `json:"welcome_message" db:"welcome_message"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type DaySchedule struct {
	Enabled bool   `json:"enabled"`
	Start   string `json:"start"`
	End     string `json:"end"`
}

// SLA Policy
type SLAPolicy struct {
	ID                   int64     `json:"id" db:"id"`
	OrgID                int64     `json:"org_id" db:"org_id"`
	IsEnabled            bool      `json:"is_enabled" db:"is_enabled"`
	FirstResponseUrgent  int       `json:"first_response_urgent" db:"first_response_urgent"`
	FirstResponseHigh    int       `json:"first_response_high" db:"first_response_high"`
	FirstResponseNormal  int       `json:"first_response_normal" db:"first_response_normal"`
	FirstResponseLow     int       `json:"first_response_low" db:"first_response_low"`
	ResolutionUrgent     int       `json:"resolution_urgent" db:"resolution_urgent"`
	ResolutionHigh       int       `json:"resolution_high" db:"resolution_high"`
	ResolutionNormal     int       `json:"resolution_normal" db:"resolution_normal"`
	ResolutionLow        int       `json:"resolution_low" db:"resolution_low"`
	BusinessHoursOnly    bool      `json:"business_hours_only" db:"business_hours_only"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
}

type SLAStatus struct {
	ResponseTarget  int     `json:"response_target_minutes"`
	ResponseElapsed float64 `json:"response_elapsed_minutes"`
	ResponseBreached bool   `json:"response_breached"`
	ResolutionTarget  int     `json:"resolution_target_minutes"`
	ResolutionElapsed float64 `json:"resolution_elapsed_minutes"`
	ResolutionBreached bool   `json:"resolution_breached"`
}

// CSAT
type CSATConfig struct {
	ID               int64     `json:"id" db:"id"`
	OrgID            int64     `json:"org_id" db:"org_id"`
	IsEnabled        bool      `json:"is_enabled" db:"is_enabled"`
	Question         string    `json:"question" db:"question"`
	ThankYouMessage  string    `json:"thank_you_message" db:"thank_you_message"`
	SendDelayMinutes int       `json:"send_delay_minutes" db:"send_delay_minutes"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type CSATResponse struct {
	ID             int64     `json:"id" db:"id"`
	OrgID          int64     `json:"org_id" db:"org_id"`
	ConversationID *int64    `json:"conversation_id" db:"conversation_id"`
	ContactID      *int64    `json:"contact_id" db:"contact_id"`
	AgentID        *int64    `json:"agent_id" db:"agent_id"`
	Rating         int       `json:"rating" db:"rating"`
	Comment        string    `json:"comment" db:"comment"`
	ChannelType    string    `json:"channel_type" db:"channel_type"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`

	// Joined
	ContactName string `json:"contact_name,omitempty"`
	AgentName   string `json:"agent_name,omitempty"`
}

// Automation
type Automation struct {
	ID             int64      `json:"id" db:"id"`
	OrgID          int64      `json:"org_id" db:"org_id"`
	Name           string     `json:"name" db:"name"`
	IsActive       bool       `json:"is_active" db:"is_active"`
	TriggerType    string     `json:"trigger_type" db:"trigger_type"`
	Conditions     string     `json:"conditions" db:"conditions"`
	Actions        string     `json:"actions" db:"actions"`
	ExecutionCount int        `json:"execution_count" db:"execution_count"`
	LastExecutedAt *time.Time `json:"last_executed_at" db:"last_executed_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// Knowledge Base
type KBCategory struct {
	ID          int64     `json:"id" db:"id"`
	OrgID       int64     `json:"org_id" db:"org_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Icon        string    `json:"icon" db:"icon"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	IsPublished bool      `json:"is_published" db:"is_published"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	ArticleCount int      `json:"article_count,omitempty"`
}

type KBArticle struct {
	ID              int64     `json:"id" db:"id"`
	OrgID           int64     `json:"org_id" db:"org_id"`
	CategoryID      *int64    `json:"category_id" db:"category_id"`
	Title           string    `json:"title" db:"title"`
	Slug            string    `json:"slug" db:"slug"`
	Content         string    `json:"content" db:"content"`
	Status          string    `json:"status" db:"status"`
	ViewCount       int       `json:"view_count" db:"view_count"`
	HelpfulCount    int       `json:"helpful_count" db:"helpful_count"`
	NotHelpfulCount int       `json:"not_helpful_count" db:"not_helpful_count"`
	AuthorID        *int64    `json:"author_id" db:"author_id"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
	CategoryName    string    `json:"category_name,omitempty"`
	AuthorName      string    `json:"author_name,omitempty"`
}

// CRM Customer
type Customer struct {
	ID                int64      `json:"id" db:"id"`
	OrgID             int64      `json:"org_id" db:"org_id"`
	Name              string     `json:"name" db:"name"`
	Company           string     `json:"company" db:"company"`
	Country           string     `json:"country" db:"country"`
	Segment           int        `json:"segment" db:"segment"`
	CustomerType      string     `json:"customer_type" db:"customer_type"`
	CustomerTypeOther string     `json:"customer_type_other" db:"customer_type_other"`
	Source            string     `json:"source" db:"source"`
	SourceDetail      string     `json:"source_detail" db:"source_detail"`
	AssignedTo        *int64     `json:"assigned_to" db:"assigned_to"`
	Phone             string     `json:"phone" db:"phone"`
	Email             string     `json:"email" db:"email"`
	Instagram         string     `json:"instagram" db:"instagram"`
	Website           string     `json:"website" db:"website"`
	VK                string     `json:"vk" db:"vk"`
	Telegram          string     `json:"telegram" db:"telegram"`
	PreferredChannel  string     `json:"preferred_channel" db:"preferred_channel"`
	Notes             string     `json:"notes" db:"notes"`
	Orders            string     `json:"orders" db:"orders"`
	LastContactAt     *time.Time `json:"last_contact_at" db:"last_contact_at"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`

	// Joined
	Channels     []CustomerChannel `json:"channels,omitempty"`
	AssignedUser *User             `json:"assigned_user,omitempty"`
}

type CustomerChannel struct {
	ID                int64     `json:"id" db:"id"`
	CustomerID        int64     `json:"customer_id" db:"customer_id"`
	ChannelType       string    `json:"channel_type" db:"channel_type"`
	ChannelIdentifier string    `json:"channel_identifier" db:"channel_identifier"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type SegmentHistory struct {
	ID            int64     `json:"id" db:"id"`
	OrgID         int64     `json:"org_id" db:"org_id"`
	CustomerID    int64     `json:"customer_id" db:"customer_id"`
	OldSegment    int       `json:"old_segment" db:"old_segment"`
	NewSegment    int       `json:"new_segment" db:"new_segment"`
	ChangedBy     *int64    `json:"changed_by" db:"changed_by"`
	ChangedAt     time.Time `json:"changed_at" db:"changed_at"`
	CustomerName  string    `json:"customer_name,omitempty"`
	ChangedByName string    `json:"changed_by_name,omitempty"`
}

// Report types
type ReportOverview struct {
	TotalConversations int     `json:"total_conversations"`
	OpenConversations  int     `json:"open_conversations"`
	AvgResponseTime    float64 `json:"avg_response_time_minutes"`
	AvgResolutionTime  float64 `json:"avg_resolution_time_minutes"`
	ResolvedCount      int     `json:"resolved_count"`
	DailyVolume        []DailyVolume `json:"daily_volume"`
}

type DailyVolume struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type AgentReport struct {
	UserID            int64   `json:"user_id"`
	FullName          string  `json:"full_name"`
	ConversationCount int     `json:"conversation_count"`
	AvgResponseTime   float64 `json:"avg_response_time_minutes"`
	ResolvedCount     int     `json:"resolved_count"`
	ResolutionRate    float64 `json:"resolution_rate"`
}

type ChannelReport struct {
	ChannelType string `json:"channel_type"`
	Count       int    `json:"count"`
}

type MessageAnalytics struct {
	TotalMessages    int              `json:"total_messages"`
	CustomerMessages int              `json:"customer_messages"`
	AgentMessages    int              `json:"agent_messages"`
	BotMessages      int              `json:"bot_messages"`
	Keywords         []KeywordCount   `json:"keywords"`
	HourlyVolume     []HourlyVolume   `json:"hourly_volume"`
	DailyMessages    []DailyVolume    `json:"daily_messages"`
}

type KeywordCount struct {
	Word  string `json:"word"`
	Count int    `json:"count"`
}

type HourlyVolume struct {
	Hour  int `json:"hour"`
	Count int `json:"count"`
}
