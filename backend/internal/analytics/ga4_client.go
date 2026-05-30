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

// WeeklyStats representa las estadísticas de una semana
type WeeklyStats struct {
	WeekLabel         string  `json:"week_label"`
	StartDate         string  `json:"start_date"`
	EndDate           string  `json:"end_date"`
	ActiveUsers       int64   `json:"active_users"`
	TotalUsers        int64   `json:"total_users"`
	Sessions          int64   `json:"sessions"`
	PageViews         int64   `json:"page_views"`
	BounceRate        float64 `json:"bounce_rate"`
	AvgSessionDuration float64 `json:"avg_session_duration"`
	NewUsers          int64   `json:"new_users"`
	EventCount        int64   `json:"event_count"`
}

// GetWeeklyTrends obtiene estadísticas de las últimas 4 semanas
func (c *GA4Client) GetWeeklyTrends(ctx context.Context) ([]WeeklyStats, error) {
	now := time.Now()
	var weeks []WeeklyStats

	// Obtener datos para cada una de las últimas 4 semanas
	for i := 0; i < 4; i++ {
		// Calcular fechas de la semana (de lunes a domingo)
		weekEnd := now.AddDate(0, 0, -1-(i*7)) // Ayer menos i semanas
		weekStart := weekEnd.AddDate(0, 0, -6)  // 6 días antes

		startDate := weekStart.Format("2006-01-02")
		endDate := weekEnd.Format("2006-01-02")

		// Obtener estadísticas para esta semana
		stats, err := c.GetStats(ctx, startDate, endDate)
		if err != nil {
			continue // Continuar con la siguiente semana si hay error
		}

		weekLabel := fmt.Sprintf("Semana %d", 4-i)
		if i == 0 {
			weekLabel = "Esta semana"
		} else if i == 1 {
			weekLabel = "Semana pasada"
		}

		weeks = append(weeks, WeeklyStats{
			WeekLabel:          weekLabel,
			StartDate:          startDate,
			EndDate:            endDate,
			ActiveUsers:        stats.ActiveUsers,
			TotalUsers:         stats.TotalUsers,
			Sessions:           stats.Sessions,
			PageViews:          stats.PageViews,
			BounceRate:         stats.BounceRate,
			AvgSessionDuration: stats.AvgSessionDuration,
			NewUsers:           stats.NewUsers,
			EventCount:         stats.EventCount,
		})
	}

	// Invertir el orden para que la semana más antigua esté primero
	for i, j := 0, len(weeks)-1; i < j; i, j = i+1, j-1 {
		weeks[i], weeks[j] = weeks[j], weeks[i]
	}

	return weeks, nil
}

// GetTopPagesWeekly obtiene las páginas más visitadas para las últimas 4 semanas
func (c *GA4Client) GetTopPagesWeekly(ctx context.Context, limit int) (map[string][]map[string]interface{}, error) {
	now := time.Now()
	weeklyPages := make(map[string][]map[string]interface{})

	// Obtener datos para cada una de las últimas 4 semanas
	for i := 0; i < 4; i++ {
		weekEnd := now.AddDate(0, 0, -1-(i*7))
		weekStart := weekEnd.AddDate(0, 0, -6)

		startDate := weekStart.Format("2006-01-02")
		endDate := weekEnd.Format("2006-01-02")

		weekLabel := fmt.Sprintf("week_%d", 4-i)
		if i == 0 {
			weekLabel = "week_4" // Esta semana
		} else if i == 1 {
			weekLabel = "week_3" // Semana pasada
		} else if i == 2 {
			weekLabel = "week_2"
		} else {
			weekLabel = "week_1"
		}

		// Obtener top pages para esta semana
		pages, err := c.GetTopPages(ctx, startDate, endDate, limit)
		if err == nil {
			weeklyPages[weekLabel] = pages
		}
	}

	return weeklyPages, nil
}

// GetTrafficSourcesWeekly obtiene las fuentes de tráfico para las últimas 4 semanas
func (c *GA4Client) GetTrafficSourcesWeekly(ctx context.Context) (map[string][]map[string]interface{}, error) {
	now := time.Now()
	weeklySources := make(map[string][]map[string]interface{})

	// Obtener datos para cada una de las últimas 4 semanas
	for i := 0; i < 4; i++ {
		weekEnd := now.AddDate(0, 0, -1-(i*7))
		weekStart := weekEnd.AddDate(0, 0, -6)

		startDate := weekStart.Format("2006-01-02")
		endDate := weekEnd.Format("2006-01-02")

		weekLabel := fmt.Sprintf("week_%d", 4-i)
		if i == 0 {
			weekLabel = "week_4" // Esta semana
		} else if i == 1 {
			weekLabel = "week_3" // Semana pasada
		} else if i == 2 {
			weekLabel = "week_2"
		} else {
			weekLabel = "week_1"
		}

		// Obtener traffic sources para esta semana
		sources, err := c.GetTrafficSources(ctx, startDate, endDate)
		if err == nil {
			weeklySources[weekLabel] = sources
		}
	}

	return weeklySources, nil
}

// PageMetrics describe el detalle de tráfico de una URL específica.
type PageMetrics struct {
	Path               string  `json:"path"`
	Title              string  `json:"title"`
	Sessions           int64   `json:"sessions"`
	ActiveUsers        int64   `json:"active_users"`
	NewUsers           int64   `json:"new_users"`
	PageViews          int64   `json:"page_views"`
	BounceRate         float64 `json:"bounce_rate"`
	AvgSessionDuration float64 `json:"avg_session_duration"`
	EngagementRate     float64 `json:"engagement_rate"`
}

// pagePathFilter arma el FilterExpression que limita la query a una URL exacta.
// GA4 normalmente reporta los paths con trailing slash; toleramos ambas formas
// usando un OR entre exacta y con/sin slash.
func pagePathFilter(pagePath string) *analyticsdata.FilterExpression {
	variants := []string{pagePath}
	if pagePath != "/" {
		if pagePath[len(pagePath)-1] == '/' {
			variants = append(variants, pagePath[:len(pagePath)-1])
		} else {
			variants = append(variants, pagePath+"/")
		}
	}
	exprs := make([]*analyticsdata.FilterExpression, 0, len(variants))
	for _, v := range variants {
		exprs = append(exprs, &analyticsdata.FilterExpression{
			Filter: &analyticsdata.Filter{
				FieldName: "pagePath",
				StringFilter: &analyticsdata.StringFilter{
					MatchType: "EXACT",
					Value:     v,
				},
			},
		})
	}
	if len(exprs) == 1 {
		return exprs[0]
	}
	return &analyticsdata.FilterExpression{
		OrGroup: &analyticsdata.FilterExpressionList{Expressions: exprs},
	}
}

// GetPageMetrics devuelve métricas detalladas de una página específica
// (sessions, users, views, bounce, avg duration, engagement) en un rango.
func (c *GA4Client) GetPageMetrics(ctx context.Context, pagePath, startDate, endDate string) (*PageMetrics, error) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{StartDate: startDate, EndDate: endDate},
		},
		Dimensions: []*analyticsdata.Dimension{
			{Name: "pageTitle"},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "sessions"},
			{Name: "activeUsers"},
			{Name: "newUsers"},
			{Name: "screenPageViews"},
			{Name: "bounceRate"},
			{Name: "averageSessionDuration"},
			{Name: "engagementRate"},
		},
		DimensionFilter: pagePathFilter(pagePath),
		Limit:           1,
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching page metrics for %s: %w", pagePath, err)
	}

	pm := &PageMetrics{Path: pagePath}
	if len(resp.Rows) == 0 {
		return pm, nil // sin tráfico todavía → ceros
	}
	row := resp.Rows[0]
	if len(row.DimensionValues) >= 1 {
		pm.Title = row.DimensionValues[0].Value
	}
	if len(row.MetricValues) >= 7 {
		fmt.Sscanf(row.MetricValues[0].Value, "%d", &pm.Sessions)
		fmt.Sscanf(row.MetricValues[1].Value, "%d", &pm.ActiveUsers)
		fmt.Sscanf(row.MetricValues[2].Value, "%d", &pm.NewUsers)
		fmt.Sscanf(row.MetricValues[3].Value, "%d", &pm.PageViews)
		fmt.Sscanf(row.MetricValues[4].Value, "%f", &pm.BounceRate)
		fmt.Sscanf(row.MetricValues[5].Value, "%f", &pm.AvgSessionDuration)
		fmt.Sscanf(row.MetricValues[6].Value, "%f", &pm.EngagementRate)
	}
	return pm, nil
}

// PageMetricsWeek representa la métrica de una página en una semana específica.
type PageMetricsWeek struct {
	WeekLabel string       `json:"week_label"` // week_1..week_4
	StartDate string       `json:"start_date"`
	EndDate   string       `json:"end_date"`
	Metrics   *PageMetrics `json:"metrics"`
}

// GetPageMetricsByWeek devuelve métricas de la página por cada una de las
// últimas N semanas (default 4). Espejo de GetTopPagesWeekly pero filtrado.
func (c *GA4Client) GetPageMetricsByWeek(ctx context.Context, pagePath string, weeks int) ([]PageMetricsWeek, error) {
	if weeks <= 0 {
		weeks = 4
	}
	now := time.Now()
	out := make([]PageMetricsWeek, 0, weeks)
	for i := weeks - 1; i >= 0; i-- {
		weekEnd := now.AddDate(0, 0, -1-(i*7))
		weekStart := weekEnd.AddDate(0, 0, -6)
		startDate := weekStart.Format("2006-01-02")
		endDate := weekEnd.Format("2006-01-02")

		pm, err := c.GetPageMetrics(ctx, pagePath, startDate, endDate)
		if err != nil {
			// fallar suave: una semana sin datos no debe tumbar la respuesta
			pm = &PageMetrics{Path: pagePath}
		}
		out = append(out, PageMetricsWeek{
			WeekLabel: fmt.Sprintf("week_%d", weeks-i),
			StartDate: startDate,
			EndDate:   endDate,
			Metrics:   pm,
		})
	}
	return out, nil
}

// ConversionByEvent representa un evento de conversión agregado por nombre.
type ConversionByEvent struct {
	EventName   string  `json:"event_name"`
	Conversions float64 `json:"conversions"`
	EventCount  int64   `json:"event_count"`
	TotalUsers  int64   `json:"total_users"`
}

// ConversionBySource representa conversiones por fuente/medio para un evento.
type ConversionBySource struct {
	EventName   string  `json:"event_name"`
	Source      string  `json:"source"`
	Medium      string  `json:"medium"`
	Conversions float64 `json:"conversions"`
	EventCount  int64   `json:"event_count"`
	TotalUsers  int64   `json:"total_users"`
}

// GetConversionsByEvent devuelve los eventos de conversión configurados como
// "key events" en GA4 con sus métricas en el rango. GA4 solo devuelve conversions>0
// para eventos marcados como key event en Admin → Events.
func (c *GA4Client) GetConversionsByEvent(ctx context.Context, startDate, endDate string) ([]ConversionByEvent, error) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{StartDate: startDate, EndDate: endDate},
		},
		Dimensions: []*analyticsdata.Dimension{
			{Name: "eventName"},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "conversions"},
			{Name: "eventCount"},
			{Name: "totalUsers"},
		},
		MetricFilter: &analyticsdata.FilterExpression{
			Filter: &analyticsdata.Filter{
				FieldName: "conversions",
				NumericFilter: &analyticsdata.NumericFilter{
					Operation: "GREATER_THAN",
					Value:     &analyticsdata.NumericValue{DoubleValue: 0},
				},
			},
		},
		OrderBys: []*analyticsdata.OrderBy{
			{Metric: &analyticsdata.MetricOrderBy{MetricName: "conversions"}, Desc: true},
		},
		Limit: 25,
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching conversions by event: %w", err)
	}

	out := make([]ConversionByEvent, 0, len(resp.Rows))
	for _, row := range resp.Rows {
		if len(row.DimensionValues) < 1 || len(row.MetricValues) < 3 {
			continue
		}
		var conversions float64
		var eventCount, users int64
		fmt.Sscanf(row.MetricValues[0].Value, "%f", &conversions)
		fmt.Sscanf(row.MetricValues[1].Value, "%d", &eventCount)
		fmt.Sscanf(row.MetricValues[2].Value, "%d", &users)
		out = append(out, ConversionByEvent{
			EventName:   row.DimensionValues[0].Value,
			Conversions: conversions,
			EventCount:  eventCount,
			TotalUsers:  users,
		})
	}
	return out, nil
}

// GetConversionsBySource desglosa las conversiones por evento × source × medium.
// Sirve para responder "¿quién atribuye el lead — Meta, Google, orgánico?".
func (c *GA4Client) GetConversionsBySource(ctx context.Context, startDate, endDate string) ([]ConversionBySource, error) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{StartDate: startDate, EndDate: endDate},
		},
		Dimensions: []*analyticsdata.Dimension{
			{Name: "eventName"},
			{Name: "sessionSource"},
			{Name: "sessionMedium"},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "conversions"},
			{Name: "eventCount"},
			{Name: "totalUsers"},
		},
		MetricFilter: &analyticsdata.FilterExpression{
			Filter: &analyticsdata.Filter{
				FieldName: "conversions",
				NumericFilter: &analyticsdata.NumericFilter{
					Operation: "GREATER_THAN",
					Value:     &analyticsdata.NumericValue{DoubleValue: 0},
				},
			},
		},
		OrderBys: []*analyticsdata.OrderBy{
			{Metric: &analyticsdata.MetricOrderBy{MetricName: "conversions"}, Desc: true},
		},
		Limit: 50,
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching conversions by source: %w", err)
	}

	out := make([]ConversionBySource, 0, len(resp.Rows))
	for _, row := range resp.Rows {
		if len(row.DimensionValues) < 3 || len(row.MetricValues) < 3 {
			continue
		}
		var conversions float64
		var eventCount, users int64
		fmt.Sscanf(row.MetricValues[0].Value, "%f", &conversions)
		fmt.Sscanf(row.MetricValues[1].Value, "%d", &eventCount)
		fmt.Sscanf(row.MetricValues[2].Value, "%d", &users)
		out = append(out, ConversionBySource{
			EventName:   row.DimensionValues[0].Value,
			Source:      row.DimensionValues[1].Value,
			Medium:      row.DimensionValues[2].Value,
			Conversions: conversions,
			EventCount:  eventCount,
			TotalUsers:  users,
		})
	}
	return out, nil
}

// GetTrafficSourcesForPage devuelve las fuentes de tráfico (source/medium)
// que llevaron a una página específica. Útil para saber si /refugio recibe
// principalmente tráfico orgánico, directo, Meta Ads, etc.
func (c *GA4Client) GetTrafficSourcesForPage(ctx context.Context, pagePath, startDate, endDate string) ([]map[string]interface{}, error) {
	if startDate == "" {
		startDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	req := &analyticsdata.RunReportRequest{
		DateRanges: []*analyticsdata.DateRange{
			{StartDate: startDate, EndDate: endDate},
		},
		Dimensions: []*analyticsdata.Dimension{
			{Name: "sessionSource"},
			{Name: "sessionMedium"},
		},
		Metrics: []*analyticsdata.Metric{
			{Name: "sessions"},
			{Name: "activeUsers"},
		},
		DimensionFilter: pagePathFilter(pagePath),
		OrderBys: []*analyticsdata.OrderBy{
			{Metric: &analyticsdata.MetricOrderBy{MetricName: "sessions"}, Desc: true},
		},
		Limit: 10,
	}

	resp, err := c.service.Properties.RunReport(c.propertyID, req).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("error fetching traffic sources for %s: %w", pagePath, err)
	}

	sources := make([]map[string]interface{}, 0, len(resp.Rows))
	for _, row := range resp.Rows {
		if len(row.DimensionValues) < 2 || len(row.MetricValues) < 2 {
			continue
		}
		var sessions, users int64
		fmt.Sscanf(row.MetricValues[0].Value, "%d", &sessions)
		fmt.Sscanf(row.MetricValues[1].Value, "%d", &users)
		sources = append(sources, map[string]interface{}{
			"source":   row.DimensionValues[0].Value,
			"medium":   row.DimensionValues[1].Value,
			"sessions": sessions,
			"users":    users,
		})
	}
	return sources, nil
}
