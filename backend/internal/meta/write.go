package meta

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// ============================================================================
// Meta Ads — operaciones de ESCRITURA (gestión de campañas)
// ----------------------------------------------------------------------------
// Pausar/activar y ajustar presupuesto vía Graph API directa (mismo token y
// httpClient que la lectura). Requiere que el token tenga permiso
// `ads_management` (la lectura solo necesita `ads_read`).
//
// Los parámetros van en la query string del POST, que la Graph API siempre
// acepta. Para identificar un objeto basta su ID (no se necesita el ad account).
// ============================================================================

// UpdateCampaignStatus pausa o activa una campaña (status = "PAUSED" | "ACTIVE").
func (c *Client) UpdateCampaignStatus(campaignID, status string) error {
	q := url.Values{}
	q.Set("status", status)
	q.Set("access_token", c.accessToken)
	endpoint := fmt.Sprintf("%s/%s?%s", graphAPIBaseURL, campaignID, q.Encode())
	return c.postGraph(endpoint, "actualizar estado de la campaña")
}

// UpdateCampaignDailyBudget fija el presupuesto diario de una campaña (CBO).
//
// IMPORTANTE: Meta espera el monto en la "unidad mínima" de la divisa de la
// cuenta. El CLP NO tiene decimales, así que el presupuesto en pesos se envía
// TAL CUAL (sin multiplicar por 100). Esto evita el bug histórico de la
// integración vía Composio, que multiplicaba los presupuestos por 100.
func (c *Client) UpdateCampaignDailyBudget(campaignID string, dailyBudgetCLP int64) error {
	q := url.Values{}
	q.Set("daily_budget", fmt.Sprintf("%d", dailyBudgetCLP))
	q.Set("access_token", c.accessToken)
	endpoint := fmt.Sprintf("%s/%s?%s", graphAPIBaseURL, campaignID, q.Encode())
	return c.postGraph(endpoint, "actualizar presupuesto de la campaña")
}

// postGraph hace un POST a la Graph API y valida la respuesta. Devuelve un error
// con el cuerpo crudo de Meta si el status no es 2xx (útil para diagnosticar
// permisos faltantes, presupuesto inválido, etc.).
func (c *Client) postGraph(endpoint, accion string) error {
	req, err := http.NewRequest(http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("error creando request (%s): %w", accion, err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error al %s: %w", accion, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("Meta API al %s (status %d): %s", accion, resp.StatusCode, body)
	}
	return nil
}
