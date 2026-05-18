package database

import (
	"context"
	"log"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5"
)

// SlowQueryThreshold, bunun üzerindeki query'ler "slow" sayılır.
const SlowQueryThreshold = 1 * time.Second

// queryTraceKey, ctx içinde TraceQueryStart'tan TraceQueryEnd'e başlangıç zamanı + SQL taşır.
type queryTraceKey struct{}
type queryTrace struct {
	start time.Time
	sql   string
}

// SlowQueryTracer, pgx v5'in QueryTracer interface'ini implement eder.
// Süresi SlowQueryThreshold'u aşan query'leri log + Sentry warning olarak raporlar.
type SlowQueryTracer struct{}

func (t *SlowQueryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, queryTraceKey{}, queryTrace{start: time.Now(), sql: data.SQL})
}

func (t *SlowQueryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	tr, ok := ctx.Value(queryTraceKey{}).(queryTrace)
	if !ok {
		return
	}
	dur := time.Since(tr.start)
	if dur < SlowQueryThreshold {
		return
	}

	// SQL'i kısalt — log + Sentry için (PII riskini azaltır)
	sql := tr.sql
	if len(sql) > 300 {
		sql = sql[:300] + "..."
	}

	log.Printf("[slow-query] %.0fms: %s", float64(dur.Milliseconds()), sql)

	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetTag("subsystem", "db-slow-query")
		scope.SetLevel(sentry.LevelWarning)
		scope.SetContext("query", sentry.Context{
			"duration_ms": dur.Milliseconds(),
			"sql":         sql,
			"error":       errString(data.Err),
		})
		sentry.CaptureMessage("Slow database query (>1s)")
	})
}

func errString(e error) string {
	if e == nil {
		return ""
	}
	return e.Error()
}
