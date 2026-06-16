// Package instagram habla con la API de Instagram (ruta "Instagram Login",
// graph.instagram.com) para enviar DMs y resolver el perfil de quien escribe.
// Espeja el patrón del cliente de WhatsApp (internal/whatsapp).
package instagram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
