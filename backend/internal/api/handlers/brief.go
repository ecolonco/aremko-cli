package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/analytics"
	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
)

// GetWeeklyBrief retorna el brief semanal en formato JSON
func GetWeeklyBrief(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Calcular rango de fechas
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		brief := map[string]interface{}{
			"title":      "Brief Semanal - Aremko Spa",
			"date_start": dateStart,
			"date_stop":  dateStop,
			"generated_at": time.Now().Format(time.RFC3339),
		}

		// Meta Ads section
		if cfg.EnableMetaAds {
			metaData, err := getMetaAdsData(cfg, dateStart, dateStop)
			if err == nil {
				brief["meta_ads"] = metaData
			} else {
				brief["meta_ads"] = map[string]interface{}{
					"error": err.Error(),
				}
			}
		}

		// Google Ads section (placeholder)
		if cfg.EnableGoogleAds {
			brief["google_ads"] = map[string]interface{}{
				"status": "coming_soon",
			}
		}

		// LinkedIn section (placeholder)
		if cfg.EnableLinkedIn {
			brief["linkedin"] = map[string]interface{}{
				"status": "coming_soon",
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    brief,
		})
	}
}

// GenerateBrief genera un nuevo brief bajo demanda
func GenerateBrief(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Por ahora, simplemente llama a GetWeeklyBrief
		// En el futuro, esto podría guardar el brief en la DB
		GetWeeklyBrief(cfg)(w, r)
	}
}

// GetStatsOverview retorna estadísticas generales
func GetStatsOverview(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		overview := map[string]interface{}{
			"period": map[string]string{
				"start": dateStart,
				"end":   dateStop,
			},
		}

		// Meta Ads stats
		if cfg.EnableMetaAds {
			metaData, err := getMetaAdsData(cfg, dateStart, dateStop)
			if err == nil {
				overview["meta_ads"] = metaData
			}
		}

		// GA4 Web Analytics stats
		if cfg.EnableGA4 {
			fmt.Printf("[GA4] Intentando conectar con credenciales: %s\n", cfg.GA4CredentialsPath)
			fmt.Printf("[GA4] Property ID: %s\n", cfg.GA4PropertyID)
			ga4Client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
			if err != nil {
				fmt.Printf("[GA4] ERROR al crear cliente: %v\n", err)
			} else {
				fmt.Println("[GA4] Cliente creado exitosamente")
				ctx := context.Background()
				ga4Stats, err := ga4Client.GetStats(ctx, dateStart, dateStop)
				if err != nil {
					fmt.Printf("[GA4] ERROR al obtener stats: %v\n", err)
				} else {
					fmt.Println("[GA4] Stats obtenidas exitosamente")
					overview["web_analytics"] = map[string]interface{}{
						"active_users":         ga4Stats.ActiveUsers,
						"total_users":          ga4Stats.TotalUsers,
						"sessions":             ga4Stats.Sessions,
						"page_views":           ga4Stats.PageViews,
						"bounce_rate":          ga4Stats.BounceRate,
						"avg_session_duration": ga4Stats.AvgSessionDuration,
						"new_users":            ga4Stats.NewUsers,
						"event_count":          ga4Stats.EventCount,
						"status":               "real_data",
					}
				}
			}
		}

		// Booking stats (real data from Django API)
		if cfg.EnableBookings {
			bookingClient := bookings.NewClient(cfg.BookingSystemURL)
			bookingStats, err := bookingClient.GetBookingStats(dateStart, dateStop)
			if err == nil {
				bookingsData := map[string]interface{}{
					"total":      bookingStats.Total,
					"revenue":    bookingStats.Revenue,
					"avg_ticket": bookingStats.AvgTicket,
					"paid":       bookingStats.Paid,
					"pending":    bookingStats.Pending,
					"partial":    bookingStats.Partial,
					"status":     "real_data",
				}

				// Obtener datos por familia de servicios (desde día 1 hasta hoy)
				now := time.Now()
				familyDateStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
				familyDateStop := now.Format("2006-01-02")

				familyStats, err := bookingClient.GetServiceFamilyStats(familyDateStart, familyDateStop)
				if err == nil {
					bookingsData["by_family"] = familyStats
				}

				// Obtener datos por método de pago (desde día 1 hasta hoy)
				paymentStats, err := bookingClient.GetPaymentMethodStats(familyDateStart, familyDateStop)
				if err == nil {
					bookingsData["by_payment_method"] = paymentStats
				}

				overview["bookings"] = bookingsData
			} else {
				// Fallback a datos de ejemplo si no hay conexión
				overview["bookings"] = map[string]interface{}{
					"total":      48,
					"revenue":    2840000,
					"avg_ticket": 59167,
					"status":     "mock_data",
					"error":      err.Error(),
				}
			}
		} else {
			overview["bookings"] = map[string]interface{}{
				"total":      48,
				"revenue":    2840000,
				"avg_ticket": 59167,
				"status":     "mock_data",
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    overview,
		})
	}
}

// Helper para obtener datos de Meta Ads
func getMetaAdsData(cfg *config.Config, dateStart, dateStop string) (map[string]interface{}, error) {
	token, err := config.GetMetaToken()
	if err != nil {
		return nil, err
	}

	client := meta.NewClient(token, cfg.MetaAdAccountID)
	insights, err := client.GetAccountInsights(dateStart, dateStop)
	if err != nil {
		return nil, err
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

	// Encontrar mejor y peor campaña
	var bestCampaign, worstCampaign *meta.AdInsights
	bestCTR := 0.0
	worstCTR := 100.0

	for i := range insights {
		ctr := insights[i].CalculateCTR()
		if ctr > bestCTR {
			bestCTR = ctr
			bestCampaign = &insights[i]
		}
		if ctr < worstCTR && insights[i].Impressions > 1000 {
			worstCTR = ctr
			worstCampaign = &insights[i]
		}
	}

	recommendations := []string{}
	if avgCTR < 1.0 {
		recommendations = append(recommendations, "CTR bajo (<1%) - Considera mejorar el copy y creativos")
	} else if avgCTR > 3.0 {
		recommendations = append(recommendations, "CTR excelente (>3%) - Mantén esta estrategia")
	}
	if avgCPC > 1.0 {
		recommendations = append(recommendations, "CPC alto (>$1) - Revisa targeting y optimiza audiencias")
	}

	result := map[string]interface{}{
		"summary": map[string]interface{}{
			"spend":       totalSpend,
			"impressions": totalImpressions,
			"clicks":      totalClicks,
			"reach":       totalReach,
			"ctr":         avgCTR,
			"cpc":         avgCPC,
			"cpm":         avgCPM,
		},
		"campaigns_count": len(insights),
		"recommendations": recommendations,
	}

	if bestCampaign != nil {
		result["best_campaign"] = map[string]interface{}{
			"name": bestCampaign.CampaignName,
			"ctr":  bestCTR,
		}
	}

	if worstCampaign != nil {
		result["worst_campaign"] = map[string]interface{}{
			"name": worstCampaign.CampaignName,
			"ctr":  worstCTR,
		}
	}

	return result, nil
}
