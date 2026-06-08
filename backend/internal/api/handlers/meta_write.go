package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
	"github.com/go-chi/chi/v5"
)

// ============================================================================
// Meta Ads — gestión de campañas (write)
// ----------------------------------------------------------------------------
// Pausar/activar y ajustar presupuesto. Estos endpoints MUEVEN dinero real y
// son públicos en la cuenta de anuncios, así que el frontend siempre pide
// confirmación antes de llamarlos. El token (con `ads_management`) vive
// server-side; el navegador no lo conoce.
// ============================================================================

// metaWriteReady valida que Meta Ads esté habilitado y devuelve el token.
func metaWriteReady(w http.ResponseWriter, cfg *config.Config) (string, bool) {
	if !cfg.EnableMetaAds {
		respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
		return "", false
	}
	token, err := config.GetMetaToken()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
		return "", false
	}
	return token, true
}

func setCampaignStatus(cfg *config.Config, status string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := metaWriteReady(w, cfg)
		if !ok {
			return
		}
		campaignID := chi.URLParam(r, "campaign_id")
		if campaignID == "" {
			respondError(w, http.StatusBadRequest, "falta campaign_id")
			return
		}
		if err := meta.NewClient(token, "").UpdateCampaignStatus(campaignID, status); err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":     true,
			"campaign_id": campaignID,
			"status":      status,
		})
	}
}

// PauseCampaign pausa una campaña — POST /api/v1/meta-ads/campaigns/{campaign_id}/pause
func PauseCampaign(cfg *config.Config) http.HandlerFunc {
	return setCampaignStatus(cfg, "PAUSED")
}

// ActivateCampaign reactiva una campaña — POST /api/v1/meta-ads/campaigns/{campaign_id}/activate
func ActivateCampaign(cfg *config.Config) http.HandlerFunc {
	return setCampaignStatus(cfg, "ACTIVE")
}

// UpdateCampaignBudget fija el presupuesto diario (CLP, entero) de una campaña —
// POST /api/v1/meta-ads/campaigns/{campaign_id}/budget  body: {"daily_budget": 110000}
func UpdateCampaignBudget(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := metaWriteReady(w, cfg)
		if !ok {
			return
		}
		campaignID := chi.URLParam(r, "campaign_id")
		if campaignID == "" {
			respondError(w, http.StatusBadRequest, "falta campaign_id")
			return
		}
		var body struct {
			DailyBudget int64 `json:"daily_budget"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.DailyBudget <= 0 {
			respondError(w, http.StatusBadRequest, "se requiere 'daily_budget' (CLP, entero positivo)")
			return
		}
		if err := meta.NewClient(token, "").UpdateCampaignDailyBudget(campaignID, body.DailyBudget); err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":      true,
			"campaign_id":  campaignID,
			"daily_budget": body.DailyBudget,
		})
	}
}
