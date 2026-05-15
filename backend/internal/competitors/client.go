package competitors

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client handles communication with the Django competitors API
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new competitors API client
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// CompetitorsSummary represents the response from /api/competitors-summary/
type CompetitorsSummary struct {
	Success    bool                 `json:"success"`
	Competitors []CompetitorInfo    `json:"competitors"`
	AremkoPrecio map[string]interface{} `json:"aremko_precio_referencia"`
	GeneratedAt string               `json:"generated_at"`
}

// CompetitorInfo represents competitor data from Django
type CompetitorInfo struct {
	ID             int                    `json:"id"`
	Nombre         string                 `json:"nombre"`
	Website        string                 `json:"website"`
	Snapshot       *SnapshotInfo          `json:"snapshot"`
	SocialMedia    *SocialMediaInfo       `json:"social_media"`
}

// SnapshotInfo represents a competitor snapshot
type SnapshotInfo struct {
	FechaCaptura        string                 `json:"fecha_captura"`
	PrecioEntradaAdulto *float64               `json:"precio_entrada_adulto"`
	PrecioEntradaNino   *float64               `json:"precio_entrada_nino"`
	Servicios           ServiciosInfo          `json:"servicios"`
	Horario             string                 `json:"horario"`
	Promociones         string                 `json:"promociones"`
	MetaDescription     string                 `json:"meta_description"`
}

// ServiciosInfo represents services offered
type ServiciosInfo struct {
	PiscinasTermales bool `json:"piscinas_termales"`
	Masajes          bool `json:"masajes"`
	Restaurant       bool `json:"restaurant"`
	Alojamiento      bool `json:"alojamiento"`
}

// SocialMediaInfo represents social media metrics
type SocialMediaInfo struct {
	FechaCaptura        string   `json:"fecha_captura"`
	FacebookSeguidores  *int     `json:"facebook_seguidores"`
	InstagramSeguidores *int     `json:"instagram_seguidores"`
	InstagramPosts      *int     `json:"instagram_posts"`
	EngagementRate      *float64 `json:"engagement_rate"`
	PostsUltimaSemana   *int     `json:"posts_ultima_semana"`
}

// GetCompetitorsSummary fetches competitors summary from Django
func (c *Client) GetCompetitorsSummary() (*CompetitorsSummary, error) {
	url := fmt.Sprintf("%s/ventas/api/competitors-summary/", c.BaseURL)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching competitors summary: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var summary CompetitorsSummary
	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !summary.Success {
		return nil, fmt.Errorf("API returned success=false")
	}

	return &summary, nil
}
