package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/aremko/aremko-cli/internal/ai"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/taxonomy"
)

// ClientsSegments proxia el endpoint Django /clientes/taxonomia/segments/.
func ClientsSegments(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableBookings {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Bookings integration is not enabled",
			})
			return
		}
		client := taxonomy.NewClient(cfg.BookingSystemURL)
		result, err := client.GetSegments()
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    result,
		})
	}
}

// ClientsCohort proxia el endpoint Django /clientes/taxonomia/cohort/.
// Acepta query params: eje_valor, eje_estilo, eje_contexto, limit, order_by.
func ClientsCohort(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableBookings {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Bookings integration is not enabled",
			})
			return
		}
		q := r.URL.Query()
		opts := taxonomy.CohortOptions{
			EjeValor:    q.Get("eje_valor"),
			EjeEstilo:   q.Get("eje_estilo"),
			EjeContexto: q.Get("eje_contexto"),
			OrderBy:     q.Get("order_by"),
		}
		if opts.EjeValor == "" && opts.EjeEstilo == "" && opts.EjeContexto == "" {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "Al menos un filtro (eje_valor, eje_estilo o eje_contexto) es requerido",
			})
			return
		}
		if l := q.Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
				opts.Limit = parsed
			}
		}

		client := taxonomy.NewClient(cfg.BookingSystemURL)
		result, err := client.GetCohort(opts)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    result,
		})
	}
}

// AnalyzeProfiles genera un análisis IA profundo de la taxonomía de clientes.
func AnalyzeProfiles(cfg *config.Config) http.HandlerFunc {
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

		client := taxonomy.NewClient(cfg.BookingSystemURL)
		segments, err := client.GetSegments()
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("Error fetching segments: %v", err),
			})
			return
		}

		// Construir payload para el LLM: segmentos + top cohortes detalladas
		profilesData := map[string]interface{}{
			"segments": segments,
		}

		// Top 5 cohortes por count (excluyendo N/A pre-sistema) — drill-down detallado
		topCohorts := []map[string]interface{}{}
		for _, cell := range segments.MatrizEstiloXContexto {
			if cell.Estilo == "N/A (pre-sistema)" || cell.Contexto == "N/A (pre-sistema)" {
				continue
			}
			if cell.Count < 50 {
				continue
			}
			cohortResp, cerr := client.GetCohort(taxonomy.CohortOptions{
				EjeEstilo:   cell.Estilo,
				EjeContexto: cell.Contexto,
				Limit:       10,
				OrderBy:     "gasto_total_desc",
			})
			if cerr != nil {
				continue
			}
			topCohorts = append(topCohorts, map[string]interface{}{
				"estilo":      cell.Estilo,
				"contexto":    cell.Contexto,
				"count":       cell.Count,
				"stats":       cohortResp.Stats,
				"top_10_ids":  extractClienteIDs(cohortResp.Clientes),
			})
			if len(topCohorts) >= 5 {
				break
			}
		}
		profilesData["top_cohorts"] = topCohorts

		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()

		fmt.Println("[AI] Generando análisis de Perfiles de Clientes...")
		analysis, err := aiClient.GenerateProfilesAnalysis(ctx, profilesData)
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

func extractClienteIDs(clientes []taxonomy.CohortRow) []int {
	ids := make([]int, 0, len(clientes))
	for _, c := range clientes {
		ids = append(ids, c.ClienteID)
	}
	return ids
}

// Sanity check: forzar uso de ai paquete para que el import no se quede inerte
// si el compilador hace tree-shaking.
var _ = ai.NewOpenRouterClient
var _ = json.NewEncoder
