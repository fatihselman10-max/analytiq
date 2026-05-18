package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// _migrations tablosu: hangi migration ne zaman uygulandığını izler.
// Bunu boot'ta ilk iş olarak yaratıyoruz; sonraki migration'lar buna kayıt düşer.
const migrationsTableDDL = `
CREATE TABLE IF NOT EXISTS _migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50) NOT NULL DEFAULT 'inline'
);
`

// EnsureMigrationsTable, tracking tablosunun var olduğunu garantiler.
// İdempotent — her boot'ta güvenle çağrılabilir.
func (db *DB) EnsureMigrationsTable(ctx context.Context) error {
	_, err := db.Pool.Exec(ctx, migrationsTableDDL)
	return err
}

// IsMigrationApplied, verilen version'un _migrations tablosunda olup olmadığını döner.
func (db *DB) IsMigrationApplied(ctx context.Context, version string) (bool, error) {
	var exists bool
	err := db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM _migrations WHERE version = $1)`,
		version,
	).Scan(&exists)
	return exists, err
}

// MarkMigrationApplied, başarıyla çalıştırılan migration'ı tracking tablosuna yazar.
// source: 'inline' (main.go array) veya 'file' (migrations/*.up.sql)
func (db *DB) MarkMigrationApplied(ctx context.Context, version, source string) error {
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO _migrations (version, source) VALUES ($1, $2)
		 ON CONFLICT (version) DO NOTHING`,
		version, source,
	)
	return err
}

// MigrationVersion, son uygulanmış migration version'unu döner (lexicographic max).
// Postdeploy smoke endpoint için.
func (db *DB) MigrationVersion(ctx context.Context) (string, error) {
	var v string
	err := db.Pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(version), '') FROM _migrations`,
	).Scan(&v)
	return v, err
}

// ApplyMigration, single migration'ı şu sırayla uygular:
// 1) Daha önce uygulanmışsa skip (log)
// 2) Yoksa exec et
// 3) Başarılıysa _migrations'a yaz
// Hata olursa loglar ve devam eder (mevcut runMigrations'ın "warning" davranışı).
// Idempotent SQL beklenir (CREATE/ALTER ... IF NOT EXISTS).
func (db *DB) ApplyMigration(ctx context.Context, version, source, sqlText string) {
	applied, err := db.IsMigrationApplied(ctx, version)
	if err != nil {
		log.Printf("Migration %s tracking check failed: %v", version, err)
		// devam et — IDEMPOTENT olduğu için exec güvenli
	} else if applied {
		// Sessizce skip — boot log'unu boğmasın
		return
	}

	if _, err := db.Pool.Exec(ctx, sqlText); err != nil {
		log.Printf("Migration %s warning: %v", version, err)
		return
	}

	if err := db.MarkMigrationApplied(ctx, version, source); err != nil {
		log.Printf("Migration %s applied but tracking insert failed: %v", version, err)
	} else {
		log.Printf("Migration %s applied successfully (source=%s)", version, source)
	}
}

// ApplyFileMigrations, verilen dizindeki *.up.sql dosyalarını sıralı uygular.
// Dosya adı = version (örn. "014_analysis_outbox.up.sql" → version "014_analysis_outbox").
// Dizin yoksa sessizce çıkar (dev için backend/migrations, prod container'da /app/migrations).
// Cumartesi sorununu (filesystem migration'lar deploy edildi ama hiç uygulanmadı) çözer.
func (db *DB) ApplyFileMigrations(ctx context.Context, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("migrations dir %s not found, skipping file migrations", dir)
			return nil
		}
		return fmt.Errorf("read migrations dir %s: %w", dir, err)
	}

	type mig struct{ version, sql string }
	migs := []mig{}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		version := strings.TrimSuffix(name, ".up.sql")
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			log.Printf("Migration %s read failed: %v", version, err)
			continue
		}
		migs = append(migs, mig{version: version, sql: string(data)})
	}

	// Lexicographic sort — dosya adları "001_", "002_" ... ile başladığı için
	// numeric sıra ile aynı sonucu verir.
	sort.Slice(migs, func(i, j int) bool { return migs[i].version < migs[j].version })

	for _, m := range migs {
		db.ApplyMigration(ctx, m.version, "file", m.sql)
	}
	return nil
}
