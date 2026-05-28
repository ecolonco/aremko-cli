package handlers

import (
	"net/http"
	"sort"
	"strings"
	"time"

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

		// Resumen ejecutivo
		summary := map[string]interface{}{
			"spend":             0.0,
			"impressions":       int64(0),
			"clicks":            int64(0),
			"reach":             int64(0),
			"frequency":         0.0,
			"ctr":               0.0,
			"cpc":               0.0,
			"leads":             int64(0),
			"cpl":               0.0,
			"budget_total_clp":  cfg.MetaRefugioBudgetCLP,
			"budget_pct_used":   0.0,
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
				"campaign_id":    cfg.MetaRefugioCampaignID,
				"campaign_name":  campaignName(campaignInsight),
				"account_id":     accountID,
				"account_label":  accountLabel,
				"period":         map[string]string{"start": dateStart, "end": dateStop},
				"summary":        summary,
				"adsets":         adsetRows,
				"variants":       variants,
				"thresholds":     refugioThresholds(),
			},
		})
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
