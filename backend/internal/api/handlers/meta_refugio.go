package handlers

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/analytics"
	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
)

// GetRefugioCampaign retorna la vista dedicada de la campaña Refugio:
// resumen ejecutivo, comparativo por adset y A/B por variante de copy.
//
// Requiere META_REFUGIO_CAMPAIGN_ID configurado. La campaña debe estar en
// alguna de las cuentas listadas en MetaAdAccounts; el handler encuentra
// la cuenta correcta automáticamente.
func GetRefugioCampaign(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableMetaAds {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads integration is disabled")
			return
		}
		if cfg.MetaRefugioCampaignID == "" {
			respondError(w, http.StatusNotFound, "META_REFUGIO_CAMPAIGN_ID no configurado")
			return
		}

		token, err := config.GetMetaToken()
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to get Meta token: "+err.Error())
			return
		}

		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")
		// Por defecto: desde el inicio de la campaña hasta hoy (incluido)
		if dateStart == "" {
			dateStart = "2026-05-28"
		}
		if dateStop == "" {
			dateStop = time.Now().Format("2006-01-02")
		}

		accounts := cfg.MetaAdAccounts
		if len(accounts) == 0 && cfg.MetaAdAccountID != "" {
			accounts = []config.MetaAccount{{ID: cfg.MetaAdAccountID, Label: "Principal"}}
		}

		// Identificar dueño real de la campaña (Meta no valida que el campaign
		// pertenezca a la cuenta usada en el query — devuelve OK con cualquiera).
		accountID, accountLabel := resolveCampaignAccount(token, cfg.MetaRefugioCampaignID, accounts)

		client := meta.NewClient(token, accountID)
		insight, _ := client.GetCampaignInsights(cfg.MetaRefugioCampaignID, dateStart, dateStop)
		campaignInsight := insight

		adsets, _ := client.GetCampaignInsightsByAdset(cfg.MetaRefugioCampaignID, dateStart, dateStop)
		ads, _ := client.GetCampaignInsightsByAd(cfg.MetaRefugioCampaignID, dateStart, dateStop)
		platforms, _ := client.GetCampaignInsightsByPlatform(cfg.MetaRefugioCampaignID, dateStart, dateStop)
		positions, _ := client.GetCampaignInsightsByPlatformPosition(cfg.MetaRefugioCampaignID, dateStart, dateStop)

		// Resumen ejecutivo
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
			leads := campaignInsight.Leads()
			summary["spend"] = campaignInsight.Spend
			summary["impressions"] = campaignInsight.Impressions
			summary["clicks"] = campaignInsight.Clicks
			summary["reach"] = campaignInsight.Reach
			summary["frequency"] = campaignInsight.Frequency
			summary["ctr"] = campaignInsight.CalculateCTR()
			summary["cpc"] = campaignInsight.CalculateCPC()
			summary["leads"] = leads
			summary["cpl"] = campaignInsight.CPL()
			if cfg.MetaRefugioBudgetCLP > 0 {
				summary["budget_pct_used"] = (campaignInsight.Spend / cfg.MetaRefugioBudgetCLP) * 100
			}
		}

		// Reemplaza el conteo Pixel (contaminado con reservas) por leads reales del
		// formulario desde la BD. El Pixel queda como leads_pixel para referencia.
		applyRealRefugioLeads(cfg, summary, dateStart, dateStop)

		// Añade la "intención WhatsApp" (clic al botón wa.me de la landing) — la
		// segunda vía de conversión que el informe ignoraba. Etapa 4a del embudo.
		applyRefugioWhatsAppClicks(cfg, summary, dateStart, dateStop)

		// Comparativo por adset
		adsetRows := make([]map[string]interface{}, 0, len(adsets))
		for i := range adsets {
			a := &adsets[i]
			adsetRows = append(adsetRows, map[string]interface{}{
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

		// A/B por variante: agregamos los ads que comparten prefijo variante_X
		variants := aggregateVariants(ads)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"campaign_id":   cfg.MetaRefugioCampaignID,
				"campaign_name": campaignName(campaignInsight),
				"account_id":    accountID,
				"account_label": accountLabel,
				"period":        map[string]string{"start": dateStart, "end": dateStop},
				"summary":       summary,
				"adsets":        adsetRows,
				"variants":      variants,
				"platforms":     platformRows(platforms),
				"positions":     positionRows(positions),
				"thresholds":    refugioThresholds(),
			},
		})
	}
}

// applyRealRefugioLeads reemplaza el conteo de leads del summary por los leads
// REALES del formulario Refugio (BD ventas_refugiolead vía Django), atribuidos
// por UTM. El conteo Pixel (fb_pixel_lead) estaba contaminado con reservas de
// checkout; la BD es la fuente de verdad.
//
//   - "leads"      → leads reales de Meta (facebook + instagram por UTM)
//   - "cpl"        → recalculado = spend / leads reales de Meta
//   - "leads_pixel"→ conteo Pixel original (referencia; usado en desgloses por ad)
//   - "leads_reales_total" / "leads_by_canal" / "leads_source" → contexto
//
// Falla suave: sin LUNA_API_KEY o si el endpoint falla, conserva el conteo Pixel.
func applyRealRefugioLeads(cfg *config.Config, summary map[string]interface{}, dateStart, dateStop string) {
	pixel, _ := summary["leads"].(int64)
	summary["leads_pixel"] = pixel
	summary["leads_source"] = "pixel"

	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
		return
	}
	real, err := bookings.NewClient(cfg.BookingSystemURL).GetRefugioLeadsSummary(dateStart, dateStop, cfg.LunaAPIKey)
	if err != nil || real == nil {
		return
	}
	leadsMeta := int64(real.ByCanal["facebook"] + real.ByCanal["instagram"])
	summary["leads"] = leadsMeta
	summary["leads_reales_total"] = real.Total
	summary["leads_by_canal"] = real.ByCanal
	summary["leads_source"] = "bd_formulario"
	spend, _ := summary["spend"].(float64)
	if leadsMeta > 0 {
		summary["cpl"] = spend / float64(leadsMeta)
	} else {
		summary["cpl"] = 0.0
	}
}

// applyRefugioWhatsAppClicks añade al summary la "intención WhatsApp": el conteo
// del evento GA4 refugio_whatsapp_click (clic al botón wa.me de la landing) total +
// por canal + el atribuible a Meta, más el costo por clic y la tasa clic→lead.
// Es la pieza que faltaba (Etapa 4a): la landing /refugio/ convierte por DOS vías
// —form→BD y WhatsApp→chat— y el informe solo veía la primera. No es key event en
// GA4, así que se cuenta por eventCount (no conversions).
func applyRefugioWhatsAppClicks(cfg *config.Config, summary map[string]interface{}, dateStart, dateStop string) {
	if !cfg.EnableGA4 {
		return
	}
	ga4Client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
	if err != nil {
		return
	}
	res, err := ga4Client.GetEventCountBySource(context.Background(), "refugio_whatsapp_click", dateStart, dateStop)
	if err != nil || res == nil {
		return
	}

	summary["whatsapp_clicks"] = res.Total
	summary["whatsapp_clicks_by_source"] = res.BySource

	// Porción atribuible a Meta (facebook/instagram, pagado u orgánico).
	var metaClicks int64
	for _, s := range res.BySource {
		src := strings.ToLower(s.Source)
		if strings.Contains(src, "facebook") || strings.Contains(src, "instagram") || src == "fb" || src == "ig" {
			metaClicks += s.EventCount
		}
	}
	summary["whatsapp_clicks_meta"] = metaClicks

	spend, _ := summary["spend"].(float64)
	if res.Total > 0 {
		summary["cost_per_whatsapp_click"] = spend / float64(res.Total)
	} else {
		summary["cost_per_whatsapp_click"] = 0.0
	}

	// Tasa clic WhatsApp → lead del formulario (leads_reales_total lo dejó
	// applyRealRefugioLeads). Mide cuántos de los que mostraron intención dejaron datos.
	leadsTotal, _ := summary["leads_reales_total"].(int)
	if res.Total > 0 && leadsTotal > 0 {
		summary["whatsapp_to_lead_rate"] = float64(leadsTotal) / float64(res.Total) * 100
	}
}

// applyRefugioSalesAndROAS cierra la Etapa 4b (H-002): cruza el teléfono de cada
// lead de Refugio (formulario + WhatsApp entrante, vía /api/refugio-leads/) contra
// las reservas reales del booking system, y agrega al summary las reservas, los
// ingresos atribuidos y el ROAS, más el CPL de intención (form + WhatsApp).
// Falla suave: si algo no responde, deja el summary como estaba (sin reservas).
func applyRefugioSalesAndROAS(cfg *config.Config, summary map[string]interface{}, dateStart, dateStop string) {
	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
		return
	}
	client := bookings.NewClient(cfg.BookingSystemURL)
	leads, err := client.GetRefugioLeads(dateStart, dateStop, cfg.LunaAPIKey)
	if err != nil || leads == nil {
		return
	}

	// Teléfonos únicos de quienes mostraron intención real (form + WhatsApp).
	telefonos := make(map[string]bool)
	for _, l := range leads.LeadsFormulario {
		if l.TelefonoE164 != "" {
			telefonos[l.TelefonoE164] = true
		}
	}
	for _, l := range leads.WhatsappLeads {
		if l.TelefonoE164 != "" {
			telefonos[l.TelefonoE164] = true
		}
	}

	// Cruce contra reservas: por cada teléfono, sus reservas desde el inicio de
	// campaña (incluye reservas futuras como la del 20-jun). Volumen bajo → serie.
	var reservasRevenue float64
	var clientesConReserva int
	for tel := range telefonos {
		det, err := client.GetVentasDetalle(dateStart, "", "", "", "", tel)
		if err != nil || det == nil {
			continue
		}
		if det.TotalRevenue > 0 {
			reservasRevenue += det.TotalRevenue
			clientesConReserva++
		}
	}

	summary["reservas_count"] = clientesConReserva
	summary["reservas_revenue"] = reservasRevenue
	summary["whatsapp_inbound"] = leads.Totales.WhatsappInboundTotal

	spend, _ := summary["spend"].(float64)
	if spend > 0 {
		summary["roas"] = reservasRevenue / spend
	} else {
		summary["roas"] = 0.0
	}

	// CPL de intención = gasto ÷ (formulario + WhatsApp entrante). El CPL de
	// formulario ya lo dejó applyRealRefugioLeads en summary["cpl"].
	intencion := leads.Totales.FormularioTotal + leads.Totales.WhatsappInboundTotal
	if intencion > 0 {
		summary["cpl_intencion"] = spend / float64(intencion)
	} else {
		summary["cpl_intencion"] = 0.0
	}
}

// resolveCampaignAccount pregunta a Meta a qué cuenta pertenece realmente la
// campaña y matchea contra las cuentas configuradas para devolver el label
// humano. Si no se puede resolver, cae a la primera cuenta como fallback.
func resolveCampaignAccount(token, campaignID string, accounts []config.MetaAccount) (string, string) {
	if len(accounts) == 0 {
		return "", ""
	}
	// Usamos cualquier cuenta del usuario para llamar; el endpoint que devuelve
	// el dueño solo necesita el token, no respeta el query account.
	probe := meta.NewClient(token, accounts[0].ID)
	realID, err := probe.GetCampaignAccountID(campaignID)
	if err != nil || realID == "" {
		return accounts[0].ID, accounts[0].Label
	}
	for _, acc := range accounts {
		if acc.ID == realID {
			return acc.ID, acc.Label
		}
	}
	// La campaña existe pero no está en la lista monitoreada: devolvemos el ID
	// real y un label genérico para que el operador la vea y la agregue al env.
	return realID, "Cuenta no listada"
}

func campaignName(i *meta.AdInsights) string {
	if i == nil {
		return "Refugio Aremko - Lanzamiento Junio 2026"
	}
	return i.CampaignName
}

// aggregateVariants agrupa los ads por la variante de copy (A/B/C) detectada
// en el ad.name. Las convenciones esperadas son substrings:
//   - "variante_a" → Variante A (Emocional)
//   - "variante_b" → Variante B (Racional)
//   - "variante_c" → Variante C (Curiosidad)
func aggregateVariants(ads []meta.AdInsights) []map[string]interface{} {
	type agg struct {
		impressions int64
		clicks      int64
		spend       float64
		reach       int64
		leads       int64
		adCount     int
	}
	buckets := map[string]*agg{
		"A": {},
		"B": {},
		"C": {},
	}
	labels := map[string]string{
		"A": "Emocional",
		"B": "Racional",
		"C": "Curiosidad",
	}

	for i := range ads {
		a := &ads[i]
		name := strings.ToLower(a.AdName)
		var key string
		switch {
		case strings.Contains(name, "variante a") || strings.Contains(name, "variante_a"):
			key = "A"
		case strings.Contains(name, "variante b") || strings.Contains(name, "variante_b"):
			key = "B"
		case strings.Contains(name, "variante c") || strings.Contains(name, "variante_c"):
			key = "C"
		default:
			continue // ignorar ads que no matchean la convención
		}
		b := buckets[key]
		b.impressions += a.Impressions
		b.clicks += a.Clicks
		b.spend += a.Spend
		b.reach += a.Reach
		b.leads += a.Leads()
		b.adCount++
	}

	keys := []string{"A", "B", "C"}
	out := make([]map[string]interface{}, 0, len(keys))
	for _, k := range keys {
		b := buckets[k]
		ctr := 0.0
		if b.impressions > 0 {
			ctr = (float64(b.clicks) / float64(b.impressions)) * 100
		}
		cpc := 0.0
		if b.clicks > 0 {
			cpc = b.spend / float64(b.clicks)
		}
		cpl := 0.0
		if b.leads > 0 {
			cpl = b.spend / float64(b.leads)
		}
		out = append(out, map[string]interface{}{
			"key":         k,
			"label":       labels[k],
			"ad_count":    b.adCount,
			"impressions": b.impressions,
			"clicks":      b.clicks,
			"spend":       b.spend,
			"reach":       b.reach,
			"ctr":         ctr,
			"cpc":         cpc,
			"leads":       b.leads,
			"cpl":         cpl,
		})
	}

	// Ordenar variantes por leads desc (la ganadora arriba) salvo cuando todo es 0
	sort.SliceStable(out, func(i, j int) bool {
		li, _ := out[i]["leads"].(int64)
		lj, _ := out[j]["leads"].(int64)
		return li > lj
	})

	return out
}

// platformRows mapea insights con breakdown=publisher_platform a una lista de
// filas con totales por plataforma. Cada row incluye Leads/CPL ya calculados.
func platformRows(insights []meta.AdInsights) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(insights))
	for i := range insights {
		ins := &insights[i]
		out = append(out, map[string]interface{}{
			"platform":    ins.PublisherPlatform,
			"impressions": ins.Impressions,
			"clicks":      ins.Clicks,
			"spend":       ins.Spend,
			"reach":       ins.Reach,
			"frequency":   ins.Frequency,
			"ctr":         ins.CalculateCTR(),
			"cpc":         ins.CalculateCPC(),
			"leads":       ins.Leads(),
			"cpl":         ins.CPL(),
		})
	}
	return out
}

// positionRows mapea insights con breakdown=publisher_platform,platform_position
// (FB Feed, IG Feed, IG Stories, IG Reels, etc.).
func positionRows(insights []meta.AdInsights) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(insights))
	for i := range insights {
		ins := &insights[i]
		out = append(out, map[string]interface{}{
			"platform":    ins.PublisherPlatform,
			"position":    ins.PlatformPosition,
			"impressions": ins.Impressions,
			"clicks":      ins.Clicks,
			"spend":       ins.Spend,
			"reach":       ins.Reach,
			"frequency":   ins.Frequency,
			"ctr":         ins.CalculateCTR(),
			"cpc":         ins.CalculateCPC(),
			"leads":       ins.Leads(),
			"cpl":         ins.CPL(),
		})
	}
	return out
}

// refugioThresholds expone los umbrales semáforo para que el frontend los use
// sin hardcodearlos. Vienen del brief operativo de Refugio.
func refugioThresholds() map[string]interface{} {
	return map[string]interface{}{
		"ctr":               map[string]float64{"green_min": 2.0, "yellow_min": 1.0},
		"cpl_clp":           map[string]float64{"green_max": 10000, "yellow_max": 15000},
		"frequency":         map[string]float64{"green_max": 2.0, "yellow_max": 3.0},
		"landing_view_rate": map[string]float64{"green_min": 80.0, "yellow_min": 60.0},
	}
}
