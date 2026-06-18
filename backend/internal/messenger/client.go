// Package messenger habla con la Graph API de Facebook (graph.facebook.com)
// para enviar mensajes por Messenger y resolver el perfil de quien escribe
// (User Profile API), usando el Page Access Token de la Página de Aremko.
// Espeja el patrón del cliente de Instagram (internal/instagram).
package messenger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const graphBase = "https://graph.facebook.com/v21.0"

type Client struct {
	PageToken  string // Page Access Token de la Página de Aremko
	PageID     string // ID de la Página (para el endpoint de envío)
	HTTPClient *http.Client
}

func NewClient(pageToken, pageID string) *Client {
	return &Client{
		PageToken:  pageToken,
		PageID:     pageID,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type SendResult struct {
	RecipientID string `json:"recipient_id"`
	MessageID   string `json:"message_id"`
}

// SendMessage envía un mensaje de texto a un PSID por Messenger. Solo funciona
// dentro de la ventana de 24h desde el último mensaje del cliente (messaging_type
// RESPONSE); fuera de eso Meta devuelve error, que se propaga tal cual.
func (c *Client) SendMessage(recipientPSID, text string) (*SendResult, error) {
	payload := map[string]interface{}{
		"messaging_type": "RESPONSE",
		"recipient":      map[string]string{"id": recipientPSID},
		"message":        map[string]string{"text": text},
	}
	body, _ := json.Marshal(payload)
	u := fmt.Sprintf("%s/%s/messages?access_token=%s",
		graphBase, url.PathEscape(c.PageID), url.QueryEscape(c.PageToken))
	req, err := http.NewRequest(http.MethodPost, u, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error enviando mensaje de Messenger: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("messenger send status %d: %s", resp.StatusCode, b)
	}
	var out SendResult
	_ = json.Unmarshal(b, &out)
	return &out, nil
}

// DownloadMedia baja los bytes de una URL de adjunto de Messenger (CDN de Meta;
// la URL del payload es accesible sin token). Devuelve bytes + Content-Type.
// Corta en maxBytes (devuelve error si lo supera).
func (c *Client) DownloadMedia(mediaURL string, maxBytes int64) ([]byte, string, error) {
	req, err := http.NewRequest(http.MethodGet, mediaURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("error descargando media Messenger: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download Messenger status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > maxBytes {
		return nil, "", fmt.Errorf("adjunto Messenger excede %d bytes", maxBytes)
	}
	return data, resp.Header.Get("Content-Type"), nil
}

// GetName resuelve el nombre de un PSID que nos escribió por Messenger (User
// Profile API: GET /{PSID}?fields=first_name,last_name). Devuelve "" si no se
// puede resolver — nunca rompe el flujo de inbound. NOTA: en modo desarrollo
// (sin Acceso Avanzado de pages_messaging) Meta responde 400 code 100 subcode 33
// para clientes sin rol en la app → queda "" y Django usa el fallback. Se
// destraba con App Review.
func (c *Client) GetName(psid string) string {
	if c.PageToken == "" || psid == "" {
		return ""
	}
	u := fmt.Sprintf("%s/%s?fields=first_name,last_name&access_token=%s",
		graphBase, url.PathEscape(psid), url.QueryEscape(c.PageToken))
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return ""
	}
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
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return ""
	}
	return strings.TrimSpace(out.FirstName + " " + out.LastName)
}
