package handlers

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/repliq/backend/internal/database"
)

type FabricHandler struct {
	db *database.DB
}

func NewFabricHandler(db *database.DB) *FabricHandler {
	return &FabricHandler{db: db}
}

type fabricResp struct {
	ID          int64     `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Season      string    `json:"season"`
	Width       string    `json:"width"`
	Composition string    `json:"composition"`
	Gauge       string    `json:"gauge"`
	Notes       string    `json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Images      []fabImg  `json:"images"`
}

type fabImg struct {
	ID       int64  `json:"id"`
	FileName string `json:"file_name"`
	FileType string `json:"file_type"`
	FileSize int64  `json:"file_size"`
	URL      string `json:"url"`
}

// List — search by code/name + season filter
func (h *FabricHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	q := strings.TrimSpace(c.Query("q"))
	season := strings.TrimSpace(c.Query("season"))

	sql := `SELECT id, code, name, season, width, composition, gauge, notes, created_at, updated_at
	        FROM fabrics WHERE org_id = $1`
	args := []interface{}{orgID}
	idx := 2
	if q != "" {
		sql += fmt.Sprintf(" AND (code ILIKE $%d OR name ILIKE $%d)", idx, idx+1)
		args = append(args, q+"%", "%"+q+"%")
		idx += 2
	}
	if season != "" {
		sql += fmt.Sprintf(" AND season = $%d", idx)
		args = append(args, season)
		idx++
	}
	sql += " ORDER BY code ASC"

	rows, err := h.db.Pool.Query(ctx, sql, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	fabrics := []fabricResp{}
	ids := []int64{}
	for rows.Next() {
		var f fabricResp
		if err := rows.Scan(&f.ID, &f.Code, &f.Name, &f.Season, &f.Width,
			&f.Composition, &f.Gauge, &f.Notes, &f.CreatedAt, &f.UpdatedAt); err != nil {
			continue
		}
		f.Images = []fabImg{}
		fabrics = append(fabrics, f)
		ids = append(ids, f.ID)
	}

	// Batch load images
	if len(ids) > 0 {
		imgRows, err := h.db.Pool.Query(ctx,
			`SELECT id, fabric_id, file_name, file_type, file_size
			 FROM fabric_images WHERE fabric_id = ANY($1)
			 ORDER BY fabric_id, sort_order, id`, ids)
		if err == nil {
			defer imgRows.Close()
			imgMap := map[int64][]fabImg{}
			for imgRows.Next() {
				var img fabImg
				var fabID int64
				if err := imgRows.Scan(&img.ID, &fabID, &img.FileName, &img.FileType, &img.FileSize); err != nil {
					continue
				}
				img.URL = fmt.Sprintf("/api/v1/fabric-images/%d", img.ID)
				imgMap[fabID] = append(imgMap[fabID], img)
			}
			for i := range fabrics {
				if imgs, ok := imgMap[fabrics[i].ID]; ok {
					fabrics[i].Images = imgs
				}
			}
		}
	}

	c.JSON(200, gin.H{"fabrics": fabrics})
}

// Get one fabric
func (h *FabricHandler) Get(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var f fabricResp
	err = h.db.Pool.QueryRow(ctx,
		`SELECT id, code, name, season, width, composition, gauge, notes, created_at, updated_at
		 FROM fabrics WHERE id = $1 AND org_id = $2`, id, orgID).Scan(
		&f.ID, &f.Code, &f.Name, &f.Season, &f.Width,
		&f.Composition, &f.Gauge, &f.Notes, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	f.Images = []fabImg{}

	imgRows, _ := h.db.Pool.Query(ctx,
		`SELECT id, file_name, file_type, file_size FROM fabric_images
		 WHERE fabric_id = $1 ORDER BY sort_order, id`, id)
	defer imgRows.Close()
	for imgRows.Next() {
		var img fabImg
		imgRows.Scan(&img.ID, &img.FileName, &img.FileType, &img.FileSize)
		img.URL = fmt.Sprintf("/api/v1/fabric-images/%d", img.ID)
		f.Images = append(f.Images, img)
	}

	c.JSON(200, gin.H{"fabric": f})
}

// Create
func (h *FabricHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Code        string `json:"code" binding:"required"`
		Name        string `json:"name"`
		Season      string `json:"season"`
		Width       string `json:"width"`
		Composition string `json:"composition"`
		Gauge       string `json:"gauge"`
		Notes       string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO fabrics (org_id, code, name, season, width, composition, gauge, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		orgID, req.Code, req.Name, req.Season, req.Width,
		req.Composition, req.Gauge, req.Notes).Scan(&id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"id": id})
}

// Update
func (h *FabricHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}
	var req struct {
		Code        *string `json:"code"`
		Name        *string `json:"name"`
		Season      *string `json:"season"`
		Width       *string `json:"width"`
		Composition *string `json:"composition"`
		Gauge       *string `json:"gauge"`
		Notes       *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	sql := "UPDATE fabrics SET updated_at=NOW()"
	args := []interface{}{}
	i := 1
	if req.Code != nil {
		sql += fmt.Sprintf(", code=$%d", i)
		args = append(args, *req.Code)
		i++
	}
	if req.Name != nil {
		sql += fmt.Sprintf(", name=$%d", i)
		args = append(args, *req.Name)
		i++
	}
	if req.Season != nil {
		sql += fmt.Sprintf(", season=$%d", i)
		args = append(args, *req.Season)
		i++
	}
	if req.Width != nil {
		sql += fmt.Sprintf(", width=$%d", i)
		args = append(args, *req.Width)
		i++
	}
	if req.Composition != nil {
		sql += fmt.Sprintf(", composition=$%d", i)
		args = append(args, *req.Composition)
		i++
	}
	if req.Gauge != nil {
		sql += fmt.Sprintf(", gauge=$%d", i)
		args = append(args, *req.Gauge)
		i++
	}
	if req.Notes != nil {
		sql += fmt.Sprintf(", notes=$%d", i)
		args = append(args, *req.Notes)
		i++
	}
	sql += fmt.Sprintf(" WHERE id=$%d AND org_id=$%d", i, i+1)
	args = append(args, id, orgID)

	if _, err := h.db.Pool.Exec(ctx, sql, args...); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// Delete fabric (cascades images)
func (h *FabricHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	tag, _ := h.db.Pool.Exec(ctx, `DELETE FROM fabrics WHERE id=$1 AND org_id=$2`, id, orgID)
	if tag.RowsAffected() == 0 {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// UploadImage — multipart/form-data file
func (h *FabricHandler) UploadImage(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	fabID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}

	// Verify ownership
	var exists bool
	h.db.Pool.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM fabrics WHERE id=$1 AND org_id=$2)`, fabID, orgID).Scan(&exists)
	if !exists {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "file required"})
		return
	}
	if file.Size > 10*1024*1024 {
		c.JSON(400, gin.H{"error": "max 10MB"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(500, gin.H{"error": "open failed"})
		return
	}
	defer src.Close()
	data, err := io.ReadAll(src)
	if err != nil {
		c.JSON(500, gin.H{"error": "read failed"})
		return
	}

	ctype := file.Header.Get("Content-Type")
	if ctype == "" {
		ctype = "image/jpeg"
	}

	var sortOrder int
	h.db.Pool.QueryRow(c.Request.Context(),
		`SELECT COALESCE(MAX(sort_order)+1, 0) FROM fabric_images WHERE fabric_id=$1`, fabID).Scan(&sortOrder)

	var imgID int64
	err = h.db.Pool.QueryRow(c.Request.Context(),
		`INSERT INTO fabric_images (fabric_id, file_name, file_type, file_size, file_data, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		fabID, file.Filename, ctype, file.Size, data, sortOrder).Scan(&imgID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(201, gin.H{
		"id":        imgID,
		"url":       fmt.Sprintf("/api/v1/fabric-images/%d", imgID),
		"file_name": file.Filename,
	})
}

// DeleteImage
func (h *FabricHandler) DeleteImage(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	imgID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	tag, _ := h.db.Pool.Exec(ctx,
		`DELETE FROM fabric_images WHERE id=$1 AND fabric_id IN (SELECT id FROM fabrics WHERE org_id=$2)`,
		imgID, orgID)
	if tag.RowsAffected() == 0 {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ServeImage — public (no auth) so <img> tags can load; returns binary
func (h *FabricHandler) ServeImage(c *gin.Context) {
	imgID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var data []byte
	var ctype, fname string
	err = h.db.Pool.QueryRow(ctx,
		`SELECT file_data, COALESCE(file_type,'image/jpeg'), COALESCE(file_name,'')
		 FROM fabric_images WHERE id = $1`, imgID).Scan(&data, &ctype, &fname)
	if err != nil {
		c.JSON(404, gin.H{"error": "Not found"})
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, fname))
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(200, ctype, data)
}
