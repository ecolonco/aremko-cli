package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/ai"
	"github.com/aremko/aremko-cli/internal/analytics"
	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/competitors"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
	"github.com/aremko/aremko-cli/internal/reviews"
)

// GetWeeklyBrief retorna el brief semanal en formato JSON
func GetWeeklyBrief(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Calcular rango de fechas
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		brief := map[string]interface{}{
			"title":        "Brief Semanal - Aremko Spa",
			"date_start":   dateStart,
			"date_stop":    dateStop,
			"generated_at": time.Now().Format(time.RFC3339),
		}

		// Web Analytics (GA4)
		if cfg.EnableGA4 {
			ga4Client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
			if err == nil {
				ctx := context.Background()
				ga4Stats, err := ga4Client.GetStats(ctx, dateStart, dateStop)
				if err == nil {
					// Obtener páginas más visitadas
					topPages, _ := ga4Client.GetTopPages(ctx, dateStart, dateStop, 10)

					// Obtener fuentes de tráfico
					trafficSources, _ := ga4Client.GetTrafficSources(ctx, dateStart, dateStop)

				// Obtener tendencias semanales (últimas 4 semanas)
				weeklyTrends, _ := ga4Client.GetWeeklyTrends(ctx)
				topPagesWeekly, _ := ga4Client.GetTopPagesWeekly(ctx, 5)
				trafficSourcesWeekly, _ := ga4Client.GetTrafficSourcesWeekly(ctx)

					brief["web_analytics"] = map[string]interface{}{
						"active_users":         ga4Stats.ActiveUsers,
						"total_users":          ga4Stats.TotalUsers,
						"sessions":             ga4Stats.Sessions,
						"page_views":           ga4Stats.PageViews,
						"bounce_rate":          ga4Stats.BounceRate,
						"avg_session_duration": ga4Stats.AvgSessionDuration,
						"new_users":            ga4Stats.NewUsers,
						"event_count":          ga4Stats.EventCount,
						"top_pages":            topPages,
						"traffic_sources":      trafficSources,
						"weekly_trends":        weeklyTrends,
						"top_pages_weekly":        topPagesWeekly,
						"traffic_sources_weekly":  trafficSourcesWeekly,
					}
				}
			}
		}

		// Bookings data
		if cfg.EnableBookings {
			bookingClient := bookings.NewClient(cfg.BookingSystemURL)
			bookingStats, err := bookingClient.GetBookingStats(dateStart, dateStop)
			if err == nil {
				brief["bookings"] = map[string]interface{}{
					"total":      bookingStats.Total,
					"revenue":    bookingStats.Revenue,
					"avg_ticket": bookingStats.AvgTicket,
					"paid":       bookingStats.Paid,
					"pending":    bookingStats.Pending,
					"partial":    bookingStats.Partial,
				}
			}
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

		// Reviews/Opinions section
		if cfg.EnableBookings {
			reviewsClient := reviews.NewClient(cfg.BookingSystemURL)
			reviewsSummary, err := reviewsClient.GetReviewsSummary()
			if err == nil {
				brief["reviews"] = map[string]interface{}{
					"surveys":   reviewsSummary.Surveys,
					"snapshots": reviewsSummary.Snapshots,
					"recent":    reviewsSummary.Recent,
					"period":    reviewsSummary.Period,
					"status":    "real_data",
				}
			} else {
				brief["reviews"] = map[string]interface{}{
					"status": "error",
					"error":  err.Error(),
				}
			}
		}


	// Competitors Analysis section
	if cfg.EnableBookings {
		competitorsClient := competitors.NewClient(cfg.BookingSystemURL)
		competitorsSummary, err := competitorsClient.GetCompetitorsSummary()
		if err == nil {
			brief["competitors"] = map[string]interface{}{
				"competitors":              competitorsSummary.Competitors,
				"aremko_precio_referencia": competitorsSummary.AremkoPrecio,
				"generated_at":             competitorsSummary.GeneratedAt,
				"status":                   "real_data",
			}
		} else {
			brief["competitors"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
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

					// Obtener páginas más visitadas
					topPages, _ := ga4Client.GetTopPages(ctx, dateStart, dateStop, 10)

					// Obtener fuentes de tráfico
					trafficSources, _ := ga4Client.GetTrafficSources(ctx, dateStart, dateStop)

					overview["web_analytics"] = map[string]interface{}{
						"active_users":         ga4Stats.ActiveUsers,
						"total_users":          ga4Stats.TotalUsers,
						"sessions":             ga4Stats.Sessions,
						"page_views":           ga4Stats.PageViews,
						"bounce_rate":          ga4Stats.BounceRate,
						"avg_session_duration": ga4Stats.AvgSessionDuration,
						"new_users":            ga4Stats.NewUsers,
						"event_count":          ga4Stats.EventCount,
						"top_pages":            topPages,
						"traffic_sources":      trafficSources,
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


	// Reviews/Opinions section
	if cfg.EnableBookings {
		reviewsClient := reviews.NewClient(cfg.BookingSystemURL)
		reviewsSummary, err := reviewsClient.GetReviewsSummary()
		if err == nil {
			overview["reviews"] = map[string]interface{}{
				"surveys":   reviewsSummary.Surveys,
				"snapshots": reviewsSummary.Snapshots,
				"recent":    reviewsSummary.Recent,
				"period":    reviewsSummary.Period,
				"status":    "real_data",
			}
		} else {
			overview["reviews"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		}
	}

	// Competitors Analysis section
	if cfg.EnableBookings {
		competitorsClient := competitors.NewClient(cfg.BookingSystemURL)
		competitorsSummary, err := competitorsClient.GetCompetitorsSummary()
		if err == nil {
			overview["competitors"] = map[string]interface{}{
				"competitors":              competitorsSummary.Competitors,
				"aremko_precio_referencia": competitorsSummary.AremkoPrecio,
				"generated_at":             competitorsSummary.GeneratedAt,
				"status":                   "real_data",
			}
		} else {
			overview["competitors"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
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

// GetWeeklyBriefWithAI retorna el brief semanal con análisis de IA
func GetWeeklyBriefWithAI(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Primero, obtener todos los datos del brief
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		briefData := map[string]interface{}{
			"title":        "Brief Semanal - Aremko Spa",
			"date_start":   dateStart,
			"date_stop":    dateStop,
			"generated_at": time.Now().Format(time.RFC3339),
		}

		// Web Analytics (GA4)
		if cfg.EnableGA4 {
			ga4Client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
			if err == nil {
				ctx := context.Background()
				ga4Stats, err := ga4Client.GetStats(ctx, dateStart, dateStop)
				if err == nil {
					topPages, _ := ga4Client.GetTopPages(ctx, dateStart, dateStop, 10)
					trafficSources, _ := ga4Client.GetTrafficSources(ctx, dateStart, dateStop)
					weeklyTrends, _ := ga4Client.GetWeeklyTrends(ctx)
					topPagesWeekly, _ := ga4Client.GetTopPagesWeekly(ctx, 5)
					trafficSourcesWeekly, _ := ga4Client.GetTrafficSourcesWeekly(ctx)

					briefData["web_analytics"] = map[string]interface{}{
						"active_users":         ga4Stats.ActiveUsers,
						"total_users":          ga4Stats.TotalUsers,
						"sessions":             ga4Stats.Sessions,
						"page_views":           ga4Stats.PageViews,
						"bounce_rate":          ga4Stats.BounceRate,
						"avg_session_duration": ga4Stats.AvgSessionDuration,
						"new_users":            ga4Stats.NewUsers,
						"event_count":          ga4Stats.EventCount,
						"top_pages":            topPages,
						"traffic_sources":      trafficSources,
						"weekly_trends":        weeklyTrends,
						"top_pages_weekly":        topPagesWeekly,
						"traffic_sources_weekly":  trafficSourcesWeekly,
					}
				}
			}
		}

		// Bookings data
		if cfg.EnableBookings {
			bookingClient := bookings.NewClient(cfg.BookingSystemURL)
			bookingStats, err := bookingClient.GetBookingStats(dateStart, dateStop)
			if err == nil {
				briefData["bookings"] = map[string]interface{}{
					"total":      bookingStats.Total,
					"revenue":    bookingStats.Revenue,
					"avg_ticket": bookingStats.AvgTicket,
					"paid":       bookingStats.Paid,
					"pending":    bookingStats.Pending,
					"partial":    bookingStats.Partial,
				}

				// Datos por familia de servicios
				now := time.Now()
				familyDateStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
				familyDateStop := now.Format("2006-01-02")

				familyStats, err := bookingClient.GetServiceFamilyStats(familyDateStart, familyDateStop)
				if err == nil {
					briefData["bookings"].(map[string]interface{})["by_family"] = familyStats
				}

				paymentStats, err := bookingClient.GetPaymentMethodStats(familyDateStart, familyDateStop)
				if err == nil {
					briefData["bookings"].(map[string]interface{})["by_payment_method"] = paymentStats
				}
			}
		}

		// Meta Ads section
		if cfg.EnableMetaAds {
			metaData, err := getMetaAdsData(cfg, dateStart, dateStop)
			if err == nil {
				briefData["meta_ads"] = metaData
			}
		}

		// Reviews/Opinions section
		if cfg.EnableBookings {
			reviewsClient := reviews.NewClient(cfg.BookingSystemURL)
			reviewsSummary, err := reviewsClient.GetReviewsSummary()
			if err == nil {
				briefData["reviews"] = map[string]interface{}{
					"surveys":   reviewsSummary.Surveys,
					"snapshots": reviewsSummary.Snapshots,
					"recent":    reviewsSummary.Recent,
					"period":    reviewsSummary.Period,
					"status":    "real_data",
				}
			} else {
				briefData["reviews"] = map[string]interface{}{
					"status": "error",
					"error":  err.Error(),
				}
			}
		}

	// Competitors Analysis section
	if cfg.EnableBookings {
		competitorsClient := competitors.NewClient(cfg.BookingSystemURL)
		competitorsSummary, err := competitorsClient.GetCompetitorsSummary()
		if err == nil {
			briefData["competitors"] = map[string]interface{}{
				"competitors":              competitorsSummary.Competitors,
				"aremko_precio_referencia": competitorsSummary.AremkoPrecio,
				"generated_at":             competitorsSummary.GeneratedAt,
				"status":                   "real_data",
			}
		} else {
			briefData["competitors"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		}
	}

	// Generar análisis con IA si está habilitado
	var aiAnalysis *ai.LLMResult
	var contentCalendar *ai.LLMResult

	if cfg.EnableAI && cfg.OpenRouterAPIKey != "" {
		aiClient := ai.NewOpenRouterClient(cfg.OpenRouterAPIKey, cfg.OpenRouterBaseURL)
		ctx := context.Background()

			// Generar análisis del brief
			fmt.Println("[AI] Generando análisis del brief...")
			aiAnalysis, _ = aiClient.GenerateBriefAnalysis(ctx, briefData)

			// Generar calendario de contenido
			fmt.Println("[AI] Generando calendario de contenido...")
			contentCalendar, _ = aiClient.GenerateContentCalendar(ctx, briefData, 7)
		}

		// Construir respuesta final
		response := map[string]interface{}{
			"success": true,
			"data":    briefData,
		}

		if aiAnalysis != nil && aiAnalysis.Error == "" {
			response["ai_analysis"] = map[string]interface{}{
				"content":       aiAnalysis.Text,
				"model":         aiAnalysis.Model,
				"input_tokens":  aiAnalysis.InputTokens,
				"output_tokens": aiAnalysis.OutputTokens,
				"latency_ms":    aiAnalysis.LatencyMs,
			}
		}

		if contentCalendar != nil && contentCalendar.Error == "" {
			response["content_calendar"] = map[string]interface{}{
				"content":       contentCalendar.Text,
				"model":         contentCalendar.Model,
				"input_tokens":  contentCalendar.InputTokens,
				"output_tokens": contentCalendar.OutputTokens,
				"latency_ms":    contentCalendar.LatencyMs,
			}
		}

		respondJSON(w, http.StatusOK, response)
	}
}

// AnalyzeWebAnalytics genera un análisis completo con IA de los datos de web analytics
func AnalyzeWebAnalytics(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Verificar que la IA está habilitada
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}

		// Obtener datos de web analytics completos
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		var webAnalyticsData map[string]interface{}

		if cfg.EnableGA4 {
			ga4Client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
			if err == nil {
				ctx := context.Background()
				ga4Stats, err := ga4Client.GetStats(ctx, dateStart, dateStop)
				if err == nil {
					topPages, _ := ga4Client.GetTopPages(ctx, dateStart, dateStop, 10)
					trafficSources, _ := ga4Client.GetTrafficSources(ctx, dateStart, dateStop)
					weeklyTrends, _ := ga4Client.GetWeeklyTrends(ctx)
					topPagesWeekly, _ := ga4Client.GetTopPagesWeekly(ctx, 5)
					trafficSourcesWeekly, _ := ga4Client.GetTrafficSourcesWeekly(ctx)

					webAnalyticsData = map[string]interface{}{
						"period": map[string]string{
							"start": dateStart,
							"end":   dateStop,
						},
						"summary": map[string]interface{}{
							"active_users":         ga4Stats.ActiveUsers,
							"total_users":          ga4Stats.TotalUsers,
							"sessions":             ga4Stats.Sessions,
							"page_views":           ga4Stats.PageViews,
							"bounce_rate":          ga4Stats.BounceRate,
							"avg_session_duration": ga4Stats.AvgSessionDuration,
							"new_users":            ga4Stats.NewUsers,
							"event_count":          ga4Stats.EventCount,
						},
						"weekly_trends":          weeklyTrends,
						"top_pages":              topPages,
						"top_pages_weekly":       topPagesWeekly,
						"traffic_sources":        trafficSources,
						"traffic_sources_weekly": trafficSourcesWeekly,
					}
				}
			}
		}

		if webAnalyticsData == nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   "Failed to fetch web analytics data",
			})
			return
		}

		// Generar análisis con IA
		aiClient := ai.NewOpenRouterClient(cfg.OpenRouterAPIKey, cfg.OpenRouterBaseURL)
		ctx := context.Background()

		fmt.Println("[AI] Generando análisis de web analytics...")
		analysis, err := aiClient.GenerateWebAnalyticsAnalysis(ctx, webAnalyticsData)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to generate analysis: %v", err),
			})
			return
		}

		if analysis.Error != "" {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   analysis.Error,
			})
			return
		}

		// Retornar análisis
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"analysis": map[string]interface{}{
				"content":       analysis.Text,
				"model":         analysis.Model,
				"input_tokens":  analysis.InputTokens,
				"output_tokens": analysis.OutputTokens,
				"latency_ms":    analysis.LatencyMs,
			},
		})
	}
}
