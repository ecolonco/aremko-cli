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

// AdInsights representa las métricas de una campaña
type AdInsights struct {
	CampaignID   string  `json:"campaign_id"`
	CampaignName string  `json:"campaign_name"`
	Impressions  int64   `json:"impressions,string"`
	Clicks       int64   `json:"clicks,string"`
	Spend        float64 `json:"spend,string"`
	Reach        int64   `json:"reach,string"`
	DateStart    string  `json:"date_start"`
	DateStop     string  `json:"date_stop"`
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
	url := fmt.Sprintf("%s/%s/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach&time_range={\"since\":\"%s\",\"until\":\"%s\"}&access_token=%s",
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
	url := fmt.Sprintf("%s/%s/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach&time_range={\"since\":\"%s\",\"until\":\"%s\"}&level=campaign&access_token=%s",
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
