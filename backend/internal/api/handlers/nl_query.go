package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/ai"
	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
)

type nlQueryRequest struct {
	Query string `json:"query"`
}

// NLQuery parses a natural-language sales question and runs it against the
// Django /bookings/detalle/ endpoint. Currently supports a single function:
// ventas_detalle(fecha_desde, fecha_hasta, familia?, servicio?).
func NLQuery(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "AI is not enabled",
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

		var req nlQueryRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "invalid JSON body",
			})
			return
		}
		req.Query = strings.TrimSpace(req.Query)
		if req.Query == "" {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "query is required",
			})
			return
		}

		hoy := time.Now().Format("2006-01-02")

		aiClient := ai.NewOpenRouterClient(cfg.OpenRouterAPIKey, cfg.OpenRouterBaseURL)
		parseCtx, cancelParse := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancelParse()

		parsed, parseRes, err := aiClient.ParseVentasDetalleQuery(parseCtx, req.Query, hoy)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("error parseando consulta: %v", err),
			})
			return
		}
		if parsed.Error != "" {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success":      false,
				"function":     "ventas_detalle",
				"parsed_args":  parsed,
				"error":        parsed.Error,
				"parse_tokens": parseRes.InputTokens + parseRes.OutputTokens,
			})
			return
		}
		if parsed.FechaDesde == "" || parsed.FechaHasta == "" {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success":     false,
				"function":    "ventas_detalle",
				"parsed_args": parsed,
				"error":       "no se pudo determinar el rango de fechas; intenta indicar la fecha más explícitamente",
			})
			return
		}

		client := bookings.NewClient(cfg.BookingSystemURL)
		result, err := client.GetVentasDetalle(parsed.FechaDesde, parsed.FechaHasta, parsed.Familia, parsed.Servicio, parsed.Proveedor)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success":     false,
				"function":    "ventas_detalle",
				"parsed_args": parsed,
				"error":       fmt.Sprintf("error consultando Django: %v", err),
			})
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":      true,
			"function":     "ventas_detalle",
			"parsed_args":  parsed,
			"result":       result,
			"parse_tokens": parseRes.InputTokens + parseRes.OutputTokens,
			"parse_ms":     parseRes.LatencyMs,
		})
	}
}
