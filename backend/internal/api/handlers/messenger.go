package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/aremko/aremko-cli/internal/config"
)

// ============================================================================
// Facebook Messenger (Messenger Platform, object "page") — bandeja omnicanal
// ----------------------------------------------------------------------------
// El payload es el MISMO formato Messenger Platform que Instagram
// (entry[].messaging[] con sender.id / message.text), por eso reusa los structs
// instagram* y los helpers (validWhatsAppSignature, flexInt). Diferencias:
//   - object = "page" (vs "instagram").
//   - identidad = PSID (Page-Scoped ID) del que escribe; recipient.id = Page ID.
//   - misma app aremko-wa2 → la firma valida con el app secret de esa app.
// Canal REACTIVO (ventana 24h). Fase 1: solo recibir + loguear.
// ============================================================================

// MessengerWebhookVerify responde el handshake de verificación de Meta.
func MessengerWebhookVerify(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		token := q.Get("hub.verify_token")
		if q.Get("hub.mode") == "subscribe" && token != "" && token == cfg.MessengerVerifyToken {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(q.Get("hub.challenge")))
			return
		}
		log.Printf("[messenger] verificación de webhook rechazada (token_ok=%v)", token == cfg.MessengerVerifyToken)
		w.WriteHeader(http.StatusForbidden)
	}
}

// MessengerWebhookReceive recibe eventos de mensajería de la Página.
func MessengerWebhookReceive(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			respondError(w, http.StatusBadRequest, "no se pudo leer el body")
			return
		}
		// Misma app aremko-wa2: si no hay MESSENGER_APP_SECRET, valida con el de WhatsApp.
		secret := cfg.MessengerAppSecret
		if secret == "" {
			secret = cfg.WhatsAppAppSecret
		}
		if secret != "" {
			if !validWhatsAppSignature(secret, raw, r.Header.Get("X-Hub-Signature-256")) {
				respondError(w, http.StatusUnauthorized, "firma inválida")
				return
			}
		}

		// Mismo shape Messenger Platform que Instagram.
		var payload instagramWebhookPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			body := string(raw)
			if len(body) > 800 {
				body = body[:800] + "…"
			}
			log.Printf("[messenger] payload no parseable (%v): %s", err, body)
			w.WriteHeader(http.StatusOK)
			return
		}

		for _, entry := range payload.Entry {
			for _, ev := range entry.Messaging {
				handleMessengerEvent(cfg, ev)
			}
			for _, ch := range entry.Changes {
				if ch.Field == "messages" {
					handleMessengerEvent(cfg, ch.Value)
				}
			}
		}
		w.WriteHeader(http.StatusOK)
	}
}

// handleMessengerEvent procesa un evento. Fase 1: solo loguea. (La persistencia
// en Django con canal='messenger' y el envío vienen en las fases siguientes.)
func handleMessengerEvent(cfg *config.Config, ev instagramMessagingEvent) {
	if ev.Message == nil {
		log.Printf("[messenger] evento sin mensaje (sender=%s)", ev.Sender.ID)
		return
	}
	if ev.Message.IsEcho {
		log.Printf("[messenger] echo (saliente propio) mid=%s a=%s: %q", ev.Message.Mid, ev.Recipient.ID, ev.Message.Text)
		return
	}
	log.Printf("[messenger] DM entrante de PSID=%s mid=%s texto=%q adjuntos=%d", ev.Sender.ID, ev.Message.Mid, ev.Message.Text, len(ev.Message.Attachments))
}
