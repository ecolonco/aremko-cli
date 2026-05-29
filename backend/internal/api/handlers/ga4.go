package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/analytics"
	"github.com/aremko/aremko-cli/internal/config"
)

// GetGA4Stats devuelve estadísticas del sitio web desde Google Analytics 4
func GetGA4Stats(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGA4 {
			http.Error(w, `{"error":"GA4 no está habilitado"}`, http.StatusServiceUnavailable)
			return
		}

		// Obtener parámetros de fecha (opcional)
		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")

		// Si no se especifican fechas, usar últimos 30 días
		if dateStart == "" {
			dateStart = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if dateStop == "" {
			dateStop = time.Now().Format("2006-01-02")
		}

		// Crear cliente GA4
		client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
		if err != nil {
			http.Error(w, `{"error":"Error inicializando GA4 client"}`, http.StatusInternalServerError)
			return
		}

		ctx := context.Background()

		// Obtener estadísticas
		stats, err := client.GetStats(ctx, dateStart, dateStop)
		if err != nil {
			http.Error(w, `{"error":"Error obteniendo estadísticas de GA4"}`, http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"stats": stats,
				"period": map[string]string{
					"start": dateStart,
					"end":   dateStop,
				},
			},
			"error": nil,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// GetGA4TopPages devuelve las páginas más visitadas
func GetGA4TopPages(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGA4 {
			http.Error(w, `{"error":"GA4 no está habilitado"}`, http.StatusServiceUnavailable)
			return
		}

		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")

		if dateStart == "" {
			dateStart = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if dateStop == "" {
			dateStop = time.Now().Format("2006-01-02")
		}

		client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
		if err != nil {
			http.Error(w, `{"error":"Error inicializando GA4 client"}`, http.StatusInternalServerError)
			return
		}

		ctx := context.Background()

		pages, err := client.GetTopPages(ctx, dateStart, dateStop, 10)
		if err != nil {
			http.Error(w, `{"error":"Error obteniendo top páginas"}`, http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"pages": pages,
				"period": map[string]string{
					"start": dateStart,
					"end":   dateStop,
				},
			},
			"error": nil,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// GetGA4TrafficSources devuelve las fuentes de tráfico
func GetGA4TrafficSources(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGA4 {
			http.Error(w, `{"error":"GA4 no está habilitado"}`, http.StatusServiceUnavailable)
			return
		}

		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")

		if dateStart == "" {
			dateStart = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if dateStop == "" {
			dateStop = time.Now().Format("2006-01-02")
		}

		client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
		if err != nil {
			http.Error(w, `{"error":"Error inicializando GA4 client"}`, http.StatusInternalServerError)
			return
		}

		ctx := context.Background()

		sources, err := client.GetTrafficSources(ctx, dateStart, dateStop)
		if err != nil {
			http.Error(w, `{"error":"Error obteniendo fuentes de tráfico"}`, http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"sources": sources,
				"period": map[string]string{
					"start": dateStart,
					"end":   dateStop,
				},
			},
			"error": nil,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// GetGA4PageMetrics devuelve métricas de una página específica (?path=...) +
// evolución semanal + fuentes de tráfico filtradas a esa URL.
// Pensado para monitorear landings dedicadas como /refugio.
func GetGA4PageMetrics(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableGA4 {
			http.Error(w, `{"error":"GA4 no está habilitado"}`, http.StatusServiceUnavailable)
			return
		}

		pagePath := r.URL.Query().Get("path")
		if pagePath == "" {
			http.Error(w, `{"error":"falta parámetro path"}`, http.StatusBadRequest)
			return
		}

		dateStart := r.URL.Query().Get("date_start")
		dateStop := r.URL.Query().Get("date_stop")
		if dateStart == "" {
			dateStart = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
		}
		if dateStop == "" {
			dateStop = time.Now().Format("2006-01-02")
		}

		client, err := analytics.NewGA4Client(cfg.GA4CredentialsPath, cfg.GA4PropertyID)
		if err != nil {
			http.Error(w, `{"error":"Error inicializando GA4 client"}`, http.StatusInternalServerError)
			return
		}
		ctx := context.Background()

		// 3 fetches en paralelo: agregado + semanal + traffic sources
		// (mantenemos secuencial por simplicidad; GA4 tolera bien).
		summary, sumErr := client.GetPageMetrics(ctx, pagePath, dateStart, dateStop)
		weekly, weekErr := client.GetPageMetricsByWeek(ctx, pagePath, 4)
		sources, srcErr := client.GetTrafficSourcesForPage(ctx, pagePath, dateStart, dateStop)

		// Si falla agregado y no hay nada de data, error 500. Si los semanales
		// o sources fallan, seguimos devolviendo lo que haya.
		if sumErr != nil && weekErr != nil && srcErr != nil {
			http.Error(w, `{"error":"Error obteniendo métricas de la página"}`, http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"path":            pagePath,
				"summary":         summary,
				"weekly":          weekly,
				"traffic_sources": sources,
				"period": map[string]string{
					"start": dateStart,
					"end":   dateStop,
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
