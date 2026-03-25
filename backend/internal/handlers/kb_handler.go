package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type KBHandler struct {
	db *database.DB
}

func NewKBHandler(db *database.DB) *KBHandler {
	return &KBHandler{db: db}
}

// --- Categories ---

func (h *KBHandler) ListCategories(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Show system articles (org_id=2) + org's own articles
	rows, err := h.db.Pool.Query(ctx,
		`SELECT c.id, c.name, COALESCE(c.description,''), COALESCE(c.icon,'book'), c.sort_order, c.is_published, c.created_at,
		        COUNT(a.id) FILTER (WHERE a.status='published') as article_count
		 FROM kb_categories c
		 LEFT JOIN kb_articles a ON a.category_id = c.id
		 WHERE c.org_id IN ($1, 2)
		 GROUP BY c.id ORDER BY c.sort_order, c.name`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type catResp struct {
		ID           int64  `json:"id"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Icon         string `json:"icon"`
		SortOrder    int    `json:"sort_order"`
		IsPublished  bool   `json:"is_published"`
		CreatedAt    string `json:"created_at"`
		ArticleCount int    `json:"article_count"`
	}
	items := []catResp{}
	for rows.Next() {
		var cat catResp
		var createdAt time.Time
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.Description, &cat.Icon, &cat.SortOrder, &cat.IsPublished, &createdAt, &cat.ArticleCount); err == nil {
			cat.CreatedAt = createdAt.Format(time.RFC3339)
			items = append(items, cat)
		}
	}
	c.JSON(http.StatusOK, gin.H{"categories": items})
}

func (h *KBHandler) CreateCategory(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Icon == "" {
		req.Icon = "book"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO kb_categories (org_id, name, description, icon) VALUES ($1,$2,$3,$4) RETURNING id`,
		orgID, req.Name, req.Description, req.Icon).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *KBHandler) UpdateCategory(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	c.ShouldBindJSON(&req)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	h.db.Pool.Exec(ctx,
		`UPDATE kb_categories SET name=COALESCE(NULLIF($1,''),name), description=COALESCE(NULLIF($2,''),description),
		 icon=COALESCE(NULLIF($3,''),icon), updated_at=NOW() WHERE id=$4 AND org_id=$5`,
		req.Name, req.Description, req.Icon, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *KBHandler) DeleteCategory(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	h.db.Pool.Exec(ctx, `DELETE FROM kb_categories WHERE id=$1 AND org_id=$2`, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// --- Articles ---

func (h *KBHandler) ListArticles(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := `SELECT a.id, a.category_id, a.title, a.slug, a.status, a.view_count,
	                 a.helpful_count, a.not_helpful_count, a.created_at, a.updated_at,
	                 COALESCE(c.name,''), COALESCE(u.full_name,'Repliq')
	          FROM kb_articles a
	          LEFT JOIN kb_categories c ON c.id = a.category_id
	          LEFT JOIN users u ON u.id = a.author_id
	          WHERE a.org_id IN ($1, 2)`
	args := []interface{}{orgID}

	if catID := c.Query("category_id"); catID != "" {
		query += " AND a.category_id = $2"
		args = append(args, catID)
	}
	if status := c.Query("status"); status != "" {
		query += " AND a.status = $" + strconv.Itoa(len(args)+1)
		args = append(args, status)
	}
	if search := c.Query("search"); search != "" {
		query += " AND (a.title ILIKE $" + strconv.Itoa(len(args)+1) + " OR a.content ILIKE $" + strconv.Itoa(len(args)+1) + ")"
		args = append(args, "%"+search+"%")
	}
	query += " ORDER BY a.updated_at DESC LIMIT 100"

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type artResp struct {
		ID              int64  `json:"id"`
		CategoryID      *int64 `json:"category_id"`
		Title           string `json:"title"`
		Slug            string `json:"slug"`
		Status          string `json:"status"`
		ViewCount       int    `json:"view_count"`
		HelpfulCount    int    `json:"helpful_count"`
		NotHelpfulCount int    `json:"not_helpful_count"`
		CreatedAt       string `json:"created_at"`
		UpdatedAt       string `json:"updated_at"`
		CategoryName    string `json:"category_name"`
		AuthorName      string `json:"author_name"`
	}
	items := []artResp{}
	for rows.Next() {
		var a artResp
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&a.ID, &a.CategoryID, &a.Title, &a.Slug, &a.Status,
			&a.ViewCount, &a.HelpfulCount, &a.NotHelpfulCount,
			&createdAt, &updatedAt, &a.CategoryName, &a.AuthorName); err == nil {
			a.CreatedAt = createdAt.Format(time.RFC3339)
			a.UpdatedAt = updatedAt.Format(time.RFC3339)
			items = append(items, a)
		}
	}
	c.JSON(http.StatusOK, gin.H{"articles": items})
}

func (h *KBHandler) GetArticle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var a struct {
		ID              int64  `json:"id"`
		CategoryID      *int64 `json:"category_id"`
		Title           string `json:"title"`
		Slug            string `json:"slug"`
		Content         string `json:"content"`
		Status          string `json:"status"`
		ViewCount       int    `json:"view_count"`
		HelpfulCount    int    `json:"helpful_count"`
		NotHelpfulCount int    `json:"not_helpful_count"`
		CategoryName    string `json:"category_name"`
		AuthorName      string `json:"author_name"`
	}
	err := h.db.Pool.QueryRow(ctx,
		`SELECT a.id, a.category_id, a.title, a.slug, COALESCE(a.content,''), a.status,
		        a.view_count, a.helpful_count, a.not_helpful_count,
		        COALESCE(c.name,''), COALESCE(u.full_name,'')
		 FROM kb_articles a
		 LEFT JOIN kb_categories c ON c.id = a.category_id
		 LEFT JOIN users u ON u.id = a.author_id
		 WHERE a.id=$1 AND a.org_id IN ($2, 2)`, id, orgID,
	).Scan(&a.ID, &a.CategoryID, &a.Title, &a.Slug, &a.Content, &a.Status,
		&a.ViewCount, &a.HelpfulCount, &a.NotHelpfulCount, &a.CategoryName, &a.AuthorName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"article": a})
}

func (h *KBHandler) CreateArticle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	var req struct {
		CategoryID *int64 `json:"category_id"`
		Title      string `json:"title" binding:"required"`
		Content    string `json:"content"`
		Status     string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	slug := slugify(req.Title)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO kb_articles (org_id, category_id, title, slug, content, status, author_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		orgID, req.CategoryID, req.Title, slug, req.Content, req.Status, userID).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *KBHandler) UpdateArticle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		CategoryID *int64 `json:"category_id"`
		Title      string `json:"title"`
		Content    string `json:"content"`
		Status     string `json:"status"`
	}
	c.ShouldBindJSON(&req)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if req.Title != "" {
		slug := slugify(req.Title)
		h.db.Pool.Exec(ctx,
			`UPDATE kb_articles SET title=$1, slug=$2, content=$3, status=COALESCE(NULLIF($4,''),status),
			 category_id=$5, updated_at=NOW() WHERE id=$6 AND org_id=$7`,
			req.Title, slug, req.Content, req.Status, req.CategoryID, id, orgID)
	} else {
		h.db.Pool.Exec(ctx,
			`UPDATE kb_articles SET content=$1, status=COALESCE(NULLIF($2,''),status),
			 category_id=$3, updated_at=NOW() WHERE id=$4 AND org_id=$5`,
			req.Content, req.Status, req.CategoryID, id, orgID)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *KBHandler) DeleteArticle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	h.db.Pool.Exec(ctx, `DELETE FROM kb_articles WHERE id=$1 AND org_id=$2`, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == ' ' {
			return r
		}
		switch r {
		case 'ı', 'İ':
			return 'i'
		case 'ö', 'Ö':
			return 'o'
		case 'ü', 'Ü':
			return 'u'
		case 'ş', 'Ş':
			return 's'
		case 'ç', 'Ç':
			return 'c'
		case 'ğ', 'Ğ':
			return 'g'
		}
		return -1
	}, s)
	re := regexp.MustCompile(`\s+`)
	s = re.ReplaceAllString(s, "-")
	re = regexp.MustCompile(`-+`)
	s = re.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
