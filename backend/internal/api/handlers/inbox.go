package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/go-chi/chi/v5"
)

// ============================================================================
// Bandeja omnicanal (H-016) — reads unificados WhatsApp + Instagram
// ----------------------------------------------------------------------------
// Proxy a Django (/api/inbox/*) agregando la X-API-Key server-side. Cada
// conversación se identifica por (canal, external_id): phone en WhatsApp,
// IGSID en Instagram. Conviven con los endpoints /whatsapp/* legacy.
// ============================================================================

// InboxConversations proxea la lista unificada de conversaciones (ambos canales).
func InboxConversations(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		soloPendientes := r.URL.Query().Get("solo_pendientes") == "true"
		canal := r.URL.Query().Get("canal") // opcional: filtra un solo canal
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			GetInboxConversationsRaw(cfg.LunaAPIKey, soloPendientes, limit, canal)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// InboxMediaLibrary proxea la biblioteca de medios del catálogo (H-025): fotos
// y videos de tinas/cabañas/masajes publicados, para la galería de adjuntos.
func InboxMediaLibrary(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).GetMediaLibraryRaw(cfg.LunaAPIKey)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// InboxLimpiarConversacion borra el historial + carrito de un teléfono (PRUEBAS).
// Destructivo; el front confirma antes. Default el teléfono de Jorge si no viene.
func InboxLimpiarConversacion(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		var body struct {
			Phone string `json:"phone"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		phone := strings.TrimSpace(body.Phone)
		if phone == "" {
			phone = "+56958655810" // default de pruebas (Jorge)
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).LimpiarConversacion(cfg.LunaAPIKey, phone)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// InboxConversation proxea el hilo de una conversación (canal, external_id).
func InboxConversation(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		canal := r.URL.Query().Get("canal")
		externalID := r.URL.Query().Get("external_id")
		if canal == "" || externalID == "" {
			respondError(w, http.StatusBadRequest, "faltan los parámetros 'canal' y 'external_id'")
			return
		}
		limit := 200
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}
		// Opt-in del borrador del agente IA (H-019): se reenvía a Django.
		conSug := r.URL.Query().Get("sugerencia") == "1"
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			GetInboxConversationRaw(cfg.LunaAPIKey, canal, externalID, limit, conSug)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// MetricsProxy proxea los endpoints de métricas de Django (H-021): campanas |
// agente | canales | masajes. Series semanales para el Tablero de Evolución.
func MetricsProxy(cfg *config.Config) http.HandlerFunc {
	permitidos := map[string]bool{"campanas": true, "agente": true, "canales": true, "masajes": true}
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		tipo := chi.URLParam(r, "tipo")
		if !permitidos[tipo] {
			respondError(w, http.StatusNotFound, "métrica desconocida")
			return
		}
		weeks := 12
		if wq := r.URL.Query().Get("weeks"); wq != "" {
			if n, err := strconv.Atoi(wq); err == nil && n > 0 {
				weeks = n
			}
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).GetMetricsRaw(cfg.LunaAPIKey, tipo, weeks)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// MetricsReservas proxea el detalle de reservas atribuidas a campañas (H-022).
func MetricsReservas(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		weeks := 12
		if wq := r.URL.Query().Get("weeks"); wq != "" {
			if n, err := strconv.Atoi(wq); err == nil && n > 0 {
				weeks = n
			}
		}
		semana := r.URL.Query().Get("semana")
		raw, err := bookings.NewClient(cfg.BookingSystemURL).GetMetricsReservasRaw(cfg.LunaAPIKey, weeks, semana)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// InboxMarcarAtendido saca de pendientes una conversación (canal, external_id).
func InboxMarcarAtendido(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		canal := chi.URLParam(r, "canal")
		externalID := chi.URLParam(r, "externalId")
		if canal == "" || externalID == "" {
			respondError(w, http.StatusBadRequest, "faltan canal/external_id")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			PostInboxMarcarAtendidoRaw(cfg.LunaAPIKey, canal, externalID)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}
