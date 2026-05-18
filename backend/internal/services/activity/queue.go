package activity

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5"
)

// Outbox pattern için kuyruk operasyonları.
// Yazar: webhook handler (Enqueue). Tüketici: worker.go'daki poll loop (Claim/Done/Fail).
// Idempotency: (org_id, message_id) UNIQUE — aynı mesaj iki kez enqueue edilemez.

// Backoff cetveli (attempt_count → bir sonraki denemeden önce beklenecek süre).
// 5'inci başarısızlık sonrası status='failed' kalır, manuel reset gerek.
var backoffSchedule = []time.Duration{
	30 * time.Second,
	2 * time.Minute,
	10 * time.Minute,
	1 * time.Hour,
	6 * time.Hour,
}

const maxAttempts = 5

// Enqueue, mesajı analiz kuyruğuna yazar. Aynı mesaj için duplicate çağrı sessizce
// no-op olur (ON CONFLICT DO NOTHING). Genellikle aynı transaction içinde mesaj
// INSERT'iyle çağrılmalı — ama channel.IncomingHook contract'ı korunduğu için bizim
// kullanımda mesaj INSERT'inden hemen sonra ayrı transaction'da çağrılıyor.
func (s *Service) Enqueue(ctx context.Context, orgID, messageID int64) error {
	_, err := s.db.Pool.Exec(ctx,
		`INSERT INTO analysis_queue (org_id, message_id, status, next_attempt_at)
		 VALUES ($1, $2, 'pending', NOW())
		 ON CONFLICT (org_id, message_id) DO NOTHING`,
		orgID, messageID,
	)
	return err
}

// claimedItem worker'ın işleyeceği kayıt.
type claimedItem struct {
	queueID      int64
	orgID        int64
	messageID    int64
	attemptCount int
}

// claimBatch, hazır pending kayıtları "processing" durumuna geçirir ve döndürür.
// SELECT FOR UPDATE SKIP LOCKED: çoklu worker (gelecekte) aynı satırı işlemez.
// Şu an tek worker var ama pattern korunuyor — multi-replica için hazır.
func (s *Service) claimBatch(ctx context.Context, limit int) ([]claimedItem, error) {
	tx, err := s.db.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx,
		`SELECT id, org_id, message_id, attempt_count
		 FROM analysis_queue
		 WHERE status = 'pending' AND next_attempt_at <= NOW()
		 ORDER BY enqueued_at
		 LIMIT $1
		 FOR UPDATE SKIP LOCKED`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	var items []claimedItem
	for rows.Next() {
		var it claimedItem
		if err := rows.Scan(&it.queueID, &it.orgID, &it.messageID, &it.attemptCount); err != nil {
			rows.Close()
			return nil, err
		}
		items = append(items, it)
	}
	rows.Close()

	if len(items) == 0 {
		return nil, tx.Commit(ctx)
	}

	ids := make([]int64, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.queueID)
	}
	_, err = tx.Exec(ctx,
		`UPDATE analysis_queue
		 SET status = 'processing', last_attempt_at = NOW(), attempt_count = attempt_count + 1
		 WHERE id = ANY($1)`,
		ids,
	)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

// markDone, başarılı işlenmiş kuyruk kaydını 'done' yapar.
func (s *Service) markDone(ctx context.Context, queueID int64) error {
	_, err := s.db.Pool.Exec(ctx,
		`UPDATE analysis_queue SET status='done', last_error=NULL WHERE id=$1`,
		queueID,
	)
	return err
}

// markFailedOrRetry, hatalı işlem için kaydı backoff'la pending'e geri çeker.
// Maxattempts aşıldıysa 'failed' bırakır (manuel müdahale gerekir).
func (s *Service) markFailedOrRetry(ctx context.Context, queueID int64, attemptCount int, errMsg string) {
	if errMsg == "" {
		errMsg = "(boş hata)"
	}
	if len(errMsg) > 400 {
		errMsg = errMsg[:400]
	}
	if attemptCount >= maxAttempts {
		_, _ = s.db.Pool.Exec(ctx,
			`UPDATE analysis_queue SET status='failed', last_error=$1 WHERE id=$2`,
			errMsg, queueID,
		)
		// Sentry: terminal failed (geçici retry'ları gürültü yapmamak için
		// sadece max-attempts dolduğunda gönderiyoruz).
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("subsystem", "ai-outbox")
			scope.SetTag("queue_id", fmt.Sprintf("%d", queueID))
			scope.SetLevel(sentry.LevelError)
			scope.SetContext("outbox", sentry.Context{
				"attempt_count": attemptCount,
				"last_error":    errMsg,
			})
			sentry.CaptureMessage(fmt.Sprintf("analysis_queue failed: %s", errMsg))
		})
		return
	}
	// claim sırasında attempt_count zaten 1 artırıldı; backoffSchedule[attemptCount-1] uygula.
	idx := attemptCount - 1
	if idx < 0 {
		idx = 0
	} else if idx >= len(backoffSchedule) {
		idx = len(backoffSchedule) - 1
	}
	delay := backoffSchedule[idx]
	_, _ = s.db.Pool.Exec(ctx,
		`UPDATE analysis_queue
		 SET status='pending', next_attempt_at = NOW() + $1::interval, last_error=$2
		 WHERE id=$3`,
		delay.String(), errMsg, queueID,
	)
}

// recordAttempt: analysis_attempts tablosuna her denemenin metriğini düşer (coverage için).
func (s *Service) recordAttempt(ctx context.Context, orgID, messageID int64, duration time.Duration, matchedBy string, producedActivityID *int64, errMsg string) {
	_, _ = s.db.Pool.Exec(ctx,
		`INSERT INTO analysis_attempts (org_id, message_id, duration_ms, matched_by, produced_activity_id, error)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		orgID, messageID, duration.Milliseconds(), matchedBy, producedActivityID, errMsg,
	)
}

// errCanceled, worker stop sinyali geldiğinde ctx.Err() veya direkt context.Canceled döner.
var errCanceled = errors.New("queue worker canceled")
