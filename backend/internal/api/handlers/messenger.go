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
	"github.com/aremko/aremko-cli/internal/messenger"
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

// handleMessengerEvent persiste el evento en Django (canal='messenger', H-023).
// is_echo=true se guarda como saliente.
func handleMessengerEvent(cfg *config.Config, ev instagramMessagingEvent) {
	if ev.Message == nil {
		log.Printf("[messenger] evento sin mensaje (sender=%s)", ev.Sender.ID)
		return
	}
	body := ev.Message.Text
	if ev.Message.IsEcho {
		log.Printf("[messenger] echo (saliente propio) mid=%s a=%s: %q", ev.Message.Mid, ev.Recipient.ID, body)
	} else {
		log.Printf("[messenger] DM entrante de PSID=%s mid=%s texto=%q adjuntos=%d", ev.Sender.ID, ev.Message.Mid, body, len(ev.Message.Attachments))
	}

	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
		return
	}
	ts := int64(ev.Timestamp)
	if ts > 9999999999 {
		ts = ts / 1000
	}
	tsStr := strconv.FormatInt(ts, 10)

	// Resolver el nombre del cliente (PSID) vía Graph API con el Page token.
	// Solo para entrantes: el PSID del cliente es ev.Sender.ID (en un eco el
	// sender es la Página). Si no se resuelve (modo desarrollo sin Acceso
	// Avanzado), Django muestra el fallback "Cliente Messenger #PSID".
	contactName := ""
	if !ev.Message.IsEcho && cfg.MessengerPageAccessToken != "" {
		contactName = messenger.NewClient(cfg.MessengerPageAccessToken, cfg.MessengerPageID).GetName(ev.Sender.ID)
	}

	bc := bookings.NewClient(cfg.BookingSystemURL)

	// Adjuntos (foto/video/audio/documento): descargamos los bytes del CDN de
	// Meta y los subimos a Django (H-024), igual que el flujo de media de IG.
	if len(ev.Message.Attachments) > 0 {
		handleMessengerMedia(cfg, bc, ev, tsStr, contactName)
		return
	}

	if err := bc.PostMessengerInbound(cfg.LunaAPIKey, bookings.MessengerInboundReq{
		FbMessageID: ev.Message.Mid,
		FromPSID:    ev.Sender.ID,
		ToPageID:    ev.Recipient.ID,
		Text:        body,
		Timestamp:   tsStr,
		ContactName: contactName,
		IsEcho:      ev.Message.IsEcho,
	}); err != nil {
		log.Printf("[messenger] error guardando inbound en Django: %v", err)
	}
}

// handleMessengerMedia baja cada adjunto del DM (CDN de Meta) y lo sube a Django
// (multipart). El texto del mensaje acompaña al primer adjunto como caption.
func handleMessengerMedia(cfg *config.Config, bc *bookings.Client, ev instagramMessagingEvent, ts, contactName string) {
	mc := messenger.NewClient(cfg.MessengerPageAccessToken, cfg.MessengerPageID)
	for i, att := range ev.Message.Attachments {
		var pl struct {
			URL string `json:"url"`
		}
		_ = json.Unmarshal(att.Payload, &pl)
		if pl.URL == "" {
			continue
		}
		data, mime, err := mc.DownloadMedia(pl.URL, maxMediaBytes)
		if err != nil {
			log.Printf("[messenger] error descargando adjunto tipo=%s: %v", att.Type, err)
			continue
		}
		mid := ev.Message.Mid
		caption := ""
		if i == 0 {
			caption = ev.Message.Text
		} else {
			mid = mid + "#" + strconv.Itoa(i) // evita choque de idempotencia
		}
		if err := bc.PostMessengerInboundMedia(cfg.LunaAPIKey, bookings.MessengerInboundMediaReq{
			FbMessageID: mid,
			FromPSID:    ev.Sender.ID,
			ToPageID:    ev.Recipient.ID,
			Type:        att.Type,
			Timestamp:   ts,
			ContactName: contactName,
			Caption:     caption,
			MimeType:    mime,
			Filename:    mid + extPorMime(mime),
			IsEcho:      ev.Message.IsEcho,
		}, data); err != nil {
			log.Printf("[messenger] error subiendo adjunto a Django: %v", err)
		}
	}
}

// MessengerReply envía una respuesta de texto a un PSID por Messenger.
// El saliente se persiste solo vía el webhook de eco (message_echoes), igual
// que en Instagram → no hace falta endpoint outbound en Django.
func MessengerReply(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.MessengerPageAccessToken == "" || cfg.MessengerPageID == "" {
			respondError(w, http.StatusServiceUnavailable, "Messenger no configurado (falta page token o page id)")
			return
		}
		var body struct {
			To   string `json:"to"`
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil ||
			strings.TrimSpace(body.To) == "" || strings.TrimSpace(body.Text) == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'to' (PSID) y 'text'")
			return
		}
		res, err := messenger.NewClient(cfg.MessengerPageAccessToken, cfg.MessengerPageID).
			SendMessage(strings.TrimSpace(body.To), body.Text)
		if err != nil {
			// Fuera de la ventana de 24h, token vencido, perfil sin permiso, etc.
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"message_id": res.MessageID,
		})
	}
}

// MessengerSendMedia recibe un archivo del frontend (multipart), lo envía al
// cliente por Messenger y deja que el eco lo persista. Tope 16 MB. Si viene
// 'caption', se manda como un mensaje de texto aparte antes del adjunto
// (Messenger no permite texto+adjunto en el mismo mensaje).
func MessengerSendMedia(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.MessengerPageAccessToken == "" || cfg.MessengerPageID == "" {
			respondError(w, http.StatusServiceUnavailable, "Messenger no configurado")
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
		mc := messenger.NewClient(cfg.MessengerPageAccessToken, cfg.MessengerPageID)
		if caption != "" {
			if _, err := mc.SendMessage(to, caption); err != nil {
				respondError(w, http.StatusBadGateway, err.Error())
				return
			}
		}
		res, err := mc.SendMedia(to, mime, filename, data)
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
