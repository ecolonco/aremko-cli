package handlers

import (
	"io"
	"net/http"
	"strconv"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/go-chi/chi/v5"
)

// ============================================================================
// Bandeja de salida "Conexión-Masajes" (proxy a Django)
// ----------------------------------------------------------------------------
// Django es la fuente de verdad + motor de envío (SendGrid, branding "Aremko
// Spa Boutique", botón de baja, opt-out). aremko-cli es solo la UI: listar, ver
// preview, editar, enviar y cancelar uno por uno.
//
// Estos handlers son un passthrough: agregan la X-API-Key (que el navegador no
// debe conocer, igual que en WhatsApp/OVC) y reenvían el status code + body de
// Django TAL CUAL, para que el frontend mapee 409 (ya no pendiente) / 422
// (envío falló o cliente dado de baja) / 401 / 404 a mensajes claros.
// ============================================================================

// masajeProxyRespond reenvía al cliente el status y body crudos de Django.
func masajeProxyRespond(w http.ResponseWriter, status int, contentType string, body []byte) {
	if contentType == "" {
		contentType = "application/json"
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// masajeID extrae y valida el {id} de la URL.
func masajeID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		respondError(w, http.StatusBadRequest, "id inválido")
		return 0, false
	}
	return id, true
}

// masajeReady valida que Django esté configurado (URL base + API key).
func masajeReady(w http.ResponseWriter, cfg *config.Config) bool {
	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
		respondError(w, http.StatusServiceUnavailable, "Django no configurado")
		return false
	}
	return true
}

// MasajeOutboxList — GET /api/v1/masaje/outbox?incluir_programados=1&limit=200
func MasajeOutboxList(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !masajeReady(w, cfg) {
			return
		}
		incluir := r.URL.Query().Get("incluir_programados") != "0" // default 1
		limit := 200
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}
		body, status, err := bookings.NewClient(cfg.BookingSystemURL).MasajeOutboxList(cfg.LunaAPIKey, incluir, limit)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		masajeProxyRespond(w, status, "application/json", body)
	}
}

// MasajeOutboxPreview — GET /api/v1/masaje/outbox/{id}/preview (devuelve HTML)
func MasajeOutboxPreview(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !masajeReady(w, cfg) {
			return
		}
		id, ok := masajeID(w, r)
		if !ok {
			return
		}
		body, status, ct, err := bookings.NewClient(cfg.BookingSystemURL).MasajeOutboxPreview(cfg.LunaAPIKey, id)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		if ct == "" {
			ct = "text/html; charset=utf-8"
		}
		masajeProxyRespond(w, status, ct, body)
	}
}

// MasajeOutboxEdit — PATCH /api/v1/masaje/outbox/{id} (body: asunto/cuerpo/operador)
func MasajeOutboxEdit(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !masajeReady(w, cfg) {
			return
		}
		id, ok := masajeID(w, r)
		if !ok {
			return
		}
		payload, _ := io.ReadAll(r.Body)
		body, status, err := bookings.NewClient(cfg.BookingSystemURL).MasajeOutboxPatch(cfg.LunaAPIKey, id, payload)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		masajeProxyRespond(w, status, "application/json", body)
	}
}

// MasajeOutboxSend — POST /api/v1/masaje/outbox/{id}/send (body: operador)
func MasajeOutboxSend(cfg *config.Config) http.HandlerFunc {
	return masajeAction(cfg, "send")
}

// MasajeOutboxCancel — POST /api/v1/masaje/outbox/{id}/cancel (body: operador)
func MasajeOutboxCancel(cfg *config.Config) http.HandlerFunc {
	return masajeAction(cfg, "cancel")
}

func masajeAction(cfg *config.Config, action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !masajeReady(w, cfg) {
			return
		}
		id, ok := masajeID(w, r)
		if !ok {
			return
		}
		payload, _ := io.ReadAll(r.Body)
		body, status, err := bookings.NewClient(cfg.BookingSystemURL).MasajeOutboxAction(cfg.LunaAPIKey, id, action, payload)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		masajeProxyRespond(w, status, "application/json", body)
	}
}
