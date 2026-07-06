package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/dataforseo"
)

// seoDefaultKeywords espeja la "lista fija" documentada en docs/LOOP_SEO.md
// (repo Django) — no cambiar una sin cambiar la otra, la comparación
// ciclo-a-ciclo del loop de SEO pierde sentido si la lista varía.
var seoDefaultKeywords = []string{
	"spa puerto varas",
	"masajes puerto varas",
	"tinajas puerto varas",
	"termas puerto varas",
	"termas en puerto varas",
	"cabaña con tina caliente puerto varas",
	"escapada romántica puerto varas",
	"aremko",
}

const (
	seoDefaultTarget       = "aremko.cl"
	seoDefaultLocationName = "Chile"
	seoDefaultLanguageCode = "es"
	seoDefaultLanguageName = "Spanish"
)

// newDataForSEOClient construye el cliente desde la config. Centraliza la
// validación para que cada handler no tenga que repetirla.
func newDataForSEOClient(cfg *config.Config) (*dataforseo.Client, error) {
	return dataforseo.NewClient(dataforseo.Config{
		APILogin:    cfg.DataForSEOAPILogin,
		APIPassword: cfg.DataForSEOAPIPassword,
	})
}

// seoKeywordsFromQuery lee ?keywords=a,b,c (coma-separado); si no viene,
// usa la lista fija por defecto (la misma que sigue el loop de SEO).
func seoKeywordsFromQuery(r *http.Request) []string {
	raw := strings.TrimSpace(r.URL.Query().Get("keywords"))
	if raw == "" {
		return seoDefaultKeywords
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return seoDefaultKeywords
	}
	return out
}

func seoTargetFromQuery(r *http.Request) string {
	if t := strings.TrimSpace(r.URL.Query().Get("target")); t != "" {
		return t
	}
	return seoDefaultTarget
}

// GetSEORankings retorna, para cada keyword de la lista (fija o pasada por
// query), la posición real de aremko.cl en Google y qué dominios aparecen
// antes. Es la fuente que Search Console nunca da: visibilidad de competidores.
func GetSEORankings(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableDataForSEO {
			respondError(w, http.StatusServiceUnavailable, "DataForSEO integration is disabled")
			return
		}
		client, err := newDataForSEOClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "DataForSEO config error: "+err.Error())
			return
		}

		keywords := seoKeywordsFromQuery(r)
		target := seoTargetFromQuery(r)
		locationName := queryOrDefault(r, "location", seoDefaultLocationName)
		languageCode := queryOrDefault(r, "language", seoDefaultLanguageCode)

		ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
		defer cancel()

		results, err := client.GetRankChecks(ctx, keywords, target, locationName, languageCode)
		if err != nil {
			respondError(w, http.StatusBadGateway, "Failed to fetch SEO rankings: "+err.Error())
			return
		}

		foundCount := 0
		for _, res := range results {
			if res.Found {
				foundCount++
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"target":      target,
				"location":    locationName,
				"language":    languageCode,
				"rankings":    results,
				"found_count": foundCount,
				"total_count": len(results),
			},
		})
	}
}

// GetSEOBacklinks retorna el resumen de backlinks de un dominio (por defecto
// aremko.cl). Usar con moderación (mensual, según docs/LOOP_SEO.md) — el
// cliente ya cachea 24h para no reventar el saldo aunque se llame seguido.
func GetSEOBacklinks(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableDataForSEO {
			respondError(w, http.StatusServiceUnavailable, "DataForSEO integration is disabled")
			return
		}
		client, err := newDataForSEOClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "DataForSEO config error: "+err.Error())
			return
		}

		target := seoTargetFromQuery(r)
		ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
		defer cancel()

		summary, err := client.GetBacklinksSummary(ctx, target)
		if err != nil {
			respondError(w, http.StatusBadGateway, "Failed to fetch backlinks summary: "+err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    summary,
		})
	}
}

// GetSEOCompetitors retorna los dominios que compiten de verdad con target
// por solapamiento de keywords en Google (no una lista adivinada a mano).
func GetSEOCompetitors(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableDataForSEO {
			respondError(w, http.StatusServiceUnavailable, "DataForSEO integration is disabled")
			return
		}
		client, err := newDataForSEOClient(cfg)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "DataForSEO config error: "+err.Error())
			return
		}

		target := seoTargetFromQuery(r)
		locationName := queryOrDefault(r, "location", seoDefaultLocationName)
		languageName := queryOrDefault(r, "language_name", seoDefaultLanguageName)

		ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
		defer cancel()

		competitors, err := client.GetCompetitors(ctx, target, locationName, languageName)
		if err != nil {
			respondError(w, http.StatusBadGateway, "Failed to fetch SEO competitors: "+err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"target":      target,
				"competitors": competitors,
			},
		})
	}
}

func queryOrDefault(r *http.Request, key, defaultValue string) string {
	if v := strings.TrimSpace(r.URL.Query().Get(key)); v != "" {
		return v
	}
	return defaultValue
}
