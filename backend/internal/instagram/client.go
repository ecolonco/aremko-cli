// Package instagram habla con la API de Instagram (ruta "Instagram Login",
// graph.instagram.com) para enviar DMs y resolver el perfil de quien escribe.
// Espeja el patrón del cliente de WhatsApp (internal/whatsapp).
package instagram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"
	"time"
)

const graphBase = "https://graph.instagram.com/v21.0"

type Client struct {
	Token      string // Instagram user access token (de aremkospa)
	BusinessID string // IG Business Account ID (la cuenta de Aremko)
	HTTPClient *http.Client
}

func NewClient(token, businessID string) *Client {
	return &Client{
		Token:      token,
		BusinessID: businessID,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type SendResult struct {
	RecipientID string `json:"recipient_id"`
	MessageID   string `json:"message_id"`
}

// SendMessage envía un DM de texto a un IGSID. Solo funciona dentro de la
// ventana de 24h desde el último mensaje del cliente (fuera de eso Meta
// devuelve error, que se propaga tal cual).
func (c *Client) SendMessage(recipientIGSID, text string) (*SendResult, error) {
	payload := map[string]interface{}{
		"recipient": map[string]string{"id": recipientIGSID},
		"message":   map[string]string{"text": text},
	}
	body, _ := json.Marshal(payload)
	u := fmt.Sprintf("%s/%s/messages", graphBase, url.PathEscape(c.BusinessID))
	req, err := http.NewRequest(http.MethodPost, u, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error enviando DM de Instagram: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("instagram send status %d: %s", resp.StatusCode, b)
	}
	var out SendResult
	_ = json.Unmarshal(b, &out)
	return &out, nil
}

// AttachmentTypeForMime mapea un MIME al tipo de adjunto de la API (image | video | audio | file).
func AttachmentTypeForMime(mime string) string {
	switch {
	case strings.HasPrefix(mime, "image/"):
		return "image"
	case strings.HasPrefix(mime, "video/"):
		return "video"
	case strings.HasPrefix(mime, "audio/"):
		return "audio"
	default:
		return "file"
	}
}

// uploadAttachment sube los bytes a la Attachment Upload API y devuelve el
// attachment_id (Instagram no acepta bytes en el envío; hay que subir primero).
func (c *Client) uploadAttachment(attType, mime, filename string, data []byte) (string, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("message", fmt.Sprintf(`{"attachment":{"type":"%s","payload":{"is_reusable":true}}}`, attType))
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="filedata"; filename="%s"`, filename))
	if mime != "" {
		h.Set("Content-Type", mime)
	}
	fw, err := mw.CreatePart(h)
	if err != nil {
		return "", err
	}
	if _, err := fw.Write(data); err != nil {
		return "", err
	}
	if err := mw.Close(); err != nil {
		return "", err
	}
	u := fmt.Sprintf("%s/%s/message_attachments", graphBase, url.PathEscape(c.BusinessID))
	req, err := http.NewRequest(http.MethodPost, u, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("error subiendo adjunto IG: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("instagram upload status %d: %s", resp.StatusCode, b)
	}
	var out struct {
		AttachmentID string `json:"attachment_id"`
	}
	if err := json.Unmarshal(b, &out); err != nil || out.AttachmentID == "" {
		return "", fmt.Errorf("instagram upload sin attachment_id: %s", b)
	}
	return out.AttachmentID, nil
}

// SendMedia envía un adjunto a un IGSID: sube los bytes (attachment_id) y luego
// manda el mensaje con ese id. Solo dentro de la ventana de 24h.
func (c *Client) SendMedia(recipientIGSID, mime, filename string, data []byte) (*SendResult, error) {
	attType := AttachmentTypeForMime(mime)
	attID, err := c.uploadAttachment(attType, mime, filename, data)
	if err != nil {
		return nil, err
	}
	payload := map[string]interface{}{
		"recipient": map[string]string{"id": recipientIGSID},
		"message": map[string]interface{}{
			"attachment": map[string]interface{}{
				"type":    attType,
				"payload": map[string]string{"attachment_id": attID},
			},
		},
	}
	body, _ := json.Marshal(payload)
	u := fmt.Sprintf("%s/%s/messages", graphBase, url.PathEscape(c.BusinessID))
	req, err := http.NewRequest(http.MethodPost, u, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error enviando adjunto de Instagram: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("instagram send-media status %d: %s", resp.StatusCode, b)
	}
	var out SendResult
	_ = json.Unmarshal(b, &out)
	return &out, nil
}

// DownloadMedia baja los bytes de una URL de adjunto de Instagram (CDN temporal
// de Meta; es pre-firmada, no lleva token). Devuelve bytes + Content-Type. Corta
// en maxBytes (devuelve error si lo supera).
func (c *Client) DownloadMedia(mediaURL string, maxBytes int64) ([]byte, string, error) {
	req, err := http.NewRequest(http.MethodGet, mediaURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("error descargando media IG: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download IG status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > maxBytes {
		return nil, "", fmt.Errorf("adjunto IG excede %d bytes", maxBytes)
	}
	return data, resp.Header.Get("Content-Type"), nil
}

// GetUsername resuelve el @usuario (o el nombre) de un IGSID que nos escribió.
// Devuelve "" si no se puede resolver — nunca rompe el flujo de inbound.
func (c *Client) GetUsername(igsid string) string {
	u := fmt.Sprintf("%s/%s?fields=username,name", graphBase, url.PathEscape(igsid))
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var out struct {
		Username string `json:"username"`
		Name     string `json:"name"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return ""
	}
	// Preferimos el nombre de perfil (display name) por ser más reconocible;
	// si no está, caemos al @usuario.
	if out.Name != "" {
		return out.Name
	}
	if out.Username != "" {
		return "@" + out.Username
	}
	return ""
}
