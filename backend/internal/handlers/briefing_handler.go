package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/repliq/backend/internal/services/bot"
)

type BriefingHandler struct {
	service *bot.BriefingService
}

func NewBriefingHandler(service *bot.BriefingService) *BriefingHandler {
	return &BriefingHandler{service: service}
}

func (h *BriefingHandler) GetBriefing(c *gin.Context) {
	orgID := c.GetInt64("org_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()

	data, err := h.service.GenerateBriefing(ctx, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate briefing"})
		return
	}

	c.JSON(http.StatusOK, data)
}
