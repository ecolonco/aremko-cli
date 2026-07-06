package dataforseo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

// ─── Rank check (SERP orgánico) ─────────────────────────────────────────────

// rankCheckCacheTTL: el ranking real de Google no cambia hora a hora — 12h
// alcanza para el loop semanal y para que el dashboard no gaste saldo en cada
// recarga de página.
const rankCheckCacheTTL = 12 * time.Hour

// RankCheckResult es el resultado de buscar 1 keyword en Google (Chile) y ver
// en qué posición aparece (si aparece) el dominio objetivo, más qué dominios
// aparecen ANTES — información que Search Console nunca muestra.
type RankCheckResult struct {
	Keyword          string   `json:"keyword"`
	TargetDomain     string   `json:"target_domain"`
	Found            bool     `json:"found"`
	Position         int      `json:"position,omitempty"` // rank_absolute; 0 si no aparece
	URL              string   `json:"url,omitempty"`
	CompetitorsAbove []string `json:"competitors_above"` // dominios antes del target (o top si no aparece), máx 10
}

type rankCheckTask struct {
	Keyword      string `json:"keyword"`
	LocationName string `json:"location_name"`
	LanguageCode string `json:"language_code"`
	Device       string `json:"device"`
	Depth        int    `json:"depth"`
}

// serpLiveResponse mapea /v3/serp/google/organic/live/advanced.
//
// IMPORTANTE (descubierto en producción 2026-07-06): este endpoint, a pesar
// de aceptar sintácticamente un array de tasks, RECHAZA más de 1 task por
// request — devuelve status_code 40000 "You can set only one task at a time"
// para la 2da en adelante. Por eso este cliente hace UNA llamada HTTP por
// keyword (en paralelo, ver GetRankChecks) en vez de un solo batch.
type serpLiveResponse struct {
	Tasks []struct {
		StatusCode    int    `json:"status_code"`
		StatusMessage string `json:"status_message"`
		Result        []struct {
			Items []struct {
				Type         string `json:"type"`
				RankAbsolute int    `json:"rank_absolute"`
				Domain       string `json:"domain"`
				URL          string `json:"url"`
			} `json:"items"`
		} `json:"result"`
	} `json:"tasks"`
}

// GetRankChecks busca varias keywords (una request HTTP por keyword, en
// paralelo — ver nota en serpLiveResponse) y devuelve, para cada una, la
// posición de targetDomain y qué dominios aparecen antes. Cachea 12h POR
// KEYWORD individual (no por la lista completa), así cambiar una keyword de
// la lista no invalida el cache de las demás.
func (c *Client) GetRankChecks(ctx context.Context, keywords []string, targetDomain, locationName, languageCode string) ([]RankCheckResult, error) {
	if len(keywords) == 0 {
		return nil, fmt.Errorf("dataforseo: se requiere al menos 1 keyword")
	}

	results := make([]RankCheckResult, len(keywords))
	errs := make([]error, len(keywords))
	var wg sync.WaitGroup
	for i, kw := range keywords {
		wg.Add(1)
		go func(idx int, keyword string) {
			defer wg.Done()
			res, err := c.getSingleRankCheck(ctx, keyword, targetDomain, locationName, languageCode)
			if err != nil {
				errs[idx] = err
				res = RankCheckResult{Keyword: keyword, TargetDomain: targetDomain, CompetitorsAbove: []string{}}
			}
			results[idx] = res
		}(i, kw)
	}
	wg.Wait()

	// Si TODAS fallaron es un problema real (credenciales, rate limit) — no
	// devolver una lista silenciosamente vacía, avisar con el primer error.
	failed := 0
	var firstErr error
	for _, e := range errs {
		if e != nil {
			failed++
			if firstErr == nil {
				firstErr = e
			}
		}
	}
	if failed == len(keywords) {
		return nil, fmt.Errorf("dataforseo: las %d keywords fallaron (ej: %w)", len(keywords), firstErr)
	}

	return results, nil
}

// getSingleRankCheck hace UNA llamada (1 keyword = 1 task, requisito de la
// API) y cachea el resultado 12h bajo una key propia de esa keyword.
func (c *Client) getSingleRankCheck(ctx context.Context, keyword, targetDomain, locationName, languageCode string) (RankCheckResult, error) {
	cacheKey := "rank:" + targetDomain + ":" + locationName + ":" + languageCode + ":" + keyword
	if cached, ok := c.cache.get(cacheKey); ok {
		return cached.(RankCheckResult), nil
	}

	task := rankCheckTask{
		Keyword:      keyword,
		LocationName: locationName,
		LanguageCode: languageCode,
		Device:       "desktop",
		Depth:        20,
	}
	raw, err := c.post(ctx, "/v3/serp/google/organic/live/advanced", []rankCheckTask{task})
	if err != nil {
		return RankCheckResult{}, err
	}
	var parsed serpLiveResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return RankCheckResult{}, fmt.Errorf("dataforseo: decode rank check failed para %q: %w", keyword, err)
	}
	if len(parsed.Tasks) == 0 {
		return RankCheckResult{}, fmt.Errorf("dataforseo: sin respuesta para keyword %q", keyword)
	}
	t := parsed.Tasks[0]
	if t.StatusCode != 20000 {
		return RankCheckResult{}, fmt.Errorf("dataforseo: status %d (%s) para keyword %q", t.StatusCode, t.StatusMessage, keyword)
	}

	res := RankCheckResult{Keyword: keyword, TargetDomain: targetDomain, CompetitorsAbove: []string{}}
	if len(t.Result) > 0 {
		for _, item := range t.Result[0].Items {
			if item.Type != "organic" {
				continue
			}
			if strings.Contains(strings.ToLower(item.Domain), strings.ToLower(targetDomain)) {
				res.Found = true
				res.Position = item.RankAbsolute
				res.URL = item.URL
				break
			}
			if len(res.CompetitorsAbove) < 10 {
				res.CompetitorsAbove = append(res.CompetitorsAbove, item.Domain)
			}
		}
	}
	c.cache.set(cacheKey, res, rankCheckCacheTTL)
	return res, nil
}

// ─── Backlinks summary ──────────────────────────────────────────────────────

const backlinksCacheTTL = 24 * time.Hour

// BacklinksSummary resume el perfil de enlaces de un dominio (no el detalle
// enlace por enlace — eso es otro endpoint, más caro, no expuesto todavía).
type BacklinksSummary struct {
	Target               string `json:"target"`
	Rank                 int    `json:"rank"` // score propio de DataForSEO (0-1000)
	Backlinks            int64  `json:"backlinks"`
	ReferringDomains     int64  `json:"referring_domains"`
	ReferringMainDomains int64  `json:"referring_main_domains"`
	BrokenBacklinks      int64  `json:"broken_backlinks"`
}

type backlinksSummaryResponse struct {
	Tasks []struct {
		StatusCode int `json:"status_code"`
		Result     []struct {
			Target               string `json:"target"`
			Rank                 int    `json:"rank"`
			Backlinks            int64  `json:"backlinks"`
			ReferringDomains     int64  `json:"referring_domains"`
			ReferringMainDomains int64  `json:"referring_main_domains"`
			BrokenBacklinks      int64  `json:"broken_backlinks"`
		} `json:"result"`
	} `json:"tasks"`
}

// GetBacklinksSummary trae el resumen de backlinks de un dominio (sin
// "https://" ni "www."). Cachea 24h — este dato cambia lento, no hace falta
// pedirlo más de una vez al día aunque el dashboard se recargue seguido.
func (c *Client) GetBacklinksSummary(ctx context.Context, target string) (*BacklinksSummary, error) {
	cacheKey := "backlinks:" + target
	if cached, ok := c.cache.get(cacheKey); ok {
		return cached.(*BacklinksSummary), nil
	}

	payload := []map[string]string{{"target": target}}
	raw, err := c.post(ctx, "/v3/backlinks/summary/live", payload)
	if err != nil {
		return nil, err
	}
	var parsed backlinksSummaryResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("dataforseo: decode backlinks summary failed: %w", err)
	}
	if len(parsed.Tasks) == 0 || parsed.Tasks[0].StatusCode != 20000 || len(parsed.Tasks[0].Result) == 0 {
		return nil, fmt.Errorf("dataforseo: sin resultado de backlinks para %s", target)
	}
	r := parsed.Tasks[0].Result[0]
	summary := &BacklinksSummary{
		Target:               r.Target,
		Rank:                 r.Rank,
		Backlinks:            r.Backlinks,
		ReferringDomains:     r.ReferringDomains,
		ReferringMainDomains: r.ReferringMainDomains,
		BrokenBacklinks:      r.BrokenBacklinks,
	}
	c.cache.set(cacheKey, summary, backlinksCacheTTL)
	return summary, nil
}

// ─── Competidores por solapamiento de keywords ──────────────────────────────

const competitorsCacheTTL = 24 * time.Hour

// CompetitorDomain es un dominio que compite por las mismas keywords que el
// target, ordenado por relevancia (DataForSEO ya lo devuelve ordenado).
type CompetitorDomain struct {
	Domain        string  `json:"domain"`
	AvgPosition   float64 `json:"avg_position"`
	Intersections int64   `json:"intersections"` // keywords en común con el target
	OrganicETV    float64 `json:"organic_etv"`   // tráfico orgánico estimado (solo keywords en común)
	OrganicCount  int64   `json:"organic_count"` // cantidad de SERPs donde aparece (keywords en común)
}

// competitorsTask: OJO — a pesar de que la respuesta viene envuelta en
// {"tasks": [...]}, el REQUEST de este endpoint va como ARRAY PLANO (igual
// que SERP y Backlinks), NO envuelto en {"tasks": [...]}. Enviarlo envuelto
// da 40503 "POST Data Is Invalid" — confirmado en producción 2026-07-06.
type competitorsTask struct {
	Target       string `json:"target"`
	LocationName string `json:"location_name"`
	LanguageName string `json:"language_name"`
	Limit        int    `json:"limit"`
}

type competitorsResponse struct {
	Tasks []struct {
		StatusCode int `json:"status_code"`
		Result     []struct {
			Items []struct {
				Domain        string  `json:"domain"`
				AvgPosition   float64 `json:"avg_position"`
				Intersections int64   `json:"intersections"`
				Metrics       struct {
					Organic struct {
						Etv   float64 `json:"etv"`
						Count int64   `json:"count"`
					} `json:"organic"`
				} `json:"metrics"`
			} `json:"items"`
		} `json:"result"`
	} `json:"tasks"`
}

// GetCompetitors devuelve los dominios que compiten de verdad con target
// (solapamiento de keywords en Google, no una lista adivinada a mano).
func (c *Client) GetCompetitors(ctx context.Context, target, locationName, languageName string) ([]CompetitorDomain, error) {
	cacheKey := "competitors:" + target + ":" + locationName + ":" + languageName
	if cached, ok := c.cache.get(cacheKey); ok {
		return cached.([]CompetitorDomain), nil
	}

	// Array plano de 1 elemento — NO envolver en {"tasks": [...]}, ver nota arriba.
	payload := []competitorsTask{{Target: target, LocationName: locationName, LanguageName: languageName, Limit: 20}}
	raw, err := c.post(ctx, "/v3/dataforseo_labs/google/competitors_domain/live", payload)
	if err != nil {
		return nil, err
	}
	var parsed competitorsResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("dataforseo: decode competitors failed: %w", err)
	}
	if len(parsed.Tasks) == 0 || parsed.Tasks[0].StatusCode != 20000 || len(parsed.Tasks[0].Result) == 0 {
		return nil, fmt.Errorf("dataforseo: sin resultado de competidores para %s", target)
	}

	items := parsed.Tasks[0].Result[0].Items
	out := make([]CompetitorDomain, 0, len(items))
	for _, it := range items {
		// El propio target siempre aparece (100% solapamiento consigo mismo) —
		// no es un "competidor", filtrarlo.
		if strings.EqualFold(it.Domain, target) {
			continue
		}
		out = append(out, CompetitorDomain{
			Domain:        it.Domain,
			AvgPosition:   it.AvgPosition,
			Intersections: it.Intersections,
			OrganicETV:    it.Metrics.Organic.Etv,
			OrganicCount:  it.Metrics.Organic.Count,
		})
	}
	c.cache.set(cacheKey, out, competitorsCacheTTL)
	return out, nil
}
