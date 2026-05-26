package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	ovc "github.com/aremko/aremko-cli/internal/operacionvueltaacasa"
	"github.com/go-chi/chi/v5"
)

// newOVCClient construye el cliente con el baseURL + api key del config.
// Devuelve nil + un error que el handler puede responder al frontend.
func newOVCClient(cfg *config.Config) (*ovc.Client, error) {
	if !cfg.EnableBookings {
		return nil, fmt.Errorf("Bookings integration is not enabled")
	}
	if cfg.AutomationAPIKey == "" {
		return nil, fmt.Errorf("AUTOMATION_API_KEY no configurada en el servidor")
	}
	return ovc.NewClient(cfg.BookingSystemURL, cfg.AutomationAPIKey), nil
}

// extractContactoID lee {contactoID} del path o devuelve error 400.
func extractContactoID(r *http.Request) (int, error) {
	raw := chi.URLParam(r, "contactoID")
	if raw == "" {
		return 0, fmt.Errorf("missing contactoID in URL")
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid contactoID: %s", raw)
	}
	return id, nil
}

// decodeJSONBody intenta decodificar el body. Si está vacío, no error
// (los POST /marcar-omitido/ permiten body vacío).
func decodeJSONBody(r *http.Request, dst interface{}) error {
	if r.Body == nil || r.ContentLength == 0 {
		return nil
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

// ============================================================================
// 1. GET /siguiente/
// ============================================================================

func OVCSiguiente(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		result, err := client.Siguiente()
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 2. POST /{contactoID}/marcar-enviado/
// ============================================================================

func OVCMarcarEnviado(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		contactoID, err := extractContactoID(r)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		var body ovc.MarcarEnviadoRequest
		if err := decodeJSONBody(r, &body); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": fmt.Sprintf("body inválido: %v", err),
			})
			return
		}
		if strings.TrimSpace(body.Operador) == "" {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": "operador requerido",
			})
			return
		}

		result, conflict, err := client.MarcarEnviado(contactoID, body)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		if conflict != nil {
			respondJSON(w, http.StatusConflict, map[string]interface{}{
				"success": false, "conflict": conflict,
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 3. POST /{contactoID}/marcar-omitido/
// ============================================================================

func OVCMarcarOmitido(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		contactoID, err := extractContactoID(r)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		var body ovc.MarcarOmitidoRequest
		_ = decodeJSONBody(r, &body)
		if strings.TrimSpace(body.Operador) == "" {
			body.Operador = "anonimo"
		}
		if err := client.MarcarOmitido(contactoID, body); err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
		})
	}
}

// ============================================================================
// 4. POST /{contactoID}/marcar-no-aplica/
// ============================================================================

func OVCMarcarNoAplica(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		contactoID, err := extractContactoID(r)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		var body ovc.MarcarNoAplicaRequest
		_ = decodeJSONBody(r, &body)
		if strings.TrimSpace(body.Operador) == "" {
			body.Operador = "anonimo"
		}
		if err := client.MarcarNoAplica(contactoID, body); err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
		})
	}
}

// ============================================================================
// 5. POST /{contactoID}/registrar-respuesta/
// ============================================================================

var tiposRespuestaValidos = map[string]bool{
	"reservo":         true,
	"interesado":      true,
	"consulto_precio": true,
	"mas_adelante":    true,
	"rechazo":         true,
	"opt_out":         true,
	"sin_respuesta":   true,
}

func OVCRegistrarRespuesta(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		contactoID, err := extractContactoID(r)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		var body ovc.RegistrarRespuestaRequest
		if err := decodeJSONBody(r, &body); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": fmt.Sprintf("body inválido: %v", err),
			})
			return
		}
		if !tiposRespuestaValidos[body.TipoRespuesta] {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   fmt.Sprintf("tipo_respuesta inválido: %s", body.TipoRespuesta),
			})
			return
		}
		if strings.TrimSpace(body.Operador) == "" {
			body.Operador = "anonimo"
		}
		if err := client.RegistrarRespuesta(contactoID, body); err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
		})
	}
}

// ============================================================================
// 1.bis GET /del-dia/  (Etapa 5.6 — historial del día)
// ============================================================================

func OVCDelDia(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		opts := ovc.DelDiaOptions{
			Fecha:    r.URL.Query().Get("fecha"),
			Operador: r.URL.Query().Get("operador"),
		}
		if opts.Fecha != "" {
			if _, perr := time.Parse("2006-01-02", opts.Fecha); perr != nil {
				respondJSON(w, http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   "fecha debe tener formato YYYY-MM-DD",
				})
				return
			}
		}
		if l := r.URL.Query().Get("limit"); l != "" {
			parsed, perr := strconv.Atoi(l)
			if perr == nil && parsed > 0 && parsed <= 500 {
				opts.Limit = parsed
			}
		}
		result, err := client.GetDelDia(opts)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 5.bis POST /{contactoID}/bloquear-cliente/  (Etapa 5.5.2 — bloqueo permanente)
// ============================================================================

func OVCBloquearCliente(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		contactoID, err := extractContactoID(r)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		var body ovc.BloquearClienteRequest
		_ = decodeJSONBody(r, &body)
		// operador y razon son opcionales según el backend Django.
		if strings.TrimSpace(body.Operador) == "" {
			body.Operador = "anonimo"
		}
		result, err := client.BloquearCliente(contactoID, body)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// Geo.4 POST /clientes/{clienteID}/actualizar-ubicacion/
// ============================================================================

func OVCActualizarUbicacion(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		raw := chi.URLParam(r, "clienteID")
		clienteID, err := strconv.Atoi(raw)
		if err != nil || clienteID <= 0 {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": "clienteID inválido",
			})
			return
		}
		var body ovc.ActualizarUbicacionRequest
		if err := decodeJSONBody(r, &body); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": fmt.Sprintf("body inválido: %v", err),
			})
			return
		}
		if len(strings.TrimSpace(body.Ciudad)) < 2 {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "ciudad debe tener al menos 2 caracteres",
			})
			return
		}
		result, err := client.ActualizarUbicacion(clienteID, body)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 6. GET /explicacion/{contactoID}/
// ============================================================================

func OVCExplicacion(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		contactoID, err := extractContactoID(r)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		result, err := client.GetExplicacion(contactoID)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 7. GET /resumen-dia/?fecha=YYYY-MM-DD
// ============================================================================

func OVCResumenDia(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		fecha := r.URL.Query().Get("fecha")
		if fecha != "" {
			if _, perr := time.Parse("2006-01-02", fecha); perr != nil {
				respondJSON(w, http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   "fecha debe tener formato YYYY-MM-DD",
				})
				return
			}
		}
		result, err := client.GetResumenDia(fecha)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 8. GET /movimientos/?desde=...&hasta=...
// ============================================================================

func OVCMovimientos(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		desde := r.URL.Query().Get("desde")
		hasta := r.URL.Query().Get("hasta")
		if desde == "" || hasta == "" {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "desde y hasta son requeridos (formato YYYY-MM-DD)",
			})
			return
		}
		for _, f := range []string{desde, hasta} {
			if _, perr := time.Parse("2006-01-02", f); perr != nil {
				respondJSON(w, http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   fmt.Sprintf("fecha inválida: %s", f),
				})
				return
			}
		}
		result, err := client.GetMovimientos(desde, hasta)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

// ============================================================================
// 9. GET /scripts-estadisticas/?desde=...&hasta=...
// ============================================================================

func OVCMetricasOperadores(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		desde := r.URL.Query().Get("desde")
		hasta := r.URL.Query().Get("hasta")
		ventanaStr := r.URL.Query().Get("ventana_atribucion_dias")
		operadoresEsperados := r.URL.Query().Get("operadores_esperados")

		ventana := 0
		if ventanaStr != "" {
			parsed, err := strconv.Atoi(ventanaStr)
			if err != nil || parsed < 1 || parsed > 365 {
				respondJSON(w, http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   "ventana_atribucion_dias debe ser entero entre 1 y 365",
				})
				return
			}
			ventana = parsed
		}

		result, err := client.GetMetricasOperadores(desde, hasta, ventana, operadoresEsperados)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}

func OVCScriptsEstadisticas(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := newOVCClient(cfg)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		desde := r.URL.Query().Get("desde")
		hasta := r.URL.Query().Get("hasta")
		if desde == "" || hasta == "" {
			respondJSON(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "desde y hasta son requeridos (formato YYYY-MM-DD)",
			})
			return
		}
		result, err := client.GetScriptsEstadisticas(desde, hasta)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false, "error": err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "data": result,
		})
	}
}
