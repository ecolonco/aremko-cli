package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/googleads"
)

// newGoogleAdsClient construye el cliente desde la config. Centraliza la
// validación para que cada handler no tenga que repetirla.
func newGoogleAdsClient(cfg *config.Config) (*googleads.Client, error) {
	return googleads.NewClient(googleads.Config{
		DeveloperToken:  cfg.GoogleAdsDeveloperToken,
		ClientID:        cfg.GoogleAdsClientID,
		ClientSecret:    cfg.GoogleAdsClientSecret,
		RefreshToken:    cfg.GoogleAdsRefreshToken,
		CustomerID:      cfg.GoogleAdsCustomerID,
		LoginCustomerID: cfg.GoogleAdsLoginCustomerID,
	})
}

// googleAdsDateRange resuelve fechas con default últimos 8 días (mismo que brief).
func googleAdsDateRange(r *http.Request, lookbackDays int) (string, string) {
	dateStart := r.URL.Query().Get("date_start")
	dateStop := r.URL.Query().Get("date_stop")
	if dateStart == "" || dateStop == "" {
		dateStop = time.Now().Format("2006-01-02")
		dateStart = time.Now().AddDate(0, 0, -lookbackDays).Format("2006-01-02")
	}
	return dateStart, dateStop
}

// GetGoogleAdsSummary retorna métricas agregadas de TODAS las campañas activas.
func GetGoogleAdsSummary(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGoogleAds {
			respondError(w, http.StatusServiceUnavailable, "Google Ads integration is disabled")
			return
		}
		client, err := newGoogleAdsClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Google Ads config error: "+err.Error())
			return
		}
		dateStart, dateStop := googleAdsDateRange(r, 8)
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		campaigns, err := client.GetCampaignSummary(ctx, dateStart, dateStop)
		if err != nil {
			respondError(w, http.StatusBadGateway, "Failed to fetch Google Ads summary: "+err.Error())
			return
		}

		var totalSpend, totalConv, totalConvValue float64
		var totalImp, totalClicks int64
		for _, c := range campaigns {
			totalSpend += c.CostCLP
			totalConv += c.Conversions
			totalConvValue += c.ConversionsValue
			totalImp += c.Impressions
			totalClicks += c.Clicks
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"campaigns": campaigns,
				"summary": map[string]interface{}{
					"spend":             totalSpend,
					"impressions":       totalImp,
					"clicks":            totalClicks,
					"conversions":       totalConv,
					"conversions_value": totalConvValue,
					"ctr":               pctSafe(totalClicks, totalImp),
					"avg_cpc":           divSafe(totalSpend, float64(totalClicks)),
					"cpl":               divSafe(totalSpend, totalConv),
					"campaigns_count":   len(campaigns),
				},
				"period": map[string]string{"start": dateStart, "end": dateStop},
			},
		})
	}
}

// GetGoogleAdsRefugio retorna la vista dedicada de la campaña Refugio Search,
// espejo de /meta-ads/refugio.
func GetGoogleAdsRefugio(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGoogleAds {
			respondError(w, http.StatusServiceUnavailable, "Google Ads integration is disabled")
			return
		}
		if cfg.GoogleAdsRefugioCampaignID == "" {
			respondError(w, http.StatusNotFound, "GOOGLE_ADS_REFUGIO_CAMPAIGN_ID no configurado")
			return
		}
		client, err := newGoogleAdsClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Google Ads config error: "+err.Error())
			return
		}

		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")
		if dateStart == "" {
			dateStart = "2026-05-29" // lanzamiento campaña Google Refugio
		}
		if dateStop == "" {
			dateStop = time.Now().Format("2006-01-02")
		}

		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		// 3 queries en paralelo serían más rápidas, pero secuencial es más
		// simple y la respuesta total es <5s en condiciones normales.
		summary, _ := client.GetCampaignInsights(ctx, cfg.GoogleAdsRefugioCampaignID, dateStart, dateStop)
		searchTerms, _ := client.GetSearchTerms(ctx, cfg.GoogleAdsRefugioCampaignID, dateStart, dateStop, 20)
		qsKeywords, _ := client.GetKeywordQualityScores(ctx, cfg.GoogleAdsRefugioCampaignID)

		summaryOut := googleAdsRefugioSummary(summary, cfg.GoogleAdsBudgetCLP)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"campaign_id":   cfg.GoogleAdsRefugioCampaignID,
				"campaign_name": campaignNameGA(summary),
				"period":        map[string]string{"start": dateStart, "end": dateStop},
				"summary":       summaryOut,
				"search_terms":  searchTerms,
				"quality_scores": qsKeywords,
				"thresholds":    googleAdsRefugioThresholds(),
			},
		})
	}
}

// GetGoogleAdsSearchTerms retorna los search terms de la campaña Refugio (o
// de una pasada como ?campaign_id=...).
func GetGoogleAdsSearchTerms(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGoogleAds {
			respondError(w, http.StatusServiceUnavailable, "Google Ads integration is disabled")
			return
		}
		client, err := newGoogleAdsClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Google Ads config error: "+err.Error())
			return
		}
		campaignID := r.URL.Query().Get("campaign_id")
		if campaignID == "" {
			campaignID = cfg.GoogleAdsRefugioCampaignID
		}
		if campaignID == "" {
			respondError(w, http.StatusBadRequest, "Falta campaign_id (query) o GOOGLE_ADS_REFUGIO_CAMPAIGN_ID configurado")
			return
		}
		dateStart, dateStop := googleAdsDateRange(r, 30)
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		terms, err := client.GetSearchTerms(ctx, campaignID, dateStart, dateStop, 50)
		if err != nil {
			respondError(w, http.StatusBadGateway, "Failed to fetch search terms: "+err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"campaign_id": campaignID,
				"terms":       terms,
				"period":      map[string]string{"start": dateStart, "end": dateStop},
			},
		})
	}
}

// GetGoogleAdsQualityScores expone las keywords con su Quality Score para
// que el dashboard pueda señalar las que cobran caro por landing mala.
func GetGoogleAdsQualityScores(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGoogleAds {
			respondError(w, http.StatusServiceUnavailable, "Google Ads integration is disabled")
			return
		}
		client, err := newGoogleAdsClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Google Ads config error: "+err.Error())
			return
		}
		campaignID := r.URL.Query().Get("campaign_id")
		if campaignID == "" {
			campaignID = cfg.GoogleAdsRefugioCampaignID
		}
		if campaignID == "" {
			respondError(w, http.StatusBadRequest, "Falta campaign_id (query) o GOOGLE_ADS_REFUGIO_CAMPAIGN_ID configurado")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		keywords, err := client.GetKeywordQualityScores(ctx, campaignID)
		if err != nil {
			respondError(w, http.StatusBadGateway, "Failed to fetch keyword QS: "+err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"campaign_id": campaignID,
				"keywords":    keywords,
			},
		})
	}
}

func googleAdsRefugioSummary(s *googleads.CampaignInsights, budgetCLP float64) map[string]interface{} {
	out := map[string]interface{}{
		"spend":                  0.0,
		"impressions":            int64(0),
		"clicks":                 int64(0),
		"conversions":            0.0,
		"conversions_value":      0.0,
		"ctr":                    0.0,
		"avg_cpc":                0.0,
		"cpl":                    0.0,
		"conversion_rate":        0.0,
		"search_impression_share": 0.0,
		"budget_total_clp":       budgetCLP,
		"budget_pct_used":        0.0,
	}
	if s == nil {
		return out
	}
	out["spend"] = s.CostCLP
	out["impressions"] = s.Impressions
	out["clicks"] = s.Clicks
	out["conversions"] = s.Conversions
	out["conversions_value"] = s.ConversionsValue
	out["ctr"] = s.CTR
	out["avg_cpc"] = s.AvgCPC
	out["cpl"] = s.CPL
	out["conversion_rate"] = s.ConversionRate
	out["search_impression_share"] = s.SearchImprShare
	if budgetCLP > 0 {
		out["budget_pct_used"] = (s.CostCLP / budgetCLP) * 100
	}
	return out
}

func campaignNameGA(s *googleads.CampaignInsights) string {
	if s == nil {
		return "Refugio - Search - Lanzamiento Junio 2026"
	}
	return s.CampaignName
}

func googleAdsRefugioThresholds() map[string]interface{} {
	return map[string]interface{}{
		"ctr_search":              map[string]float64{"green_min": 5.0, "yellow_min": 2.0},
		"cpl_clp":                 map[string]float64{"green_max": 10000, "yellow_max": 15000},
		"search_impression_share": map[string]float64{"green_min": 50.0, "yellow_min": 30.0},
		"quality_score":           map[string]float64{"green_min": 7.0, "yellow_min": 5.0},
		"budget_remaining_pct":    map[string]float64{"green_min": 20.0, "yellow_min": 10.0},
	}
}
