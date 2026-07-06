package dataforseo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
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

// serpLiveResponse mapea /v3/serp/google/organic/live/advanced. El endpoint
// acepta un ARRAY de tasks en un solo POST y devuelve un array de resultados
// en el mismo orden — así 8 keywords cuestan 1 sola llamada HTTP.
type serpLiveResponse struct {
	Tasks []struct {
		StatusCode int `json:"status_code"`
		Result     []struct {
			Items []struct {
				Type         string `json:"type"`
				RankAbsolute int    `json:"rank_absolute"`
				Domain       string `json:"domain"`
				URL          string `json:"url"`
			} `json:"items"`
		} `json:"result"`
	} `json:"tasks"`
}

// GetRankChecks busca varias keywords en UN SOLO request a DataForSEO y
// devuelve, para cada una, la posición de targetDomain y qué dominios
// aparecen antes. Cachea 12h por combinación exacta (dominio+ubicación+idioma+keywords).
func (c *Client) GetRankChecks(ctx context.Context, keywords []string, targetDomain, locationName, languageCode string) ([]RankCheckResult, error) {
	if len(keywords) == 0 {
		return nil, fmt.Errorf("dataforseo: se requiere al menos 1 keyword")
	}
	cacheKey := "rank:" + targetDomain + ":" + locationName + ":" + languageCode + ":" + strings.Join(keywords, "|")
	if cached, ok := c.cache.get(cacheKey); ok {
		return cached.([]RankCheckResult), nil
	}

	tasks := make([]rankCheckTask, len(keywords))
	for i, kw := range keywords {
		tasks[i] = rankCheckTask{
			Keyword:      kw,
			LocationName: locationName,
			LanguageCode: languageCode,
			Device:       "desktop",
			Depth:        20,
		}
	}

	raw, err := c.post(ctx, "/v3/serp/google/organic/live/advanced", tasks)
	if err != nil {
		return nil, err
	}
	var parsed serpLiveResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("dataforseo: decode rank check failed: %w", err)
	}

	results := make([]RankCheckResult, 0, len(keywords))
	for i, task := range parsed.Tasks {
		kw := ""
		if i < len(keywords) {
			kw = keywords[i]
		}
		res := RankCheckResult{Keyword: kw, TargetDomain: targetDomain, CompetitorsAbove: []string{}}
		if task.StatusCode == 20000 && len(task.Result) > 0 {
			for _, item := range task.Result[0].Items {
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
		results = append(results, res)
	}

	c.cache.set(cacheKey, results, rankCheckCacheTTL)
	return results, nil
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

type competitorsRequest struct {
	Tasks []competitorsTask `json:"tasks"`
}

type competitorsTask struct {
	Target       string `json:"target"`
	LocationName string `json:"location_name"`
	LanguageName string `json:"language_name"`
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

	payload := competitorsRequest{Tasks: []competitorsTask{{Target: target, LocationName: locationName, LanguageName: languageName}}}
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
