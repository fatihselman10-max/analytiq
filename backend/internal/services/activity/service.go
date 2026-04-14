package activity

import (
	"context"
	"log"
	"time"

	"github.com/repliq/backend/internal/database"
)

type Service struct {
	db       *database.DB
	analyzer *Analyzer
}

func NewService(db *database.DB, apiKey string) *Service {
	return &Service{
		db:       db,
		analyzer: NewAnalyzer(apiKey),
	}
}

// AnalyzeIncoming runs the analyzer on a contact-sent message and inserts pending activities.
// If customerID is nil (no CRM match), it does nothing — pending tasks need a customer.
// Designed to be called in a goroutine, so it owns its own context.
func (s *Service) AnalyzeIncoming(orgID int64, customerID *int64, messageID int64, channel, text string) {
	if customerID == nil || *customerID == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	detections := s.analyzer.Analyze(ctx, text, channel)
	if len(detections) == 0 {
		// No keyword match — try AI fallback for substantive messages
		detections = s.analyzer.AnalyzeWithAI(ctx, text, channel)
	}
	if len(detections) == 0 {
		return
	}

	for _, d := range detections {
		// Dedupe: skip if same activity_type for same customer in pending status within last hour
		var dupID int64
		err := s.db.Pool.QueryRow(ctx,
			`SELECT id FROM customer_activities
			 WHERE customer_id=$1 AND activity_type=$2 AND status='pending'
			   AND created_at > NOW() - INTERVAL '1 hour'
			 LIMIT 1`,
			*customerID, d.ActivityType).Scan(&dupID)
		if err == nil && dupID > 0 {
			continue
		}

		_, err = s.db.Pool.Exec(ctx,
			`INSERT INTO customer_activities
			   (org_id, customer_id, activity_type, title, description, channel, metadata,
			    status, detected_by, confidence, source_message_id, source_text)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11)`,
			orgID, *customerID, d.ActivityType, d.Title, d.Description, channel, d.Metadata,
			d.DetectedBy, d.Confidence, messageID, text,
		)
		if err != nil {
			log.Printf("activity: failed to insert pending: %v", err)
		}
	}
}
