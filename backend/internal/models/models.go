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
