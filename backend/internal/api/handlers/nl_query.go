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
	// Force fuerza el tipo si el usuario lo selecciona manualmente desde el
	// toggle del frontend. Valores aceptados: "servicios" | "productos" | "".
	// Si está vacío, el LLM autodetecta.
	Force string `json:"force,omitempty"`
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
		// Fechas son opcionales solo si se filtra por cliente; de lo contrario obligatorias.
		if parsed.Cliente == "" && (parsed.FechaDesde == "" || parsed.FechaHasta == "") {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success":     false,
				"function":    "ventas_detalle",
				"parsed_args": parsed,
				"error":       "no se pudo determinar el rango de fechas; intenta indicar la fecha más explícitamente",
			})
			return
		}

		// El toggle del frontend puede forzar el tipo. Si está set y es válido,
		// sobrescribe la detección del LLM.
		tipo := strings.ToLower(strings.TrimSpace(parsed.Tipo))
		if req.Force == "servicios" || req.Force == "productos" {
			tipo = req.Force
		}
		if tipo != "servicios" && tipo != "productos" {
			tipo = "servicios" // default histórico
		}

		client := bookings.NewClient(cfg.BookingSystemURL)

		if tipo == "productos" {
			productosResult, err := client.GetVentasDetalleProductos(parsed.FechaDesde, parsed.FechaHasta, parsed.Producto, parsed.Categoria, parsed.Cliente)
			if err != nil {
				respondJSON(w, http.StatusBadGateway, map[string]interface{}{
					"success":     false,
					"function":    "ventas_detalle_productos",
					"parsed_args": parsed,
					"tipo":        tipo,
					"error":       fmt.Sprintf("error consultando Django (productos): %v", err),
				})
				return
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success":      true,
				"function":     "ventas_detalle_productos",
				"tipo":         tipo,
				"parsed_args":  parsed,
				"result":       productosResult,
				"parse_tokens": parseRes.InputTokens + parseRes.OutputTokens,
				"parse_ms":     parseRes.LatencyMs,
			})
			return
		}

		result, err := client.GetVentasDetalle(parsed.FechaDesde, parsed.FechaHasta, parsed.Familia, parsed.Servicio, parsed.Proveedor, parsed.Cliente)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success":     false,
				"function":    "ventas_detalle",
				"parsed_args": parsed,
				"tipo":        tipo,
				"error":       fmt.Sprintf("error consultando Django: %v", err),
			})
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":      true,
			"function":     "ventas_detalle",
			"tipo":         tipo,
			"parsed_args":  parsed,
			"result":       result,
			"parse_tokens": parseRes.InputTokens + parseRes.OutputTokens,
			"parse_ms":     parseRes.LatencyMs,
		})
	}
}
