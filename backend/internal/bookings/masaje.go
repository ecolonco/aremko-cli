package bookings

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

// ============================================================================
// Bandeja de salida "Conexión-Masajes"
// ----------------------------------------------------------------------------
// Proxy crudo hacia los endpoints de Django (/api/masaje/outbox/...). A
// diferencia de otros métodos del cliente, estos PRESERVAN el status code y el
// body de Django para que el handler los reenvíe tal cual al frontend: la
// bandeja necesita distinguir 409 (ya no está pendiente), 422 (envío falló /
// cliente dado de baja), 401 y 404 con su mensaje original.
// ============================================================================

// masajeProxy ejecuta una request a Django con la X-API-Key y devuelve el body
// crudo, el status code y el Content-Type de la respuesta.
func (c *Client) masajeProxy(method, path, apiKey string, body []byte) (respBody []byte, status int, contentType string, err error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, c.BaseURL+path, reader)
	if err != nil {
		return nil, 0, "", err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("X-API-Key", apiKey)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, 0, "", fmt.Errorf("error en %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return b, resp.StatusCode, resp.Header.Get("Content-Type"), nil
}

// MasajeOutboxList lista la bandeja de salida (para_enviar + programados).
func (c *Client) MasajeOutboxList(apiKey string, incluirProgramados bool, limit int) ([]byte, int, error) {
	ip := "1"
	if !incluirProgramados {
		ip = "0"
	}
	if limit <= 0 {
		limit = 200
	}
	path := fmt.Sprintf("/api/masaje/outbox/?incluir_programados=%s&limit=%d", ip, limit)
	b, st, _, err := c.masajeProxy(http.MethodGet, path, apiKey, nil)
	return b, st, err
}

// MasajeOutboxPreview devuelve el HTML del email tal cual lo recibirá el cliente.
func (c *Client) MasajeOutboxPreview(apiKey string, id int) ([]byte, int, string, error) {
	path := fmt.Sprintf("/api/masaje/outbox/%d/preview/", id)
	return c.masajeProxy(http.MethodGet, path, apiKey, nil)
}

// MasajeOutboxPatch edita asunto/cuerpo de un seguimiento (solo si pendiente).
func (c *Client) MasajeOutboxPatch(apiKey string, id int, payload []byte) ([]byte, int, error) {
	path := fmt.Sprintf("/api/masaje/outbox/%d/", id)
	b, st, _, err := c.masajeProxy(http.MethodPatch, path, apiKey, payload)
	return b, st, err
}

// MasajeOutboxAction ejecuta "send" o "cancel" sobre un seguimiento.
func (c *Client) MasajeOutboxAction(apiKey string, id int, action string, payload []byte) ([]byte, int, error) {
	path := fmt.Sprintf("/api/masaje/outbox/%d/%s/", id, action)
	b, st, _, err := c.masajeProxy(http.MethodPost, path, apiKey, payload)
	return b, st, err
}
