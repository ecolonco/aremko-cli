package bookings

import (
	"encoding/json"
	"fmt"
	"net/http"
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
