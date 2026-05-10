package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
)

// GetMetaCampaigns retorna todas las campañas de Meta Ads
func GetMetaCampaigns(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}

		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		client := meta.NewClient(token, cfg.MetaAdAccountID)
		campaigns, err := client.GetCampaigns()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to fetch campaigns: "+err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    campaigns,
			"count":   len(campaigns),
		})
	}
}

// GetMetaInsights retorna los insights de Meta Ads para un período
func GetMetaInsights(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}

		// Obtener parámetros de fecha desde query params
		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")

		// Si no se proporcionan fechas, usar última semana
		if dateStart == "" || dateStop == "" {
			dateStop = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
			dateStart = time.Now().AddDate(0, 0, -8).Format("2006-01-02")
		}

		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		client := meta.NewClient(token, cfg.MetaAdAccountID)
		insights, err := client.GetAccountInsights(dateStart, dateStop)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to fetch insights: "+err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"data":       insights,
			"count":      len(insights),
			"date_start": dateStart,
			"date_stop":  dateStop,
		})
	}
}

// GetMetaAccountSummary retorna un resumen agregado de la cuenta
func GetMetaAccountSummary(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}

		// Obtener parámetros de fecha
		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")

		if dateStart == "" || dateStop == "" {
			dateStop = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
			dateStart = time.Now().AddDate(0, 0, -8).Format("2006-01-02")
		}

		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		client := meta.NewClient(token, cfg.MetaAdAccountID)
		insights, err := client.GetAccountInsights(dateStart, dateStop)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to fetch insights: "+err.Error())
			return
		}

		// Calcular totales
		var totalSpend float64
		var totalImpressions int64
		var totalClicks int64
		var totalReach int64

		for _, insight := range insights {
			totalSpend += insight.Spend
			totalImpressions += insight.Impressions
			totalClicks += insight.Clicks
			totalReach += insight.Reach
		}

		// Calcular métricas
		avgCTR := 0.0
		avgCPC := 0.0
		avgCPM := 0.0

		if totalImpressions > 0 {
			avgCTR = (float64(totalClicks) / float64(totalImpressions)) * 100
			avgCPM = (totalSpend / float64(totalImpressions)) * 1000
		}
		if totalClicks > 0 {
			avgCPC = totalSpend / float64(totalClicks)
		}

		summary := map[string]interface{}{
			"spend":       totalSpend,
			"impressions": totalImpressions,
			"clicks":      totalClicks,
			"reach":       totalReach,
			"ctr":         avgCTR,
			"cpc":         avgCPC,
			"cpm":         avgCPM,
			"campaigns":   len(insights),
			"period": map[string]string{
				"start": dateStart,
				"end":   dateStop,
			},
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    summary,
		})
	}
}

// Helpers

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
