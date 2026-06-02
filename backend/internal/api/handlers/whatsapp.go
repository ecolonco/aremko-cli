package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/whatsapp"
)

// ============================================================================
// WhatsApp Cloud API — webhook + envío (piloto inbound Refugio)
// ----------------------------------------------------------------------------
// Flujo del piloto:
//   1. Meta verifica el webhook con un GET (hub.challenge) → WhatsAppWebhookVerify
//   2. Mensajes entrantes / estados llegan por POST → WhatsAppWebhookReceive
//      (valida firma X-Hub-Signature-256 con el app secret)
//   3. WhatsAppSendTest permite responder dentro de la ventana de 24h (gratis)
//
// TODO(pilot): persistir entrantes en Django (vincular cliente por teléfono,
// abrir/renovar ventana 24h, encolar en bandeja como respuesta_pendiente).
// ============================================================================

// WhatsAppWebhookVerify responde el handshake de verificación de Meta.
// Meta llama GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
func WhatsAppWebhookVerify(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		mode := q.Get("hub.mode")
		token := q.Get("hub.verify_token")
		challenge := q.Get("hub.challenge")

		if mode == "subscribe" && token != "" && token == cfg.WhatsAppVerifyToken {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(challenge))
			return
		}
		w.WriteHeader(http.StatusForbidden)
	}
}

// WhatsAppWebhookReceive recibe mensajes entrantes y actualizaciones de estado.
func WhatsAppWebhookReceive(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			respondError(w, http.StatusBadRequest, "no se pudo leer el body")
			return
		}

		// Validar firma si hay app secret configurado (recomendado en prod).
		if cfg.WhatsAppAppSecret != "" {
			if !validWhatsAppSignature(cfg.WhatsAppAppSecret, raw, r.Header.Get("X-Hub-Signature-256")) {
				respondError(w, http.StatusUnauthorized, "firma inválida")
				return
			}
		}

		var payload whatsappWebhookPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			respondError(w, http.StatusBadRequest, "payload inválido")
			return
		}

		for _, entry := range payload.Entry {
			for _, ch := range entry.Changes {
				for _, msg := range ch.Value.Messages {
					handleInboundWhatsApp(cfg, ch.Value, msg)
				}
				for _, st := range ch.Value.Statuses {
					log.Printf("[whatsapp] status=%s id=%s destinatario=%s", st.Status, st.ID, st.RecipientID)
				}
			}
		}

		// Meta exige un 200 rápido; si no, reintenta y puede deshabilitar el webhook.
		w.WriteHeader(http.StatusOK)
	}
}

// WhatsAppSendTest envía un mensaje de texto (ventana de 24h). Útil para validar
// el piloto. Protegido con X-API-KEY si AUTOMATION_API_KEY está configurada.
func WhatsAppSendTest(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AutomationAPIKey != "" && r.Header.Get("X-API-KEY") != cfg.AutomationAPIKey {
			respondError(w, http.StatusUnauthorized, "no autorizado")
			return
		}
		if cfg.WhatsAppAccessToken == "" || cfg.WhatsAppPhoneNumberID == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado")
			return
		}

		var body struct {
			To   string `json:"to"`
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.To == "" || body.Text == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'to' y 'text'")
			return
		}

		client := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
		res, err := client.SendSessionMessage(body.To, body.Text)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"message_id": res.MessageID,
		})
	}
}

// handleInboundWhatsApp procesa un mensaje entrante: lo loguea y lo persiste en
// Django (vincula al cliente por teléfono + marca respuesta pendiente en la
// bandeja OVC). Idempotente del lado Django por wa_message_id.
func handleInboundWhatsApp(cfg *config.Config, v whatsappChangeValue, msg whatsappInboundMessage) {
	nombre := ""
	for _, ct := range v.Contacts {
		if ct.WaID == msg.From {
			nombre = ct.Profile.Name
		}
	}
	// El wa_id viene sin "+"; Django espera E.164 con "+".
	phone := msg.From
	if phone != "" && !strings.HasPrefix(phone, "+") {
		phone = "+" + phone
	}
	log.Printf("[whatsapp] entrante de %s (%s) tipo=%s: %q", phone, nombre, msg.Type, msg.Text.Body)

	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
		return
	}
	err := bookings.NewClient(cfg.BookingSystemURL).PostWhatsAppInbound(cfg.LunaAPIKey, bookings.WhatsAppInboundReq{
		WaMessageID: msg.ID,
		From:        phone,
		Body:        msg.Text.Body,
		Type:        msg.Type,
		Timestamp:   msg.Timestamp,
		ContactName: nombre,
	})
	if err != nil {
		log.Printf("[whatsapp] error guardando inbound en Django: %v", err)
	}
}

// WhatsAppReply envía una respuesta (mensaje de sesión, ventana 24h) vía Cloud
// API y la registra en Django. Lo usa la bandeja para responderle al cliente
// desde aremko-cli, por eso NO exige X-API-KEY del llamador: igual que los
// endpoints OVC, el secreto (token de WhatsApp + LUNA_API_KEY) vive sólo en el
// servidor; el navegador no puede portarlo sin exponerlo. El acceso se acota vía
// CORS + despliegue privado del backend, mismo modelo que /ovc/*.
func WhatsAppReply(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.WhatsAppAccessToken == "" || cfg.WhatsAppPhoneNumberID == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado")
			return
		}
		var body struct {
			To   string `json:"to"`
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.To == "" || body.Text == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'to' y 'text'")
			return
		}

		client := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
		res, err := client.SendSessionMessage(body.To, body.Text)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}

		// Registrar el saliente en Django (no bloquea la respuesta si falla).
		if cfg.LunaAPIKey != "" && cfg.BookingSystemURL != "" {
			ts := strconv.FormatInt(time.Now().Unix(), 10)
			if e := bookings.NewClient(cfg.BookingSystemURL).PostWhatsAppOutbound(cfg.LunaAPIKey, bookings.WhatsAppOutboundReq{
				WaMessageID: res.MessageID,
				To:          body.To,
				Body:        body.Text,
				Timestamp:   ts,
			}); e != nil {
				log.Printf("[whatsapp] error registrando outbound en Django: %v", e)
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"message_id": res.MessageID,
		})
	}
}

// WhatsAppConversation proxea el historial de conversación de Django para la
// bandeja (el backend Go agrega la X-API-Key que el frontend no debe conocer).
func WhatsAppConversation(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		phone := r.URL.Query().Get("phone")
		if phone == "" {
			respondError(w, http.StatusBadRequest, "falta el parámetro 'phone'")
			return
		}
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).GetWhatsAppConversationRaw(cfg.LunaAPIKey, phone, limit)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// validWhatsAppSignature verifica X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(appSecret, body).
func validWhatsAppSignature(appSecret string, body []byte, header string) bool {
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	want := strings.TrimPrefix(header, prefix)
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(body)
	got := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(got), []byte(want))
}

// ---- Shape del payload del webhook (solo los campos que usamos) ----

type whatsappWebhookPayload struct {
	Object string `json:"object"`
	Entry  []struct {
		ID      string `json:"id"`
		Changes []struct {
			Field string              `json:"field"`
			Value whatsappChangeValue `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

type whatsappChangeValue struct {
	Metadata struct {
		DisplayPhoneNumber string `json:"display_phone_number"`
		PhoneNumberID      string `json:"phone_number_id"`
	} `json:"metadata"`
	Contacts []struct {
		Profile struct {
			Name string `json:"name"`
		} `json:"profile"`
		WaID string `json:"wa_id"`
	} `json:"contacts"`
	Messages []whatsappInboundMessage `json:"messages"`
	Statuses []struct {
		ID          string `json:"id"`
		Status      string `json:"status"`
		Timestamp   string `json:"timestamp"`
		RecipientID string `json:"recipient_id"`
	} `json:"statuses"`
}

type whatsappInboundMessage struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Text      struct {
		Body string `json:"body"`
	} `json:"text"`
}
