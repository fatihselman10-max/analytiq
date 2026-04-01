package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	db *database.DB
}

func NewTaskHandler(db *database.DB) *TaskHandler {
	return &TaskHandler{db: db}
}

func (h *TaskHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, org_id, title, assignee, department, priority, status,
		        due_date, completed_at, tags, notes, kpi_weight, created_at, updated_at
		 FROM tasks WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type taskResponse struct {
		ID          int64      `json:"id"`
		Title       string     `json:"title"`
		Assignee    string     `json:"assignee"`
		Department  string     `json:"department"`
		Priority    string     `json:"priority"`
		Status      string     `json:"status"`
		DueDate     *string    `json:"due_date"`
		CompletedAt *string    `json:"completed_at"`
		Tags        []string   `json:"tags"`
		Notes       []string   `json:"notes"`
		KpiWeight   int        `json:"kpi_weight"`
		CreatedAt   time.Time  `json:"created_at"`
		UpdatedAt   time.Time  `json:"updated_at"`
	}

	items := []taskResponse{}
	for rows.Next() {
		var t taskResponse
		var dueDate, completedAt *time.Time
		if err := rows.Scan(&t.ID, new(int64), &t.Title, &t.Assignee, &t.Department,
			&t.Priority, &t.Status, &dueDate, &completedAt, &t.Tags, &t.Notes,
			&t.KpiWeight, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		if dueDate != nil {
			s := dueDate.Format("2006-01-02")
			t.DueDate = &s
		}
		if completedAt != nil {
			s := completedAt.Format("2006-01-02")
			t.CompletedAt = &s
		}
		if t.Tags == nil {
			t.Tags = []string{}
		}
		if t.Notes == nil {
			t.Notes = []string{}
		}
		items = append(items, t)
	}

	c.JSON(http.StatusOK, gin.H{"tasks": items})
}

func (h *TaskHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Title      string   `json:"title" binding:"required"`
		Assignee   string   `json:"assignee"`
		Department string   `json:"department"`
		Priority   string   `json:"priority"`
		DueDate    string   `json:"due_date"`
		Tags       []string `json:"tags"`
		KpiWeight  int      `json:"kpi_weight"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Department == "" {
		req.Department = "operations"
	}
	if req.Priority == "" {
		req.Priority = "normal"
	}
	if req.KpiWeight < 1 || req.KpiWeight > 5 {
		req.KpiWeight = 3
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var dueDate *time.Time
	if req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = &t
		}
	}

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO tasks (org_id, title, assignee, department, priority, due_date, tags, kpi_weight)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		orgID, req.Title, req.Assignee, req.Department, req.Priority, dueDate, req.Tags, req.KpiWeight,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *TaskHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Title       *string  `json:"title"`
		Assignee    *string  `json:"assignee"`
		Department  *string  `json:"department"`
		Priority    *string  `json:"priority"`
		Status      *string  `json:"status"`
		DueDate     *string  `json:"due_date"`
		CompletedAt *string  `json:"completed_at"`
		Tags        []string `json:"tags"`
		Notes       []string `json:"notes"`
		KpiWeight   *int     `json:"kpi_weight"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Build dynamic update
	query := `UPDATE tasks SET updated_at=NOW()`
	args := []interface{}{}
	argIdx := 1

	if req.Title != nil {
		query += `, title=$` + strconv.Itoa(argIdx)
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Assignee != nil {
		query += `, assignee=$` + strconv.Itoa(argIdx)
		args = append(args, *req.Assignee)
		argIdx++
	}
	if req.Department != nil {
		query += `, department=$` + strconv.Itoa(argIdx)
		args = append(args, *req.Department)
		argIdx++
	}
	if req.Priority != nil {
		query += `, priority=$` + strconv.Itoa(argIdx)
		args = append(args, *req.Priority)
		argIdx++
	}
	if req.Status != nil {
		query += `, status=$` + strconv.Itoa(argIdx)
		args = append(args, *req.Status)
		argIdx++
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			query += `, due_date=NULL`
		} else {
			query += `, due_date=$` + strconv.Itoa(argIdx)
			args = append(args, *req.DueDate)
			argIdx++
		}
	}
	if req.CompletedAt != nil {
		if *req.CompletedAt == "" {
			query += `, completed_at=NULL`
		} else {
			query += `, completed_at=$` + strconv.Itoa(argIdx)
			args = append(args, *req.CompletedAt)
			argIdx++
		}
	}
	if req.Tags != nil {
		query += `, tags=$` + strconv.Itoa(argIdx)
		args = append(args, req.Tags)
		argIdx++
	}
	if req.Notes != nil {
		query += `, notes=$` + strconv.Itoa(argIdx)
		args = append(args, req.Notes)
		argIdx++
	}
	if req.KpiWeight != nil {
		query += `, kpi_weight=$` + strconv.Itoa(argIdx)
		args = append(args, *req.KpiWeight)
		argIdx++
	}

	query += ` WHERE id=$` + strconv.Itoa(argIdx) + ` AND org_id=$` + strconv.Itoa(argIdx+1)
	args = append(args, id, orgID)

	_, err = h.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *TaskHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	h.db.Pool.Exec(ctx, `DELETE FROM tasks WHERE id=$1 AND org_id=$2`, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// AddNote appends a note to a task
func (h *TaskHandler) AddNote(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Note string `json:"note" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE tasks SET notes = array_append(notes, $1), updated_at=NOW() WHERE id=$2 AND org_id=$3`,
		req.Note, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add note"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note added"})
}

// MoveStatus changes task status and sets completed_at if done
func (h *TaskHandler) MoveStatus(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if req.Status == "done" {
		_, err = h.db.Pool.Exec(ctx,
			`UPDATE tasks SET status=$1, completed_at=CURRENT_DATE, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
			req.Status, id, orgID)
	} else {
		_, err = h.db.Pool.Exec(ctx,
			`UPDATE tasks SET status=$1, completed_at=NULL, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
			req.Status, id, orgID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

