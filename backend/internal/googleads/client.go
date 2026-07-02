// Package googleads provides a thin REST client for Google Ads API using
// OAuth2 refresh token authentication. No official Go SDK exists for Google
// Ads, so we talk to the REST endpoint googleads.googleapis.com directly with
// GAQL (Google Ads Query Language).
//
// Auth flow:
//   1. ClientID + ClientSecret + RefreshToken → oauth2.TokenSource
//   2. Every request signs Authorization: Bearer <access_token>
//   3. Also adds developer-token + login-customer-id headers
//
// Costs come from Google in micros (CLP × 1_000_000). All helper methods on
// the returned structs convert to plain CLP via *Micros / 1e6.
package googleads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"golang.org/x/oauth2"
)

const (
	apiBaseURL = "https://googleads.googleapis.com/v21"
	tokenURL   = "https://oauth2.googleapis.com/token"
)

// Client habla con Google Ads API REST en nombre de una cuenta (customer_id).
type Client struct {
	developerToken   string
	customerID       string // sin guiones, ej "5399055633"
	loginCustomerID  string // ID del MCC si la cuenta está administrada
	tokenSource      oauth2.TokenSource
	httpClient       *http.Client
}

// Config requerida para construir el cliente. Todas las strings vienen de
// variables de entorno; ver internal/config/config.go.
type Config struct {
	DeveloperToken  string
	ClientID        string
	ClientSecret    string
	RefreshToken    string
	CustomerID      string
	LoginCustomerID string
}

// NewClient construye el cliente y prepara el OAuth2 token source. No falla
// si el refresh todavía no se ejecutó — eso ocurre lazily en el primer request.
func NewClient(cfg Config) (*Client, error) {
	if cfg.DeveloperToken == "" || cfg.ClientID == "" || cfg.RefreshToken == "" || cfg.CustomerID == "" {
		return nil, fmt.Errorf("googleads: missing required config (developer_token / client_id / refresh_token / customer_id)")
	}
	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		Endpoint: oauth2.Endpoint{
			TokenURL: tokenURL,
		},
		Scopes: []string{"https://www.googleapis.com/auth/adwords"},
	}
	tok := &oauth2.Token{RefreshToken: cfg.RefreshToken}
	ts := oauthCfg.TokenSource(context.Background(), tok)

	return &Client{
		developerToken:  cfg.DeveloperToken,
		customerID:      cfg.CustomerID,
		loginCustomerID: cfg.LoginCustomerID,
		tokenSource:     ts,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// searchStream ejecuta una query GAQL y devuelve las rows raw (sin parsing).
// El caller deserializa según los fields que pidió.
func (c *Client) searchStream(ctx context.Context, gaql string) ([]json.RawMessage, error) {
	tok, err := c.tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("googleads: token refresh failed: %w", err)
	}

	url := fmt.Sprintf("%s/customers/%s/googleAds:searchStream", apiBaseURL, c.customerID)
	body, _ := json.Marshal(map[string]string{"query": gaql})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("developer-token", c.developerToken)
	req.Header.Set("Content-Type", "application/json")
	if c.loginCustomerID != "" {
		req.Header.Set("login-customer-id", c.loginCustomerID)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("googleads: request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("googleads: status %d: %s", resp.StatusCode, string(respBody))
	}

	// searchStream devuelve un array de páginas, cada una con {results: [...]}
	var pages []struct {
		Results []json.RawMessage `json:"results"`
	}
	if err := json.Unmarshal(respBody, &pages); err != nil {
		return nil, fmt.Errorf("googleads: decode failed: %w (raw=%s)", err, truncate(string(respBody), 300))
	}
	var rows []json.RawMessage
	for _, p := range pages {
		rows = append(rows, p.Results...)
	}
	return rows, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ─── Tipos de respuesta y métricas ─────────────────────────────────────────

// CampaignInsights agrega métricas de una campaña en un rango.
type CampaignInsights struct {
	CampaignID         string  `json:"campaign_id"`
	CampaignName       string  `json:"campaign_name"`
	Status             string  `json:"status"`
	Impressions        int64   `json:"impressions"`
	Clicks             int64   `json:"clicks"`
	CostCLP            float64 `json:"cost_clp"`
	Conversions        float64 `json:"conversions"`
	ConversionsValue   float64 `json:"conversions_value"`
	CTR                float64 `json:"ctr"`
	AvgCPC             float64 `json:"avg_cpc"`
	CPL                float64 `json:"cpl"`
	ConversionRate     float64 `json:"conversion_rate"`
	SearchImprShare    float64 `json:"search_impression_share"`
	BudgetTotalCLP     float64 `json:"budget_total_clp"`
	BudgetPctUsed      float64 `json:"budget_pct_used"`
	StartDate          string  `json:"start_date"`
	EndDate            string  `json:"end_date"`
}

// SearchTerm representa un término de búsqueda real que disparó anuncios.
// Es información exclusiva de Google que Meta no entrega.
type SearchTerm struct {
	Term            string  `json:"term"`
	MatchType       string  `json:"match_type"`
	Impressions     int64   `json:"impressions"`
	Clicks          int64   `json:"clicks"`
	CostCLP         float64 `json:"cost_clp"`
	Conversions     float64 `json:"conversions"`
	CTR             float64 `json:"ctr"`
	AvgCPC          float64 `json:"avg_cpc"`
	CPL             float64 `json:"cpl"`
	Status          string  `json:"status"` // ADDED / EXCLUDED / NONE
}

// KeywordQS describe el quality score de una keyword. Es métrica única de
// Google y afecta directamente el CPC efectivo.
type KeywordQS struct {
	KeywordText      string `json:"keyword_text"`
	MatchType        string `json:"match_type"`
	AdGroupName      string `json:"ad_group_name"`
	QualityScore     int    `json:"quality_score"`
	ExpectedCTR      string `json:"expected_ctr"`      // ABOVE_AVERAGE | AVERAGE | BELOW_AVERAGE
	AdRelevance      string `json:"ad_relevance"`
	LandingPageExp   string `json:"landing_page_experience"`
}

// ─── Helpers de parseo ─────────────────────────────────────────────────────

func microsToCLP(micros int64) float64 {
	return float64(micros) / 1_000_000.0
}

func parseInt64FromString(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

func parseFloatFromString(s string) float64 {
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

// row es la forma genérica de cada row del REST: { campaign: {...},
// metrics: {...}, segments: {...}, ad_group_criterion: {...}, ... }
type row struct {
	Campaign struct {
		ID            json.RawMessage `json:"id"`
		Name          string          `json:"name"`
		Status        string          `json:"status"`
		StartDate     string          `json:"startDate"`
		EndDate       string          `json:"endDate"`
		AdvertisingChannelType string `json:"advertisingChannelType"`
	} `json:"campaign"`
	Metrics struct {
		Impressions                  json.Number `json:"impressions"`
		Clicks                       json.Number `json:"clicks"`
		CostMicros                   json.Number `json:"costMicros"`
		Conversions                  json.Number `json:"conversions"`
		ConversionsValue             json.Number `json:"conversionsValue"`
		CTR                          json.Number `json:"ctr"`
		AverageCpc                   json.Number `json:"averageCpc"`
		CostPerConversion            json.Number `json:"costPerConversion"`
		SearchImpressionShare        json.Number `json:"searchImpressionShare"`
	} `json:"metrics"`
	SearchTermView struct {
		SearchTerm string `json:"searchTerm"`
		Status     string `json:"status"`
	} `json:"searchTermView"`
	Segments struct {
		SearchTermMatchType string `json:"searchTermMatchType"`
		Date                string `json:"date"`
	} `json:"segments"`
	AdGroupCriterion struct {
		Keyword struct {
			Text      string `json:"text"`
			MatchType string `json:"matchType"`
		} `json:"keyword"`
		QualityInfo struct {
			QualityScore           int    `json:"qualityScore"`
			CreativeQualityScore   string `json:"creativeQualityScore"`
			PostClickQualityScore  string `json:"postClickQualityScore"`
			SearchPredictedCtr     string `json:"searchPredictedCtr"`
		} `json:"qualityInfo"`
	} `json:"adGroupCriterion"`
	AdGroup struct {
		Name string `json:"name"`
	} `json:"adGroup"`
}

// extractCampaignID resuelve campaign.id que puede venir como string o number.
func (r *row) campaignIDString() string {
	s := string(r.Campaign.ID)
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}
