// Package messenger habla con la Graph API de Facebook (graph.facebook.com)
// para resolver el perfil de quien escribe por Messenger (User Profile API).
// Usa el Page Access Token de la Página de Aremko. Espeja el patrón del cliente
// de Instagram (internal/instagram), pero por ahora SOLO resuelve nombre — el
// envío de DMs llega en una fase posterior.
package messenger

import (
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
	HTTPClient *http.Client
}

func NewClient(pageToken string) *Client {
	return &Client{
		PageToken:  pageToken,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetName resuelve el nombre de un PSID que nos escribió por Messenger (User
// Profile API: GET /{PSID}?fields=first_name,last_name). Devuelve "" si no se
// puede resolver — nunca rompe el flujo de inbound (perfiles privados o sin
// Acceso Avanzado pueden no exponer el nombre). Se piden solo first_name/last_name
// (campos documentados del perfil de usuario de Messenger) para evitar que un
// campo inválido tumbe toda la respuesta con un 400.
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
