package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

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

// PublicacionDetalle trae una publicación (polling del estado de revisión).
func PublicacionDetalle(cfg *config.Config) http.HandlerFunc {
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
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			GetPublicacionDetalleRaw(cfg.AutomationAPIKey, id)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(raw)})
	}
}

// PublicacionMaterial reenvía el multipart con las fotos a Django (passthrough),
// preservando el status de Django (para que el 400 de formato llegue al front).
func PublicacionMaterial(cfg *config.Config) http.HandlerFunc {
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
		// Leer el multipart completo a memoria antes de reenviarlo: al pasar
		// un *bytes.Reader, Go setea Content-Length y NO usa chunked encoding
		// (Django no parsea request.FILES con transfer-encoding chunked, por
		// eso "No se recibió ningún archivo" al hacer streaming directo).
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<20)) // tope 64 MB total
		if err != nil {
			respondError(w, http.StatusBadRequest, "no se pudo leer el archivo: "+err.Error())
			return
		}

		// Timeout más generoso: subir hasta 16 MB por foto a Cloudinary (vía
		// Django) puede pasar los 10s por defecto del cliente.
		client := bookings.NewClient(cfg.BookingSystemURL)
		client.HTTPClient.Timeout = 60 * time.Second

		status, body, err := client.PostPublicacionMaterialRaw(
			cfg.AutomationAPIKey, id, r.Header.Get("Content-Type"), bytes.NewReader(raw),
		)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		// Reenviar el status y body de Django tal cual (200 ok, 400 formato, etc.)
		w.Header().Set("Content-Type", "application/json")
		if status == http.StatusOK {
			respondJSON(w, http.StatusOK, map[string]interface{}{"success": true, "data": json.RawMessage(body)})
			return
		}
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}
}
