package meta

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	graphAPIBaseURL = "https://graph.facebook.com/v21.0"
)

type Client struct {
	accessToken string
	adAccountID string
	httpClient  *http.Client
}

// NewClient crea un nuevo cliente de Meta Ads API
func NewClient(accessToken, adAccountID string) *Client {
	return &Client{
		accessToken: accessToken,
		adAccountID: adAccountID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Campaign representa una campaña de Meta Ads
type Campaign struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// AdAction representa una acción/conversión devuelta por Meta en el array actions[]
type AdAction struct {
	ActionType string `json:"action_type"`
	Value      string `json:"value"`
}

// AdInsights representa las métricas de una campaña, adset o ad
type AdInsights struct {
	CampaignID   string     `json:"campaign_id,omitempty"`
	CampaignName string     `json:"campaign_name,omitempty"`
	AdsetID      string     `json:"adset_id,omitempty"`
	AdsetName    string     `json:"adset_name,omitempty"`
	AdID         string     `json:"ad_id,omitempty"`
	AdName       string     `json:"ad_name,omitempty"`
	Impressions  int64      `json:"impressions,string"`
	Clicks       int64      `json:"clicks,string"`
	Spend        float64    `json:"spend,string"`
	Reach        int64      `json:"reach,string"`
	Frequency    float64    `json:"frequency,string"`
	Actions      []AdAction `json:"actions,omitempty"`
	DateStart    string     `json:"date_start"`
	DateStop     string     `json:"date_stop"`
}

// Leads suma todas las acciones de tipo lead devueltas por Meta.
// Meta puede usar "lead" o "offsite_conversion.fb_pixel_lead" dependiendo del setup.
func (i *AdInsights) Leads() int64 {
	var total int64
	for _, a := range i.Actions {
		if a.ActionType == "lead" || a.ActionType == "offsite_conversion.fb_pixel_lead" {
			var v int64
			_, _ = fmt.Sscanf(a.Value, "%d", &v)
			total += v
		}
	}
	return total
}

// CPL calcula el Costo Por Lead. Retorna 0 si no hay leads.
func (i *AdInsights) CPL() float64 {
	leads := i.Leads()
	if leads == 0 {
		return 0
	}
	return i.Spend / float64(leads)
}

// GetCampaigns obtiene todas las campañas de la cuenta
func (c *Client) GetCampaigns() ([]Campaign, error) {
	url := fmt.Sprintf("%s/%s/campaigns?fields=id,name,status&access_token=%s",
		graphAPIBaseURL, c.adAccountID, c.accessToken)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error al obtener campañas: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("error de Meta API (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		Data []Campaign `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error al decodificar respuesta: %w", err)
	}

	return result.Data, nil
}

// GetCampaignInsights obtiene las métricas de una campaña en un rango de fechas
func (c *Client) GetCampaignInsights(campaignID, dateStart, dateStop string) (*AdInsights, error) {
	url := fmt.Sprintf("%s/%s/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach,frequency,actions&time_range={\"since\":\"%s\",\"until\":\"%s\"}&access_token=%s",
		graphAPIBaseURL, campaignID, dateStart, dateStop, c.accessToken)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error al obtener insights: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("error de Meta API (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		Data []AdInsights `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error al decodificar insights: %w", err)
	}

	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no hay datos disponibles para el período especificado")
	}

	insights := result.Data[0]
	insights.DateStart = dateStart
	insights.DateStop = dateStop

	return &insights, nil
}

// GetAccountInsights obtiene las métricas agregadas de toda la cuenta
func (c *Client) GetAccountInsights(dateStart, dateStop string) ([]AdInsights, error) {
	url := fmt.Sprintf("%s/%s/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach,frequency,actions&time_range={\"since\":\"%s\",\"until\":\"%s\"}&level=campaign&access_token=%s",
		graphAPIBaseURL, c.adAccountID, dateStart, dateStop, c.accessToken)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error al obtener insights de cuenta: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("error de Meta API (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		Data []AdInsights `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error al decodificar insights: %w", err)
	}

	// Añadir las fechas a cada insight
	for i := range result.Data {
		result.Data[i].DateStart = dateStart
		result.Data[i].DateStop = dateStop
	}

	return result.Data, nil
}

// AdAccountID devuelve el ID de la cuenta publicitaria asociada al cliente.
func (c *Client) AdAccountID() string {
	return c.adAccountID
}

// GetCampaignAccountID resuelve a qué ad account pertenece realmente una
// campaña. Necesario porque /{campaign_id}/insights responde OK desde
// cualquier cuenta del token, sin importar el dueño real.
//
// Devuelve el ID con prefijo "act_" (formato consistente con el resto del API).
func (c *Client) GetCampaignAccountID(campaignID string) (string, error) {
	url := fmt.Sprintf("%s/%s?fields=account_id&access_token=%s",
		graphAPIBaseURL, campaignID, c.accessToken)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return "", fmt.Errorf("error consultando dueño de campaña: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("error de Meta API (status %d): %s", resp.StatusCode, body)
	}
	var result struct {
		AccountID string `json:"account_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("error decodificando dueño: %w", err)
	}
	if result.AccountID == "" {
		return "", fmt.Errorf("respuesta sin account_id")
	}
	// Meta devuelve account_id SIN el prefijo "act_". Lo agregamos para mantener
	// consistencia con MetaAccount.ID (que sí lo lleva).
	return "act_" + result.AccountID, nil
}

// GetCampaignInsightsByAdset retorna insights de una campaña desglosados por adset.
func (c *Client) GetCampaignInsightsByAdset(campaignID, dateStart, dateStop string) ([]AdInsights, error) {
	url := fmt.Sprintf("%s/%s/insights?level=adset&fields=adset_id,adset_name,impressions,clicks,spend,reach,frequency,actions&time_range={\"since\":\"%s\",\"until\":\"%s\"}&access_token=%s",
		graphAPIBaseURL, campaignID, dateStart, dateStop, c.accessToken)
	return c.fetchInsights(url, dateStart, dateStop)
}

// GetCampaignInsightsByAd retorna insights de una campaña desglosados por ad individual.
func (c *Client) GetCampaignInsightsByAd(campaignID, dateStart, dateStop string) ([]AdInsights, error) {
	url := fmt.Sprintf("%s/%s/insights?level=ad&fields=ad_id,ad_name,adset_id,adset_name,impressions,clicks,spend,reach,frequency,actions&time_range={\"since\":\"%s\",\"until\":\"%s\"}&access_token=%s",
		graphAPIBaseURL, campaignID, dateStart, dateStop, c.accessToken)
	return c.fetchInsights(url, dateStart, dateStop)
}

func (c *Client) fetchInsights(url, dateStart, dateStop string) ([]AdInsights, error) {
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error al obtener insights: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("error de Meta API (status %d): %s", resp.StatusCode, body)
	}

	var result struct {
		Data []AdInsights `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("error al decodificar insights: %w", err)
	}
	for i := range result.Data {
		result.Data[i].DateStart = dateStart
		result.Data[i].DateStop = dateStop
	}
	return result.Data, nil
}

// CalculateCTR calcula el Click-Through Rate
func (i *AdInsights) CalculateCTR() float64 {
	if i.Impressions == 0 {
		return 0
	}
	return (float64(i.Clicks) / float64(i.Impressions)) * 100
}

// CalculateCPC calcula el Cost Per Click
func (i *AdInsights) CalculateCPC() float64 {
	if i.Clicks == 0 {
		return 0
	}
	return i.Spend / float64(i.Clicks)
}

// CalculateCPM calcula el Cost Per Mille (1000 impresiones)
func (i *AdInsights) CalculateCPM() float64 {
	if i.Impressions == 0 {
		return 0
	}
	return (i.Spend / float64(i.Impressions)) * 1000
}
