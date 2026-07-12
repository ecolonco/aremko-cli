package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/go-chi/chi/v5"
)

// ============================================================================
// Publicaciones planificadas de la semana (asistente community manager)
// ----------------------------------------------------------------------------
// Django explota el brief de cada lunes en una cola de publicaciones
// (PublicacionPlanificada). Estos handlers son el proxy para la página de
// Angélica: el backend Go agrega la X-API-Key (AUTOMATION_API_KEY, que el
// navegador no conoce) y reenvía el JSON de Django.
// ============================================================================

// PublicacionesSemana lista la cola de la semana (default: semana en curso).
// Query param opcional: semana=YYYY-MM-DD (cualquier día de la semana).
func PublicacionesSemana(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AutomationAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado (AUTOMATION_API_KEY/BOOKING_SYSTEM_URL)")
			return
		}
		semana := r.URL.Query().Get("semana")
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			GetPublicacionesSemanaRaw(cfg.AutomationAPIKey, semana)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    json.RawMessage(raw),
		})
	}
}

// PublicacionActualizar cambia estado/published_url/notas de una publicación.
func PublicacionActualizar(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AutomationAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado (AUTOMATION_API_KEY/BOOKING_SYSTEM_URL)")
			return
		}
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			respondError(w, http.StatusBadRequest, "id inválido")
			return
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			respondError(w, http.StatusBadRequest, "body no es JSON válido")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			PostPublicacionActualizarRaw(cfg.AutomationAPIKey, id, payload)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    json.RawMessage(raw),
		})
	}
}
