package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/whatsapp"
	"github.com/go-chi/chi/v5"
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
	bc := bookings.NewClient(cfg.BookingSystemURL)

	// Adjuntos (foto/video/audio/voz/documento): la Cloud API solo manda un
	// media_id; hay que descargar los bytes con el token y subirlos a Django.
	if media := msg.media(); media != nil && media.ID != "" {
		handleInboundMedia(cfg, bc, msg, media, phone, nombre)
		return
	}

	err := bc.PostWhatsAppInbound(cfg.LunaAPIKey, bookings.WhatsAppInboundReq{
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

// extPorMime deduce una extensión de archivo razonable desde el mime de Meta.
func extPorMime(mime string) string {
	switch {
	case strings.HasPrefix(mime, "image/jpeg"):
		return ".jpg"
	case strings.HasPrefix(mime, "image/png"):
		return ".png"
	case strings.HasPrefix(mime, "image/webp"):
		return ".webp"
	case strings.HasPrefix(mime, "application/pdf"):
		return ".pdf"
	case strings.HasPrefix(mime, "audio/ogg"):
		return ".ogg"
	case strings.HasPrefix(mime, "audio/mpeg"):
		return ".mp3"
	case strings.HasPrefix(mime, "audio/"):
		return ".m4a"
	case strings.HasPrefix(mime, "video/mp4"):
		return ".mp4"
	case strings.HasPrefix(mime, "video/"):
		return ".mp4"
	}
	return ".bin"
}

// maxMediaBytes: tope de adjunto entrante (16 MB), alineado con el límite del
// endpoint de Django (Cloudinary) y con los topes de la Cloud API (imagen 5 MB,
// audio/voz/video 16 MB). Si Django lo cambia vía env, ajustar aquí también.
const maxMediaBytes int64 = 16 * 1024 * 1024

// handleInboundMedia descarga el adjunto desde Meta y lo sube a Django (multipart).
func handleInboundMedia(cfg *config.Config, bc *bookings.Client, msg whatsappInboundMessage, media *whatsappMedia, phone, nombre string) {
	if cfg.WhatsAppAccessToken == "" {
		log.Printf("[whatsapp] media entrante sin token configurado; se omite")
		return
	}
	wc := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
	dl, err := wc.DownloadMedia(media.ID, maxMediaBytes)
	if err != nil {
		if errors.Is(err, whatsapp.ErrMediaTooLarge) {
			handleMediaTooLarge(cfg, bc, wc, msg, phone, nombre)
			return
		}
		log.Printf("[whatsapp] error descargando media %s: %v", media.ID, err)
		return
	}
	mime := media.MimeType
	if mime == "" {
		mime = dl.MimeType
	}
	filename := media.Filename
	if filename == "" {
		filename = msg.ID + extPorMime(mime)
	}
	// Las notas de voz llegan como type=audio con voice=true; lo distinguimos.
	tipo := msg.Type
	if tipo == "audio" && media.Voice {
		tipo = "voice"
	}
	err = bc.PostWhatsAppInboundMedia(cfg.LunaAPIKey, bookings.WhatsAppInboundMediaReq{
		WaMessageID: msg.ID,
		From:        phone,
		Type:        tipo,
		Timestamp:   msg.Timestamp,
		ContactName: nombre,
		Caption:     media.Caption,
		MimeType:    mime,
		Filename:    filename,
	}, dl.Data)
	if err != nil {
		log.Printf("[whatsapp] error subiendo media a Django: %v", err)
	}
}

// handleMediaTooLarge: el adjunto supera el tope. Deja una nota en el hilo para
// el operador y le avisa al cliente (la ventana de 24h está abierta: acaba de
// escribir) para que lo reenvíe más liviano. No descarga los bytes.
func handleMediaTooLarge(cfg *config.Config, bc *bookings.Client, wc *whatsapp.Client, msg whatsappInboundMessage, phone, nombre string) {
	log.Printf("[whatsapp] adjunto de %s excede %d bytes; aviso al cliente", phone, maxMediaBytes)

	// Nota para el operador en el hilo (idempotente con sufijo en el wa_message_id).
	if e := bc.PostWhatsAppInbound(cfg.LunaAPIKey, bookings.WhatsAppInboundReq{
		WaMessageID: msg.ID + "-toolarge",
		From:        phone,
		Body:        "⚠️ El cliente envió un archivo demasiado grande (límite 16 MB); no se pudo guardar. Pídele reenviarlo más liviano.",
		Type:        "text",
		Timestamp:   msg.Timestamp,
		ContactName: nombre,
	}); e != nil {
		log.Printf("[whatsapp] error dejando nota de archivo grande: %v", e)
	}

	// Aviso automático al cliente + registro del saliente.
	aviso := "Recibimos tu archivo, pero es muy pesado para guardarlo (máximo 16 MB). ¿Puedes reenviarlo más liviano o como foto? 🙏"
	res, err := wc.SendSessionMessage(phone, aviso)
	if err != nil {
		log.Printf("[whatsapp] no se pudo avisar al cliente del archivo grande: %v", err)
		return
	}
	if cfg.LunaAPIKey != "" {
		if e := bc.PostWhatsAppOutbound(cfg.LunaAPIKey, bookings.WhatsAppOutboundReq{
			WaMessageID: res.MessageID,
			To:          phone,
			Body:        aviso,
			Timestamp:   strconv.FormatInt(time.Now().Unix(), 10),
		}); e != nil {
			log.Printf("[whatsapp] error registrando aviso saliente: %v", e)
		}
	}
}

// WhatsAppReply envía una respuesta (mensaje de sesión, ventana 24h) vía Cloud
// API y la registra en Django. Lo usa la bandeja para responderle al cliente
// desde aremko-cli, por eso NO exige X-API-KEY del llamador: igual que los
// endpoints OVC, el secreto (token de WhatsApp + LUNA_API_KEY) vive sólo en el
// servidor; el navegador no puede portarlo sin exponerlo. El acceso se acota vía
// CORS + despliegue privado del backend, mismo modelo que /ovc/*.
// WhatsAppSendTemplate envía una PLANTILLA aprobada a un número (form
// "Contactando"). Sirve para abrir conversación EN FRÍO con clientes que no han
// escrito en las últimas 24h —p. ej. los que tras la migración a Cloud API ven
// "esta cuenta no tiene WhatsApp"—: al recibir la plantilla, su teléfono reabre
// el chat. 'text' (opcional) rellena la variable {{1}} de la plantilla editable.
// 'display_text' (opcional) es el texto ya renderizado, sólo para registrar el
// saliente en la bandeja. Mismo modelo de auth que WhatsAppReply (sin X-API-KEY
// del navegador; el token vive en el servidor).
func WhatsAppSendTemplate(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.WhatsAppAccessToken == "" || cfg.WhatsAppPhoneNumberID == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado")
			return
		}
		var body struct {
			To           string `json:"to"`
			TemplateName string `json:"template_name"`
			Lang         string `json:"lang"`
			Text         string `json:"text"`
			DisplayText  string `json:"display_text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.To == "" || body.TemplateName == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'to' y 'template_name'")
			return
		}
		lang := body.Lang
		if lang == "" {
			lang = "es"
		}
		var components []interface{}
		if strings.TrimSpace(body.Text) != "" {
			components = []interface{}{
				map[string]interface{}{
					"type": "body",
					"parameters": []interface{}{
						map[string]interface{}{"type": "text", "text": body.Text},
					},
				},
			}
		}

		client := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
		res, err := client.SendTemplate(body.To, body.TemplateName, lang, components)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}

		// Registrar el saliente en Django (best-effort) para que aparezca en la
		// bandeja. Usa display_text si vino; si no, una marca con el nombre.
		if cfg.LunaAPIKey != "" && cfg.BookingSystemURL != "" {
			logBody := body.DisplayText
			if strings.TrimSpace(logBody) == "" {
				logBody = "[Plantilla: " + body.TemplateName + "]"
			}
			ts := strconv.FormatInt(time.Now().Unix(), 10)
			if e := bookings.NewClient(cfg.BookingSystemURL).PostWhatsAppOutbound(cfg.LunaAPIKey, bookings.WhatsAppOutboundReq{
				WaMessageID: res.MessageID,
				To:          body.To,
				Body:        logBody,
				Timestamp:   ts,
			}); e != nil {
				log.Printf("[whatsapp] error registrando outbound (plantilla) en Django: %v", e)
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"message_id": res.MessageID,
		})
	}
}

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

// WhatsAppSendMedia recibe un archivo del frontend (multipart), lo sube a la
// Cloud API, lo envía al cliente y registra el saliente en Django (con el
// archivo, para que aparezca en el hilo). Tope 16 MB. No exige X-API-KEY del
// llamador (mismo modelo que /whatsapp/reply y /ovc/*).
func WhatsAppSendMedia(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.WhatsAppAccessToken == "" || cfg.WhatsAppPhoneNumberID == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado")
			return
		}
		// Tope duro del body (deja ~1 MB de margen para campos/boundaries).
		r.Body = http.MaxBytesReader(w, r.Body, maxMediaBytes+(1<<20))
		if err := r.ParseMultipartForm(maxMediaBytes + (1 << 20)); err != nil {
			respondError(w, http.StatusRequestEntityTooLarge, "archivo demasiado grande (máx 16 MB)")
			return
		}
		to := strings.TrimSpace(r.FormValue("to"))
		caption := r.FormValue("caption")
		if to == "" {
			respondError(w, http.StatusBadRequest, "falta 'to'")
			return
		}
		file, hdr, err := r.FormFile("file")
		if err != nil {
			respondError(w, http.StatusBadRequest, "falta el archivo 'file'")
			return
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			respondError(w, http.StatusBadRequest, "no se pudo leer el archivo")
			return
		}
		if int64(len(data)) > maxMediaBytes {
			respondError(w, http.StatusRequestEntityTooLarge, "archivo demasiado grande (máx 16 MB)")
			return
		}
		mime := hdr.Header.Get("Content-Type")
		if mime == "" {
			mime = "application/octet-stream"
		}
		filename := hdr.Filename
		mediaType := whatsapp.MediaTypeForSend(mime)

		wc := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
		mediaID, err := wc.UploadMedia(data, mime, filename)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		res, err := wc.SendMediaMessage(to, mediaType, mediaID, caption, filename)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}

		// Registrar el saliente en Django (con el archivo) para verlo en el hilo.
		if cfg.LunaAPIKey != "" && cfg.BookingSystemURL != "" {
			ts := strconv.FormatInt(time.Now().Unix(), 10)
			if e := bookings.NewClient(cfg.BookingSystemURL).PostWhatsAppOutboundMedia(cfg.LunaAPIKey,
				bookings.WhatsAppOutboundMediaReq{
					WaMessageID: res.MessageID,
					To:          to,
					Type:        mediaType,
					Timestamp:   ts,
					Caption:     caption,
					MimeType:    mime,
					Filename:    filename,
				}, data); e != nil {
				log.Printf("[whatsapp] error registrando outbound-media en Django: %v", e)
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":    true,
			"message_id": res.MessageID,
		})
	}
}

// WhatsAppCreateTemplates crea (un disparo) todas las plantillas embebidas de
// Vuelta a Casa en la WABA indicada (?waba_id=). Quedan en revisión de Meta.
// Protegido con X-API-Key = LUNA_API_KEY (server-to-server). Idempotente del
// lado Meta: si una plantilla ya existe, devuelve error y seguimos con el resto.
func WhatsAppCreateTemplates(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || r.Header.Get("X-API-Key") != cfg.LunaAPIKey {
			respondError(w, http.StatusUnauthorized, "no autorizado")
			return
		}
		if cfg.WhatsAppAccessToken == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado")
			return
		}
		wabaID := r.URL.Query().Get("waba_id")
		if wabaID == "" {
			respondError(w, http.StatusBadRequest, "falta waba_id")
			return
		}
		specs, err := whatsapp.VueltaACasaTemplates()
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// Filtro opcional ?name= para (re)crear solo una plantilla puntual.
		if only := r.URL.Query().Get("name"); only != "" {
			filtered := specs[:0:0]
			for _, t := range specs {
				if t.Name == only {
					filtered = append(filtered, t)
				}
			}
			specs = filtered
		}
		wc := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
		creadas, fallidas := 0, 0
		results := make([]map[string]interface{}, 0, len(specs))
		for _, t := range specs {
			res, err := wc.CreateTemplate(wabaID, t)
			if err != nil {
				fallidas++
				results = append(results, map[string]interface{}{
					"name": t.Name, "ok": false, "error": err.Error(),
				})
				continue
			}
			creadas++
			results = append(results, map[string]interface{}{
				"name": t.Name, "ok": true, "id": res["id"], "status": res["status"],
			})
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true, "total": len(specs), "creadas": creadas, "fallidas": fallidas,
			"results": results,
		})
	}
}

// WhatsAppRunTemplateCampaign corre la campaña de primer contacto (Vuelta a
// Casa): pide a Django los contactos salva 1 pendientes con plantilla asignada,
// envía cada plantilla por la Cloud API y reporta el resultado a Django.
// Lo dispara el cron de Django tras generar la bandeja. Protegido con
// X-API-Key = LUNA_API_KEY (server-to-server; no lo llama el navegador).
func WhatsAppRunTemplateCampaign(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || r.Header.Get("X-API-Key") != cfg.LunaAPIKey {
			respondError(w, http.StatusUnauthorized, "no autorizado")
			return
		}
		if cfg.WhatsAppAccessToken == "" || cfg.WhatsAppPhoneNumberID == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado")
			return
		}
		if cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}

		bc := bookings.NewClient(cfg.BookingSystemURL)
		pendientes, err := bc.GetPendingTemplateSends(cfg.LunaAPIKey, limit)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}

		wc := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
		enviados, fallidos := 0, 0
		for _, p := range pendientes {
			lang := p.Language
			if lang == "" {
				lang = "es"
			}
			res, err := wc.SendTemplate(p.Phone, p.MetaTemplateName, lang, buildTemplateBody(p.Params))
			if err != nil {
				fallidos++
				log.Printf("[whatsapp] plantilla falló contacto=%d script=%s: %v", p.ContactoID, p.ScriptID, err)
				if e := bc.MarkTemplateFailed(cfg.LunaAPIKey, p.ContactoID, err.Error()); e != nil {
					log.Printf("[whatsapp] error en mark-template-failed contacto=%d: %v", p.ContactoID, e)
				}
				continue
			}
			enviados++
			if e := bc.MarkTemplateSent(cfg.LunaAPIKey, p.ContactoID, res.MessageID); e != nil {
				log.Printf("[whatsapp] error en mark-template-sent contacto=%d: %v", p.ContactoID, e)
			}
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":  true,
			"total":    len(pendientes),
			"enviados": enviados,
			"fallidos": fallidos,
		})
	}
}

// buildTemplateBody arma el component "body" de una plantilla con sus variables
// posicionales ({{1}}, {{2}}…). Devuelve nil si la plantilla no tiene variables.
func buildTemplateBody(params []string) []interface{} {
	if len(params) == 0 {
		return nil
	}
	ps := make([]interface{}, 0, len(params))
	for _, p := range params {
		ps = append(ps, map[string]interface{}{"type": "text", "text": p})
	}
	return []interface{}{
		map[string]interface{}{"type": "body", "parameters": ps},
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

// WhatsAppConversations proxea el listado de conversaciones de Django (una fila
// por teléfono) para poblar la bandeja de entrada. La X-API-Key la agrega el
// backend Go server-side; el navegador no la porta.
func WhatsAppConversations(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		soloPendientes := r.URL.Query().Get("solo_pendientes") == "true"
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			GetWhatsAppConversationsRaw(cfg.LunaAPIKey, soloPendientes, limit)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// WhatsAppMarcarAtendido saca una conversación de la cola de pendientes
// (proxy a Django). El teléfono llega como path param {phone} en E.164.
// WhatsAppEditarNombre corrige el nombre del cliente (ficha canónica en Django)
// desde la conversación. Proxy a Django agregando la X-API-Key. Devuelve el JSON
// de Django tal cual ({ok, cliente_id, cliente_nombre}) para que la UI actualice.
func WhatsAppEditarNombre(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		phone := chi.URLParam(r, "phone")
		if phone == "" {
			respondError(w, http.StatusBadRequest, "falta el teléfono")
			return
		}
		var body struct {
			Nombre string `json:"nombre"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Nombre) == "" {
			respondError(w, http.StatusBadRequest, "nombre requerido")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			PostWhatsAppEditarNombreRaw(cfg.LunaAPIKey, phone, strings.TrimSpace(body.Nombre))
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

func WhatsAppMarcarAtendido(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		phone := chi.URLParam(r, "phone")
		if phone == "" {
			respondError(w, http.StatusBadRequest, "falta el teléfono")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).
			PostWhatsAppMarcarAtendidoRaw(cfg.LunaAPIKey, phone)
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

type whatsappMedia struct {
	ID       string `json:"id"`
	MimeType string `json:"mime_type"`
	Caption  string `json:"caption"`  // image | video | document
	Filename string `json:"filename"` // document
	Voice    bool   `json:"voice"`    // audio: true = nota de voz
}

type whatsappInboundMessage struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Text      struct {
		Body string `json:"body"`
	} `json:"text"`
	Image    *whatsappMedia `json:"image"`
	Video    *whatsappMedia `json:"video"`
	Audio    *whatsappMedia `json:"audio"`
	Document *whatsappMedia `json:"document"`
	Sticker  *whatsappMedia `json:"sticker"`
}

// media devuelve el adjunto del mensaje según su tipo (nil si es texto).
func (m whatsappInboundMessage) media() *whatsappMedia {
	switch m.Type {
	case "image":
		return m.Image
	case "video":
		return m.Video
	case "audio":
		return m.Audio
	case "document":
		return m.Document
	case "sticker":
		return m.Sticker
	}
	return nil
}
