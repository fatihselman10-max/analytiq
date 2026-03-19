package bot

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"

	"github.com/repliq/backend/internal/database"
)

// Engine processes incoming messages against bot rules for an organization.
type Engine struct {
	db *database.DB
}

// NewEngine creates a new bot Engine backed by the given database.
func NewEngine(db *database.DB) *Engine {
	return &Engine{db: db}
}

// botRule mirrors the columns we SELECT from the bot_rules table.
type botRule struct {
	ID               int64
	Name             string
	Keywords         []string
	MatchType        string
	ResponseTemplate string
	ChannelTypes     []string
}

// ProcessMessage checks the content of an incoming message against the active
// bot rules for the given organization. If a rule matches it inserts the bot
// response into the messages table, logs the match in bot_logs, and returns
// the response text.
func (e *Engine) ProcessMessage(ctx context.Context, orgID int64, conversationID int64, content string, channelType string) (response string, matched bool, err error) {
	// 1. Fetch active bot rules ordered by priority (highest first).
	rows, err := e.db.Pool.Query(ctx,
		`SELECT id, name, keywords, match_type, response_template, channel_types
		 FROM bot_rules
		 WHERE org_id = $1 AND is_active = true
		 ORDER BY priority DESC`,
		orgID,
	)
	if err != nil {
		return "", false, fmt.Errorf("bot: query rules: %w", err)
	}
	defer rows.Close()

	var rules []botRule
	for rows.Next() {
		var r botRule
		if err := rows.Scan(&r.ID, &r.Name, &r.Keywords, &r.MatchType, &r.ResponseTemplate, &r.ChannelTypes); err != nil {
			return "", false, fmt.Errorf("bot: scan rule: %w", err)
		}
		rules = append(rules, r)
	}
	if err := rows.Err(); err != nil {
		return "", false, fmt.Errorf("bot: iterate rules: %w", err)
	}

	// 2. Resolve the contact name for template interpolation.
	contactName := e.resolveContactName(ctx, conversationID)

	// 3. Evaluate each rule in priority order.
	contentLower := strings.ToLower(content)

	for _, rule := range rules {
		// Filter by channel type if the rule specifies any.
		if len(rule.ChannelTypes) > 0 && !containsString(rule.ChannelTypes, channelType) {
			continue
		}

		matchedKeyword, ok := matchRule(rule, content, contentLower)
		if !ok {
			continue
		}

		// Interpolate the response template.
		response = interpolate(rule.ResponseTemplate, contactName, matchedKeyword)

		// 4. Log the match in bot_logs.
		if _, err := e.db.Pool.Exec(ctx,
			`INSERT INTO bot_logs (org_id, rule_id, conversation_id, matched_keyword, action)
			 VALUES ($1, $2, $3, $4, $5)`,
			orgID, rule.ID, conversationID, matchedKeyword, "auto_reply",
		); err != nil {
			log.Printf("bot: failed to insert bot_log: %v", err)
		}

		// 5. Insert the bot's reply into the messages table.
		if _, err := e.db.Pool.Exec(ctx,
			`INSERT INTO messages (conversation_id, sender_type, content, content_type)
			 VALUES ($1, 'bot', $2, 'text')`,
			conversationID, response,
		); err != nil {
			return "", false, fmt.Errorf("bot: insert message: %w", err)
		}

		return response, true, nil
	}

	return "", false, nil
}

// matchRule checks whether the given content matches the rule's keywords
// according to its match_type. It returns the matched keyword (if any) and
// whether the rule matched.
func matchRule(rule botRule, content, contentLower string) (string, bool) {
	switch rule.MatchType {
	case "contains":
		for _, kw := range rule.Keywords {
			if strings.Contains(contentLower, strings.ToLower(kw)) {
				return kw, true
			}
		}
	case "exact":
		for _, kw := range rule.Keywords {
			if strings.EqualFold(content, kw) {
				return kw, true
			}
		}
	case "regex":
		for _, pattern := range rule.Keywords {
			re, err := regexp.Compile(pattern)
			if err != nil {
				log.Printf("bot: invalid regex %q in rule %d: %v", pattern, rule.ID, err)
				continue
			}
			if re.MatchString(content) {
				return pattern, true
			}
		}
	}
	return "", false
}

// interpolate replaces template placeholders in the response string.
func interpolate(template, contactName, keyword string) string {
	r := strings.NewReplacer(
		"{{contact_name}}", contactName,
		"{{keyword}}", keyword,
	)
	return r.Replace(template)
}

// resolveContactName looks up the contact name associated with a conversation.
func (e *Engine) resolveContactName(ctx context.Context, conversationID int64) string {
	var name string
	err := e.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(c.name, '') FROM contacts c
		 JOIN conversations cv ON cv.contact_id = c.id
		 WHERE cv.id = $1`,
		conversationID,
	).Scan(&name)
	if err != nil {
		return ""
	}
	return name
}

// containsString checks whether a string slice contains the target string.
func containsString(slice []string, target string) bool {
	for _, s := range slice {
		if s == target {
			return true
		}
	}
	return false
}
