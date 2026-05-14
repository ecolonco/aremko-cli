package reviews

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client handles communication with the Django reviews API
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new reviews API client
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// ReviewsSummary represents the complete reviews summary response
type ReviewsSummary struct {
	Success bool         `json:"success"`
	Period  Period       `json:"periodo"`
	Surveys SurveyData   `json:"encuestas_satisfaccion"`
	Snapshots *SnapshotData `json:"snapshots,omitempty"`
	Recent  []Review     `json:"reviews_recientes"`
}

// Period represents a date range
type Period struct {
	Start string `json:"fecha_inicio"`
	End   string `json:"fecha_fin"`
}

// SurveyData represents satisfaction survey aggregated data
type SurveyData struct {
	Total       int                    `json:"total"`
	NPS         NPSData                `json:"nps"`
	Ratings     map[string]float64     `json:"calificaciones_promedio"`
	Featured    []FeaturedReview       `json:"reviews_destacadas"`
}

// NPSData represents Net Promoter Score metrics
type NPSData struct {
	Score      *int `json:"score"`
	Promoters  int  `json:"promotores"`
	Passives   int  `json:"pasivos"`
	Detractors int  `json:"detractores"`
}

// FeaturedReview represents a highlighted survey response
type FeaturedReview struct {
	Date       string `json:"fecha"`
	NPSScore   int    `json:"nps_score"`
	Experience int    `json:"experiencia_general"`
	Comment    string `json:"comentario"`
	Author     string `json:"autor"`
}

// SnapshotData represents Google/TripAdvisor snapshots
type SnapshotData struct {
	Date        string         `json:"fecha"`
	Google      PlatformData   `json:"google"`
	TripAdvisor PlatformData   `json:"tripadvisor"`
	Notes       string         `json:"notas"`
}

// PlatformData represents metrics for a review platform
type PlatformData struct {
	Rating      float64 `json:"rating"`
	Total       int     `json:"total"`
	RatingDelta float64 `json:"rating_delta"`
	TotalDelta  int     `json:"total_delta"`
	URL         string  `json:"url"`
}

// Review represents an individual review
type Review struct {
	ID          int     `json:"id"`
	Source      string  `json:"fuente"`
	Date        string  `json:"fecha"`
	Author      string  `json:"autor"`
	Rating      int     `json:"rating"`
	Text        string  `json:"texto"`
	Language    string  `json:"idioma"`
	Sentiment   string  `json:"sentimiento"`
	Responded   bool    `json:"respuesta_publicada"`
	RespondedAt *string `json:"respuesta_publicada_at"`
}

// GetReviewsSummary fetches the comprehensive reviews summary
func (c *Client) GetReviewsSummary() (*ReviewsSummary, error) {
	url := fmt.Sprintf("%s/api/reviews-summary/", c.BaseURL)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching reviews summary: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var summary ReviewsSummary
	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !summary.Success {
		return nil, fmt.Errorf("API returned success=false")
	}

	return &summary, nil
}
