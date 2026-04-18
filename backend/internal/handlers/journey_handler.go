package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/repliq/backend/internal/services/journey"
)

type JourneyHandler struct {
	svc *journey.Service
}

func NewJourneyHandler(svc *journey.Service) *JourneyHandler {
	return &JourneyHandler{svc: svc}
}

func (h *JourneyHandler) GetByContact(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	contactID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact id"})
		return
	}

	limit := 100
	if l := c.Query("limit"); l != "" {
		if n, e := strconv.Atoi(l); e == nil && n > 0 {
			limit = n
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	events, err := h.svc.ListByContact(ctx, orgID, contactID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch journey"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"events": events})
}
