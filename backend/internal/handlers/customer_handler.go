package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/repliq/backend/internal/database"
)

type CustomerHandler struct {
	db *database.DB
}

func NewCustomerHandler(db *database.DB) *CustomerHandler {
	return &CustomerHandler{db: db}
}

func (h *CustomerHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := `SELECT c.id, c.org_id, c.name, COALESCE(c.company,''), COALESCE(c.country,''),
	                  c.segment, COALESCE(c.customer_type,''), COALESCE(c.customer_type_other,''),
	                  COALESCE(c.source,''), COALESCE(c.source_detail,''),
	                  c.assigned_to, COALESCE(c.phone,''), COALESCE(c.email,''),
	                  COALESCE(c.instagram,''), COALESCE(c.notes,''), COALESCE(c.orders,''),
	                  c.last_contact_at, c.created_at, c.updated_at,
	                  COALESCE(u.full_name, '') as assigned_name
	           FROM customers c
	           LEFT JOIN users u ON c.assigned_to = u.id
	           WHERE c.org_id = $1`
	args := []interface{}{orgID}
	argIdx := 2

	if s := c.Query("segment"); s != "" {
		query += fmt.Sprintf(" AND c.segment = $%d", argIdx)
		args = append(args, s)
		argIdx++
	}
	if s := c.Query("country"); s != "" {
		query += fmt.Sprintf(" AND c.country = $%d", argIdx)
		args = append(args, s)
		argIdx++
	}
	if s := c.Query("source"); s != "" {
		query += fmt.Sprintf(" AND c.source = $%d", argIdx)
		args = append(args, s)
		argIdx++
	}
	if s := c.Query("customer_type"); s != "" {
		query += fmt.Sprintf(" AND c.customer_type = $%d", argIdx)
		args = append(args, s)
		argIdx++
	}
	if s := c.Query("assigned_to"); s != "" {
		query += fmt.Sprintf(" AND c.assigned_to = $%d", argIdx)
		args = append(args, s)
		argIdx++
	}
	if s := c.Query("search"); s != "" {
		query += fmt.Sprintf(" AND (c.name ILIKE $%d OR c.company ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+s+"%")
		argIdx++
	}

	query += " ORDER BY c.last_contact_at DESC NULLS LAST, c.created_at DESC"

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch customers"})
		return
	}
	defer rows.Close()

	type chResp struct {
		ID                int64  `json:"id"`
		ChannelType       string `json:"channel_type"`
		ChannelIdentifier string `json:"channel_identifier"`
	}

	type customerResp struct {
		ID                int64      `json:"id"`
		Name              string     `json:"name"`
		Company           string     `json:"company"`
		Country           string     `json:"country"`
		Segment           int        `json:"segment"`
		CustomerType      string     `json:"customer_type"`
		CustomerTypeOther string     `json:"customer_type_other"`
		Source            string     `json:"source"`
		SourceDetail      string     `json:"source_detail"`
		AssignedTo        *int64     `json:"assigned_to"`
		Phone             string     `json:"phone"`
		Email             string     `json:"email"`
		Instagram         string     `json:"instagram"`
		Notes             string     `json:"notes"`
		Orders            string     `json:"orders"`
		LastContactAt     *time.Time `json:"last_contact_at"`
		CreatedAt         time.Time  `json:"created_at"`
		UpdatedAt         time.Time  `json:"updated_at"`
		AssignedName      string     `json:"assigned_name"`
		Channels          []chResp   `json:"channels"`
	}

	var customers []customerResp
	var ids []int64

	for rows.Next() {
		var cu customerResp
		if err := rows.Scan(&cu.ID, new(int64), &cu.Name, &cu.Company, &cu.Country,
			&cu.Segment, &cu.CustomerType, &cu.CustomerTypeOther,
			&cu.Source, &cu.SourceDetail, &cu.AssignedTo,
			&cu.Phone, &cu.Email, &cu.Instagram, &cu.Notes, &cu.Orders,
			&cu.LastContactAt, &cu.CreatedAt, &cu.UpdatedAt, &cu.AssignedName); err != nil {
			continue
		}
		cu.Channels = []chResp{}
		customers = append(customers, cu)
		ids = append(ids, cu.ID)
	}

	if customers == nil {
		customers = []customerResp{}
	}

	// Batch load channels
	if len(ids) > 0 {
		chRows, err := h.db.Pool.Query(ctx,
			`SELECT id, customer_id, channel_type, COALESCE(channel_identifier,'')
			 FROM customer_channels WHERE customer_id = ANY($1)`, ids)
		if err == nil {
			defer chRows.Close()
			chMap := map[int64][]chResp{}
			for chRows.Next() {
				var ch chResp
				var custID int64
				if err := chRows.Scan(&ch.ID, &custID, &ch.ChannelType, &ch.ChannelIdentifier); err != nil {
					continue
				}
				chMap[custID] = append(chMap[custID], ch)
			}
			for i := range customers {
				if chs, ok := chMap[customers[i].ID]; ok {
					customers[i].Channels = chs
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"customers": customers})
}

func (h *CustomerHandler) Get(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var cu struct {
		ID                int64      `json:"id"`
		Name              string     `json:"name"`
		Company           string     `json:"company"`
		Country           string     `json:"country"`
		Segment           int        `json:"segment"`
		CustomerType      string     `json:"customer_type"`
		CustomerTypeOther string     `json:"customer_type_other"`
		Source            string     `json:"source"`
		SourceDetail      string     `json:"source_detail"`
		AssignedTo        *int64     `json:"assigned_to"`
		Phone             string     `json:"phone"`
		Email             string     `json:"email"`
		Instagram         string     `json:"instagram"`
		Notes             string     `json:"notes"`
		Orders            string     `json:"orders"`
		LastContactAt     *time.Time `json:"last_contact_at"`
		CreatedAt         time.Time  `json:"created_at"`
		UpdatedAt         time.Time  `json:"updated_at"`
		AssignedName      string     `json:"assigned_name"`
	}

	err = h.db.Pool.QueryRow(ctx,
		`SELECT c.id, c.name, COALESCE(c.company,''), COALESCE(c.country,''),
		        c.segment, COALESCE(c.customer_type,''), COALESCE(c.customer_type_other,''),
		        COALESCE(c.source,''), COALESCE(c.source_detail,''),
		        c.assigned_to, COALESCE(c.phone,''), COALESCE(c.email,''),
		        COALESCE(c.instagram,''), COALESCE(c.notes,''), COALESCE(c.orders,''),
		        c.last_contact_at, c.created_at, c.updated_at,
		        COALESCE(u.full_name, '') as assigned_name
		 FROM customers c
		 LEFT JOIN users u ON c.assigned_to = u.id
		 WHERE c.id = $1 AND c.org_id = $2`, id, orgID,
	).Scan(&cu.ID, &cu.Name, &cu.Company, &cu.Country,
		&cu.Segment, &cu.CustomerType, &cu.CustomerTypeOther,
		&cu.Source, &cu.SourceDetail, &cu.AssignedTo,
		&cu.Phone, &cu.Email, &cu.Instagram, &cu.Notes, &cu.Orders,
		&cu.LastContactAt, &cu.CreatedAt, &cu.UpdatedAt, &cu.AssignedName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	// Load channels
	type chResp struct {
		ID                int64  `json:"id"`
		ChannelType       string `json:"channel_type"`
		ChannelIdentifier string `json:"channel_identifier"`
	}
	channels := []chResp{}

	chRows, err := h.db.Pool.Query(ctx,
		`SELECT id, channel_type, COALESCE(channel_identifier,'') FROM customer_channels WHERE customer_id = $1`, id)
	if err == nil {
		defer chRows.Close()
		for chRows.Next() {
			var ch chResp
			if err := chRows.Scan(&ch.ID, &ch.ChannelType, &ch.ChannelIdentifier); err != nil {
				continue
			}
			channels = append(channels, ch)
		}
	}

	// Load segment history
	type histResp struct {
		OldSegment    int       `json:"old_segment"`
		NewSegment    int       `json:"new_segment"`
		ChangedByName string    `json:"changed_by_name"`
		ChangedAt     time.Time `json:"changed_at"`
	}
	history := []histResp{}

	hRows, err := h.db.Pool.Query(ctx,
		`SELECT sh.old_segment, sh.new_segment, COALESCE(u.full_name,'Sistem'), sh.changed_at
		 FROM segment_history sh
		 LEFT JOIN users u ON sh.changed_by = u.id
		 WHERE sh.customer_id = $1
		 ORDER BY sh.changed_at DESC LIMIT 20`, id)
	if err == nil {
		defer hRows.Close()
		for hRows.Next() {
			var h histResp
			if err := hRows.Scan(&h.OldSegment, &h.NewSegment, &h.ChangedByName, &h.ChangedAt); err != nil {
				continue
			}
			history = append(history, h)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"customer":        cu,
		"channels":        channels,
		"segment_history": history,
	})
}

func (h *CustomerHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")

	var req struct {
		Name              string `json:"name" binding:"required"`
		Company           string `json:"company"`
		Country           string `json:"country"`
		Segment           int    `json:"segment"`
		CustomerType      string `json:"customer_type"`
		CustomerTypeOther string `json:"customer_type_other"`
		Source            string `json:"source"`
		SourceDetail      string `json:"source_detail"`
		AssignedTo        *int64 `json:"assigned_to"`
		Phone             string `json:"phone"`
		Email             string `json:"email"`
		Instagram         string `json:"instagram"`
		Notes             string `json:"notes"`
		Channels          []struct {
			ChannelType       string `json:"channel_type"`
			ChannelIdentifier string `json:"channel_identifier"`
		} `json:"channels"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Segment < 1 || req.Segment > 4 {
		req.Segment = 4
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO customers (org_id, name, company, country, segment, customer_type, customer_type_other,
		                        source, source_detail, assigned_to, phone, email, instagram, notes, last_contact_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()) RETURNING id`,
		orgID, req.Name, req.Company, req.Country, req.Segment,
		req.CustomerType, req.CustomerTypeOther, req.Source, req.SourceDetail,
		req.AssignedTo, req.Phone, req.Email, req.Instagram, req.Notes,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer"})
		return
	}

	// Insert channels
	for _, ch := range req.Channels {
		if ch.ChannelType == "" {
			continue
		}
		h.db.Pool.Exec(ctx,
			`INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
			 VALUES ($1,$2,$3) ON CONFLICT (customer_id, channel_type) DO NOTHING`,
			id, ch.ChannelType, ch.ChannelIdentifier)
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *CustomerHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name              *string `json:"name"`
		Company           *string `json:"company"`
		Country           *string `json:"country"`
		Segment           *int    `json:"segment"`
		CustomerType      *string `json:"customer_type"`
		CustomerTypeOther *string `json:"customer_type_other"`
		Source            *string `json:"source"`
		SourceDetail      *string `json:"source_detail"`
		AssignedTo        *int64  `json:"assigned_to"`
		Phone             *string `json:"phone"`
		Email             *string `json:"email"`
		Instagram         *string `json:"instagram"`
		Notes             *string `json:"notes"`
		Orders            *string `json:"orders"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Check segment change for audit
	if req.Segment != nil {
		var oldSegment int
		err := h.db.Pool.QueryRow(ctx,
			`SELECT segment FROM customers WHERE id = $1 AND org_id = $2`, id, orgID,
		).Scan(&oldSegment)
		if err == nil && oldSegment != *req.Segment {
			h.db.Pool.Exec(ctx,
				`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by)
				 VALUES ($1,$2,$3,$4,$5)`,
				orgID, id, oldSegment, *req.Segment, userID)
		}
	}

	// Dynamic update
	query := `UPDATE customers SET updated_at=NOW()`
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name=$%d", argIdx)
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Company != nil {
		query += fmt.Sprintf(", company=$%d", argIdx)
		args = append(args, *req.Company)
		argIdx++
	}
	if req.Country != nil {
		query += fmt.Sprintf(", country=$%d", argIdx)
		args = append(args, *req.Country)
		argIdx++
	}
	if req.Segment != nil {
		query += fmt.Sprintf(", segment=$%d", argIdx)
		args = append(args, *req.Segment)
		argIdx++
	}
	if req.CustomerType != nil {
		query += fmt.Sprintf(", customer_type=$%d", argIdx)
		args = append(args, *req.CustomerType)
		argIdx++
	}
	if req.CustomerTypeOther != nil {
		query += fmt.Sprintf(", customer_type_other=$%d", argIdx)
		args = append(args, *req.CustomerTypeOther)
		argIdx++
	}
	if req.Source != nil {
		query += fmt.Sprintf(", source=$%d", argIdx)
		args = append(args, *req.Source)
		argIdx++
	}
	if req.SourceDetail != nil {
		query += fmt.Sprintf(", source_detail=$%d", argIdx)
		args = append(args, *req.SourceDetail)
		argIdx++
	}
	if req.AssignedTo != nil {
		query += fmt.Sprintf(", assigned_to=$%d", argIdx)
		args = append(args, *req.AssignedTo)
		argIdx++
	}
	if req.Phone != nil {
		query += fmt.Sprintf(", phone=$%d", argIdx)
		args = append(args, *req.Phone)
		argIdx++
	}
	if req.Email != nil {
		query += fmt.Sprintf(", email=$%d", argIdx)
		args = append(args, *req.Email)
		argIdx++
	}
	if req.Instagram != nil {
		query += fmt.Sprintf(", instagram=$%d", argIdx)
		args = append(args, *req.Instagram)
		argIdx++
	}
	if req.Notes != nil {
		query += fmt.Sprintf(", notes=$%d", argIdx)
		args = append(args, *req.Notes)
		argIdx++
	}
	if req.Orders != nil {
		query += fmt.Sprintf(", orders=$%d", argIdx)
		args = append(args, *req.Orders)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id=$%d AND org_id=$%d", argIdx, argIdx+1)
	args = append(args, id, orgID)

	_, err = h.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *CustomerHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	h.db.Pool.Exec(ctx, `DELETE FROM customers WHERE id=$1 AND org_id=$2`, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *CustomerHandler) AddChannel(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		ChannelType       string `json:"channel_type" binding:"required"`
		ChannelIdentifier string `json:"channel_identifier"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Verify customer belongs to org
	var exists bool
	h.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM customers WHERE id=$1 AND org_id=$2)`, id, orgID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var chID int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
		 VALUES ($1,$2,$3) ON CONFLICT (customer_id, channel_type) DO UPDATE SET channel_identifier=$3
		 RETURNING id`,
		id, req.ChannelType, req.ChannelIdentifier).Scan(&chID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add channel"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": chID})
}

func (h *CustomerHandler) RemoveChannel(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	customerID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}
	channelID, err := strconv.ParseInt(c.Param("channel_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	h.db.Pool.Exec(ctx,
		`DELETE FROM customer_channels WHERE id=$1 AND customer_id IN (SELECT id FROM customers WHERE id=$2 AND org_id=$3)`,
		channelID, customerID, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *CustomerHandler) Import(c *gin.Context) {
	orgID := c.GetInt64("org_id")

	var req struct {
		Customers []struct {
			Name         string `json:"name"`
			Company      string `json:"company"`
			Country      string `json:"country"`
			Segment      int    `json:"segment"`
			CustomerType string `json:"customer_type"`
			Source       string `json:"source"`
			SourceDetail string `json:"source_detail"`
			Phone        string `json:"phone"`
			Email        string `json:"email"`
			Instagram    string `json:"instagram"`
			Notes        string `json:"notes"`
		} `json:"customers" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	imported := 0
	for _, cu := range req.Customers {
		if cu.Name == "" {
			continue
		}
		seg := cu.Segment
		if seg < 1 || seg > 4 {
			seg = 4
		}

		var id int64
		err := h.db.Pool.QueryRow(ctx,
			`INSERT INTO customers (org_id, name, company, country, segment, customer_type, source, source_detail, phone, email, instagram, notes, last_contact_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING id`,
			orgID, cu.Name, cu.Company, cu.Country, seg, cu.CustomerType, cu.Source, cu.SourceDetail,
			cu.Phone, cu.Email, cu.Instagram, cu.Notes,
		).Scan(&id)
		if err != nil {
			continue
		}

		// Auto-add channels from provided info
		if cu.Phone != "" {
			h.db.Pool.Exec(ctx, `INSERT INTO customer_channels (customer_id, channel_type, channel_identifier) VALUES ($1,'WhatsApp',$2) ON CONFLICT DO NOTHING`, id, cu.Phone)
		}
		if cu.Email != "" {
			h.db.Pool.Exec(ctx, `INSERT INTO customer_channels (customer_id, channel_type, channel_identifier) VALUES ($1,'Email',$2) ON CONFLICT DO NOTHING`, id, cu.Email)
		}
		if cu.Instagram != "" {
			h.db.Pool.Exec(ctx, `INSERT INTO customer_channels (customer_id, channel_type, channel_identifier) VALUES ($1,'Instagram',$2) ON CONFLICT DO NOTHING`, id, cu.Instagram)
		}
		imported++
	}

	c.JSON(http.StatusOK, gin.H{"imported": imported})
}

// CRM Report: Segment overview
func (h *CustomerHandler) SegmentOverview(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := `SELECT segment, COUNT(*) FROM customers WHERE org_id = $1`
	args := []interface{}{orgID}
	if country := c.Query("country"); country != "" {
		query += ` AND country = $2`
		args = append(args, country)
	}
	query += ` GROUP BY segment ORDER BY segment`

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type segCount struct {
		Segment int `json:"segment"`
		Count   int `json:"count"`
	}
	result := []segCount{}
	total := 0
	for rows.Next() {
		var sc segCount
		if err := rows.Scan(&sc.Segment, &sc.Count); err != nil {
			continue
		}
		total += sc.Count
		result = append(result, sc)
	}

	c.JSON(http.StatusOK, gin.H{"segments": result, "total": total})
}

// CRM Report: Segment changes
func (h *CustomerHandler) SegmentChanges(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	days := 30
	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			days = parsed
		}
	}

	rows, err := h.db.Pool.Query(ctx,
		`SELECT sh.old_segment, sh.new_segment, c.name, COALESCE(c.company,''),
		        COALESCE(u.full_name,'Sistem'), sh.changed_at
		 FROM segment_history sh
		 JOIN customers c ON sh.customer_id = c.id
		 LEFT JOIN users u ON sh.changed_by = u.id
		 WHERE sh.org_id = $1 AND sh.changed_at >= NOW() - ($2 || ' days')::INTERVAL
		 ORDER BY sh.changed_at DESC`, orgID, strconv.Itoa(days))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type change struct {
		OldSegment int       `json:"old_segment"`
		NewSegment int       `json:"new_segment"`
		Name       string    `json:"name"`
		Company    string    `json:"company"`
		ChangedBy  string    `json:"changed_by"`
		ChangedAt  time.Time `json:"changed_at"`
	}
	changes := []change{}
	for rows.Next() {
		var ch change
		if err := rows.Scan(&ch.OldSegment, &ch.NewSegment, &ch.Name, &ch.Company, &ch.ChangedBy, &ch.ChangedAt); err != nil {
			continue
		}
		changes = append(changes, ch)
	}

	c.JSON(http.StatusOK, gin.H{"changes": changes})
}

// CRM Report: Weekly new customers
func (h *CustomerHandler) WeeklyNew(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT date_trunc('week', created_at)::date as week, country, COUNT(*)
		 FROM customers WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '90 days'
		 GROUP BY week, country ORDER BY week DESC, country`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type weekRow struct {
		Week    string `json:"week"`
		Country string `json:"country"`
		Count   int    `json:"count"`
	}
	result := []weekRow{}
	for rows.Next() {
		var w weekRow
		var weekDate time.Time
		if err := rows.Scan(&weekDate, &w.Country, &w.Count); err != nil {
			continue
		}
		w.Week = weekDate.Format("2006-01-02")
		result = append(result, w)
	}

	c.JSON(http.StatusOK, gin.H{"weekly": result})
}
