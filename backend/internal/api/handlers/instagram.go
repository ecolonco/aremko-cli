package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/aremko/aremko-cli/internal/config"
)

// ============================================================================
// Instagram Messaging API (ruta "Instagram Login") — bandeja omnicanal
// ----------------------------------------------------------------------------
// Fase 1 (este archivo): solo recibir y loguear los DMs entrantes para validar
// el webhook end-to-end. La persistencia en Django (modelo channel-agnostic,
// keyeado por IGSID en vez de teléfono) y el envío de respuestas vienen después.
//
// Diferencias clave vs WhatsApp:
//   - Identidad de app IG aparte (aremko-wa2-IG) → su propio app secret y token.
//   - El payload usa el formato "Messenger Platform" (entry[].messaging[] con
//     sender.id / message.text), NO el de WhatsApp (changes/value/messages).
//   - La conversación se keyea por IGSID (sender.id), no por número de teléfono.
//   - Canal REACTIVO: solo se responde dentro de la ventana de 24h; sin campañas.
//
// Flujo:
//   1. Meta verifica el webhook con un GET (hub.challenge) → InstagramWebhookVerify
//   2. Los DMs entrantes llegan por POST → InstagramWebhookReceive
//      (valida firma X-Hub-Signature-256 con el app secret de la app IG)
// ============================================================================

// InstagramWebhookVerify responde el handshake de verificación de Meta.
// Meta llama GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
func InstagramWebhookVerify(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		mode := q.Get("hub.mode")
		token := q.Get("hub.verify_token")
		challenge := q.Get("hub.challenge")

		if mode == "subscribe" && token != "" && token == cfg.InstagramVerifyToken {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(challenge))
			return
		}
		log.Printf("[instagram] verificación de webhook rechazada (mode=%q token_ok=%v)", mode, token == cfg.InstagramVerifyToken)
		w.WriteHeader(http.StatusForbidden)
	}
}

// InstagramWebhookReceive recibe eventos de mensajería de Instagram.
func InstagramWebhookReceive(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			respondError(w, http.StatusBadRequest, "no se pudo leer el body")
			return
		}

		// Validar firma si hay app secret configurado (recomendado en prod).
		// Reusa el verificador HMAC genérico de WhatsApp (mismo esquema de Meta).
		if cfg.InstagramAppSecret != "" {
			if !validWhatsAppSignature(cfg.InstagramAppSecret, raw, r.Header.Get("X-Hub-Signature-256")) {
				respondError(w, http.StatusUnauthorized, "firma inválida")
				return
			}
		}

		var payload instagramWebhookPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			respondError(w, http.StatusBadRequest, "payload inválido")
			return
		}

		for _, entry := range payload.Entry {
			for _, ev := range entry.Messaging {
				handleInstagramEvent(cfg, ev)
			}
		}

		// Meta exige un 200 rápido; si no, reintenta y puede deshabilitar el webhook.
		w.WriteHeader(http.StatusOK)
	}
}

// handleInstagramEvent procesa un evento de mensajería. Fase 1: solo loguea.
func handleInstagramEvent(cfg *config.Config, ev instagramMessagingEvent) {
	if ev.Message == nil {
		// read / reaction / postback / etc. — los ignoramos por ahora.
		log.Printf("[instagram] evento sin mensaje (sender=%s)", ev.Sender.ID)
		return
	}
	// is_echo = el mensaje lo envió la propia cuenta (eco de un saliente). No es
	// un DM del cliente; en Fase 1 solo lo dejamos registrado.
	if ev.Message.IsEcho {
		log.Printf("[instagram] echo (saliente propio) mid=%s a=%s: %q", ev.Message.Mid, ev.Recipient.ID, ev.Message.Text)
		return
	}
	log.Printf("[instagram] DM entrante de IGSID=%s mid=%s texto=%q adjuntos=%d", ev.Sender.ID, ev.Message.Mid, ev.Message.Text, len(ev.Message.Attachments))
}

// ---- Shape del payload del webhook (formato Messenger Platform) ----

type instagramWebhookPayload struct {
	Object string `json:"object"` // "instagram"
	Entry  []struct {
		ID        string                    `json:"id"` // IG Business Account ID
		Time      int64                     `json:"time"`
		Messaging []instagramMessagingEvent `json:"messaging"`
	} `json:"entry"`
}

type instagramMessagingEvent struct {
	Sender struct {
		ID string `json:"id"` // IGSID del que escribe (cliente)
	} `json:"sender"`
	Recipient struct {
		ID string `json:"id"` // IG Business Account ID (la cuenta de Aremko)
	} `json:"recipient"`
	Timestamp int64                    `json:"timestamp"`
	Message   *instagramInboundMessage `json:"message"`
}

type instagramInboundMessage struct {
	Mid         string `json:"mid"`
	Text        string `json:"text"`
	IsEcho      bool   `json:"is_echo"`
	Attachments []struct {
		Type    string `json:"type"` // image | video | audio | file | share | story_mention | ...
		Payload struct {
			URL string `json:"url"`
		} `json:"payload"`
	} `json:"attachments"`
}
