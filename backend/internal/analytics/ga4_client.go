package analytics

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/api/analyticsdata/v1beta"
	"google.golang.org/api/option"
)

type GA4Client struct {
	service    *analyticsdata.Service
	propertyID string
}

type GA4Stats struct {
	ActiveUsers       int64   `json:"active_users"`
	TotalUsers        int64   `json:"total_users"`
	Sessions          int64   `json:"sessions"`
	PageViews         int64   `json:"page_views"`
	BounceRate        float64 `json:"bounce_rate"`
	AvgSessionDuration float64 `json:"avg_session_duration"`
	NewUsers          int64   `json:"new_users"`
	EventCount        int64   `json:"event_count"`
}

// NewGA4Client crea un nuevo cliente de Google Analytics 4
func NewGA4Client(credentialsPath string, propertyID string) (*GA4Client, error) {
	ctx := context.Background()

	service, err := analyticsdata.NewService(ctx, option.WithCredentialsFile(credentialsPath))
	if err != nil {
		return nil, fmt.Errorf("error creating GA4 service: %w", err)
	}

	return &GA4Client{
		service:    service,
		propertyID: fmt.Sprintf("properties/%s", propertyID),
	}, nil
}

// GetStats obtiene estadísticas de tráfico del sitio web
func (c *GA4Client) GetStats(ctx context.Context, startDate, endDate string) (*GA4Stats, error) {
	// Si no se especifican fechas, usar últimos 30 días
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	// Crear request para métricas principales
	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{
				StartDate: startDate,
				EndDate:   endDate,
			},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "activeUsers"},
			{Name: "totalUsers"},
			{Name: "sessions"},
			{Name: "screenPageViews"},
			{Name: "bounceRate"},
			{Name: "averageSessionDuration"},
			{Name: "newUsers"},
			{Name: "eventCount"},
		},
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching GA4 data: %w", err)
	}

	// Parsear respuesta
	stats := &GA4Stats{}
	if len(resp.Rows) > 0 && len(resp.Rows[0].MetricValues) >= 8 {
		row := resp.Rows[0]

		fmt.Sscanf(row.MetricValues[0].Value, "%d", &stats.ActiveUsers)
		fmt.Sscanf(row.MetricValues[1].Value, "%d", &stats.TotalUsers)
		fmt.Sscanf(row.MetricValues[2].Value, "%d", &stats.Sessions)
		fmt.Sscanf(row.MetricValues[3].Value, "%d", &stats.PageViews)
		fmt.Sscanf(row.MetricValues[4].Value, "%f", &stats.BounceRate)
		fmt.Sscanf(row.MetricValues[5].Value, "%f", &stats.AvgSessionDuration)
		fmt.Sscanf(row.MetricValues[6].Value, "%d", &stats.NewUsers)
		fmt.Sscanf(row.MetricValues[7].Value, "%d", &stats.EventCount)
	}

	return stats, nil
}

// GetTopPages obtiene las páginas más visitadas
func (c *GA4Client) GetTopPages(ctx context.Context, startDate, endDate string, limit int) ([]map[string]interface{}, error) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{
				StartDate: startDate,
				EndDate:   endDate,
			},
		},
		Dimensions: []*analyticsdata.Dimension{
			{Name: "pagePath"},
			{Name: "pageTitle"},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "screenPageViews"},
			{Name: "activeUsers"},
		},
		OrderBys: []*analyticsdata.OrderBy{
			{
				Metric: &analyticsdata.MetricOrderBy{
					MetricName: "screenPageViews",
				},
				Desc: true,
			},
		},
		Limit: int64(limit),
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching top pages: %w", err)
	}

	var pages []map[string]interface{}
	for _, row := range resp.Rows {
		if len(row.DimensionValues) >= 2 && len(row.MetricValues) >= 2 {
			var pageViews, users int64
			fmt.Sscanf(row.MetricValues[0].Value, "%d", &pageViews)
			fmt.Sscanf(row.MetricValues[1].Value, "%d", &users)

			pages = append(pages, map[string]interface{}{
				"path":       row.DimensionValues[0].Value,
				"title":      row.DimensionValues[1].Value,
				"page_views": pageViews,
				"users":      users,
			})
		}
	}

	return pages, nil
}

// GetTrafficSources obtiene las fuentes de tráfico
func (c *GA4Client) GetTrafficSources(ctx context.Context, startDate, endDate string) ([]map[string]interface{}, error) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{
				StartDate: startDate,
				EndDate:   endDate,
			},
		},
		Dimensions: []*analyticsdata.Dimension{
			{Name: "sessionSource"},
			{Name: "sessionMedium"},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "sessions"},
			{Name: "activeUsers"},
			{Name: "newUsers"},
		},
		OrderBys: []*analyticsdata.OrderBy{
			{
				Metric: &analyticsdata.MetricOrderBy{
					MetricName: "sessions",
				},
				Desc: true,
			},
		},
		Limit: 10,
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching traffic sources: %w", err)
	}

	var sources []map[string]interface{}
	for _, row := range resp.Rows {
		if len(row.DimensionValues) >= 2 && len(row.MetricValues) >= 3 {
			var sessions, users, newUsers int64
			fmt.Sscanf(row.MetricValues[0].Value, "%d", &sessions)
			fmt.Sscanf(row.MetricValues[1].Value, "%d", &users)
			fmt.Sscanf(row.MetricValues[2].Value, "%d", &newUsers)

			sources = append(sources, map[string]interface{}{
				"source":    row.DimensionValues[0].Value,
				"medium":    row.DimensionValues[1].Value,
				"sessions":  sessions,
				"users":     users,
				"new_users": newUsers,
			})
		}
	}

	return sources, nil
}
