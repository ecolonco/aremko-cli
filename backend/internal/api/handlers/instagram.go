package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/instagram"
)

// flexInt acepta un entero venga como número JSON (DMs reales: 1527459824) o
// como string ("1527459824", lo que manda el probador de webhooks de Meta).
// Así un timestamp con tipo inesperado no rompe el unmarshal del webhook entero.
type flexInt int64

func (f *flexInt) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		return nil
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil // no abortamos el webhook por un timestamp raro
	}
	*f = flexInt(n)
	return nil
}

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
			// No devolvemos 400: Meta reintentaría y podría deshabilitar el
			// webhook. Logueamos el crudo (recortado) para depurar y seguimos.
			body := string(raw)
			if len(body) > 800 {
				body = body[:800] + "…"
			}
			log.Printf("[instagram] payload no parseable (%v): %s", err, body)
			w.WriteHeader(http.StatusOK)
			return
		}

		for _, entry := range payload.Entry {
			// DMs reales: formato "messaging[]".
			for _, ev := range entry.Messaging {
				handleInstagramEvent(cfg, ev)
			}
			// Probador de webhooks de Meta y eventos no-DM (ej. comentarios):
			// formato "changes[].value". El value de un "messages" tiene la misma
			// forma que un evento de messaging (sender/recipient/message).
			for _, ch := range entry.Changes {
				if ch.Field == "messages" {
					handleInstagramEvent(cfg, ch.Value)
				} else {
					log.Printf("[instagram] evento changes field=%q (ignorado en Fase 1)", ch.Field)
				}
			}
		}

		// Meta exige un 200 rápido; si no, reintenta y puede deshabilitar el webhook.
		w.WriteHeader(http.StatusOK)
	}
}

// handleInstagramEvent procesa un evento de mensajería y lo persiste en Django
// (bandeja omnicanal, H-016). is_echo=true se guarda como saliente.
func handleInstagramEvent(cfg *config.Config, ev instagramMessagingEvent) {
	if ev.Message == nil {
		// read / reaction / postback / etc. — los ignoramos por ahora.
		log.Printf("[instagram] evento sin mensaje (sender=%s)", ev.Sender.ID)
		return
	}
	body := ev.Message.Text
	if ev.Message.IsEcho {
		log.Printf("[instagram] echo (saliente propio) mid=%s a=%s: %q", ev.Message.Mid, ev.Recipient.ID, body)
	} else {
		log.Printf("[instagram] DM entrante de IGSID=%s mid=%s texto=%q adjuntos=%d", ev.Sender.ID, ev.Message.Mid, body, len(ev.Message.Attachments))
	}

	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
		return
	}

	// El timestamp de IG viene en milisegundos; Django (como en WhatsApp) espera
	// segundos → normalizamos si el valor parece estar en ms.
	tsVal := int64(ev.Timestamp)
	if tsVal > 9999999999 {
		tsVal = tsVal / 1000
	}
	ts := strconv.FormatInt(tsVal, 10)

	// Resolvemos el @usuario/nombre del cliente (no en ecos: ahí el sender somos
	// nosotros). Vacío si no hay token o no se puede resolver → Django usa el IGSID.
	contactName := ""
	if !ev.Message.IsEcho && cfg.InstagramAccessToken != "" && cfg.InstagramBusinessID != "" {
		contactName = instagram.NewClient(cfg.InstagramAccessToken, cfg.InstagramBusinessID).GetUsername(ev.Sender.ID)
	}

	bc := bookings.NewClient(cfg.BookingSystemURL)

	// Adjuntos (foto/video/audio/historia/…): descargamos los bytes y los subimos
	// a Django (H-020), igual que el flujo de media de WhatsApp.
	if len(ev.Message.Attachments) > 0 {
		handleInstagramMedia(cfg, bc, ev, ts, contactName)
		return
	}

	if err := bc.PostInstagramInbound(cfg.LunaAPIKey, bookings.InstagramInboundReq{
		IgMessageID: ev.Message.Mid,
		FromIGSID:   ev.Sender.ID,
		ToIGSID:     ev.Recipient.ID,
		Text:        body,
		Timestamp:   ts,
		ContactName: contactName,
		IsEcho:      ev.Message.IsEcho,
	}); err != nil {
		log.Printf("[instagram] error guardando inbound en Django: %v", err)
	}
}

// handleInstagramMedia baja cada adjunto del DM (CDN temporal de IG) y lo sube a
// Django (multipart). El texto del mensaje acompaña al primer adjunto como caption.
func handleInstagramMedia(cfg *config.Config, bc *bookings.Client, ev instagramMessagingEvent, ts, contactName string) {
	ic := instagram.NewClient(cfg.InstagramAccessToken, cfg.InstagramBusinessID)
	posted := 0
	for i, att := range ev.Message.Attachments {
		var pl struct {
			URL string `json:"url"`
		}
		_ = json.Unmarshal(att.Payload, &pl)
		// Diagnóstico (H-030): los `share` y los adjuntos sin URL nunca se habían
		// visto en prod; logueamos el payload crudo para conocer su estructura real.
		if att.Type == "share" || pl.URL == "" {
			log.Printf("[instagram] adjunto tipo=%s payload_crudo=%s", att.Type, string(att.Payload))
		}
		if pl.URL == "" {
			continue
		}
		data, mime, err := ic.DownloadMedia(pl.URL, maxMediaBytes)
		if err != nil {
			log.Printf("[instagram] error descargando adjunto tipo=%s: %v", att.Type, err)
			continue
		}
		mid := ev.Message.Mid
		caption := ""
		if i == 0 {
			caption = ev.Message.Text
		} else {
			mid = mid + "#" + strconv.Itoa(i) // evita choque de idempotencia
		}
		if err := bc.PostInstagramInboundMedia(cfg.LunaAPIKey, bookings.InstagramInboundMediaReq{
			IgMessageID: mid,
			FromIGSID:   ev.Sender.ID,
			ToIGSID:     ev.Recipient.ID,
			Type:        att.Type,
			Timestamp:   ts,
			ContactName: contactName,
			Caption:     caption,
			MimeType:    mime,
			Filename:    mid + extPorMime(mime),
			IsEcho:      ev.Message.IsEcho,
		}, data); err != nil {
			log.Printf("[instagram] error subiendo adjunto a Django: %v", err)
			continue
		}
		posted++
	}

	// Si ningún adjunto se pudo subir (típico de un `share` sin media descargable
	// estándar), NO perdemos el mensaje: lo registramos como texto para que aparezca
	// en la bandeja con el contexto de que el cliente compartió algo. H-030.
	if posted == 0 {
		nota := strings.TrimSpace(ev.Message.Text)
		marca := "📎 [el cliente compartió una publicación por Instagram]"
		if nota == "" {
			nota = marca
		} else {
			nota = nota + "\n" + marca
		}
		if err := bc.PostInstagramInbound(cfg.LunaAPIKey, bookings.InstagramInboundReq{
			IgMessageID: ev.Message.Mid,
			FromIGSID:   ev.Sender.ID,
			ToIGSID:     ev.Recipient.ID,
			Text:        nota,
			Timestamp:   ts,
			ContactName: contactName,
			IsEcho:      ev.Message.IsEcho,
		}); err != nil {
			log.Printf("[instagram] error registrando inbound fallback (share sin media): %v", err)
		}
	}
}

// InstagramReply envía un DM de texto al cliente (ventana de 24h). El saliente
// NO se registra acá: Meta manda un webhook "echo" que el inbound persiste como
// saliente (contrato H-016). Lo usa la bandeja para responder por Instagram.
func InstagramReply(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.InstagramAccessToken == "" || cfg.InstagramBusinessID == "" {
			respondError(w, http.StatusServiceUnavailable, "Instagram no configurado (falta token o business id)")
			return
		}
		var body struct {
			To   string `json:"to"`
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil ||
			strings.TrimSpace(body.To) == "" || strings.TrimSpace(body.Text) == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'to' (IGSID) y 'text'")
			return
		}
		res, err := instagram.NewClient(cfg.InstagramAccessToken, cfg.InstagramBusinessID).
			SendMessage(strings.TrimSpace(body.To), body.Text)
		if err != nil {
			// Fuera de la ventana de 24h, token vencido, etc. → error de Meta.
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"message_id": res.MessageID,
		})
	}
}

// InstagramSendMedia recibe un archivo del frontend (multipart), lo envía al
// cliente por Instagram (sube a la Attachment Upload API y manda el attachment_id)
// y deja que el eco lo persista. Tope 16 MB. Si viene 'caption', se manda como
// mensaje de texto aparte antes del adjunto (IG no permite texto+adjunto juntos).
func InstagramSendMedia(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.InstagramAccessToken == "" || cfg.InstagramBusinessID == "" {
			respondError(w, http.StatusServiceUnavailable, "Instagram no configurado")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxMediaBytes+(1<<20))
		if err := r.ParseMultipartForm(maxMediaBytes + (1 << 20)); err != nil {
			respondError(w, http.StatusRequestEntityTooLarge, "archivo demasiado grande (máx 16 MB)")
			return
		}
		to := strings.TrimSpace(r.FormValue("to"))
		caption := strings.TrimSpace(r.FormValue("caption"))
		if to == "" {
			respondError(w, http.StatusBadRequest, "falta 'to'")
			return
		}
		data, mime, filename, err := mediaFromRequest(r)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		ic := instagram.NewClient(cfg.InstagramAccessToken, cfg.InstagramBusinessID)
		if caption != "" {
			if _, err := ic.SendMessage(to, caption); err != nil {
				respondError(w, http.StatusBadGateway, err.Error())
				return
			}
		}
		res, err := ic.SendMedia(to, mime, filename, data)
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

// ---- Shape del payload del webhook (formato Messenger Platform) ----

type instagramWebhookPayload struct {
	Object string `json:"object"` // "instagram"
	Entry  []struct {
		ID        string                    `json:"id"` // IG Business Account ID
		Time      flexInt                   `json:"time"`
		Messaging []instagramMessagingEvent `json:"messaging"`
		// Formato alterno usado por el probador de Meta y por eventos no-DM.
		Changes []struct {
			Field string                  `json:"field"`
			Value instagramMessagingEvent `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

type instagramMessagingEvent struct {
	Sender struct {
		ID string `json:"id"` // IGSID del que escribe (cliente)
	} `json:"sender"`
	Recipient struct {
		ID string `json:"id"` // IG Business Account ID (la cuenta de Aremko)
	} `json:"recipient"`
	Timestamp flexInt                  `json:"timestamp"`
	Message   *instagramInboundMessage `json:"message"`
}

type instagramInboundMessage struct {
	Mid         string `json:"mid"`
	Text        string `json:"text"`
	IsEcho      bool   `json:"is_echo"`
	Attachments []struct {
		Type string `json:"type"` // image | video | audio | file | share | story_mention | ...
		// Payload crudo: los `share` (publicación compartida por DM) no siempre traen
		// la misma forma que image/video, así que lo guardamos completo y extraemos la
		// URL aparte (y lo logueamos para conocer su estructura real). H-030.
		Payload json.RawMessage `json:"payload"`
	} `json:"attachments"`
}
