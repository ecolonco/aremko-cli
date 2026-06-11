// Package email envía correos vía la API v3 de SendGrid con un POST HTTPS
// simple, sin SDK externo (evita sumar dependencias al go.mod). Lo usa el
// reporte diario de gestión; si más adelante hay otros envíos desde el backend
// Go, este cliente se reutiliza.
package email

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const sendGridURL = "https://api.sendgrid.com/v3/mail/send"

// Attachment es un archivo adjunto (ej. el informe completo en HTML).
type Attachment struct {
	Filename string
	MIMEType string
	Content  []byte
}

// Client envía correos por SendGrid.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SendHTML manda un correo HTML a varios destinatarios (cada uno en su propio
// "to" para no exponer la lista entre ellos no aplica acá: van en personalizations
// separadas para que cada quien reciba su copia). Devuelve error si SendGrid no
// responde 2xx.
func (c *Client) SendHTML(fromEmail, fromName, subject, htmlBody string, to []string, attachments []Attachment) error {
	if c.apiKey == "" {
		return fmt.Errorf("SENDGRID_API_KEY no configurada")
	}
	if len(to) == 0 {
		return fmt.Errorf("sin destinatarios")
	}

	// Una personalization por destinatario → cada uno recibe su propia copia
	// y no ve las direcciones de los demás.
	personalizations := make([]map[string]interface{}, 0, len(to))
	for _, addr := range to {
		personalizations = append(personalizations, map[string]interface{}{
			"to": []map[string]string{{"email": addr}},
		})
	}

	payload := map[string]interface{}{
		"personalizations": personalizations,
		"from":             map[string]string{"email": fromEmail, "name": fromName},
		"subject":          subject,
		"content": []map[string]string{
			{"type": "text/html", "value": htmlBody},
		},
	}

	if len(attachments) > 0 {
		atts := make([]map[string]string, 0, len(attachments))
		for _, a := range attachments {
			atts = append(atts, map[string]string{
				"content":     base64.StdEncoding.EncodeToString(a.Content),
				"filename":    a.Filename,
				"type":        a.MIMEType,
				"disposition": "attachment",
			})
		}
		payload["attachments"] = atts
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("error al serializar correo: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, sendGridURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error al llamar a SendGrid: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("SendGrid respondió %d: %s", resp.StatusCode, string(b))
	}
	return nil
}
