package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
)

// accountsFor devuelve la lista de cuentas Meta a iterar. Prioriza la lista
// nueva MetaAdAccounts; si está vacía y hay un MetaAdAccountID legacy, lo
// envuelve como una sola cuenta etiquetada "Principal" para no romper deploys
// que todavía usan la variable singular.
func accountsFor(cfg *config.Config) []config.MetaAccount {
	if len(cfg.MetaAdAccounts) > 0 {
		return cfg.MetaAdAccounts
	}
	if cfg.MetaAdAccountID != "" {
		return []config.MetaAccount{{ID: cfg.MetaAdAccountID, Label: "Principal"}}
	}
	return nil
}

// defaultDateRange resuelve las fechas del query (date_start/date_stop) con
// los defaults del endpoint. lookbackDays es cuántos días atrás cubre el
// default cuando el query no manda fechas.
func defaultDateRange(r *http.Request, lookbackDays int) (string, string) {
	dateStart := r.URL.Query().Get("date_start")
	dateStop := r.URL.Query().Get("date_stop")
	if dateStart == "" || dateStop == "" {
		dateStop = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart = time.Now().AddDate(0, 0, -lookbackDays).Format("2006-01-02")
	}
	return dateStart, dateStop
}

// GetMetaCampaigns retorna todas las campañas de Meta Ads de todas las cuentas
// configuradas. Cada campaña incluye los campos account_id y account_label.
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

		type taggedCampaign struct {
			meta.Campaign
			AccountID    string `json:"account_id"`
			AccountLabel string `json:"account_label"`
		}

		all := make([]taggedCampaign, 0)
		for _, acc := range accountsFor(cfg) {
			client := meta.NewClient(token, acc.ID)
			campaigns, err := client.GetCampaigns()
			if err != nil {
				continue // si una cuenta falla, seguimos con las demás
			}
			for _, c := range campaigns {
				all = append(all, taggedCampaign{Campaign: c, AccountID: acc.ID, AccountLabel: acc.Label})
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    all,
			"count":   len(all),
		})
	}
}

// GetMetaInsights retorna los insights de Meta Ads agregados de todas las
// cuentas configuradas. Cada item de la respuesta lleva account_id/label.
func GetMetaInsights(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}
		dateStart, dateStop := defaultDateRange(r, 8)
		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		type taggedInsight struct {
			meta.AdInsights
			AccountID    string `json:"account_id"`
			AccountLabel string `json:"account_label"`
		}

		all := make([]taggedInsight, 0)
		for _, acc := range accountsFor(cfg) {
			client := meta.NewClient(token, acc.ID)
			insights, err := client.GetAccountInsights(dateStart, dateStop)
			if err != nil {
				continue
			}
			for _, ins := range insights {
				all = append(all, taggedInsight{AdInsights: ins, AccountID: acc.ID, AccountLabel: acc.Label})
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"data":       all,
			"count":      len(all),
			"date_start": dateStart,
			"date_stop":  dateStop,
		})
	}
}

// GetMetaAccountSummary retorna el resumen agregado de TODAS las cuentas
// monitoreadas. Incluye totales y un array accounts[] con el desglose por
// cuenta para que el frontend pueda ver de dónde viene cada peso.
func GetMetaAccountSummary(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}
		dateStart, dateStop := defaultDateRange(r, 8)
		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		var totalSpend float64
		var totalImpressions, totalClicks, totalReach, totalLeads int64
		totalCampaigns := 0

		accountsBreakdown := make([]map[string]interface{}, 0)

		for _, acc := range accountsFor(cfg) {
			client := meta.NewClient(token, acc.ID)
			insights, err := client.GetAccountInsights(dateStart, dateStop)
			if err != nil {
				insights = nil // cuenta sin datos: la incluimos con ceros
			}

			var aSpend float64
			var aImp, aClicks, aReach, aLeads int64
			for _, ins := range insights {
				aSpend += ins.Spend
				aImp += ins.Impressions
				aClicks += ins.Clicks
				aReach += ins.Reach
				aLeads += ins.Leads()
			}

			accountsBreakdown = append(accountsBreakdown, map[string]interface{}{
				"id":          acc.ID,
				"label":       acc.Label,
				"spend":       aSpend,
				"impressions": aImp,
				"clicks":      aClicks,
				"reach":       aReach,
				"leads":       aLeads,
				"ctr":         pctSafe(aClicks, aImp),
				"cpc":         divSafe(aSpend, float64(aClicks)),
				"cpm":         divSafe(aSpend*1000, float64(aImp)),
				"campaigns":   len(insights),
			})

			totalSpend += aSpend
			totalImpressions += aImp
			totalClicks += aClicks
			totalReach += aReach
			totalLeads += aLeads
			totalCampaigns += len(insights)
		}

		summary := map[string]interface{}{
			"spend":       totalSpend,
			"impressions": totalImpressions,
			"clicks":      totalClicks,
			"reach":       totalReach,
			"leads":       totalLeads,
			"ctr":         pctSafe(totalClicks, totalImpressions),
			"cpc":         divSafe(totalSpend, float64(totalClicks)),
			"cpm":         divSafe(totalSpend*1000, float64(totalImpressions)),
			"campaigns":   totalCampaigns,
			"accounts":    accountsBreakdown,
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

// GetCampaignsWithInsights retorna campañas con métricas del período, iterando
// todas las cuentas configuradas. Cada campaña incluye account_id/label.
func GetCampaignsWithInsights(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}
		dateStart, dateStop := defaultDateRange(r, 90)
		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		type CampaignWithMetrics struct {
			ID           string  `json:"id"`
			Name         string  `json:"name"`
			Spend        float64 `json:"spend"`
			Impressions  int64   `json:"impressions"`
			Clicks       int64   `json:"clicks"`
			Reach        int64   `json:"reach"`
			Leads        int64   `json:"leads"`
			CTR          float64 `json:"ctr"`
			CPC          float64 `json:"cpc"`
			CPM          float64 `json:"cpm"`
			CPL          float64 `json:"cpl"`
			Status       string  `json:"status"`
			AccountID    string  `json:"account_id"`
			AccountLabel string  `json:"account_label"`
		}

		all := make([]CampaignWithMetrics, 0)
		for _, acc := range accountsFor(cfg) {
			client := meta.NewClient(token, acc.ID)
			campaigns, err := client.GetCampaigns()
			if err != nil {
				continue
			}
			insights, err := client.GetAccountInsights(dateStart, dateStop)
			if err != nil {
				insights = []meta.AdInsights{}
			}
			insightsMap := map[string]*meta.AdInsights{}
			for i := range insights {
				insightsMap[insights[i].CampaignID] = &insights[i]
			}
			for _, c := range campaigns {
				row := CampaignWithMetrics{
					ID:           c.ID,
					Name:         c.Name,
					Status:       c.Status,
					AccountID:    acc.ID,
					AccountLabel: acc.Label,
				}
				if ins, ok := insightsMap[c.ID]; ok {
					row.Spend = ins.Spend
					row.Impressions = ins.Impressions
					row.Clicks = ins.Clicks
					row.Reach = ins.Reach
					row.Leads = ins.Leads()
					row.CTR = ins.CalculateCTR()
					row.CPC = ins.CalculateCPC()
					row.CPM = ins.CalculateCPM()
					row.CPL = ins.CPL()
				}
				all = append(all, row)
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"data":       all,
			"count":      len(all),
			"date_start": dateStart,
			"date_stop":  dateStop,
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

func divSafe(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

func pctSafe(num, den int64) float64 {
	if den == 0 {
		return 0
	}
	return (float64(num) / float64(den)) * 100
}
