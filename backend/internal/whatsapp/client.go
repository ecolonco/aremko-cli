// Package whatsapp habla con la WhatsApp Cloud API (parte de la Graph API de
// Meta). Mismo patrón que internal/meta: token + ID de número + http.Client.
//
// Piloto (inbound Refugio): el envío se usa para responder DENTRO de la ventana
// de servicio de 24h (gratis). El envío de plantillas (marketing/utility) queda
// listo para la fase saliente de la bandeja de Deborah.
package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// graphAPIBaseURL — misma versión que internal/meta para mantener consistencia.
const graphAPIBaseURL = "https://graph.facebook.com/v21.0"

// Client envía mensajes a través del número de WhatsApp Business conectado.
type Client struct {
	accessToken   string
	phoneNumberID string
	httpClient    *http.Client
}

// NewClient crea un cliente de WhatsApp Cloud API.
func NewClient(accessToken, phoneNumberID string) *Client {
	return &Client{
		accessToken:   accessToken,
		phoneNumberID: phoneNumberID,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
	}
}

// SendResult es la respuesta mínima de Cloud API al enviar un mensaje.
type SendResult struct {
	MessageID string                 // id del mensaje (wamid...) para rastrear estados
	Raw       map[string]interface{} // respuesta cruda por si se necesita más detalle
}

// SendSessionMessage envía texto libre. SOLO válido dentro de la ventana de
// servicio de 24h (el cliente escribió primero). Fuera de la ventana Meta lo
// rechaza y hay que usar SendTemplate.
func (c *Client) SendSessionMessage(to, body string) (*SendResult, error) {
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "text",
		"text":              map[string]interface{}{"body": body},
	}
	return c.send(payload)
}

// SendTemplate envía un mensaje de plantilla aprobada en Meta (marketing /
// utility). components rellena las variables ({{1}}, {{2}}...); puede ser nil.
func (c *Client) SendTemplate(to, templateName, langCode string, components []interface{}) (*SendResult, error) {
	tmpl := map[string]interface{}{
		"name":     templateName,
		"language": map[string]interface{}{"code": langCode},
	}
	if len(components) > 0 {
		tmpl["components"] = components
	}
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "template",
		"template":          tmpl,
	}
	return c.send(payload)
}

func (c *Client) send(payload map[string]interface{}) (*SendResult, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("error serializando payload: %w", err)
	}

	url := fmt.Sprintf("%s/%s/messages", graphAPIBaseURL, c.phoneNumberID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("error creando request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error enviando mensaje WhatsApp: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("WhatsApp API status %d: %s", resp.StatusCode, raw)
	}

	var parsed map[string]interface{}
	_ = json.Unmarshal(raw, &parsed)

	res := &SendResult{Raw: parsed}
	// El id viene en messages[0].id
	if msgs, ok := parsed["messages"].([]interface{}); ok && len(msgs) > 0 {
		if m0, ok := msgs[0].(map[string]interface{}); ok {
			if id, ok := m0["id"].(string); ok {
				res.MessageID = id
			}
		}
	}
	return res, nil
}
