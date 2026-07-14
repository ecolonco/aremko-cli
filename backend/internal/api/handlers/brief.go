package handlers

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aremko/aremko-cli/internal/ai"
	"github.com/aremko/aremko-cli/internal/analytics"
	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/competitors"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/googleads"
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
					topPagesWeekly, _ := ga4Client.GetTopPagesWeekly(ctx, 50)
					trafficSourcesWeekly, _ := ga4Client.GetTrafficSourcesWeekly(ctx)

					brief["web_analytics"] = map[string]interface{}{
						"active_users":           ga4Stats.ActiveUsers,
						"total_users":            ga4Stats.TotalUsers,
						"sessions":               ga4Stats.Sessions,
						"page_views":             ga4Stats.PageViews,
						"bounce_rate":            ga4Stats.BounceRate,
						"avg_session_duration":   ga4Stats.AvgSessionDuration,
						"new_users":              ga4Stats.NewUsers,
						"event_count":            ga4Stats.EventCount,
						"top_pages":              topPages,
						"traffic_sources":        trafficSources,
						"weekly_trends":          weeklyTrends,
						"top_pages_weekly":       topPagesWeekly,
						"traffic_sources_weekly": trafficSourcesWeekly,
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

		// Google Ads section (paralelo a Meta, cuando esté configurado)
		if cfg.EnableGoogleAds {
			gaData, err := getGoogleAdsData(cfg, dateStart, dateStop)
			if err == nil {
				brief["google_ads"] = gaData
			} else {
				brief["google_ads"] = map[string]interface{}{
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

		// Facebook Organic section
		if cfg.EnableMetaAds && cfg.MetaAccessToken != "" {
			fbClient := social.NewFacebookClient(cfg.MetaAccessToken)
			fbInsights, err := fbClient.GetPageInsights(context.Background(), 10)
			if err == nil {
				brief["facebook_organic"] = map[string]interface{}{
					"page_info": map[string]interface{}{
						"name":            fbInsights.Name,
						"fan_count":       fbInsights.FanCount,
						"followers_count": fbInsights.FollowersCount,
					},
					"top_posts": fbInsights.TopPosts,
					"status":    "real_data",
				}
			} else {
				brief["facebook_organic"] = map[string]interface{}{
					"status": "error",
					"error":  err.Error(),
				}
			}
		}

		// TikTok Organic section (Login Kit + Display API, solo lectura de
		// estadísticas propias — NO es mensajería). Sin tendencia semanal
		// histórica (la API no la da); solo estado actual + mejores videos.
		if cfg.EnableTikTok {
			ttClient := social.NewTikTokClient(cfg.TikTokClientKey, cfg.TikTokClientSecret, cfg.TikTokRefreshToken)
			ctx := context.Background()
			accountInfo, err := ttClient.GetAccountInfo(ctx)
			if err == nil {
				topVideos, _ := ttClient.GetTopVideos(ctx, 20)
				brief["tiktok_organic"] = map[string]interface{}{
					"account_info": accountInfo,
					"top_videos":   topVideos,
					"status":       "real_data",
				}
			} else {
				brief["tiktok_organic"] = map[string]interface{}{
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

// Helper para obtener datos de Meta Ads. Itera todas las cuentas configuradas
// (cfg.MetaAdAccounts), agrega totales globales y deja un desglose por cuenta
// en accounts[]. Si cfg.MetaRefugioCampaignID está set y se encuentra la
// campaña, agrega el bloque "refugio" con vista dedicada (Leads/CPL/adsets/variantes).
func getMetaAdsData(cfg *config.Config, dateStart, dateStop string) (map[string]interface{}, error) {
	token, err := config.GetMetaToken()
	if err != nil {
		return nil, err
	}

	accounts := accountsFor(cfg)
	if len(accounts) == 0 {
		return nil, fmt.Errorf("no hay cuentas Meta configuradas")
	}

	// Agregados globales
	var totalSpend float64
	var totalImpressions, totalClicks, totalReach, totalLeads int64

	allCampaigns := make([]map[string]interface{}, 0)
	allRecent := make([]map[string]interface{}, 0)
	accountsBreakdown := make([]map[string]interface{}, 0, len(accounts))

	historicalStart := time.Now().AddDate(0, 0, -90).Format("2006-01-02")
	historicalStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

	// Mejor/peor campaña a nivel global
	var bestCampaign, worstCampaign *meta.AdInsights
	bestCampaignAcc := ""
	worstCampaignAcc := ""
	bestCTR := 0.0
	worstCTR := 100.0

	var firstErr error
	accountsOK := 0 // cuentas que respondieron bien (aunque sea con 0 campañas)

	for _, acc := range accounts {
		client := meta.NewClient(token, acc.ID)
		insights, err := client.GetAccountInsights(dateStart, dateStop)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			insights = nil
		} else {
			accountsOK++
		}

		var accSpend float64
		var accImp, accClicks, accReach, accLeads int64

		for i := range insights {
			ins := &insights[i]
			accSpend += ins.Spend
			accImp += ins.Impressions
			accClicks += ins.Clicks
			accReach += ins.Reach
			accLeads += ins.Leads()

			allCampaigns = append(allCampaigns, map[string]interface{}{
				"id":            ins.CampaignID,
				"name":          ins.CampaignName,
				"spend":         ins.Spend,
				"impressions":   ins.Impressions,
				"clicks":        ins.Clicks,
				"reach":         ins.Reach,
				"leads":         ins.Leads(),
				"ctr":           ins.CalculateCTR(),
				"cpc":           ins.CalculateCPC(),
				"cpm":           ins.CalculateCPM(),
				"cpl":           ins.CPL(),
				"period":        "week",
				"account_id":    acc.ID,
				"account_label": acc.Label,
			})

			ctr := ins.CalculateCTR()
			if ctr > bestCTR {
				bestCTR = ctr
				bestCampaign = ins
				bestCampaignAcc = acc.Label
			}
			if ctr < worstCTR && ins.Impressions > 1000 {
				worstCTR = ctr
				worstCampaign = ins
				worstCampaignAcc = acc.Label
			}
		}

		// Histórico 90d por cuenta
		var recent []map[string]interface{}
		if historicalInsights, hErr := client.GetAccountInsights(historicalStart, historicalStop); hErr == nil {
			for i := range historicalInsights {
				h := &historicalInsights[i]
				row := map[string]interface{}{
					"id":            h.CampaignID,
					"name":          h.CampaignName,
					"spend":         h.Spend,
					"impressions":   h.Impressions,
					"clicks":        h.Clicks,
					"reach":         h.Reach,
					"leads":         h.Leads(),
					"ctr":           h.CalculateCTR(),
					"cpc":           h.CalculateCPC(),
					"cpm":           h.CalculateCPM(),
					"cpl":           h.CPL(),
					"account_id":    acc.ID,
					"account_label": acc.Label,
				}
				recent = append(recent, row)
				allRecent = append(allRecent, row)
			}
		}

		accountsBreakdown = append(accountsBreakdown, map[string]interface{}{
			"id":              acc.ID,
			"label":           acc.Label,
			"campaigns_count": len(insights),
			"summary": map[string]interface{}{
				"spend":       accSpend,
				"impressions": accImp,
				"clicks":      accClicks,
				"reach":       accReach,
				"leads":       accLeads,
				"ctr":         pctSafe(accClicks, accImp),
				"cpc":         divSafe(accSpend, float64(accClicks)),
				"cpm":         divSafe(accSpend*1000, float64(accImp)),
			},
			"recent_campaigns_count": len(recent),
		})

		totalSpend += accSpend
		totalImpressions += accImp
		totalClicks += accClicks
		totalReach += accReach
		totalLeads += accLeads
	}

	// Top 10 globales de los últimos 90 días por gasto
	sort.Slice(allRecent, func(i, j int) bool {
		si, _ := allRecent[i]["spend"].(float64)
		sj, _ := allRecent[j]["spend"].(float64)
		return si > sj
	})
	if len(allRecent) > 10 {
		allRecent = allRecent[:10]
	}

	// Tope defensivo del payload: al monitorear cuentas con MUCHAS campañas
	// históricas (p.ej. la operativa con 200+ boosts viejos), la lista semanal
	// puede inflar la request al LLM y hacerla fallar. El análisis solo mira el
	// top por inversión, así que ordenamos por gasto y dejamos las 60 mayores.
	campaignsTotal := len(allCampaigns)
	sort.Slice(allCampaigns, func(i, j int) bool {
		si, _ := allCampaigns[i]["spend"].(float64)
		sj, _ := allCampaigns[j]["spend"].(float64)
		return si > sj
	})
	if len(allCampaigns) > 60 {
		allCampaigns = allCampaigns[:60]
	}

	avgCTR := pctSafe(totalClicks, totalImpressions)
	avgCPC := divSafe(totalSpend, float64(totalClicks))
	avgCPM := divSafe(totalSpend*1000, float64(totalImpressions))

	recommendations := []string{}
	if avgCTR < 1.0 {
		recommendations = append(recommendations, "CTR bajo (<1%) - Considera mejorar el copy y creativos")
	} else if avgCTR > 3.0 {
		recommendations = append(recommendations, "CTR excelente (>3%) - Mantén esta estrategia")
	}
	if avgCPC > 1000 { // CLP: $1.000 ya es alto para campañas de engagement
		recommendations = append(recommendations, "CPC alto (>$1.000 CLP) - Revisa targeting y optimiza audiencias")
	}

	result := map[string]interface{}{
		"summary": map[string]interface{}{
			"spend":       totalSpend,
			"impressions": totalImpressions,
			"clicks":      totalClicks,
			"reach":       totalReach,
			"leads":       totalLeads,
			"ctr":         avgCTR,
			"cpc":         avgCPC,
			"cpm":         avgCPM,
		},
		"campaigns_count":   campaignsTotal,
		"campaigns":         allCampaigns,
		"recent_campaigns":  allRecent,
		"recent_range_days": 90,
		"recommendations":   recommendations,
		"accounts":          accountsBreakdown,
		"period": map[string]string{
			"start": dateStart,
			"end":   dateStop,
		},
	}

	if bestCampaign != nil {
		result["best_campaign"] = map[string]interface{}{
			"name":          bestCampaign.CampaignName,
			"ctr":           bestCTR,
			"account_label": bestCampaignAcc,
		}
	}
	if worstCampaign != nil {
		result["worst_campaign"] = map[string]interface{}{
			"name":          worstCampaign.CampaignName,
			"ctr":           worstCTR,
			"account_label": worstCampaignAcc,
		}
	}

	// Bloque Refugio (vista dedicada). Si la campaña existe en alguna cuenta,
	// la enriquecemos con adsets + variantes. Si no, dejamos refugio fuera.
	if cfg.MetaRefugioCampaignID != "" {
		if refugio := buildRefugioBlock(cfg, token, accounts); refugio != nil {
			result["refugio"] = refugio
		}
	}

	// Bloque GiftCard Día del Padre (vista dedicada, métricas de compra).
	// Estacional: buildGiftCardBlock devuelve nil una vez pasada la fecha (Jorge:
	// "aparece solo si está activa").
	if cfg.MetaGiftCardCampaignID != "" {
		if giftcard := buildGiftCardBlock(cfg, token, accounts); giftcard != nil {
			result["giftcard"] = giftcard
		}
	}

	// Bloques de MENSAJES (objetivo conversaciones/WhatsApp): Ritual del Río y
	// Pausa junto al río. Se descubren por NOMBRE (no requieren config de ID) y se
	// muestran desde el día 1 aunque tengan poco gasto, para verlas arrancar.
	if ritual := buildMessagingBlock(token, accounts, "ritual del río"); ritual != nil {
		result["ritual"] = ritual
	}
	if pausa := buildMessagingBlock(token, accounts, "pausa junto al río"); pausa != nil {
		result["pausa"] = pausa
	}

	// Evolución SEMANAL de los programas (H-053): últimas 8 semanas, gasto+conversaciones
	// de la campaña junto a las ventas REALES del programa, para ver el efecto de la
	// campaña sobre las ventas semana a semana. Ritual = cabaña+tina+masaje
	// (cabanas_tinas_masajes), Pausa = tina+masaje solo (tinas_masajes); buckets
	// mutuamente excluyentes (sin doble conteo). Degradación suave: si bookings está
	// apagado o el endpoint no responde, cada semana muestra 0 sin romper el reporte.
	attachProgramWeekly(cfg, token, result)

	// Solo fallar si NINGUNA cuenta respondió (todas dieron error). Si al menos
	// una respondió bien, seguimos: una cuenta con problema de permiso (403) o una
	// semana sin campañas activas NO debe tumbar todo el reporte. Las cuentas que
	// fallaron simplemente no aportan datos (y su bloque dedicado queda fuera).
	if accountsOK == 0 && firstErr != nil {
		return nil, firstErr
	}

	return result, nil
}

// getGoogleAdsData arma el bloque google_ads para el brief/overview. Trae
// summary de cuenta + bloque dedicado refugio (si hay GOOGLE_ADS_REFUGIO_CAMPAIGN_ID).
// Espejo de getMetaAdsData. Falla suave si Google Ads API responde mal —
// devolvemos solo lo que pudimos rescatar.
func getGoogleAdsData(cfg *config.Config, dateStart, dateStop string) (map[string]interface{}, error) {
	client, err := googleads.NewClient(googleads.Config{
		DeveloperToken:  cfg.GoogleAdsDeveloperToken,
		ClientID:        cfg.GoogleAdsClientID,
		ClientSecret:    cfg.GoogleAdsClientSecret,
		RefreshToken:    cfg.GoogleAdsRefreshToken,
		CustomerID:      cfg.GoogleAdsCustomerID,
		LoginCustomerID: cfg.GoogleAdsLoginCustomerID,
	})
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	campaigns, err := client.GetCampaignSummary(ctx, dateStart, dateStop)
	if err != nil {
		return nil, err
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

	result := map[string]interface{}{
		"summary": map[string]interface{}{
			"spend":             totalSpend,
			"impressions":       totalImp,
			"clicks":            totalClicks,
			"conversions":       totalConv,
			"conversions_value": totalConvValue,
			"ctr":               pctSafe(totalClicks, totalImp),
			"avg_cpc":           divSafe(totalSpend, float64(totalClicks)),
			"cpl":               divSafe(totalSpend, totalConv),
		},
		"campaigns":       campaigns,
		"campaigns_count": len(campaigns),
		"period":          map[string]string{"start": dateStart, "end": dateStop},
	}

	// Bloque Refugio dedicado (vista comparable a meta_ads.refugio)
	if cfg.GoogleAdsRefugioCampaignID != "" {
		refugioStart := "2026-05-29"
		refugioStop := time.Now().Format("2006-01-02")
		summary, _ := client.GetCampaignInsights(ctx, cfg.GoogleAdsRefugioCampaignID, refugioStart, refugioStop)
		searchTerms, _ := client.GetSearchTerms(ctx, cfg.GoogleAdsRefugioCampaignID, refugioStart, refugioStop, 20)
		qsKeywords, _ := client.GetKeywordQualityScores(ctx, cfg.GoogleAdsRefugioCampaignID)

		result["refugio"] = map[string]interface{}{
			"campaign_id":    cfg.GoogleAdsRefugioCampaignID,
			"campaign_name":  campaignNameGA(summary),
			"period":         map[string]string{"start": refugioStart, "end": refugioStop},
			"summary":        googleAdsRefugioSummary(summary, cfg.GoogleAdsBudgetCLP),
			"search_terms":   searchTerms,
			"quality_scores": qsKeywords,
			"thresholds":     googleAdsRefugioThresholds(),
		}
	}

	// Tablas semanales por programa (H-053): gasto/clics semanal de Google + ventas reales
	// del programa (todos los canales). Best-effort; nunca rompe el bloque si Google falla.
	weeks := computeWeekWindows(8)
	sales := fetchWeeklyProgramSales(cfg, weeks)
	attachProgramWeeklyGoogle(ctx, client, result, weeks, sales)

	return result, nil
}

// buildRefugioBlock arma el bloque de la campaña Refugio buscándola en las
// cuentas configuradas. Devuelve nil si no se encuentra en ninguna.
//
// El rango usado es desde el lanzamiento (28-may-2026) hasta hoy, no la semana
// del brief — porque la campaña dura 10 días y queremos verla completa cada vez.
func buildRefugioBlock(cfg *config.Config, token string, accounts []config.MetaAccount) map[string]interface{} {
	dateStart := "2026-05-28"
	dateStop := time.Now().Format("2006-01-02")

	if len(accounts) == 0 {
		return nil
	}
	accountID, accountLabel := resolveCampaignAccount(token, cfg.MetaRefugioCampaignID, accounts)
	client := meta.NewClient(token, accountID)
	campaignInsight, _ := client.GetCampaignInsights(cfg.MetaRefugioCampaignID, dateStart, dateStop)
	adsets, _ := client.GetCampaignInsightsByAdset(cfg.MetaRefugioCampaignID, dateStart, dateStop)
	ads, _ := client.GetCampaignInsightsByAd(cfg.MetaRefugioCampaignID, dateStart, dateStop)
	platforms, _ := client.GetCampaignInsightsByPlatform(cfg.MetaRefugioCampaignID, dateStart, dateStop)
	positions, _ := client.GetCampaignInsightsByPlatformPosition(cfg.MetaRefugioCampaignID, dateStart, dateStop)

	summary := map[string]interface{}{
		"spend":            0.0,
		"impressions":      int64(0),
		"clicks":           int64(0),
		"reach":            int64(0),
		"frequency":        0.0,
		"ctr":              0.0,
		"cpc":              0.0,
		"leads":            int64(0),
		"cpl":              0.0,
		"budget_total_clp": cfg.MetaRefugioBudgetCLP,
		"budget_pct_used":  0.0,
	}
	if campaignInsight != nil {
		summary["spend"] = campaignInsight.Spend
		summary["impressions"] = campaignInsight.Impressions
		summary["clicks"] = campaignInsight.Clicks
		summary["reach"] = campaignInsight.Reach
		summary["frequency"] = campaignInsight.Frequency
		summary["ctr"] = campaignInsight.CalculateCTR()
		summary["cpc"] = campaignInsight.CalculateCPC()
		summary["leads"] = campaignInsight.Leads()
		summary["cpl"] = campaignInsight.CPL()
		if cfg.MetaRefugioBudgetCLP > 0 {
			summary["budget_pct_used"] = (campaignInsight.Spend / cfg.MetaRefugioBudgetCLP) * 100
		}
	}

	// Leads reales del formulario (BD) en lugar del Pixel contaminado.
	applyRealRefugioLeads(cfg, summary, dateStart, dateStop)

	// Intención WhatsApp (Etapa 4a): clics al botón wa.me de la landing (GA4).
	// Este es el path (getMetaAdsData → buildRefugioBlock) que alimenta el bloque
	// "Embudo Refugio" del dashboard; sin esto el frontend muestra "Clics WhatsApp = —".
	applyRefugioWhatsAppClicks(cfg, summary, dateStart, dateStop)

	// Ventas y ROAS reales (Etapa 4b, H-002): cruce teléfono de lead → reservas.
	applyRefugioSalesAndROAS(cfg, summary, dateStart, dateStop)

	adsetRows := adsetInsightRows(adsets)

	// Ventana RECIENTE (últimos 3 días): separa el efecto de las optimizaciones
	// aplicadas el 10-jun (variante C pausada, Audience Network/Threads excluidos,
	// retargeting ampliado a 180d) del acumulado histórico, que arrastra la
	// saturación y el gasto previos. La IA decide con esta ventana; el acumulado
	// queda como contexto.
	recentStart := time.Now().AddDate(0, 0, -2).Format("2006-01-02")
	recentInsight, _ := client.GetCampaignInsights(cfg.MetaRefugioCampaignID, recentStart, dateStop)
	recentAdsets, _ := client.GetCampaignInsightsByAdset(cfg.MetaRefugioCampaignID, recentStart, dateStop)
	recentAds, _ := client.GetCampaignInsightsByAd(cfg.MetaRefugioCampaignID, recentStart, dateStop)

	summaryReciente := map[string]interface{}{}
	if recentInsight != nil {
		summaryReciente = map[string]interface{}{
			"spend":       recentInsight.Spend,
			"impressions": recentInsight.Impressions,
			"clicks":      recentInsight.Clicks,
			"reach":       recentInsight.Reach,
			"frequency":   recentInsight.Frequency,
			"ctr":         recentInsight.CalculateCTR(),
			"cpc":         recentInsight.CalculateCPC(),
			"leads":       recentInsight.Leads(),
			"cpl":         recentInsight.CPL(),
		}
	}

	return map[string]interface{}{
		"campaign_id":   cfg.MetaRefugioCampaignID,
		"campaign_name": campaignName(campaignInsight),
		"account_id":    accountID,
		"account_label": accountLabel,
		"period":        map[string]string{"start": dateStart, "end": dateStop},
		"summary":       summary,
		"adsets":        adsetRows,
		"variants":      aggregateVariants(ads),
		"platforms":     platformRows(platforms),
		"positions":     positionRows(positions),
		"thresholds":    refugioThresholds(),
		// Ventana post-optimizaciones (ver comentario arriba)
		"period_reciente":    map[string]string{"start": recentStart, "end": dateStop},
		"summary_reciente":   summaryReciente,
		"adsets_recientes":   adsetInsightRows(recentAdsets),
		"variants_recientes": aggregateVariants(recentAds),
	}
}

// adsetInsightRows convierte insights de adset al formato del payload del brief.
func adsetInsightRows(adsets []meta.AdInsights) []map[string]interface{} {
	rows := make([]map[string]interface{}, 0, len(adsets))
	for i := range adsets {
		a := &adsets[i]
		rows = append(rows, map[string]interface{}{
			"adset_id":    a.AdsetID,
			"adset_name":  a.AdsetName,
			"spend":       a.Spend,
			"impressions": a.Impressions,
			"clicks":      a.Clicks,
			"reach":       a.Reach,
			"frequency":   a.Frequency,
			"ctr":         a.CalculateCTR(),
			"cpc":         a.CalculateCPC(),
			"leads":       a.Leads(),
			"cpl":         a.CPL(),
		})
	}
	return rows
}

// buildGiftCardBlock arma el bloque de la campaña GiftCard Día del Padre.
// Espejo liviano de buildRefugioBlock: la métrica primaria son las COMPRAS del
// píxel (evento Purchase) y su valor en CLP (ROAS), no leads. El rango va desde
// el lanzamiento (11-jun-2026) hasta hoy porque la campaña dura ~11 días y
// queremos verla completa cada vez. Devuelve nil si no hay cuentas.
func buildGiftCardBlock(cfg *config.Config, token string, accounts []config.MetaAccount) map[string]interface{} {
	dateStart := "2026-06-11"
	dateStop := time.Now().Format("2006-01-02")

	if len(accounts) == 0 {
		return nil
	}
	// Estacional: el Día del Padre fue el 21-jun; con unos días de cola de
	// atribución, la campaña deja de ser relevante. Jorge la quiere "solo si está
	// activa" → pasada la cola, la sacamos del reporte (no se muestra ni en tablas
	// ni en el análisis de la IA).
	if endDate, err := time.Parse("2006-01-02", "2026-06-21"); err == nil &&
		time.Now().After(endDate.AddDate(0, 0, 3)) {
		return nil
	}
	accountID, accountLabel := resolveCampaignAccount(token, cfg.MetaGiftCardCampaignID, accounts)
	client := meta.NewClient(token, accountID)
	campaignInsight, _ := client.GetCampaignInsights(cfg.MetaGiftCardCampaignID, dateStart, dateStop)
	platforms, _ := client.GetCampaignInsightsByPlatform(cfg.MetaGiftCardCampaignID, dateStart, dateStop)

	summary := map[string]interface{}{
		"spend":             0.0,
		"impressions":       int64(0),
		"clicks":            int64(0),
		"reach":             int64(0),
		"frequency":         0.0,
		"ctr":               0.0,
		"cpc":               0.0,
		"purchases":         int64(0),
		"cost_per_purchase": 0.0,
		"purchase_value":    0.0,
		"roas":              0.0,
		"budget_total_clp":  cfg.MetaGiftCardBudgetCLP,
		"budget_pct_used":   0.0,
	}
	if campaignInsight != nil {
		summary["spend"] = campaignInsight.Spend
		summary["impressions"] = campaignInsight.Impressions
		summary["clicks"] = campaignInsight.Clicks
		summary["reach"] = campaignInsight.Reach
		summary["frequency"] = campaignInsight.Frequency
		summary["ctr"] = campaignInsight.CalculateCTR()
		summary["cpc"] = campaignInsight.CalculateCPC()
		summary["purchases"] = campaignInsight.Purchases()
		summary["cost_per_purchase"] = campaignInsight.CostPerPurchase()
		summary["purchase_value"] = campaignInsight.PurchaseValue()
		if campaignInsight.Spend > 0 {
			summary["roas"] = campaignInsight.PurchaseValue() / campaignInsight.Spend
		}
		if cfg.MetaGiftCardBudgetCLP > 0 {
			summary["budget_pct_used"] = (campaignInsight.Spend / cfg.MetaGiftCardBudgetCLP) * 100
		}
	}

	return map[string]interface{}{
		"campaign_id":   cfg.MetaGiftCardCampaignID,
		"campaign_name": campaignName(campaignInsight),
		"account_id":    accountID,
		"account_label": accountLabel,
		"period":        map[string]string{"start": dateStart, "end": dateStop},
		"end_date":      "2026-06-21", // Día del Padre; la campaña se apaga sola el 22-jun 00:00 PDT
		"summary":       summary,
		"platforms":     platformRows(platforms),
	}
}

// findCampaignByName busca una campaña cuyo nombre CONTENGA `needle` (sin importar
// mayúsculas) recorriendo las cuentas configuradas. Prefiere una ACTIVE; si no hay,
// toma la primera que no esté eliminada/archivada. Devuelve ids vacíos si no
// encuentra nada. Permite descubrir Ritual/Pausa sin hardcodear el ID de campaña.
func findCampaignByName(token string, accounts []config.MetaAccount, needle string) (campaignID, accountID, accountLabel, campaignName string) {
	n := strings.ToLower(needle)
	for _, acc := range accounts {
		client := meta.NewClient(token, acc.ID)
		campaigns, err := client.GetCampaigns()
		if err != nil {
			continue
		}
		var fallback *meta.Campaign
		for i := range campaigns {
			c := &campaigns[i]
			if !strings.Contains(strings.ToLower(c.Name), n) {
				continue
			}
			switch strings.ToUpper(c.Status) {
			case "DELETED", "ARCHIVED":
				continue
			case "ACTIVE":
				return c.ID, acc.ID, acc.Label, c.Name
			}
			if fallback == nil {
				fallback = c
			}
		}
		if fallback != nil {
			return fallback.ID, acc.ID, acc.Label, fallback.Name
		}
	}
	return "", "", "", ""
}

// buildMessagingBlock arma el bloque de una campaña de MENSAJES (objetivo
// conversaciones/WhatsApp) ubicándola por NOMBRE. Métrica primaria = conversaciones
// iniciadas + costo por conversación. Lo usan Ritual del Río y Pausa junto al río
// (lanzadas 27-jun-2026). Ventana de 30 días para captar el arranque. Devuelve nil
// si la campaña no se encuentra en ninguna cuenta.
func buildMessagingBlock(token string, accounts []config.MetaAccount, needle string) map[string]interface{} {
	if len(accounts) == 0 {
		return nil
	}
	campaignID, accountID, accountLabel, name := findCampaignByName(token, accounts, needle)
	if campaignID == "" {
		return nil
	}
	dateStart := time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	dateStop := time.Now().Format("2006-01-02")
	client := meta.NewClient(token, accountID)
	ci, _ := client.GetCampaignInsights(campaignID, dateStart, dateStop)
	platforms, _ := client.GetCampaignInsightsByPlatform(campaignID, dateStart, dateStop)

	summary := map[string]interface{}{
		"spend":                 0.0,
		"impressions":           int64(0),
		"clicks":                int64(0),
		"reach":                 int64(0),
		"frequency":             0.0,
		"ctr":                   0.0,
		"cpc":                   0.0,
		"conversations":         int64(0),
		"cost_per_conversation": 0.0,
	}
	if ci != nil {
		summary["spend"] = ci.Spend
		summary["impressions"] = ci.Impressions
		summary["clicks"] = ci.Clicks
		summary["reach"] = ci.Reach
		summary["frequency"] = ci.Frequency
		summary["ctr"] = ci.CalculateCTR()
		summary["cpc"] = ci.CalculateCPC()
		summary["conversations"] = ci.Conversations()
		summary["cost_per_conversation"] = ci.CostPerConversation()
	}

	return map[string]interface{}{
		"campaign_id":   campaignID,
		"campaign_name": name,
		"account_id":    accountID,
		"account_label": accountLabel,
		"objective":     "mensajes (conversaciones/WhatsApp)",
		"period":        map[string]string{"start": dateStart, "end": dateStop},
		"summary":       summary,
		"platforms":     platformRows(platforms),
	}
}

// weekWindow es una ventana semanal [Start, Stop] (YYYY-MM-DD, 7 días inclusive) con
// una etiqueta corta dd-mm para el reporte.
type weekWindow struct {
	Start, Stop, Label string
}

// computeWeekWindows devuelve las últimas n semanas (7 días c/u), de la más antigua a
// la más reciente; la última termina AYER. Son contiguas desde `base`, para que calcen
// con los buckets de Meta time_increment=7 (que arrancan en la fecha `since`).
func computeWeekWindows(n int) []weekWindow {
	now := time.Now()
	base := now.AddDate(0, 0, -7*n) // inicio de la 1ª semana (n semanas atrás)
	out := make([]weekWindow, 0, n)
	for i := 0; i < n; i++ {
		s := base.AddDate(0, 0, 7*i)
		e := s.AddDate(0, 0, 6)
		out = append(out, weekWindow{
			Start: s.Format("2006-01-02"),
			Stop:  e.Format("2006-01-02"),
			Label: s.Format("02-01"),
		})
	}
	return out
}

// attachProgramWeekly enriquece los bloques ritual/pausa con una serie SEMANAL (últimas
// 8 semanas) que combina gasto+conversaciones de la campaña con las ventas reales del
// programa, semana a semana (H-053), para ver el efecto de la campaña sobre las ventas.
// Buckets mutuamente excluyentes (Ritual=cabanas_tinas_masajes, Pausa=tinas_masajes).
// Best-effort en cada fuente: si Meta o Django no responden, esa celda queda en 0.
// fetchWeeklyProgramSales trae las ventas reales por semana (una llamada concurrente por
// ventana a family-combinations-range). Cada respuesta trae TODOS los buckets → sirve para
// los 3 programas a la vez. Best-effort: semana sin respuesta queda nil (el render pinta 0).
// Compartido por los reportes de Meta y de Google (las ventas son de TODOS los canales).
func fetchWeeklyProgramSales(cfg *config.Config, weeks []weekWindow) []map[string]bookings.CombinationStats {
	sales := make([]map[string]bookings.CombinationStats, len(weeks))
	if !cfg.EnableBookings || cfg.BookingSystemURL == "" {
		return sales
	}
	bc := bookings.NewClient(cfg.BookingSystemURL)
	var wg sync.WaitGroup
	for i, w := range weeks {
		wg.Add(1)
		go func(i int, start, stop string) {
			defer wg.Done()
			if r, err := bc.GetFamilyCombinationsRange(start, stop); err == nil && r != nil {
				sales[i] = r.Combinations
			}
		}(i, w.Start, w.Stop)
	}
	wg.Wait()
	return sales
}

func attachProgramWeekly(cfg *config.Config, token string, result map[string]interface{}) {
	_, hasRitual := result["ritual"]
	_, hasPausa := result["pausa"]
	_, hasRefugio := result["refugio"]
	if !hasRitual && !hasPausa && !hasRefugio {
		return
	}
	weeks := computeWeekWindows(8)
	sales := fetchWeeklyProgramSales(cfg, weeks)

	// 3 programas SIN intersección (H-053b): Ritual = cabaña+tina+masaje 1 noche,
	// Refugio = 2 noches, Pausa = tina+masaje. Cada reserva cae en uno solo. Ritual/Pausa
	// miden conversaciones (WhatsApp); Refugio es campaña de leads (formulario).
	attachOneProgramWeekly(token, result, "ritual", "cabanas_tinas_masajes_1n", "conversations", weeks, sales)
	attachOneProgramWeekly(token, result, "refugio", "cabanas_tinas_masajes_2n", "leads", weeks, sales)
	attachOneProgramWeekly(token, result, "pausa", "tinas_masajes", "conversations", weeks, sales)
}

// attachOneProgramWeekly arma la serie semanal de UN programa: mapea el gasto semanal de
// Meta (time_increment=7, por date_start) con las ventas del combo correspondiente y la
// cuelga en block["weekly"] como []map (para que el render la lea con num()/str()). La
// métrica de actividad es "conversations" (Ritual/Pausa, campañas de mensajes) o "leads"
// (Refugio, campaña de formulario); se guarda en row["activity"] + block["activity_label"].
func attachOneProgramWeekly(token string, result map[string]interface{}, key, combo, metric string, weeks []weekWindow, sales []map[string]bookings.CombinationStats) {
	block, ok := result[key].(map[string]interface{})
	if !ok {
		return
	}
	campaignID, _ := block["campaign_id"].(string)
	accountID, _ := block["account_id"].(string)

	activityLabel := "Conversac."
	if metric == "leads" {
		activityLabel = "Leads"
	}
	block["activity_label"] = activityLabel

	// Gasto/actividad por semana desde Meta (una sola llamada con time_increment=7).
	metaByStart := map[string]meta.AdInsights{}
	if campaignID != "" && accountID != "" && len(weeks) > 0 {
		client := meta.NewClient(token, accountID)
		if rows, err := client.GetCampaignInsightsWeekly(campaignID, weeks[0].Start, weeks[len(weeks)-1].Stop); err == nil {
			for _, r := range rows {
				metaByStart[r.DateStart] = r
			}
		} else {
			fmt.Printf("[REPORTE] insights semanales %s no disponibles (H-053, se omiten): %v\n", key, err)
		}
	}

	weekly := make([]map[string]interface{}, 0, len(weeks))
	for i, w := range weeks {
		row := map[string]interface{}{
			"label":    w.Label,
			"spend":    0.0,
			"activity": int64(0),
			"reservas": 0,
			"ingresos": 0.0,
		}
		if mi, ok := metaByStart[w.Start]; ok {
			row["spend"] = mi.Spend
			if metric == "leads" {
				row["activity"] = mi.Leads()
			} else {
				row["activity"] = mi.Conversations()
			}
		}
		if i < len(sales) && sales[i] != nil {
			cs := sales[i][combo]
			row["reservas"] = cs.CountReservas
			row["ingresos"] = cs.Revenue
		}
		weekly = append(weekly, row)
	}
	block["weekly"] = weekly
}

// weekIndexForDate devuelve el índice de la ventana semanal que contiene date (YYYY-MM-DD),
// o -1 si no cae en ninguna. Comparación lexicográfica (válida para YYYY-MM-DD).
func weekIndexForDate(weeks []weekWindow, date string) int {
	for i, w := range weeks {
		if date >= w.Start && date <= w.Stop {
			return i
		}
	}
	return -1
}

// attachProgramWeeklyGoogle arma las series semanales de Ritual/Refugio/Pausa para el
// reporte de GOOGLE: gasto+clics semanal de la campaña de Google (descubierta por nombre,
// gasto diario agregado a las mismas ventanas) + ventas reales del programa (todos los
// canales). Best-effort: si Google no responde, las celdas de gasto quedan en 0 (las
// ventas igual se muestran). Refugio se enriquece SOBRE su bloque existente; Ritual/Pausa
// crean bloque nuevo. Métrica de actividad = Clics (las conversiones de Google no están
// bien trackeadas todavía).
func attachProgramWeeklyGoogle(ctx context.Context, client *googleads.Client, result map[string]interface{}, weeks []weekWindow, sales []map[string]bookings.CombinationStats) {
	if len(weeks) == 0 {
		return
	}
	spanStart, spanStop := weeks[0].Start, weeks[len(weeks)-1].Stop
	camps, _ := client.GetCampaignSummary(ctx, spanStart, spanStop)

	// Busca la campaña por nombre; prefiere la que tuvo gasto en el período (evita elegir
	// una zombie pausada homónima), y si ninguna gastó, cae a la primera coincidencia.
	findCamp := func(needle string) *googleads.CampaignInsights {
		var first *googleads.CampaignInsights
		for i := range camps {
			if strings.Contains(strings.ToLower(camps[i].CampaignName), needle) {
				if camps[i].CostCLP > 0 {
					return &camps[i]
				}
				if first == nil {
					first = &camps[i]
				}
			}
		}
		return first
	}

	build := func(key, needle, combo string) {
		spend := make([]float64, len(weeks))
		clicks := make([]int64, len(weeks))
		name := ""
		if c := findCamp(needle); c != nil {
			name = c.CampaignName
			if daily, err := client.GetCampaignDaily(ctx, c.CampaignID, spanStart, spanStop); err == nil {
				for _, d := range daily {
					if idx := weekIndexForDate(weeks, d.Date); idx >= 0 {
						spend[idx] += d.CostCLP
						clicks[idx] += d.Clicks
					}
				}
			}
		}
		weekly := make([]map[string]interface{}, len(weeks))
		for i, w := range weeks {
			row := map[string]interface{}{
				"label":    w.Label,
				"spend":    spend[i],
				"activity": clicks[i],
				"reservas": 0,
				"ingresos": 0.0,
			}
			if i < len(sales) && sales[i] != nil {
				cs := sales[i][combo]
				row["reservas"] = cs.CountReservas
				row["ingresos"] = cs.Revenue
			}
			weekly[i] = row
		}
		block, ok := result[key].(map[string]interface{})
		if !ok {
			block = map[string]interface{}{}
			result[key] = block
		}
		block["weekly"] = weekly
		block["activity_label"] = "Clics"
		if name != "" {
			if _, exists := block["campaign_name"]; !exists {
				block["campaign_name"] = name
			}
		}
	}

	build("ritual", "ritual", "cabanas_tinas_masajes_1n")
	build("refugio", "refugio", "cabanas_tinas_masajes_2n")
	build("pausa", "pausa", "tinas_masajes")
}

// newAIClientWithOperatingContext returns an OpenRouter client preloaded with
// Aremko's current operating context. Best-effort: if the fetch from Django
// fails, the analysis still runs (just without the context-aware prompt).
func newAIClientWithOperatingContext(cfg *config.Config) *ai.OpenRouterClient {
	client := ai.NewOpenRouterClient(cfg.OpenRouterAPIKey, cfg.OpenRouterBaseURL, cfg.OpenRouterModel, cfg.OpenRouterMaxTokens)
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
					topPagesWeekly, _ := ga4Client.GetTopPagesWeekly(ctx, 50)
					trafficSourcesWeekly, _ := ga4Client.GetTrafficSourcesWeekly(ctx)

					briefData["web_analytics"] = map[string]interface{}{
						"active_users":           ga4Stats.ActiveUsers,
						"total_users":            ga4Stats.TotalUsers,
						"sessions":               ga4Stats.Sessions,
						"page_views":             ga4Stats.PageViews,
						"bounce_rate":            ga4Stats.BounceRate,
						"avg_session_duration":   ga4Stats.AvgSessionDuration,
						"new_users":              ga4Stats.NewUsers,
						"event_count":            ga4Stats.EventCount,
						"top_pages":              topPages,
						"traffic_sources":        trafficSources,
						"weekly_trends":          weeklyTrends,
						"top_pages_weekly":       topPagesWeekly,
						"traffic_sources_weekly": trafficSourcesWeekly,
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
					topPagesWeekly, _ := ga4Client.GetTopPagesWeekly(ctx, 50)
					trafficSourcesWeekly, _ := ga4Client.GetTrafficSourcesWeekly(ctx)
					// Conversiones: eventos key marcados en GA4 + atribución por source/medium
					convByEvent, _ := ga4Client.GetConversionsByEvent(ctx, dateStart, dateStop)
					convBySource, _ := ga4Client.GetConversionsBySource(ctx, dateStart, dateStop)

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
						"conversions_by_event":   convByEvent,
						"conversions_by_source":  convBySource,
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

		// Facebook orgánico (puede venir vacío/error; el análisis lo tolera)
		var facebookData map[string]interface{}
		fbClient := social.NewFacebookClient(cfg.MetaAccessToken)
		if fbInsights, fbErr := fbClient.GetPageInsights(ctx, 10); fbErr == nil {
			facebookData = map[string]interface{}{
				"page_info": map[string]interface{}{
					"name":            fbInsights.Name,
					"fan_count":       fbInsights.FanCount,
					"followers_count": fbInsights.FollowersCount,
				},
				"top_posts": fbInsights.TopPosts,
			}
		}

		// Payload combinado: orgánico = Instagram + Facebook
		organicData := map[string]interface{}{
			"instagram": instagramData,
			"facebook":  facebookData,
		}

		// Generar análisis con IA
		aiClient := newAIClientWithOperatingContext(cfg)

		fmt.Println("[AI] Generando análisis Orgánico (Instagram + Facebook)...")
		analysis, err := aiClient.GenerateOrganicAnalysis(ctx, organicData)
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

// AnalyzeSocial genera UN informe unificado de TODO el bloque Social: orgánico
// (Instagram + Facebook) + pagado (Meta Ads + Google Ads Refugio), con lectura
// cruzada orgánico-vs-pagado. Reemplaza el doble análisis (orgánico y Meta por
// separado) cuando el usuario pide "todo el bloque" desde el botón de arriba.
func AnalyzeSocial(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI analysis is not enabled",
			})
			return
		}
		if !cfg.EnableMetaAds || cfg.MetaAccessToken == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Social integration is not enabled",
			})
			return
		}

		ctx := context.Background()

		// --- ORGÁNICO: Instagram + Facebook ---
		var instagramData map[string]interface{}
		igClient := social.NewInstagramClient(cfg.MetaAccessToken)
		if accountInfo, err := igClient.GetAccountInfo(ctx); err == nil {
			accountID := accountInfo["account_id"].(string)
			weeklyInsights, _ := igClient.GetWeeklyInsights(ctx, accountID)
			topPosts, _ := igClient.GetTopPosts(ctx, accountID, 10)
			instagramData = map[string]interface{}{
				"account_info":    accountInfo,
				"weekly_insights": weeklyInsights,
				"top_posts":       topPosts,
			}
		}

		var facebookData map[string]interface{}
		fbClient := social.NewFacebookClient(cfg.MetaAccessToken)
		if fbInsights, fbErr := fbClient.GetPageInsights(ctx, 10); fbErr == nil {
			facebookData = map[string]interface{}{
				"page_info": map[string]interface{}{
					"name":            fbInsights.Name,
					"fan_count":       fbInsights.FanCount,
					"followers_count": fbInsights.FollowersCount,
				},
				"top_posts": fbInsights.TopPosts,
			}
		}

		// --- PAGADO: Meta Ads (+ Google Ads Refugio si está configurado) ---
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")

		paidData := map[string]interface{}{}
		if metaData, err := getMetaAdsData(cfg, dateStart, dateStop); err == nil {
			paidData["meta_ads"] = metaData
		}
		if cfg.EnableGoogleAds {
			if gaData, err := getGoogleAdsData(cfg, dateStart, dateStop); err == nil {
				paidData["google_ads"] = gaData
			}
		}

		socialData := map[string]interface{}{
			"organic": map[string]interface{}{
				"instagram": instagramData,
				"facebook":  facebookData,
			},
			"paid": paidData,
		}

		aiClient := newAIClientWithOperatingContext(cfg)
		fmt.Println("[AI] Generando análisis unificado de Social (Orgánico + Pagado)...")
		analysis, err := aiClient.GenerateSocialAnalysis(ctx, socialData)
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
		// Tendencias mensuales 24 meses por producto/SKU (espejo de familia).
		// El endpoint Django todavía puede no existir; en ese caso simplemente
		// no se agrega el dato y el frontend no muestra la sección.
		if monthlyProducts, perr := bookingClient.GetMonthlyByProduct(24); perr == nil {
			salesData["monthly_trends_products"] = monthlyProducts
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
					"total_clientes":     segs.TotalClientes,
					"n_sistema_actual":   segs.NSistemaActual,
					"n_pre_sistema":      segs.NPreSistema,
					"top_3_estilos":      topNBuckets(segs.EjeEstilo, 3),
					"top_3_contextos":    topNBuckets(segs.EjeContexto, 3),
					"valor_distribucion": segs.EjeValor,
					"nota":               "Para drill-down completo de cohortes, ver pestaña Perfiles del dashboard.",
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
				convByEvent, _ := ga4Client.GetConversionsByEvent(ctx, dateStart, dateStop)
				convBySource, _ := ga4Client.GetConversionsBySource(ctx, dateStart, dateStop)
				setSection("web_analytics", map[string]interface{}{
					"summary": map[string]interface{}{
						"active_users":         ga4Stats.ActiveUsers,
						"sessions":             ga4Stats.Sessions,
						"page_views":           ga4Stats.PageViews,
						"bounce_rate":          ga4Stats.BounceRate,
						"avg_session_duration": ga4Stats.AvgSessionDuration,
						"new_users":            ga4Stats.NewUsers,
					},
					"weekly_trends":         weeklyTrends,
					"top_pages":             topPages,
					"traffic_sources":       trafficSources,
					"conversions_by_event":  convByEvent,
					"conversions_by_source": convBySource,
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

		// Google Ads (paralelo a Meta, cuando está configurado)
		if cfg.EnableGoogleAds {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { recover() }()
				if gaData, err := getGoogleAdsData(cfg, dateStart, dateStop); err == nil {
					setSection("google_ads", gaData)
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
