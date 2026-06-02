package bookings

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client handles communication with the Django booking system API
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new bookings API client
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// BookingStats represents aggregated booking statistics
type BookingStats struct {
	Total      int     `json:"total"`
	Revenue    float64 `json:"revenue"`
	AvgTicket  float64 `json:"avg_ticket"`
	Paid       int     `json:"paid"`
	Pending    int     `json:"pending"`
	Partial    int     `json:"partial"`
	Period     Period  `json:"period"`
}

// DailyBooking represents bookings for a single day
type DailyBooking struct {
	Date    string  `json:"date"`
	Count   int     `json:"count"`
	Revenue float64 `json:"revenue"`
}

// ClientStats represents client statistics
type ClientStats struct {
	TotalClients         int    `json:"total_clients"`
	NewClientsWeek       int    `json:"new_clients_week"`
	ReturningClientsWeek int    `json:"returning_clients_week"`
	UniqueClientsWeek    int    `json:"unique_clients_week"`
	Period               Period `json:"period"`
}

// ServiceFamilyStats represents sales by service family with comparative data
type ServiceFamilyStats struct {
	Family               string  `json:"family"`
	CurrentCount         int     `json:"current_count"`
	CurrentRevenue       float64 `json:"current_revenue"`
	PreviousMonthCount   int     `json:"previous_month_count"`
	PreviousMonthRevenue float64 `json:"previous_month_revenue"`
	PreviousYearCount    int     `json:"previous_year_count"`
	PreviousYearRevenue  float64 `json:"previous_year_revenue"`
}

// FamilyStatsMTDPeriod describes the date ranges compared by GetFamilyStatsMTD
type FamilyStatsMTDPeriod struct {
	CurrentStart   string `json:"current_start"`
	CurrentStop    string `json:"current_stop"`
	PrevMonthStart string `json:"prev_month_start"`
	PrevMonthStop  string `json:"prev_month_stop"`
	PrevYearStart  string `json:"prev_year_start"`
	PrevYearStop   string `json:"prev_year_stop"`
}

// FamilyStatsMTD is the response shape from /bookings/by-family-mtd/
type FamilyStatsMTD struct {
	Period   FamilyStatsMTDPeriod `json:"period"`
	Families []ServiceFamilyStats `json:"families"`
}

// PaymentMethodStats represents sales by payment method with comparative data
type PaymentMethodStats struct {
	PaymentMethod        string  `json:"payment_method"`
	CurrentCount         int     `json:"current_count"`
	CurrentRevenue       float64 `json:"current_revenue"`
	PreviousMonthCount   int     `json:"previous_month_count"`
	PreviousMonthRevenue float64 `json:"previous_month_revenue"`
	PreviousYearCount    int     `json:"previous_year_count"`
	PreviousYearRevenue  float64 `json:"previous_year_revenue"`
}

// FamilyBreakdown represents weekly count and revenue for a service family
type FamilyBreakdown struct {
	Count   int     `json:"count"`
	Revenue float64 `json:"revenue"`
}

// WeekData represents one week of the breakdown matrix
type WeekData struct {
	WeekLabel        string                     `json:"week_label"`
	ISOYear          int                        `json:"iso_year"`
	ISOWeek          int                        `json:"iso_week"`
	DateStart        string                     `json:"date_start"`
	DateStop         string                     `json:"date_stop"`
	ByFamily         map[string]FamilyBreakdown `json:"by_family"`
	TotalCount       int                        `json:"total_count"`
	TotalRevenue     float64                    `json:"total_revenue"`
	UniqueClients    int                        `json:"unique_clients"`
	NewClients       int                        `json:"new_clients"`
	ReturningClients int                        `json:"returning_clients"`
}

// BreakdownTotals represents aggregate totals across the period
type BreakdownTotals struct {
	TotalCount             int     `json:"total_count"`
	TotalRevenue           float64 `json:"total_revenue"`
	UniqueClientsPeriod    int     `json:"unique_clients_period"`
	NewClientsPeriod       int     `json:"new_clients_period"`
	ReturningClientsPeriod int     `json:"returning_clients_period"`
}

// BreakdownAverages represents per-week averages
type BreakdownAverages struct {
	TotalCount       float64 `json:"total_count"`
	TotalRevenue     float64 `json:"total_revenue"`
	UniqueClients    float64 `json:"unique_clients"`
	NewClients       float64 `json:"new_clients"`
	ReturningClients float64 `json:"returning_clients"`
}

// BreakdownTrend compares first 4 weeks vs last 4 weeks
type BreakdownTrend struct {
	NewClientsFirst4wAvg       float64 `json:"new_clients_first_4w_avg"`
	NewClientsLast4wAvg        float64 `json:"new_clients_last_4w_avg"`
	ReturningClientsFirst4wAvg float64 `json:"returning_clients_first_4w_avg"`
	ReturningClientsLast4wAvg  float64 `json:"returning_clients_last_4w_avg"`
}

// BreakdownSummary contains aggregate stats for the breakdown
type BreakdownSummary struct {
	WeeksCount      int                `json:"weeks_count"`
	FirstWeekStart  string             `json:"first_week_start"`
	LastWeekStop    string             `json:"last_week_stop"`
	Totals          BreakdownTotals    `json:"totals"`
	AveragesPerWeek BreakdownAverages  `json:"averages_per_week"`
	Trend           BreakdownTrend     `json:"trend"`
}

// WeeklyBreakdown is the response from /bookings/weekly-breakdown/
type WeeklyBreakdown struct {
	Weeks   []WeekData       `json:"weeks"`
	Summary BreakdownSummary `json:"summary"`
}

// Period represents a date range
type Period struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// APIResponse is a generic response wrapper
type APIResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
}

// GetBookingStats fetches booking statistics for a date range
func (c *Client) GetBookingStats(dateStart, dateStop string) (*BookingStats, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/stats/?date_start=%s&date_stop=%s",
		c.BaseURL, dateStart, dateStop)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching booking stats: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var stats BookingStats
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("error parsing booking stats: %w", err)
	}

	return &stats, nil
}

// GetDailyBookings fetches bookings grouped by day
func (c *Client) GetDailyBookings(dateStart, dateStop string) ([]DailyBooking, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/daily/?date_start=%s&date_stop=%s",
		c.BaseURL, dateStart, dateStop)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching daily bookings: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var dailyBookings []DailyBooking
	if err := json.Unmarshal(apiResp.Data, &dailyBookings); err != nil {
		return nil, fmt.Errorf("error parsing daily bookings: %w", err)
	}

	return dailyBookings, nil
}

// GetClientStats fetches client statistics
func (c *Client) GetClientStats() (*ClientStats, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/clients/stats/", c.BaseURL)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching client stats: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var stats ClientStats
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("error parsing client stats: %w", err)
	}

	return &stats, nil
}

// GetServiceFamilyStats fetches sales grouped by service family
func (c *Client) GetServiceFamilyStats(dateStart, dateStop string) ([]ServiceFamilyStats, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/by-family/?date_start=%s&date_stop=%s",
		c.BaseURL, dateStart, dateStop)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching service family stats: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var stats []ServiceFamilyStats
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("error parsing service family stats: %w", err)
	}

	return stats, nil
}

// GetPaymentMethodStats fetches sales grouped by payment method
func (c *Client) GetPaymentMethodStats(dateStart, dateStop string) ([]PaymentMethodStats, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/by-payment-method/?date_start=%s&date_stop=%s",
		c.BaseURL, dateStart, dateStop)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching payment method stats: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var stats []PaymentMethodStats
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("error parsing payment method stats: %w", err)
	}

	return stats, nil
}

// HealthCheck verifies the Django API is accessible
func (c *Client) HealthCheck() (bool, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/health/", c.BaseURL)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return false, fmt.Errorf("error checking health: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp struct {
		Success   bool   `json:"success"`
		Status    string `json:"status"`
		Service   string `json:"service"`
		Version   string `json:"version"`
		Timestamp string `json:"timestamp"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return false, fmt.Errorf("error decoding health response: %w", err)
	}

	return apiResp.Success && apiResp.Status == "healthy", nil
}

// RefugioLeadsSummary es el conteo REAL de leads del formulario Refugio desde la
// BD (tabla ventas_refugiolead) — la fuente de verdad. NO usar fb_pixel_lead de
// Meta (contaminado con reservas de checkout).
type RefugioLeadsSummary struct {
	Total   int            `json:"total"`
	ByCanal map[string]int `json:"by_canal"`
	Desde   string         `json:"desde"`
	Hasta   string         `json:"hasta"`
}

// ============================================================================
// Relay de WhatsApp ⇄ Django (persistencia de conversaciones + bandeja OVC)
// ============================================================================

// WhatsAppInboundReq es el body de POST /api/whatsapp/inbound.
type WhatsAppInboundReq struct {
	WaMessageID string `json:"wa_message_id"`
	From        string `json:"from"`
	Body        string `json:"body"`
	Type        string `json:"type"`
	Timestamp   string `json:"timestamp"` // epoch (seg) o ISO; Django acepta ambos
	ContactName string `json:"contact_name,omitempty"`
}

// WhatsAppOutboundReq es el body de POST /api/whatsapp/outbound.
type WhatsAppOutboundReq struct {
	WaMessageID string `json:"wa_message_id"`
	To          string `json:"to"`
	Body        string `json:"body"`
	Timestamp   string `json:"timestamp"`
}

// PostWhatsAppInbound guarda un mensaje entrante en Django (idempotente por
// wa_message_id) y marca el contacto OVC como respuesta pendiente.
func (c *Client) PostWhatsAppInbound(apiKey string, req WhatsAppInboundReq) error {
	return c.postWhatsApp("/api/whatsapp/inbound", apiKey, req)
}

// PostWhatsAppOutbound registra un mensaje saliente en Django.
func (c *Client) PostWhatsAppOutbound(apiKey string, req WhatsAppOutboundReq) error {
	return c.postWhatsApp("/api/whatsapp/outbound", apiKey, req)
}

func (c *Client) postWhatsApp(path, apiKey string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("error serializando %s: %w", path, err)
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("error creando request %s: %w", path, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("error en %s: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("django %s status %d: %s", path, resp.StatusCode, b)
	}
	return nil
}

// GetWhatsAppConversationRaw devuelve el JSON crudo del historial de conversación
// de Django, para que el frontend lo consuma vía el proxy del backend Go.
func (c *Client) GetWhatsAppConversationRaw(apiKey, phone string, limit int) ([]byte, error) {
	if limit <= 0 {
		limit = 50
	}
	u := fmt.Sprintf("%s/api/whatsapp/conversation/?phone=%s&limit=%d",
		c.BaseURL, url.QueryEscape(phone), limit)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", apiKey)
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error en conversation: %w", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("django conversation status %d: %s", resp.StatusCode, b)
	}
	return b, nil
}

// GetRefugioLeadsSummary consulta el endpoint Django /api/refugio-leads/summary/
// (requiere header X-API-Key). Devuelve el conteo real por canal en el rango.
func (c *Client) GetRefugioLeadsSummary(desde, hasta, apiKey string) (*RefugioLeadsSummary, error) {
	url := fmt.Sprintf("%s/api/refugio-leads/summary/?desde=%s&hasta=%s", c.BaseURL, desde, hasta)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creando request refugio leads: %w", err)
	}
	req.Header.Set("X-API-Key", apiKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching refugio leads: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code refugio leads: %d", resp.StatusCode)
	}

	var out RefugioLeadsSummary
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("error decoding refugio leads: %w", err)
	}
	return &out, nil
}

// GetWeeklyBreakdown fetches the 12-week matrix of bookings by family and clients
func (c *Client) GetWeeklyBreakdown(weeks int) (*WeeklyBreakdown, error) {
	if weeks <= 0 {
		weeks = 12
	}
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/weekly-breakdown/?weeks=%d", c.BaseURL, weeks)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching weekly breakdown: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var breakdown WeeklyBreakdown
	if err := json.Unmarshal(apiResp.Data, &breakdown); err != nil {
		return nil, fmt.Errorf("error parsing weekly breakdown: %w", err)
	}

	return &breakdown, nil
}

// MonthlyFamilyData is one row (one month) of the monthly-by-family matrix.
type MonthlyFamilyData struct {
	Month       string                     `json:"month"`
	MonthLabel  string                     `json:"month_label"`
	Families    map[string]FamilyBreakdown `json:"families"`
	Total       FamilyBreakdown            `json:"total"`
}

// MonthlyFamilySummary describes aggregated stats per family for the period.
type MonthlyFamilySummary struct {
	TotalCount        int                    `json:"total_count"`
	TotalRevenue      float64                `json:"total_revenue"`
	AvgMonthlyRevenue float64                `json:"avg_monthly_revenue"`
	BestMonth         map[string]interface{} `json:"best_month"`
	WorstMonth        map[string]interface{} `json:"worst_month"`
	TrendSlopePct     *float64               `json:"trend_slope_pct"`
}

// MonthlyByFamilyResult is the response from /bookings/monthly-by-family/.
type MonthlyByFamilyResult struct {
	Months          int                              `json:"months"`
	FirstMonth      string                           `json:"first_month"`
	LastMonth       string                           `json:"last_month"`
	Data            []MonthlyFamilyData              `json:"data"`
	SummaryByFamily map[string]MonthlyFamilySummary  `json:"summary_by_family"`
}

// GetMonthlyByFamily fetches the monthly revenue + count matrix by family for the
// last N months (6, 12, 18 or 24 are the supported values from the UI; backend allows up to 36).
func (c *Client) GetMonthlyByFamily(months int) (*MonthlyByFamilyResult, error) {
	if months <= 0 {
		months = 24
	}
	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/monthly-by-family/?months=%d", c.BaseURL, months)

	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("error fetching monthly-by-family: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading monthly-by-family body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("monthly-by-family returned %d: %s", resp.StatusCode, string(body))
	}

	var result MonthlyByFamilyResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing monthly-by-family: %w", err)
	}
	return &result, nil
}

// ProductBreakdown is the count + revenue for one product in one month.
type ProductBreakdown struct {
	Name    string  `json:"name"`
	Count   int     `json:"count"`
	Revenue float64 `json:"revenue"`
}

// MonthlyProductData is one row (one month) of the monthly-by-product matrix.
// Products map is keyed by product_id. Productos sin ventas ese mes están
// omitidos (no llegan con count=0) para mantener el payload chico.
type MonthlyProductData struct {
	Month      string                      `json:"month"`
	MonthLabel string                      `json:"month_label"`
	Products   map[string]ProductBreakdown `json:"products"`
	Total      ProductBreakdown            `json:"total"`
}

// MonthlyProductSummary describes aggregated stats per product for the period.
// Category puede llegar nil hasta que el endpoint Django agregue el campo
// (pedido pendiente — ver docs/DJANGO-BRIEF-monthly-by-product.md).
type MonthlyProductSummary struct {
	Name              string                 `json:"name"`
	Category          *string                `json:"category,omitempty"`
	TotalCount        int                    `json:"total_count"`
	TotalRevenue      float64                `json:"total_revenue"`
	AvgMonthlyRevenue float64                `json:"avg_monthly_revenue"`
	BestMonth         map[string]interface{} `json:"best_month"`
	WorstMonth        map[string]interface{} `json:"worst_month"`
	TrendSlopePct     *float64               `json:"trend_slope_pct"`
}

// MonthlyByProductResult is the response from /bookings/monthly-by-product/.
// Mirror del endpoint monthly-by-family, pero a nivel SKU individual.
type MonthlyByProductResult struct {
	Months           int                              `json:"months"`
	FirstMonth       string                           `json:"first_month"`
	LastMonth        string                           `json:"last_month"`
	Data             []MonthlyProductData             `json:"data"`
	SummaryByProduct map[string]MonthlyProductSummary `json:"summary_by_product"`
}

// GetMonthlyByProduct fetches the monthly revenue + count matrix by product for
// the last N months. Revenue para productos = precio_unitario * cantidad (NO
// se multiplica por cantidad_personas — esa fórmula aplica solo a servicios).
func (c *Client) GetMonthlyByProduct(months int) (*MonthlyByProductResult, error) {
	if months <= 0 {
		months = 24
	}
	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/monthly-by-product/?months=%d", c.BaseURL, months)

	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("error fetching monthly-by-product: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading monthly-by-product body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("monthly-by-product returned %d: %s", resp.StatusCode, string(body))
	}

	var result MonthlyByProductResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing monthly-by-product: %w", err)
	}
	return &result, nil
}

// CombinationStats is the count + revenue for one combination in one month.
type CombinationStats struct {
	CountReservas int     `json:"count_reservas"`
	Revenue       float64 `json:"revenue"`
}

// FamilyCombinationMonth represents one month of the family-combination matrix.
type FamilyCombinationMonth struct {
	Month        string                      `json:"month"`
	MonthLabel   string                      `json:"month_label"`
	Combinations map[string]CombinationStats `json:"combinations"`
	Total        CombinationStats            `json:"total"`
}

// FamilyCombinationShare describes one combination's share of the total.
type FamilyCombinationShare struct {
	PctReservas float64 `json:"pct_reservas"`
	PctRevenue  float64 `json:"pct_revenue"`
}

// FamilyCombinationsSummary is the period summary returned by Django.
type FamilyCombinationsSummary struct {
	TotalReservas              int                                `json:"total_reservas"`
	TotalRevenue               float64                            `json:"total_revenue"`
	ShareByCombination         map[string]FamilyCombinationShare  `json:"share_by_combination"`
	TrendSlopePctByCombination map[string]*float64                `json:"trend_slope_pct_by_combination"`
}

// FamilyCombinationsResult is the response from /bookings/family-combinations/.
type FamilyCombinationsResult struct {
	Months     int                       `json:"months"`
	FirstMonth string                    `json:"first_month"`
	LastMonth  string                    `json:"last_month"`
	Order      string                    `json:"order"`
	Data       []FamilyCombinationMonth  `json:"data"`
	Summary    FamilyCombinationsSummary `json:"summary"`
}

// GetFamilyCombinations fetches the matrix of reservation count + revenue grouped
// by family combination (solo_tinas, tinas_masajes, cabanas_tinas_masajes, etc.).
// Used to measure bundling effectiveness over time.
func (c *Client) GetFamilyCombinations(months int) (*FamilyCombinationsResult, error) {
	if months <= 0 {
		months = 24
	}
	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/family-combinations/?months=%d", c.BaseURL, months)

	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("error fetching family-combinations: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading family-combinations body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("family-combinations returned %d: %s", resp.StatusCode, string(body))
	}

	var result FamilyCombinationsResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing family-combinations: %w", err)
	}
	return &result, nil
}

// VentasDetalleRow describes a single reservation row from /bookings/detalle/.
// One reservation may appear in multiple rows if it has different services.
type VentasDetalleRow struct {
	ReservaID        int     `json:"reserva_id"`
	Fecha            string  `json:"fecha"`
	Hora             string  `json:"hora"`
	ClienteID        int     `json:"cliente_id"`
	ClienteNombre    string  `json:"cliente_nombre"`
	ClienteRUT       string  `json:"cliente_rut"`
	ClienteEmail     string  `json:"cliente_email"`
	ServicioID       int     `json:"servicio_id"`
	ServicioNombre   string  `json:"servicio_nombre"`
	Familia          string  `json:"familia"`
	ProveedorID      *int    `json:"proveedor_id"`
	ProveedorNombre  string  `json:"proveedor_nombre"`
	CantidadPersonas int     `json:"cantidad_personas"`
	PrecioUnitario   float64 `json:"precio_unitario"`
	Total            float64 `json:"total"`
	MetodoPago       string  `json:"metodo_pago"`
	Estado           string  `json:"estado"`
	Nota             string  `json:"nota"`
}

// VentasDetalleResult is the response shape from /bookings/detalle/. Returned
// unwrapped (no APIResponse envelope) because the endpoint streams the body directly.
type VentasDetalleResult struct {
	FechaDesde   string             `json:"fecha_desde"`
	FechaHasta   string             `json:"fecha_hasta"`
	Familia      string             `json:"familia"`
	Servicio     string             `json:"servicio"`
	TotalFilas   int                `json:"total_filas"`
	TotalRevenue float64            `json:"total_revenue"`
	Truncated    bool               `json:"truncated"`
	Rows         []VentasDetalleRow `json:"rows"`
}

// GetVentasDetalle fetches detailed booking rows. Filters are all partial-match
// (icontains): familia, servicio (service name), proveedor (masseur/provider),
// cliente (matches name/phone/email/rut). When cliente is set, fecha_desde and
// fecha_hasta may be empty — Django returns the client's full history.
func (c *Client) GetVentasDetalle(fechaDesde, fechaHasta, familia, servicio, proveedor, cliente string) (*VentasDetalleResult, error) {
	q := url.Values{}
	if fechaDesde != "" {
		q.Set("fecha_desde", fechaDesde)
	}
	if fechaHasta != "" {
		q.Set("fecha_hasta", fechaHasta)
	}
	if familia != "" {
		q.Set("familia", familia)
	}
	if servicio != "" {
		q.Set("servicio", servicio)
	}
	if proveedor != "" {
		q.Set("proveedor", proveedor)
	}
	if cliente != "" {
		q.Set("cliente", cliente)
	}
	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/detalle/?%s", c.BaseURL, q.Encode())

	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("error fetching ventas detalle: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading detalle body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("detalle endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result VentasDetalleResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing detalle response: %w", err)
	}
	return &result, nil
}

// VentasDetalleProductoRow es una línea de venta de producto (no servicio)
// devuelta por /bookings/detalle-productos/.
type VentasDetalleProductoRow struct {
	Fecha           string  `json:"fecha"`
	ClienteID       int     `json:"cliente_id"`
	ClienteNombre   string  `json:"cliente_nombre"`
	ClienteTelefono string  `json:"cliente_telefono"`
	ClienteEmail    string  `json:"cliente_email"`
	VentaReservaID  int     `json:"venta_reserva_id"`
	ProductoID      int     `json:"producto_id"`
	ProductoNombre  string  `json:"producto_nombre"`
	Categoria       string  `json:"categoria"`
	Cantidad        int     `json:"cantidad"`
	PrecioUnitario  float64 `json:"precio_unitario"`
	Revenue         float64 `json:"revenue"`
	MetodoPago      string  `json:"metodo_pago"`
	EstadoPago      string  `json:"estado_pago"`
}

// VentasDetalleProductosResult es la respuesta de /bookings/detalle-productos/.
// Espejo de VentasDetalleResult pero a nivel SKU de producto.
// Django excluye automáticamente estado_pago='cancelado' y líneas con
// producto huérfano. Truncated=true cuando se alcanzó el hard cap de 500 rows.
type VentasDetalleProductosResult struct {
	FechaDesde       string                     `json:"fecha_desde"`
	FechaHasta       string                     `json:"fecha_hasta"`
	FiltrosAplicados map[string]interface{}     `json:"filtros_aplicados"`
	TotalRevenue     float64                    `json:"total_revenue"`
	TotalUnidades    int                        `json:"total_unidades"`
	TotalLineas      int                        `json:"total_lineas"`
	Truncated        bool                       `json:"truncated"`
	Rows             []VentasDetalleProductoRow `json:"rows"`
}

// GetVentasDetalleProductos consulta el detalle de ventas de productos. Espejo
// de GetVentasDetalle pero contra el endpoint Django para productos.
// Filtros: producto / categoria son substrings case-insensitive del catálogo;
// cliente matchea teléfono/email/nombre.
func (c *Client) GetVentasDetalleProductos(fechaDesde, fechaHasta, producto, categoria, cliente string) (*VentasDetalleProductosResult, error) {
	q := url.Values{}
	if fechaDesde != "" {
		q.Set("fecha_desde", fechaDesde)
	}
	if fechaHasta != "" {
		q.Set("fecha_hasta", fechaHasta)
	}
	if producto != "" {
		q.Set("producto", producto)
	}
	if categoria != "" {
		q.Set("categoria", categoria)
	}
	if cliente != "" {
		q.Set("cliente", cliente)
	}
	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/detalle-productos/?%s", c.BaseURL, q.Encode())

	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("error fetching ventas detalle productos: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading detalle-productos body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("detalle-productos endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result VentasDetalleProductosResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing detalle-productos response: %w", err)
	}
	return &result, nil
}

// GetFamilyStatsMTD fetches the month-to-date breakdown by family with comparative
// against same days of previous month and previous year. Revenue is correctly
// computed as precio_unitario_venta * cantidad_personas.
func (c *Client) GetFamilyStatsMTD(dateStop string) (*FamilyStatsMTD, error) {
	url := fmt.Sprintf("%s/ventas/api/aremko-cli/bookings/by-family-mtd/", c.BaseURL)
	if dateStop != "" {
		url = fmt.Sprintf("%s?date_stop=%s", url, dateStop)
	}

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error fetching family stats MTD: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("API error: %s", apiResp.Error)
	}

	var stats FamilyStatsMTD
	if err := json.Unmarshal(apiResp.Data, &stats); err != nil {
		return nil, fmt.Errorf("error parsing family stats MTD: %w", err)
	}

	return &stats, nil
}
