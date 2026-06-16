package handlers

import (
	"net/http"
	"strconv"

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
