package handlers

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/aremko/aremko-cli/internal/ai"
	"github.com/aremko/aremko-cli/internal/analytics"
	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/competitors"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
	"github.com/aremko/aremko-cli/internal/reviews"
	"github.com/aremko/aremko-cli/internal/social"
	"github.com/aremko/aremko-cli/internal/taxonomy"
)

// topNBuckets devuelve los N primeros de una lista de EjeBucket por count descendente.
func topNBuckets(buckets []taxonomy.EjeBucket, n int) []taxonomy.EjeBucket {
	if len(buckets) == 0 {
		return buckets
	}
	sorted := make([]taxonomy.EjeBucket, len(buckets))
	copy(sorted, buckets)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Count > sorted[j].Count })
	if n > len(sorted) {
		n = len(sorted)
	}
	return sorted[:n]
}

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
				bookingsData := map[string]interface{}{
					"total":      bookingStats.Total,
					"revenue":    bookingStats.Revenue,
					"avg_ticket": bookingStats.AvgTicket,
					"paid":       bookingStats.Paid,
					"pending":    bookingStats.Pending,
					"partial":    bookingStats.Partial,
					"period": map[string]string{
						"start": dateStart,
						"end":   dateStop,
					},
				}

				// Ventas por familia de servicios (con comparativa mes/año anterior)
				if familyStats, ferr := bookingClient.GetServiceFamilyStats(dateStart, dateStop); ferr == nil {
					bookingsData["by_family"] = familyStats
				}

				// Ventas por método de pago (con comparativa)
				if paymentStats, perr := bookingClient.GetPaymentMethodStats(dateStart, dateStop); perr == nil {
					bookingsData["by_payment_method"] = paymentStats
				}

				// Estadísticas de clientes (total, nuevos esta semana, recurrentes)
				if clientStats, cerr := bookingClient.GetClientStats(); cerr == nil {
					bookingsData["client_stats"] = clientStats
				}

				// Reservas día por día de la semana
				if dailyBookings, derr := bookingClient.GetDailyBookings(dateStart, dateStop); derr == nil {
					bookingsData["daily"] = dailyBookings
				}

				// Matriz 12 semanas × familias × clientes nuevos/recurrentes
				if weeklyBreakdown, werr := bookingClient.GetWeeklyBreakdown(12); werr == nil {
					bookingsData["weekly_breakdown"] = weeklyBreakdown
				}

				// Ventas Mes a la Fecha por familia (con comparativa MoM/YoY corregida)
				if mtdStats, merr := bookingClient.GetFamilyStatsMTD(""); merr == nil {
					bookingsData["by_family_mtd"] = mtdStats
				}

				brief["bookings"] = bookingsData
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
	// Instagram Organic section
	if cfg.EnableMetaAds && cfg.MetaAccessToken != "" {
		igClient := social.NewInstagramClient(cfg.MetaAccessToken)
		ctx := context.Background()

		accountInfo, err := igClient.GetAccountInfo(ctx)
		if err == nil {
			accountID := accountInfo["account_id"].(string)

			// Obtener insights semanales
			weeklyInsights, _ := igClient.GetWeeklyInsights(ctx, accountID)

			// Obtener top posts
			topPosts, _ := igClient.GetTopPosts(ctx, accountID, 10)

			brief["instagram_organic"] = map[string]interface{}{
				"account_info":    accountInfo,
				"weekly_insights": weeklyInsights,
				"top_posts":       topPosts,
				"status":          "real_data",
			}
		} else {
			brief["instagram_organic"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		}
	}

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
	// Instagram Organic section
	if cfg.EnableMetaAds && cfg.MetaAccessToken != "" {
		igClient := social.NewInstagramClient(cfg.MetaAccessToken)
		ctx := context.Background()

		accountInfo, err := igClient.GetAccountInfo(ctx)
		if err == nil {
			accountID := accountInfo["account_id"].(string)

			// Obtener insights semanales
			weeklyInsights, _ := igClient.GetWeeklyInsights(ctx, accountID)

			// Obtener top posts
			topPosts, _ := igClient.GetTopPosts(ctx, accountID, 10)

			overview["instagram_organic"] = map[string]interface{}{
				"account_info":    accountInfo,
				"weekly_insights": weeklyInsights,
				"top_posts":       topPosts,
				"status":          "real_data",
			}
		} else {
			overview["instagram_organic"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		}
	}

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

	// Lista de campañas del rango actual (semana del brief)
	campaignsList := make([]map[string]interface{}, 0, len(insights))
	for i := range insights {
		campaignsList = append(campaignsList, map[string]interface{}{
			"id":          insights[i].CampaignID,
			"name":        insights[i].CampaignName,
			"spend":       insights[i].Spend,
			"impressions": insights[i].Impressions,
			"clicks":      insights[i].Clicks,
			"reach":       insights[i].Reach,
			"ctr":         insights[i].CalculateCTR(),
			"cpc":         insights[i].CalculateCPC(),
			"cpm":         insights[i].CalculateCPM(),
			"period":      "week",
		})
	}

	// Top 10 campañas de los últimos 90 días (incluye campañas no activas esta semana)
	recentCampaigns := []map[string]interface{}{}
	historicalStart := time.Now().AddDate(0, 0, -90).Format("2006-01-02")
	historicalStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	if historicalInsights, hErr := client.GetAccountInsights(historicalStart, historicalStop); hErr == nil && len(historicalInsights) > 0 {
		sort.Slice(historicalInsights, func(i, j int) bool {
			return historicalInsights[i].Spend > historicalInsights[j].Spend
		})
		limit := 10
		if len(historicalInsights) < limit {
			limit = len(historicalInsights)
		}
		for i := 0; i < limit; i++ {
			recentCampaigns = append(recentCampaigns, map[string]interface{}{
				"id":          historicalInsights[i].CampaignID,
				"name":        historicalInsights[i].CampaignName,
				"spend":       historicalInsights[i].Spend,
				"impressions": historicalInsights[i].Impressions,
				"clicks":      historicalInsights[i].Clicks,
				"reach":       historicalInsights[i].Reach,
				"ctr":         historicalInsights[i].CalculateCTR(),
				"cpc":         historicalInsights[i].CalculateCPC(),
				"cpm":         historicalInsights[i].CalculateCPM(),
			})
		}
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
		"campaigns_count":   len(insights),
		"campaigns":         campaignsList,
		"recent_campaigns":  recentCampaigns,
		"recent_range_days": 90,
		"recommendations":   recommendations,
		"period": map[string]string{
			"start": dateStart,
			"end":   dateStop,
		},
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

// newAIClientWithOperatingContext returns an OpenRouter client preloaded with
// Aremko's current operating context. Best-effort: if the fetch from Django
// fails, the analysis still runs (just without the context-aware prompt).
func newAIClientWithOperatingContext(cfg *config.Config) *ai.OpenRouterClient {
	client := ai.NewOpenRouterClient(cfg.OpenRouterAPIKey, cfg.OpenRouterBaseURL)
	if cfg.EnableBookings && cfg.BookingSystemURL != "" {
		bClient := bookings.NewClient(cfg.BookingSystemURL)
		if opCtx, err := bClient.GetOperatingContext(); err == nil && opCtx != "" {
			client.OperatingContext = opCtx
		}
	}
	return client
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
	// Instagram Organic section
	if cfg.EnableMetaAds && cfg.MetaAccessToken != "" {
		igClient := social.NewInstagramClient(cfg.MetaAccessToken)
		ctx := context.Background()

		accountInfo, err := igClient.GetAccountInfo(ctx)
		if err == nil {
			accountID := accountInfo["account_id"].(string)

			// Obtener insights semanales
			weeklyInsights, _ := igClient.GetWeeklyInsights(ctx, accountID)

			// Obtener top posts
			topPosts, _ := igClient.GetTopPosts(ctx, accountID, 10)

			briefData["instagram_organic"] = map[string]interface{}{
				"account_info":    accountInfo,
				"weekly_insights": weeklyInsights,
				"top_posts":       topPosts,
				"status":          "real_data",
			}
		} else {
			briefData["instagram_organic"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		}
	}

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
		aiClient := newAIClientWithOperatingContext(cfg)
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
		aiClient := newAIClientWithOperatingContext(cfg)
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

// AnalyzeInstagramOrganic genera un análisis completo con IA de los datos de Instagram Orgánico
func AnalyzeInstagramOrganic(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Verificar que la IA está habilitada
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}

		// Verificar que Meta Ads está habilitado (necesitamos el token)
		if !cfg.EnableMetaAds || cfg.MetaAccessToken == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Instagram integration is not enabled",
			})
			return
		}

		// Obtener datos de Instagram completos
		var instagramData map[string]interface{}

		igClient := social.NewInstagramClient(cfg.MetaAccessToken)
		ctx := context.Background()

		accountInfo, err := igClient.GetAccountInfo(ctx)
		if err == nil {
			accountID := accountInfo["account_id"].(string)

			// Obtener insights semanales
			weeklyInsights, _ := igClient.GetWeeklyInsights(ctx, accountID)

			// Obtener top posts
			topPosts, _ := igClient.GetTopPosts(ctx, accountID, 10)

			instagramData = map[string]interface{}{
				"account_info":    accountInfo,
				"weekly_insights": weeklyInsights,
				"top_posts":       topPosts,
			}
		}

		if instagramData == nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   "Failed to fetch Instagram data",
			})
			return
		}

		// Generar análisis con IA
		aiClient := newAIClientWithOperatingContext(cfg)

		fmt.Println("[AI] Generando análisis de Instagram Orgánico...")
		analysis, err := aiClient.GenerateInstagramAnalysis(ctx, instagramData)
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

// AnalyzeMetaAds genera un análisis completo con IA de los datos de Meta Ads
func AnalyzeMetaAds(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Verificar que la IA está habilitada
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}

		// Verificar que Meta Ads está habilitado
		if !cfg.EnableMetaAds || cfg.MetaAccessToken == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Meta Ads integration is not enabled",
			})
			return
		}

		// Obtener datos completos de Meta Ads (mismo rango que el brief semanal)
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		metaData, err := getMetaAdsData(cfg, dateStart, dateStop)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to fetch Meta Ads data: %v", err),
			})
			return
		}

		// Generar análisis con IA
		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()

		fmt.Println("[AI] Generando análisis de Meta Ads...")
		analysis, err := aiClient.GenerateMetaAdsAnalysis(ctx, metaData)
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

// AnalyzeSales genera un análisis completo con IA de los datos de ventas y reservas
func AnalyzeSales(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}

		if !cfg.EnableBookings {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Bookings integration is not enabled",
			})
			return
		}

		// Mismo rango que el brief semanal
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		bookingClient := bookings.NewClient(cfg.BookingSystemURL)
		stats, err := bookingClient.GetBookingStats(dateStart, dateStop)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to fetch booking stats: %v", err),
			})
			return
		}

		salesData := map[string]interface{}{
			"period": map[string]string{
				"start": dateStart,
				"end":   dateStop,
			},
			"summary": map[string]interface{}{
				"total":      stats.Total,
				"revenue":    stats.Revenue,
				"avg_ticket": stats.AvgTicket,
				"paid":       stats.Paid,
				"pending":    stats.Pending,
				"partial":    stats.Partial,
			},
		}

		if familyStats, ferr := bookingClient.GetServiceFamilyStats(dateStart, dateStop); ferr == nil {
			salesData["by_family"] = familyStats
		}
		if paymentStats, perr := bookingClient.GetPaymentMethodStats(dateStart, dateStop); perr == nil {
			salesData["by_payment_method"] = paymentStats
		}
		if clientStats, cerr := bookingClient.GetClientStats(); cerr == nil {
			salesData["client_stats"] = clientStats
		}
		if dailyBookings, derr := bookingClient.GetDailyBookings(dateStart, dateStop); derr == nil {
			salesData["daily"] = dailyBookings
		}
		// Mes a la Fecha (revenue corregido × cantidad_personas)
		if mtdStats, merr := bookingClient.GetFamilyStatsMTD(""); merr == nil {
			salesData["by_family_mtd"] = mtdStats
		}
		// Matriz 12 semanas (clientes nuevos vs recurrentes)
		if weeklyBreakdown, werr := bookingClient.GetWeeklyBreakdown(12); werr == nil {
			salesData["weekly_breakdown"] = weeklyBreakdown
		}
		// Tendencias mensuales 24 meses por familia (estacionalidad + slope)
		if monthlyTrends, merr := bookingClient.GetMonthlyByFamily(24); merr == nil {
			salesData["monthly_trends"] = monthlyTrends
		}
		// Combinaciones de familias por reserva (bundling effectiveness, últimos 24 meses)
		if combos, cerr := bookingClient.GetFamilyCombinations(24); cerr == nil {
			salesData["family_combinations"] = combos
		}
		// Resumen lite de la taxonomía de clientes (3-4 líneas para que el modelo
		// tenga contexto sin saturar el prompt).
		if cfg.BookingSystemURL != "" {
			taxClient := taxonomy.NewClient(cfg.BookingSystemURL)
			if segs, terr := taxClient.GetSegments(); terr == nil && segs != nil {
				salesData["customer_segments_summary"] = map[string]interface{}{
					"total_clientes":      segs.TotalClientes,
					"n_sistema_actual":    segs.NSistemaActual,
					"n_pre_sistema":       segs.NPreSistema,
					"top_3_estilos":       topNBuckets(segs.EjeEstilo, 3),
					"top_3_contextos":     topNBuckets(segs.EjeContexto, 3),
					"valor_distribucion":  segs.EjeValor,
					"nota":                "Para drill-down completo de cohortes, ver pestaña Perfiles del dashboard.",
				}
			}
		}

		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()

		fmt.Println("[AI] Generando análisis de Ventas...")
		analysis, err := aiClient.GenerateSalesAnalysis(ctx, salesData)
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

// AnalyzeReviews genera un análisis completo con IA de las opiniones y encuestas
func AnalyzeReviews(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}

		if !cfg.EnableBookings {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Reviews integration is not enabled",
			})
			return
		}

		reviewsClient := reviews.NewClient(cfg.BookingSystemURL)
		summary, err := reviewsClient.GetReviewsSummary()
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Failed to fetch reviews data: %v", err),
			})
			return
		}

		reviewsData := map[string]interface{}{
			"period":    summary.Period,
			"surveys":   summary.Surveys,
			"snapshots": summary.Snapshots,
			"recent":    summary.Recent,
		}

		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()

		fmt.Println("[AI] Generando análisis de Opiniones...")
		analysis, err := aiClient.GenerateReviewsAnalysis(ctx, reviewsData)
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

// AnalyzeOverview arma el brief semanal completo y genera análisis IA integral que
// cruza todas las áreas (web, social, ventas, opiniones, competencia) con plan de acción.
func AnalyzeOverview(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}

		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		ctx := context.Background()
		fullBrief := map[string]interface{}{
			"period": map[string]string{
				"start": dateStart,
				"end":   dateStop,
			},
		}
		var mu sync.Mutex
		var wg sync.WaitGroup

		setSection := func(key string, value interface{}) {
			mu.Lock()
			fullBrief[key] = value
			mu.Unlock()
		}

		// Web Analytics (GA4)
		if cfg.EnableGA4 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }() // no romper si falla
				ga4Client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
				if err != nil {
					return
				}
				ga4Stats, err := ga4Client.GetStats(ctx, dateStart, dateStop)
				if err != nil {
					return
				}
				topPages, _ := ga4Client.GetTopPages(ctx, dateStart, dateStop, 10)
				trafficSources, _ := ga4Client.GetTrafficSources(ctx, dateStart, dateStop)
				weeklyTrends, _ := ga4Client.GetWeeklyTrends(ctx)
				setSection("web_analytics", map[string]interface{}{
					"summary": map[string]interface{}{
						"active_users":         ga4Stats.ActiveUsers,
						"sessions":             ga4Stats.Sessions,
						"page_views":           ga4Stats.PageViews,
						"bounce_rate":          ga4Stats.BounceRate,
						"avg_session_duration": ga4Stats.AvgSessionDuration,
						"new_users":            ga4Stats.NewUsers,
					},
					"weekly_trends":   weeklyTrends,
					"top_pages":       topPages,
					"traffic_sources": trafficSources,
				})
			}()
		}

		// Bookings (con weekly_breakdown 12 semanas)
		if cfg.EnableBookings {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }()
				bookingClient := bookings.NewClient(cfg.BookingSystemURL)
				bookingStats, err := bookingClient.GetBookingStats(dateStart, dateStop)
				if err != nil {
					return
				}
				salesData := map[string]interface{}{
					"summary": map[string]interface{}{
						"total":      bookingStats.Total,
						"revenue":    bookingStats.Revenue,
						"avg_ticket": bookingStats.AvgTicket,
						"paid":       bookingStats.Paid,
						"pending":    bookingStats.Pending,
						"partial":    bookingStats.Partial,
					},
				}
				if familyStats, ferr := bookingClient.GetServiceFamilyStats(dateStart, dateStop); ferr == nil {
					salesData["by_family"] = familyStats
				}
				if paymentStats, perr := bookingClient.GetPaymentMethodStats(dateStart, dateStop); perr == nil {
					salesData["by_payment_method"] = paymentStats
				}
				if clientStats, cerr := bookingClient.GetClientStats(); cerr == nil {
					salesData["client_stats"] = clientStats
				}
				if dailyBookings, derr := bookingClient.GetDailyBookings(dateStart, dateStop); derr == nil {
					salesData["daily"] = dailyBookings
				}
				if weeklyBreakdown, werr := bookingClient.GetWeeklyBreakdown(12); werr == nil {
					salesData["weekly_breakdown"] = weeklyBreakdown
				}
				setSection("sales", salesData)
			}()
		}

		// Meta Ads
		if cfg.EnableMetaAds {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }()
				if metaData, err := getMetaAdsData(cfg, dateStart, dateStop); err == nil {
					setSection("meta_ads", metaData)
				}
			}()
		}

		// Instagram Orgánico (type assertion segura para no entrar en panic)
		if cfg.EnableMetaAds && cfg.MetaAccessToken != "" {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }()
				igClient := social.NewInstagramClient(cfg.MetaAccessToken)
				accountInfo, err := igClient.GetAccountInfo(ctx)
				if err != nil {
					return
				}
				accountID, ok := accountInfo["account_id"].(string)
				if !ok || accountID == "" {
					setSection("instagram_organic", map[string]interface{}{
						"account_info": accountInfo,
					})
					return
				}
				weeklyInsights, _ := igClient.GetWeeklyInsights(ctx, accountID)
				topPosts, _ := igClient.GetTopPosts(ctx, accountID, 5)
				setSection("instagram_organic", map[string]interface{}{
					"account_info":    accountInfo,
					"weekly_insights": weeklyInsights,
					"top_posts":       topPosts,
				})
			}()
		}

		// Reviews
		if cfg.EnableBookings {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }()
				reviewsClient := reviews.NewClient(cfg.BookingSystemURL)
				if reviewsSummary, err := reviewsClient.GetReviewsSummary(); err == nil {
					setSection("reviews", map[string]interface{}{
						"surveys":   reviewsSummary.Surveys,
						"snapshots": reviewsSummary.Snapshots,
						"recent":    reviewsSummary.Recent,
						"period":    reviewsSummary.Period,
					})
				}
			}()
		}

		// Competencia
		if cfg.EnableBookings {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }()
				competitorsClient := competitors.NewClient(cfg.BookingSystemURL)
				if competitorsSummary, err := competitorsClient.GetCompetitorsSummary(); err == nil {
					setSection("competitors", map[string]interface{}{
						"competitors":              competitorsSummary.Competitors,
						"aremko_precio_referencia": competitorsSummary.AremkoPrecio,
					})
				}
			}()
		}

		// Esperar a que todas las áreas se recolecten en paralelo
		wg.Wait()

		// Llamar a la IA
		aiClient := newAIClientWithOperatingContext(cfg)
		fmt.Println("[AI] Generando análisis integral del brief...")
		analysis, err := aiClient.GenerateOverviewAnalysis(ctx, fullBrief)
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
