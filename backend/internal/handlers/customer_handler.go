package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
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
	                  COALESCE(u.full_name, '') as assigned_name,
	                  COALESCE(c.pipeline_stage, 'new_contact') as pipeline_stage,
	                  COALESCE(c.pipeline_updated_at, c.created_at) as pipeline_updated_at,
	                  COALESCE(c.interested_products, '') as interested_products,
	                  COALESCE(c.sent_catalogs, '') as sent_catalogs,
	                  COALESCE(c.sent_kartelas, '') as sent_kartelas,
	                  COALESCE(c.sent_samples, '') as sent_samples,
	                  COALESCE(c.contact_role, '') as contact_role,
	                  COALESCE(c.website, '') as website,
	                  COALESCE(c.vk, '') as vk,
	                  COALESCE(c.telegram, '') as telegram,
	                  COALESCE(c.preferred_channel, '') as preferred_channel
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
	if s := c.Query("pipeline_stage"); s != "" {
		query += fmt.Sprintf(" AND c.pipeline_stage = $%d", argIdx)
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
		PipelineStage      string     `json:"pipeline_stage"`
		PipelineUpdatedAt  time.Time  `json:"pipeline_updated_at"`
		InterestedProducts string     `json:"interested_products"`
		SentCatalogs       string     `json:"sent_catalogs"`
		SentKartelas       string     `json:"sent_kartelas"`
		SentSamples        string     `json:"sent_samples"`
		ContactRole        string     `json:"contact_role"`
		Website            string     `json:"website"`
		VK                 string     `json:"vk"`
		Telegram           string     `json:"telegram"`
		PreferredChannel   string     `json:"preferred_channel"`
		Channels           []chResp   `json:"channels"`
	}

	var customers []customerResp
	var ids []int64

	for rows.Next() {
		var cu customerResp
		if err := rows.Scan(&cu.ID, new(int64), &cu.Name, &cu.Company, &cu.Country,
			&cu.Segment, &cu.CustomerType, &cu.CustomerTypeOther,
			&cu.Source, &cu.SourceDetail, &cu.AssignedTo,
			&cu.Phone, &cu.Email, &cu.Instagram, &cu.Notes, &cu.Orders,
			&cu.LastContactAt, &cu.CreatedAt, &cu.UpdatedAt, &cu.AssignedName,
			&cu.PipelineStage, &cu.PipelineUpdatedAt, &cu.InterestedProducts,
			&cu.SentCatalogs, &cu.SentKartelas, &cu.SentSamples, &cu.ContactRole,
			&cu.Website, &cu.VK, &cu.Telegram, &cu.PreferredChannel); err != nil {
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
		PipelineStage      string     `json:"pipeline_stage"`
		PipelineUpdatedAt  time.Time  `json:"pipeline_updated_at"`
		InterestedProducts string     `json:"interested_products"`
		SentCatalogs       string     `json:"sent_catalogs"`
		SentKartelas       string     `json:"sent_kartelas"`
		SentSamples        string     `json:"sent_samples"`
		ContactRole        string     `json:"contact_role"`
		Website            string     `json:"website"`
		VK                 string     `json:"vk"`
		Telegram           string     `json:"telegram"`
		PreferredChannel   string     `json:"preferred_channel"`
	}

	err = h.db.Pool.QueryRow(ctx,
		`SELECT c.id, c.name, COALESCE(c.company,''), COALESCE(c.country,''),
		        c.segment, COALESCE(c.customer_type,''), COALESCE(c.customer_type_other,''),
		        COALESCE(c.source,''), COALESCE(c.source_detail,''),
		        c.assigned_to, COALESCE(c.phone,''), COALESCE(c.email,''),
		        COALESCE(c.instagram,''), COALESCE(c.notes,''), COALESCE(c.orders,''),
		        c.last_contact_at, c.created_at, c.updated_at,
		        COALESCE(u.full_name, '') as assigned_name,
		        COALESCE(c.pipeline_stage, 'new_contact') as pipeline_stage,
		        COALESCE(c.pipeline_updated_at, c.created_at) as pipeline_updated_at,
		        COALESCE(c.interested_products, '') as interested_products,
		        COALESCE(c.sent_catalogs, '') as sent_catalogs,
		        COALESCE(c.sent_kartelas, '') as sent_kartelas,
		        COALESCE(c.sent_samples, '') as sent_samples,
		        COALESCE(c.contact_role, '') as contact_role,
		        COALESCE(c.website, '') as website,
		        COALESCE(c.vk, '') as vk,
		        COALESCE(c.telegram, '') as telegram,
		        COALESCE(c.preferred_channel, '') as preferred_channel
		 FROM customers c
		 LEFT JOIN users u ON c.assigned_to = u.id
		 WHERE c.id = $1 AND c.org_id = $2`, id, orgID,
	).Scan(&cu.ID, &cu.Name, &cu.Company, &cu.Country,
		&cu.Segment, &cu.CustomerType, &cu.CustomerTypeOther,
		&cu.Source, &cu.SourceDetail, &cu.AssignedTo,
		&cu.Phone, &cu.Email, &cu.Instagram, &cu.Notes, &cu.Orders,
		&cu.LastContactAt, &cu.CreatedAt, &cu.UpdatedAt, &cu.AssignedName,
		&cu.PipelineStage, &cu.PipelineUpdatedAt, &cu.InterestedProducts,
		&cu.SentCatalogs, &cu.SentKartelas, &cu.SentSamples, &cu.ContactRole,
		&cu.Website, &cu.VK, &cu.Telegram, &cu.PreferredChannel)
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
		Website           string `json:"website"`
		VK                string `json:"vk"`
		Telegram          string `json:"telegram"`
		PreferredChannel  string `json:"preferred_channel"`
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
		                        source, source_detail, assigned_to, phone, email, instagram, notes,
		                        website, vk, telegram, preferred_channel, last_contact_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()) RETURNING id`,
		orgID, req.Name, req.Company, req.Country, req.Segment,
		req.CustomerType, req.CustomerTypeOther, req.Source, req.SourceDetail,
		req.AssignedTo, req.Phone, req.Email, req.Instagram, req.Notes,
		req.Website, req.VK, req.Telegram, req.PreferredChannel,
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
		Website           *string `json:"website"`
		VK                *string `json:"vk"`
		Telegram          *string `json:"telegram"`
		PreferredChannel  *string `json:"preferred_channel"`
		Notes              *string `json:"notes"`
		Orders             *string `json:"orders"`
		InterestedProducts *string `json:"interested_products"`
		SentCatalogs       *string `json:"sent_catalogs"`
		SentKartelas       *string `json:"sent_kartelas"`
		SentSamples        *string `json:"sent_samples"`
		ContactRole        *string `json:"contact_role"`
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
		var customerName string
		err := h.db.Pool.QueryRow(ctx,
			`SELECT segment, name FROM customers WHERE id = $1 AND org_id = $2`, id, orgID,
		).Scan(&oldSegment, &customerName)
		if err == nil && oldSegment != *req.Segment {
			h.db.Pool.Exec(ctx,
				`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by)
				 VALUES ($1,$2,$3,$4,$5)`,
				orgID, id, oldSegment, *req.Segment, userID)
			// Log activity for segment change
			segTitle := fmt.Sprintf("Segment degisikligi: %d → %d", oldSegment, *req.Segment)
			noteText := ""
			if req.Notes != nil && *req.Notes != "" {
				noteText = *req.Notes
			}
			h.db.Pool.Exec(ctx,
				`INSERT INTO customer_activities (org_id, customer_id, activity_type, title, description, created_by)
				 VALUES ($1,$2,'segment_change',$3,$4,$5)`,
				orgID, id, segTitle, noteText, userID)
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
	if req.Website != nil {
		query += fmt.Sprintf(", website=$%d", argIdx)
		args = append(args, *req.Website)
		argIdx++
	}
	if req.VK != nil {
		query += fmt.Sprintf(", vk=$%d", argIdx)
		args = append(args, *req.VK)
		argIdx++
	}
	if req.Telegram != nil {
		query += fmt.Sprintf(", telegram=$%d", argIdx)
		args = append(args, *req.Telegram)
		argIdx++
	}
	if req.PreferredChannel != nil {
		query += fmt.Sprintf(", preferred_channel=$%d", argIdx)
		args = append(args, *req.PreferredChannel)
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
	if req.InterestedProducts != nil {
		query += fmt.Sprintf(", interested_products=$%d", argIdx)
		args = append(args, *req.InterestedProducts)
		argIdx++
	}
	if req.SentCatalogs != nil {
		query += fmt.Sprintf(", sent_catalogs=$%d", argIdx)
		args = append(args, *req.SentCatalogs)
		argIdx++
	}
	if req.SentKartelas != nil {
		query += fmt.Sprintf(", sent_kartelas=$%d", argIdx)
		args = append(args, *req.SentKartelas)
		argIdx++
	}
	if req.SentSamples != nil {
		query += fmt.Sprintf(", sent_samples=$%d", argIdx)
		args = append(args, *req.SentSamples)
		argIdx++
	}
	if req.ContactRole != nil {
		query += fmt.Sprintf(", contact_role=$%d", argIdx)
		args = append(args, *req.ContactRole)
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

// Pipeline: Update customer stage
func (h *CustomerHandler) UpdatePipelineStage(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Stage string `json:"stage" binding:"required"`
		Note  string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Get old stage and current segment
	var oldStage string
	var currentSegment int
	err = h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(pipeline_stage, 'new_contact'), segment FROM customers WHERE id=$1 AND org_id=$2`, id, orgID,
	).Scan(&oldStage, &currentSegment)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	// Auto segment rules: kartela/sample → Aktif(2), order/shipping → VIP(1)
	stageAutoSegment := map[string]int{
		"catalog_sent":   3, // Potansiyel
		"kartela_sent":   2, // Aktif
		"sample_sent":    2, // Aktif
		"order_received": 1, // VIP
		"shipping":       1, // VIP
	}

	newSegment := currentSegment
	if autoSeg, ok := stageAutoSegment[req.Stage]; ok && autoSeg < currentSegment {
		newSegment = autoSeg
	}

	// Update stage + segment together
	_, err = h.db.Pool.Exec(ctx,
		`UPDATE customers SET pipeline_stage=$1, pipeline_updated_at=NOW(), segment=$2, updated_at=NOW() WHERE id=$3 AND org_id=$4`,
		req.Stage, newSegment, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stage"})
		return
	}

	// Log segment change if changed
	segmentChanged := newSegment != currentSegment
	if segmentChanged {
		h.db.Pool.Exec(ctx,
			`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by)
			 VALUES ($1,$2,$3,$4,$5)`,
			orgID, id, currentSegment, newSegment, userID)
		segTitle := fmt.Sprintf("Segment degisikligi: %d → %d", currentSegment, newSegment)
		h.db.Pool.Exec(ctx,
			`INSERT INTO customer_activities (org_id, customer_id, activity_type, title, description, created_by)
			 VALUES ($1,$2,'segment_change',$3,$4,$5)`,
			orgID, id, segTitle, "", userID)
	}

	// Log stage change activity
	title := fmt.Sprintf("Asama degisikligi: %s → %s", oldStage, req.Stage)
	desc := req.Note
	h.db.Pool.Exec(ctx,
		`INSERT INTO customer_activities (org_id, customer_id, activity_type, title, description, created_by)
		 VALUES ($1,$2,'stage_change',$3,$4,$5)`,
		orgID, id, title, desc, userID)

	c.JSON(http.StatusOK, gin.H{"message": "Stage updated", "segment_changed": segmentChanged, "new_segment": newSegment})
}

// Activities: List for a customer
func (h *CustomerHandler) ListActivities(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	customerID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT a.id, a.activity_type, a.title, a.description, a.channel,
		        COALESCE(u.full_name, 'Sistem') as created_by_name, a.created_at,
		        COALESCE(a.metadata, '{}') as metadata,
		        COALESCE(a.detected_by, 'manual') as detected_by
		 FROM customer_activities a
		 LEFT JOIN users u ON a.created_by = u.id
		 WHERE a.customer_id = $1 AND a.org_id = $2
		   AND COALESCE(a.status, 'approved') = 'approved'
		   AND a.deleted_at IS NULL
		 ORDER BY a.created_at DESC
		 LIMIT 100`,
		customerID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activities"})
		return
	}
	defer rows.Close()

	type actResp struct {
		ID            int64     `json:"id"`
		ActivityType  string    `json:"activity_type"`
		Title         string    `json:"title"`
		Description   string    `json:"description"`
		Channel       string    `json:"channel"`
		CreatedByName string    `json:"created_by_name"`
		CreatedAt     time.Time `json:"created_at"`
		Metadata      string    `json:"metadata"`
		DetectedBy    string    `json:"detected_by"`
	}
	activities := []actResp{}
	for rows.Next() {
		var a actResp
		if err := rows.Scan(&a.ID, &a.ActivityType, &a.Title, &a.Description, &a.Channel, &a.CreatedByName, &a.CreatedAt, &a.Metadata, &a.DetectedBy); err != nil {
			continue
		}
		activities = append(activities, a)
	}

	c.JSON(http.StatusOK, gin.H{"activities": activities})
}

// ListPendingActivities — org-wide AI/rule detected activities awaiting approval
func (h *CustomerHandler) ListPendingActivities(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT a.id, a.customer_id, a.contact_id, a.conversation_id,
		        COALESCE(c.name, ct.name, 'İsimsiz') AS display_name,
		        COALESCE(c.company,'') AS customer_company,
		        COALESCE(c.country,'') AS customer_country,
		        COALESCE(ct.channel_type, a.channel, '') AS contact_channel,
		        COALESCE(ct.external_id,'') AS contact_external,
		        a.activity_type, a.title, COALESCE(a.description,''), COALESCE(a.channel,''),
		        COALESCE(a.metadata,'{}'), COALESCE(a.detected_by,'manual'), COALESCE(a.confidence,0),
		        COALESCE(a.source_text,''), a.source_message_id, a.created_at
		 FROM customer_activities a
		 LEFT JOIN customers c ON c.id = a.customer_id
		 LEFT JOIN contacts  ct ON ct.id = a.contact_id
		 WHERE a.org_id = $1 AND COALESCE(a.status,'approved') = 'pending'
		   AND a.deleted_at IS NULL
		 ORDER BY a.created_at DESC
		 LIMIT 200`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pending activities"})
		return
	}
	defer rows.Close()

	type pendingItem struct {
		ID              int64     `json:"id"`
		CustomerID      *int64    `json:"customer_id"`
		ContactID       *int64    `json:"contact_id"`
		ConversationID  *int64    `json:"conversation_id"`
		CustomerName    string    `json:"customer_name"`
		CustomerCompany string    `json:"customer_company"`
		CustomerCountry string    `json:"customer_country"`
		ContactChannel  string    `json:"contact_channel"`
		ContactExternal string    `json:"contact_external"`
		IsOrphan        bool      `json:"is_orphan"`
		ActivityType    string    `json:"activity_type"`
		Title           string    `json:"title"`
		Description     string    `json:"description"`
		Channel         string    `json:"channel"`
		Metadata        string    `json:"metadata"`
		DetectedBy      string    `json:"detected_by"`
		Confidence      int       `json:"confidence"`
		SourceText      string    `json:"source_text"`
		SourceMessageID *int64    `json:"source_message_id"`
		CreatedAt       time.Time `json:"created_at"`
	}
	items := []pendingItem{}
	for rows.Next() {
		var p pendingItem
		if err := rows.Scan(&p.ID, &p.CustomerID, &p.ContactID, &p.ConversationID,
			&p.CustomerName, &p.CustomerCompany, &p.CustomerCountry,
			&p.ContactChannel, &p.ContactExternal,
			&p.ActivityType, &p.Title, &p.Description, &p.Channel, &p.Metadata, &p.DetectedBy, &p.Confidence,
			&p.SourceText, &p.SourceMessageID, &p.CreatedAt); err != nil {
			continue
		}
		p.IsOrphan = p.CustomerID == nil
		items = append(items, p)
	}

	c.JSON(http.StatusOK, gin.H{"pending": items, "count": len(items)})
}

// ApprovePendingActivity — confirms detected activity, applies pipeline+segment effects.
// 2026-05-16: orphan (customer_id IS NULL) activities can be approved by providing
// `create_customer` in the request body — the customer card is created at approval time,
// then the standard pipeline/segment/task flow runs as if the activity had a customer all along.
func (h *CustomerHandler) ApprovePendingActivity(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	actID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Title          string `json:"title"`
		Description    string `json:"description"`
		CreateCustomer *struct {
			Name    string `json:"name"`
			Company string `json:"company"`
			Country string `json:"country"`
		} `json:"create_customer"`
	}
	_ = c.ShouldBindJSON(&req)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	var customerID *int64
	var contactID *int64
	var conversationID *int64
	var activityType, activityChannel string
	err = h.db.Pool.QueryRow(ctx,
		`SELECT customer_id, contact_id, conversation_id, activity_type, COALESCE(channel,'')
		 FROM customer_activities
		 WHERE id=$1 AND org_id=$2 AND COALESCE(status,'approved')='pending'
		   AND deleted_at IS NULL`,
		actID, orgID).Scan(&customerID, &contactID, &conversationID, &activityType, &activityChannel)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending activity not found"})
		return
	}

	// Orphan path: müşteri kartı yoksa, body'deki create_customer ile yarat.
	if customerID == nil {
		if req.CreateCustomer == nil || strings.TrimSpace(req.CreateCustomer.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":      "Bu önerinin müşteri kartı yok. Onaylamak için müşteri bilgisi gönder.",
				"orphan":     true,
				"contact_id": contactID,
			})
			return
		}

		// Contact bilgisinden kanal-specifik alanı doldur (telegram, instagram, phone, email).
		var contactChannel, contactExternal, contactPhone, contactName string
		if contactID != nil {
			h.db.Pool.QueryRow(ctx,
				`SELECT COALESCE(channel_type,''), COALESCE(external_id,''), COALESCE(phone,''), COALESCE(name,'')
				 FROM contacts WHERE id=$1 AND org_id=$2`, *contactID, orgID,
			).Scan(&contactChannel, &contactExternal, &contactPhone, &contactName)
		}

		// Channel-specific identifier kolonuna düş
		var tgVal, igVal, emailVal, phoneVal, websiteVal string
		switch contactChannel {
		case "telegram":
			tgVal = "t.me/" + contactExternal
		case "instagram":
			igVal = contactExternal
		case "email":
			emailVal = contactExternal
		case "vk":
			websiteVal = "https://vk.com/id" + contactExternal
		}
		if contactPhone != "" {
			phoneVal = contactPhone
		}

		var newCustomerID int64
		err = h.db.Pool.QueryRow(ctx,
			`INSERT INTO customers
			   (org_id, name, company, country, phone, telegram, instagram, email, website,
			    source, source_detail, segment, pipeline_stage, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),
			         'inbound','AI onayından oluşturuldu',4,'new_contact',NOW(),NOW())
			 RETURNING id`,
			orgID, strings.TrimSpace(req.CreateCustomer.Name),
			strings.TrimSpace(req.CreateCustomer.Company),
			strings.TrimSpace(req.CreateCustomer.Country),
			phoneVal, tgVal, igVal, emailVal, websiteVal,
		).Scan(&newCustomerID)
		if err != nil {
			log.Printf("approve: customer create failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Müşteri kartı oluşturulamadı"})
			return
		}

		// Activity'yi bu yeni customer'a bağla
		h.db.Pool.Exec(ctx,
			`UPDATE customer_activities SET customer_id=$1 WHERE id=$2 AND org_id=$3`,
			newCustomerID, actID, orgID)

		// Aynı contact'ın bu org'taki diğer pending orphan kayıtlarını da bağla
		if contactID != nil {
			h.db.Pool.Exec(ctx,
				`UPDATE customer_activities SET customer_id=$1
				 WHERE org_id=$2 AND contact_id=$3 AND customer_id IS NULL`,
				newCustomerID, orgID, *contactID)
		}

		// Conversation'ı da bu customer'a bağla (panelde aynı kart altında görünsün)
		if conversationID != nil {
			h.db.Pool.Exec(ctx,
				`UPDATE conversations SET customer_id=$1 WHERE id=$2 AND org_id=$3 AND customer_id IS NULL`,
				newCustomerID, *conversationID, orgID)
		}

		customerID = &newCustomerID
		_ = contactName // reserved for future "kullan contact ismini default doldur"
	}

	updateFields := `status='approved', reviewed_by=$1, reviewed_at=NOW()`
	args := []interface{}{userID}
	idx := 2
	if req.Title != "" {
		updateFields += fmt.Sprintf(", title=$%d", idx)
		args = append(args, req.Title)
		idx++
	}
	if req.Description != "" {
		updateFields += fmt.Sprintf(", description=$%d", idx)
		args = append(args, req.Description)
		idx++
	}
	args = append(args, actID, orgID)
	_, err = h.db.Pool.Exec(ctx,
		fmt.Sprintf(`UPDATE customer_activities SET %s WHERE id=$%d AND org_id=$%d`, updateFields, idx, idx+1),
		args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve"})
		return
	}

	cid := *customerID // artık nil olamaz (orphan path yarattı veya zaten doluydu)

	// Apply pipeline+segment side effects (mirrors CreateActivity logic)
	h.db.Pool.Exec(ctx, `UPDATE customers SET last_contact_at=NOW(), updated_at=NOW() WHERE id=$1`, cid)

	stageForActivity := map[string]string{
		"catalog_request":      "catalog_sent",
		"kartela_request":      "kartela_sent",
		"sample_request":       "kartela_sent",
		"shipping_info":        "shipping",
		"order_intent":         "order_received",
		"intro_video_sent":     "catalog_sent",
		"warehouse_video_sent": "catalog_sent",
	}
	segmentForActivity := map[string]int{
		"kartela_request": 2,
		"sample_request":  2,
		"order_intent":    1,
	}
	stageOrder := map[string]int{
		"new_contact": 0, "catalog_sent": 1, "kartela_sent": 2,
		"sample_sent": 3, "order_received": 4, "shipping": 5,
	}
	if newStage, ok := stageForActivity[activityType]; ok {
		var currentStage string
		h.db.Pool.QueryRow(ctx, `SELECT COALESCE(pipeline_stage,'new_contact') FROM customers WHERE id=$1`, cid).Scan(&currentStage)
		if stageOrder[newStage] > stageOrder[currentStage] {
			h.db.Pool.Exec(ctx,
				`UPDATE customers SET pipeline_stage=$1, pipeline_updated_at=NOW() WHERE id=$2 AND org_id=$3`,
				newStage, cid, orgID)
		}
	}
	if newSeg, ok := segmentForActivity[activityType]; ok {
		var oldSeg int
		err := h.db.Pool.QueryRow(ctx, `SELECT segment FROM customers WHERE id=$1`, cid).Scan(&oldSeg)
		if err == nil && newSeg < oldSeg {
			h.db.Pool.Exec(ctx, `UPDATE customers SET segment=$1 WHERE id=$2`, newSeg, cid)
			h.db.Pool.Exec(ctx,
				`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by)
				 VALUES ($1,$2,$3,$4,$5)`, orgID, cid, oldSeg, newSeg, userID)
		}
	}

	// Patron directive (2026-05-11): onaylanan AI tespitleri "Yapılacaklar"a düşsün.
	// Customer adıyla birlikte standart bir görev oluştur. Source_type=ai_approval ile
	// manuel görevlerden ayrılır. Aynı activity için tekrar onay verilirse duplicate üretmemek
	// adına source_id alanı yok — bunun yerine 30 dakika içinde aynı (customer, action) tekrarını
	// yazmadan önce dedupe.
	taskTitleMap := map[string]struct{ title, department string }{
		"order_intent":        {"Sipariş işle", "operations"},
		"sample_request":      {"Numune gönder", "operations"},
		"kartela_request":     {"Kartela gönder", "operations"},
		"catalog_request":     {"Katalog gönder", "operations"},
		"shipping_info":       {"Kargo bilgisi paylaş", "operations"},
		"meeting_request":     {"Görüşme planla", "sales"},
		"factory_visit":       {"Fabrika ziyareti planla", "sales"},
		"price_inquiry":       {"Fiyat bilgisi gönder", "sales"},
		"price_clarification": {"Fiyat detayı netleştir", "sales"},
	}
	if action, ok := taskTitleMap[activityType]; ok {
		var customerName string
		_ = h.db.Pool.QueryRow(ctx, `SELECT COALESCE(NULLIF(name,''), '') FROM customers WHERE id=$1`, cid).Scan(&customerName)
		taskTitle := action.title
		if customerName != "" {
			taskTitle = action.title + " — " + customerName
		}
		var existing int64
		_ = h.db.Pool.QueryRow(ctx,
			`SELECT id FROM tasks
			 WHERE org_id=$1 AND customer_id=$2 AND pipeline_action=$3 AND status IN ('todo','in_progress')
			   AND created_at > NOW() - INTERVAL '30 minutes'
			 LIMIT 1`,
			orgID, cid, activityType,
		).Scan(&existing)
		if existing == 0 {
			h.db.Pool.Exec(ctx,
				`INSERT INTO tasks (org_id, customer_id, title, department, category, source_type, pipeline_action, priority, status)
				 VALUES ($1,$2,$3,$4,$5,'ai_approval',$6,'normal','todo')`,
				orgID, cid, taskTitle, action.department, "AI Tespit", activityType,
			)
		}
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "customer_id": cid})
}

// RejectPendingActivity — discards a detected activity
func (h *CustomerHandler) RejectPendingActivity(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	actID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	res, err := h.db.Pool.Exec(ctx,
		`UPDATE customer_activities
		 SET status='rejected', reviewed_by=$1, reviewed_at=NOW()
		 WHERE id=$2 AND org_id=$3 AND COALESCE(status,'approved')='pending'`,
		userID, actID, orgID)
	if err != nil || res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending activity not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// BulkActivity — patron'un haftalık toplu aksiyonlarını seçili segmentlerdeki tüm müşterilerin
// timeline'ına işler (örn "Depo videosu gönderildi" → segment 1+2+3'teki herkesin kartına).
// Body: { activity_type, segments: [int], title?, description? }
func (h *CustomerHandler) BulkActivity(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")

	var req struct {
		ActivityType string  `json:"activity_type"`
		Segments     []int   `json:"segments"`
		Title        string  `json:"title"`
		Description  string  `json:"description"`
		Channel      string  `json:"channel"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ActivityType) == "" || len(req.Segments) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "activity_type ve segments zorunlu"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Hedef müşterileri çek
	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, COALESCE(pipeline_stage,'new_contact') FROM customers
		 WHERE org_id=$1 AND segment = ANY($2::int[])`,
		orgID, req.Segments,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Müşteri sorgusu başarısız"})
		return
	}
	type custInfo struct {
		id    int64
		stage string
	}
	var targets []custInfo
	for rows.Next() {
		var ci custInfo
		if err := rows.Scan(&ci.id, &ci.stage); err == nil {
			targets = append(targets, ci)
		}
	}
	rows.Close()

	if len(targets) == 0 {
		c.JSON(http.StatusOK, gin.H{"ok": true, "processed": 0})
		return
	}

	// Aynı pipeline ilerletme map'i (ApprovePendingActivity ile aynı)
	stageForActivity := map[string]string{
		"catalog_request":      "catalog_sent",
		"kartela_request":      "kartela_sent",
		"sample_request":       "kartela_sent",
		"shipping_info":        "shipping",
		"order_intent":         "order_received",
		"intro_video_sent":     "catalog_sent",
		"warehouse_video_sent": "catalog_sent",
	}
	stageOrder := map[string]int{
		"new_contact": 0, "catalog_sent": 1, "kartela_sent": 2,
		"sample_sent": 3, "order_received": 4, "shipping": 5,
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = req.ActivityType
	}
	channel := strings.TrimSpace(req.Channel)
	if channel == "" {
		channel = "bulk"
	}

	processed := 0
	for _, t := range targets {
		_, err := h.db.Pool.Exec(ctx,
			`INSERT INTO customer_activities
			   (org_id, customer_id, activity_type, title, description, channel, metadata,
			    status, detected_by, confidence, created_by)
			 VALUES ($1,$2,$3,$4,$5,$6,'{}','approved','manual',100,$7)`,
			orgID, t.id, req.ActivityType, title, req.Description, channel, userID,
		)
		if err != nil {
			continue
		}
		h.db.Pool.Exec(ctx, `UPDATE customers SET last_contact_at=NOW(), updated_at=NOW() WHERE id=$1`, t.id)
		if newStage, ok := stageForActivity[req.ActivityType]; ok {
			if stageOrder[newStage] > stageOrder[t.stage] {
				h.db.Pool.Exec(ctx,
					`UPDATE customers SET pipeline_stage=$1, pipeline_updated_at=NOW() WHERE id=$2 AND org_id=$3`,
					newStage, t.id, orgID)
			}
		}
		processed++
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "processed": processed, "targeted": len(targets)})
}

// LinkConversationToCustomer — Inbox'taki orphan konuşmadan tek tıkla CRM kartı yarat.
// Çağrı: POST /conversations/:id/link-customer body: { name, company?, segment?, country?, customer_type? }
// Mevcut conversation'ın contact'ından external_id'yi alıp customer_channels'a yazar ve
// conversation.customer_id'yi set eder. Mevcut müşteri verilirse (existing_customer_id) onu kullanır.
func (h *CustomerHandler) LinkConversationToCustomer(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	convID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	var req struct {
		Name               string `json:"name"`
		Company            string `json:"company"`
		Segment            int    `json:"segment"`
		Country            string `json:"country"`
		CustomerType       string `json:"customer_type"`
		ExistingCustomerID int64  `json:"existing_customer_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Konuşma + contact bilgileri
	var contactID, channelID int64
	var channelType string
	var externalID, contactName string
	err = h.db.Pool.QueryRow(ctx, `
		SELECT c.contact_id, c.channel_id, ch.type,
		       COALESCE(co.external_id, ''), COALESCE(co.name, '')
		FROM conversations c
		JOIN channels ch ON ch.id = c.channel_id
		LEFT JOIN contacts co ON co.id = c.contact_id
		WHERE c.id = $1 AND c.org_id = $2
	`, convID, orgID).Scan(&contactID, &channelID, &channelType, &externalID, &contactName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	var customerID int64
	if req.ExistingCustomerID > 0 {
		// Mevcut müşteriye bağla
		var exists int64
		_ = h.db.Pool.QueryRow(ctx, `SELECT id FROM customers WHERE id=$1 AND org_id=$2`, req.ExistingCustomerID, orgID).Scan(&exists)
		if exists == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mevcut müşteri bulunamadı"})
			return
		}
		customerID = exists
	} else {
		// Yeni müşteri yarat
		name := strings.TrimSpace(req.Name)
		if name == "" {
			name = strings.TrimSpace(contactName)
		}
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Müşteri adı zorunlu"})
			return
		}
		segment := req.Segment
		if segment < 1 || segment > 4 {
			segment = 4
		}
		country := strings.TrimSpace(req.Country)
		err = h.db.Pool.QueryRow(ctx, `
			INSERT INTO customers (org_id, name, company, country, segment, customer_type, source, source_detail, last_contact_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
			RETURNING id
		`, orgID, name, strings.TrimSpace(req.Company), country, segment, strings.TrimSpace(req.CustomerType),
			"Inbox", "Konuşmadan eklendi").Scan(&customerID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Müşteri yaratılamadı: " + err.Error()})
			return
		}
	}

	// Channel link (varsa upsert)
	if externalID != "" {
		channelLabel := channelType
		switch strings.ToLower(channelType) {
		case "instagram":
			channelLabel = "Instagram"
		case "telegram":
			channelLabel = "Telegram"
		case "whatsapp":
			channelLabel = "WhatsApp"
		case "vk":
			channelLabel = "VK"
		case "email":
			channelLabel = "Email"
		case "facebook":
			channelLabel = "Facebook"
		}
		h.db.Pool.Exec(ctx, `
			INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
			VALUES ($1, $2, $3)
			ON CONFLICT (customer_id, channel_type) DO UPDATE SET channel_identifier = EXCLUDED.channel_identifier
		`, customerID, channelLabel, externalID)
	}

	// Bu kontağın tüm conversation'larını bağla
	h.db.Pool.Exec(ctx, `
		UPDATE conversations SET customer_id = $1, updated_at = NOW()
		WHERE org_id = $2 AND contact_id = $3 AND customer_id IS NULL
	`, customerID, orgID, contactID)

	c.JSON(http.StatusOK, gin.H{"ok": true, "customer_id": customerID})
}

// DeleteActivity — soft-delete an activity (Çöp Kutusu pattern).
// deleted_at = NOW(), deleted_by = current user. 30 gün sonra weekly cron tarafından gerçek silinir.
// Personel "Ayarlar → Silinenler" sayfasından Geri Al ile kurtarabilir.
func (h *CustomerHandler) DeleteActivity(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	actID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	res, err := h.db.Pool.Exec(ctx,
		`UPDATE customer_activities
		 SET deleted_at = NOW(), deleted_by = $1
		 WHERE id = $2 AND org_id = $3 AND deleted_at IS NULL`,
		userID, actID, orgID)
	if err != nil || res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activity not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AppendNote — müşteri kartının notes alanına yeni bir satır ekler (race-safe).
// Wizard form'larındaki "Not" alanı bu endpoint'i çağırır. Zaman damgası eklenir.
func (h *CustomerHandler) AppendNote(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	customerID, err := strconv.ParseInt(c.Param("id"), 10, 64)
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
	note := strings.TrimSpace(req.Note)
	if note == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Empty note"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Zaman damgalı satır: "[2026-05-18 14:32] not içeriği"
	tsLine := fmt.Sprintf("[%s] %s", time.Now().Format("2006-01-02 15:04"), note)
	res, err := h.db.Pool.Exec(ctx,
		`UPDATE customers
		 SET notes = CASE WHEN COALESCE(notes,'') = '' THEN $1 ELSE notes || E'\n' || $1 END,
		     updated_at = NOW()
		 WHERE id = $2 AND org_id = $3`,
		tsLine, customerID, orgID)
	if err != nil || res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ListTrashedActivities — son 30 günde silinmiş aktiviteleri listeler ("Çöp Kutusu").
// Müşteri adı, silen kullanıcı adı join'li döner ki frontend kolay göstersin.
func (h *CustomerHandler) ListTrashedActivities(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT a.id, a.customer_id, COALESCE(c.name, ''), COALESCE(c.company, ''),
		        a.activity_type, COALESCE(a.title, ''), COALESCE(a.description, ''),
		        a.created_at, a.deleted_at,
		        a.deleted_by, COALESCE(u.name, '')
		 FROM customer_activities a
		 LEFT JOIN customers c ON c.id = a.customer_id
		 LEFT JOIN users u ON u.id = a.deleted_by
		 WHERE a.org_id = $1 AND a.deleted_at IS NOT NULL
		   AND a.deleted_at > NOW() - INTERVAL '30 days'
		 ORDER BY a.deleted_at DESC
		 LIMIT 500`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type item struct {
		ID            int64     `json:"id"`
		CustomerID    *int64    `json:"customer_id"`
		CustomerName  string    `json:"customer_name"`
		Company       string    `json:"company"`
		ActivityType  string    `json:"activity_type"`
		Title         string    `json:"title"`
		Description   string    `json:"description"`
		CreatedAt     time.Time `json:"created_at"`
		DeletedAt     time.Time `json:"deleted_at"`
		DeletedBy     *int64    `json:"deleted_by"`
		DeletedByName string    `json:"deleted_by_name"`
	}
	items := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.CustomerID, &it.CustomerName, &it.Company,
			&it.ActivityType, &it.Title, &it.Description,
			&it.CreatedAt, &it.DeletedAt, &it.DeletedBy, &it.DeletedByName); err != nil {
			continue
		}
		items = append(items, it)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// RestoreActivity — silinen aktiviteyi Çöp Kutusu'ndan geri alır.
func (h *CustomerHandler) RestoreActivity(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	actID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	res, err := h.db.Pool.Exec(ctx,
		`UPDATE customer_activities
		 SET deleted_at = NULL, deleted_by = NULL
		 WHERE id = $1 AND org_id = $2 AND deleted_at IS NOT NULL`,
		actID, orgID)
	if err != nil || res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trashed activity not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PendingActivityStats — weekly approve/reject ratio + top types (for patron widget)
func (h *CustomerHandler) PendingActivityStats(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var pendingCount, approvedWeek, rejectedWeek int
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM customer_activities WHERE org_id=$1 AND status='pending' AND deleted_at IS NULL`, orgID,
	).Scan(&pendingCount)
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM customer_activities
		 WHERE org_id=$1 AND status='approved' AND detected_by IN ('rule','ai')
		   AND reviewed_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL`, orgID,
	).Scan(&approvedWeek)
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM customer_activities
		 WHERE org_id=$1 AND status='rejected'
		   AND reviewed_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL`, orgID,
	).Scan(&rejectedWeek)

	rows, _ := h.db.Pool.Query(ctx,
		`SELECT activity_type, COUNT(*) FROM customer_activities
		 WHERE org_id=$1 AND detected_by IN ('rule','ai')
		   AND created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL
		 GROUP BY activity_type ORDER BY 2 DESC LIMIT 5`, orgID)
	type topItem struct {
		ActivityType string `json:"activity_type"`
		Count        int    `json:"count"`
	}
	top := []topItem{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var t topItem
			if err := rows.Scan(&t.ActivityType, &t.Count); err == nil {
				top = append(top, t)
			}
		}
	}

	total := approvedWeek + rejectedWeek
	approveRate := 0
	if total > 0 {
		approveRate = (approvedWeek * 100) / total
	}

	c.JSON(http.StatusOK, gin.H{
		"pending_count":  pendingCount,
		"approved_week":  approvedWeek,
		"rejected_week":  rejectedWeek,
		"approve_rate":   approveRate,
		"top_types":      top,
	})
}

// Activities: Create
func (h *CustomerHandler) CreateActivity(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	customerID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		ActivityType string `json:"activity_type" binding:"required"`
		Title        string `json:"title" binding:"required"`
		Description  string `json:"description"`
		Channel      string `json:"channel"`
		Metadata     string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Metadata == "" {
		req.Metadata = "{}"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Verify customer belongs to org
	var exists bool
	h.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM customers WHERE id=$1 AND org_id=$2)`, customerID, orgID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var id int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO customer_activities (org_id, customer_id, activity_type, title, description, channel, metadata, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		orgID, customerID, req.ActivityType, req.Title, req.Description, req.Channel, req.Metadata, userID,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create activity"})
		return
	}

	// Update last_contact_at
	h.db.Pool.Exec(ctx, `UPDATE customers SET last_contact_at=NOW(), updated_at=NOW() WHERE id=$1`, customerID)

	// Auto pipeline + segment based on activity type
	stageForActivity := map[string]string{
		"catalog_sent": "catalog_sent",
		"kartela_sent": "kartela_sent",
		"sample_sent":  "sample_sent",
		"order":        "order_received",
	}
	segmentForActivity := map[string]int{
		"kartela_sent": 2, // Aktif
		"sample_sent":  2, // Aktif
		"order":        1, // VIP
	}

	// Pipeline stage order for comparison
	stageOrder := map[string]int{
		"new_contact": 0, "catalog_sent": 1, "kartela_sent": 2,
		"sample_sent": 3, "order_received": 4, "shipping": 5,
	}
	if newStage, ok := stageForActivity[req.ActivityType]; ok {
		// Only advance pipeline forward, never backward
		var currentStage string
		h.db.Pool.QueryRow(ctx, `SELECT COALESCE(pipeline_stage,'new_contact') FROM customers WHERE id=$1`, customerID).Scan(&currentStage)
		currentOrder := stageOrder[currentStage]
		newOrder := stageOrder[newStage]
		if newOrder > currentOrder {
			h.db.Pool.Exec(ctx,
				`UPDATE customers SET pipeline_stage=$1, pipeline_updated_at=NOW() WHERE id=$2 AND org_id=$3`,
				newStage, customerID, orgID)
		}
	}
	if newSeg, ok := segmentForActivity[req.ActivityType]; ok {
		var oldSeg int
		err := h.db.Pool.QueryRow(ctx, `SELECT segment FROM customers WHERE id=$1`, customerID).Scan(&oldSeg)
		if err == nil && newSeg < oldSeg {
			h.db.Pool.Exec(ctx, `UPDATE customers SET segment=$1 WHERE id=$2`, newSeg, customerID)
			// Log segment change as activity
			segTitle := fmt.Sprintf("Segment degisikligi: %d → %d", oldSeg, newSeg)
			h.db.Pool.Exec(ctx,
				`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by)
				 VALUES ($1,$2,$3,$4,$5)`, orgID, customerID, oldSeg, newSeg, userID)
			h.db.Pool.Exec(ctx,
				`INSERT INTO customer_activities (org_id, customer_id, activity_type, title, created_by)
				 VALUES ($1,$2,'segment_change',$3,$4)`, orgID, customerID, segTitle, userID)
		}
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// Pipeline: Overview (counts per stage)
func (h *CustomerHandler) PipelineOverview(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT COALESCE(pipeline_stage, 'new_contact'), COUNT(*)
		 FROM customers WHERE org_id = $1
		 GROUP BY pipeline_stage ORDER BY pipeline_stage`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type stageCount struct {
		Stage string `json:"stage"`
		Count int    `json:"count"`
	}
	result := []stageCount{}
	for rows.Next() {
		var sc stageCount
		if err := rows.Scan(&sc.Stage, &sc.Count); err != nil {
			continue
		}
		result = append(result, sc)
	}

	c.JSON(http.StatusOK, gin.H{"stages": result})
}

// Patron Dashboard: All recent activities across all customers
func (h *CustomerHandler) PatronFeed(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	days := 30
	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			days = parsed
		}
	}

	// Recent activities across all customers
	actRows, err := h.db.Pool.Query(ctx,
		`SELECT a.id, a.customer_id, a.activity_type, a.title, a.description, a.channel,
		        COALESCE(u.full_name, 'Sistem') as created_by_name, a.created_at,
		        c.name as customer_name, COALESCE(c.company,'') as customer_company,
		        c.segment as customer_segment,
		        COALESCE(a.metadata, '{}') as metadata
		 FROM customer_activities a
		 JOIN customers c ON a.customer_id = c.id
		 LEFT JOIN users u ON a.created_by = u.id
		 WHERE a.org_id = $1 AND a.created_at >= NOW() - ($2 || ' days')::INTERVAL
		   AND a.deleted_at IS NULL
		 ORDER BY a.created_at DESC
		 LIMIT 200`,
		orgID, strconv.Itoa(days))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activities"})
		return
	}
	defer actRows.Close()

	type actItem struct {
		ID              int64     `json:"id"`
		CustomerID      int64     `json:"customer_id"`
		ActivityType    string    `json:"activity_type"`
		Title           string    `json:"title"`
		Description     string    `json:"description"`
		Channel         string    `json:"channel"`
		CreatedByName   string    `json:"created_by_name"`
		CreatedAt       time.Time `json:"created_at"`
		CustomerName    string    `json:"customer_name"`
		CustomerCompany string    `json:"customer_company"`
		CustomerSegment int       `json:"customer_segment"`
		Metadata        string    `json:"metadata"`
	}
	activities := []actItem{}
	for actRows.Next() {
		var a actItem
		if err := actRows.Scan(&a.ID, &a.CustomerID, &a.ActivityType, &a.Title, &a.Description,
			&a.Channel, &a.CreatedByName, &a.CreatedAt,
			&a.CustomerName, &a.CustomerCompany, &a.CustomerSegment, &a.Metadata); err != nil {
			continue
		}
		activities = append(activities, a)
	}

	// Recent segment changes with details
	segRows, err := h.db.Pool.Query(ctx,
		`SELECT sh.id, sh.customer_id, sh.old_segment, sh.new_segment,
		        COALESCE(u.full_name, 'Sistem') as changed_by_name, sh.changed_at,
		        c.name as customer_name, COALESCE(c.company,'') as customer_company,
		        COALESCE(c.pipeline_stage, 'new_contact') as pipeline_stage
		 FROM segment_history sh
		 JOIN customers c ON sh.customer_id = c.id
		 LEFT JOIN users u ON sh.changed_by = u.id
		 WHERE sh.org_id = $1 AND sh.changed_at >= NOW() - ($2 || ' days')::INTERVAL
		 ORDER BY sh.changed_at DESC
		 LIMIT 100`,
		orgID, strconv.Itoa(days))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch segment changes"})
		return
	}
	defer segRows.Close()

	type segItem struct {
		ID              int64     `json:"id"`
		CustomerID      int64     `json:"customer_id"`
		OldSegment      int       `json:"old_segment"`
		NewSegment      int       `json:"new_segment"`
		ChangedByName   string    `json:"changed_by_name"`
		ChangedAt       time.Time `json:"changed_at"`
		CustomerName    string    `json:"customer_name"`
		CustomerCompany string    `json:"customer_company"`
		PipelineStage   string    `json:"pipeline_stage"`
	}
	segChanges := []segItem{}
	for segRows.Next() {
		var s segItem
		if err := segRows.Scan(&s.ID, &s.CustomerID, &s.OldSegment, &s.NewSegment,
			&s.ChangedByName, &s.ChangedAt,
			&s.CustomerName, &s.CustomerCompany, &s.PipelineStage); err != nil {
			continue
		}
		segChanges = append(segChanges, s)
	}

	// Team member activity counts
	teamRows, err := h.db.Pool.Query(ctx,
		`SELECT COALESCE(u.full_name, 'Sistem') as name, COUNT(*) as count
		 FROM customer_activities a
		 LEFT JOIN users u ON a.created_by = u.id
		 WHERE a.org_id = $1 AND a.created_at >= NOW() - ($2 || ' days')::INTERVAL
		   AND a.deleted_at IS NULL
		 GROUP BY u.full_name
		 ORDER BY count DESC`,
		orgID, strconv.Itoa(days))
	teamStats := []struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}{}
	if err == nil {
		defer teamRows.Close()
		for teamRows.Next() {
			var t struct {
				Name  string `json:"name"`
				Count int    `json:"count"`
			}
			if err := teamRows.Scan(&t.Name, &t.Count); err != nil {
				continue
			}
			teamStats = append(teamStats, t)
		}
	}

	// Pipeline stage distribution
	pipeRows, err := h.db.Pool.Query(ctx,
		`SELECT COALESCE(pipeline_stage, 'new_contact'), COUNT(*)
		 FROM customers WHERE org_id = $1
		 GROUP BY pipeline_stage ORDER BY COUNT(*) DESC`,
		orgID)
	pipeStats := []struct {
		Stage string `json:"stage"`
		Count int    `json:"count"`
	}{}
	if err == nil {
		defer pipeRows.Close()
		for pipeRows.Next() {
			var p struct {
				Stage string `json:"stage"`
				Count int    `json:"count"`
			}
			if err := pipeRows.Scan(&p.Stage, &p.Count); err != nil {
				continue
			}
			pipeStats = append(pipeStats, p)
		}
	}

	// Recent conversations/messages
	msgRows, err := h.db.Pool.Query(ctx,
		`SELECT m.id, m.conversation_id, m.sender_type, m.content,
		        COALESCE(m.content_type, 'text'), m.created_at,
		        COALESCE(u.full_name, co.name, '') as sender_name,
		        co.name as contact_name, COALESCE(ch.type, '') as channel_type
		 FROM messages m
		 JOIN conversations cv ON m.conversation_id = cv.id
		 LEFT JOIN contacts co ON cv.contact_id = co.id
		 LEFT JOIN channels ch ON cv.channel_id = ch.id
		 LEFT JOIN users u ON m.sender_type IN ('agent','bot') AND u.id = m.sender_id
		 WHERE cv.org_id = $1
		   AND m.is_internal = false
		   AND m.created_at >= NOW() - ($2 || ' days')::INTERVAL
		 ORDER BY m.created_at DESC
		 LIMIT 100`,
		orgID, strconv.Itoa(days))

	type msgItem struct {
		ID             int64     `json:"id"`
		ConversationID int64     `json:"conversation_id"`
		SenderType     string    `json:"sender_type"`
		Content        string    `json:"content"`
		ContentType    string    `json:"content_type"`
		CreatedAt      time.Time `json:"created_at"`
		SenderName     string    `json:"sender_name"`
		ContactName    string    `json:"contact_name"`
		ChannelType    string    `json:"channel_type"`
	}
	recentMessages := []msgItem{}
	if err == nil {
		defer msgRows.Close()
		for msgRows.Next() {
			var m msgItem
			if err := msgRows.Scan(&m.ID, &m.ConversationID, &m.SenderType, &m.Content,
				&m.ContentType, &m.CreatedAt, &m.SenderName, &m.ContactName, &m.ChannelType); err != nil {
				continue
			}
			// Truncate content for overview
			if len(m.Content) > 200 {
				m.Content = m.Content[:200] + "..."
			}
			recentMessages = append(recentMessages, m)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"activities":       activities,
		"segment_changes":  segChanges,
		"team_stats":       teamStats,
		"pipeline_stats":   pipeStats,
		"recent_messages":  recentMessages,
	})
}
