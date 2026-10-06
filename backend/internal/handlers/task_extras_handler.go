package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Due — GET /tasks/due. Giriş yapan personele atanmış, son tarihi bugün veya geçmiş,
// tamamlanmamış görevler (Samet 2026-10-06: "son tarih geldiğinde sisteme girince bildirim").
// tasks.assignee full_name metni tuttuğu için users.full_name ile eşleşir.
func (h *TaskHandler) Due(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var fullName string
	h.db.Pool.QueryRow(ctx, `SELECT COALESCE(full_name,'') FROM users WHERE id=$1`, userID).Scan(&fullName)
	fullName = strings.TrimSpace(fullName)

	type dueTask struct {
		ID           int64   `json:"id"`
		Title        string  `json:"title"`
		DueDate      string  `json:"due_date"`
		Priority     string  `json:"priority"`
		Status       string  `json:"status"`
		CustomerID   *int64  `json:"customer_id"`
		CustomerName string  `json:"customer_name"`
		DaysLate     int     `json:"days_late"`
	}
	items := []dueTask{}
	if fullName == "" {
		c.JSON(http.StatusOK, gin.H{"tasks": items})
		return
	}

	rows, err := h.db.Pool.Query(ctx,
		`SELECT t.id, t.title, t.due_date, COALESCE(t.priority,'normal'), t.status, t.customer_id,
		        COALESCE(NULLIF(cu.company,''), cu.name, ''),
		        ((NOW() AT TIME ZONE 'Europe/Istanbul')::date - t.due_date)
		 FROM tasks t
		 LEFT JOIN customers cu ON cu.id = t.customer_id
		 WHERE t.org_id = $1 AND t.assignee = $2
		   AND t.due_date IS NOT NULL
		   AND t.due_date <= (NOW() AT TIME ZONE 'Europe/Istanbul')::date
		   AND t.status NOT IN ('done','cancelled','canceled')
		 ORDER BY t.due_date ASC, t.id ASC
		 LIMIT 100`, orgID, fullName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var t dueTask
		var due time.Time
		if err := rows.Scan(&t.ID, &t.Title, &due, &t.Priority, &t.Status, &t.CustomerID,
			&t.CustomerName, &t.DaysLate); err != nil {
			continue
		}
		t.DueDate = due.Format("2006-01-02")
		items = append(items, t)
	}
	c.JSON(http.StatusOK, gin.H{"tasks": items})
}

func randomToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// UploadPhoto — POST /tasks/:id/photos (multipart "file"). Numune paket fotoğrafı.
func (h *TaskHandler) UploadPhoto(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	var exists bool
	h.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id=$1 AND org_id=$2)`, taskID, orgID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max 10MB"})
		return
	}
	ctype := file.Header.Get("Content-Type")
	if ctype == "" {
		ctype = "image/jpeg"
	}
	if !strings.HasPrefix(ctype, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only images"})
		return
	}
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "open failed"})
		return
	}
	defer src.Close()
	data, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "read failed"})
		return
	}

	token := randomToken()
	var id int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO task_attachments (org_id, task_id, token, file_name, file_type, file_size, file_data, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		orgID, taskID, token, file.Filename, ctype, file.Size, data, userID).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "url": "/api/v1/task-photos/" + token})
}

// ListPhotos — GET /tasks/:id/photos
func (h *TaskHandler) ListPhotos(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, token, file_name, created_at FROM task_attachments
		 WHERE task_id=$1 AND org_id=$2 ORDER BY id`, taskID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()
	type photo struct {
		ID        int64     `json:"id"`
		URL       string    `json:"url"`
		FileName  string    `json:"file_name"`
		CreatedAt time.Time `json:"created_at"`
	}
	items := []photo{}
	for rows.Next() {
		var p photo
		var token string
		if err := rows.Scan(&p.ID, &token, &p.FileName, &p.CreatedAt); err != nil {
			continue
		}
		p.URL = "/api/v1/task-photos/" + token
		items = append(items, p)
	}
	c.JSON(http.StatusOK, gin.H{"photos": items})
}

// DeletePhoto — DELETE /task-photos/:id
func (h *TaskHandler) DeletePhoto(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	tag, _ := h.db.Pool.Exec(c.Request.Context(),
		`DELETE FROM task_attachments WHERE id=$1 AND org_id=$2`, id, orgID)
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ServePhoto — GET /api/v1/task-photos/:token, public (<img> için), 32 haneli rastgele token ile.
func (h *TaskHandler) ServePhoto(c *gin.Context) {
	token := c.Param("token")
	if len(token) != 32 {
		c.Status(http.StatusNotFound)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var data []byte
	var ctype, fname string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT file_data, file_type, file_name FROM task_attachments WHERE token=$1`, token).Scan(&data, &ctype, &fname)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "private, max-age=86400")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", fname))
	c.Data(http.StatusOK, ctype, data)
}
