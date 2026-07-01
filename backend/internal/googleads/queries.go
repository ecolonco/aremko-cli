package googleads

import (
	"context"
	"encoding/json"
	"fmt"
)

// GetCampaignSummary trae todas las campañas + métricas agregadas en el rango.
// Sirve para la card "Cuentas / Campañas" y para detectar la Refugio Search.
func (c *Client) GetCampaignSummary(ctx context.Context, dateStart, dateStop string) ([]CampaignInsights, error) {
	gaql := fmt.Sprintf(`
		SELECT
			campaign.id,
			campaign.name,
			campaign.status,
			campaign.start_date,
			campaign.end_date,
			metrics.impressions,
			metrics.clicks,
			metrics.cost_micros,
			metrics.conversions,
			metrics.conversions_value,
			metrics.ctr,
			metrics.average_cpc,
			metrics.cost_per_conversion,
			metrics.search_impression_share
		FROM campaign
		WHERE segments.date BETWEEN '%s' AND '%s'
	`, dateStart, dateStop)

	rows, err := c.searchStream(ctx, gaql)
	if err != nil {
		return nil, err
	}
	out := make([]CampaignInsights, 0, len(rows))
	for _, raw := range rows {
		var r row
		if err := json.Unmarshal(raw, &r); err != nil {
			continue
		}
		out = append(out, c.rowToCampaign(&r, dateStart, dateStop))
	}
	return out, nil
}

// GetCampaignInsights trae métricas agregadas de UNA campaña específica.
// Usado para la card Refugio Google Ads (parecido al getCampaignInsights de Meta).
func (c *Client) GetCampaignInsights(ctx context.Context, campaignID, dateStart, dateStop string) (*CampaignInsights, error) {
	gaql := fmt.Sprintf(`
		SELECT
			campaign.id,
			campaign.name,
			campaign.status,
			campaign.start_date,
			metrics.impressions,
			metrics.clicks,
			metrics.cost_micros,
			metrics.conversions,
			metrics.conversions_value,
			metrics.ctr,
			metrics.average_cpc,
			metrics.cost_per_conversion,
			metrics.search_impression_share
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
	`, campaignID, dateStart, dateStop)

	rows, err := c.searchStream(ctx, gaql)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	var r row
	if err := json.Unmarshal(rows[0], &r); err != nil {
		return nil, err
	}
	ci := c.rowToCampaign(&r, dateStart, dateStop)
	return &ci, nil
}

// DailyMetric es una fila por DÍA (segments.date) de una campaña.
type DailyMetric struct {
	Date        string  // YYYY-MM-DD
	CostCLP     float64
	Clicks      int64
	Conversions float64
}

// GetCampaignDaily trae métricas por DÍA de una campaña (segments.date), para
// construir series semanales alineadas a ventanas arbitrarias (se agregan en Go).
// Usado por las tablas semanales de Ritual/Refugio/Pausa del reporte de Google (H-053).
func (c *Client) GetCampaignDaily(ctx context.Context, campaignID, dateStart, dateStop string) ([]DailyMetric, error) {
	gaql := fmt.Sprintf(`
		SELECT
			campaign.id,
			segments.date,
			metrics.cost_micros,
			metrics.clicks,
			metrics.conversions
		FROM campaign
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
	`, campaignID, dateStart, dateStop)

	rows, err := c.searchStream(ctx, gaql)
	if err != nil {
		return nil, err
	}
	out := make([]DailyMetric, 0, len(rows))
	for _, raw := range rows {
		var r row
		if err := json.Unmarshal(raw, &r); err != nil {
			continue
		}
		out = append(out, DailyMetric{
			Date:        r.Segments.Date,
			CostCLP:     microsToCLP(parseInt64FromString(r.Metrics.CostMicros.String())),
			Clicks:      parseInt64FromString(r.Metrics.Clicks.String()),
			Conversions: parseFloatFromString(r.Metrics.Conversions.String()),
		})
	}
	return out, nil
}

func (c *Client) rowToCampaign(r *row, dateStart, dateStop string) CampaignInsights {
	imp := r.Metrics.Impressions.String()
	clicks := r.Metrics.Clicks.String()
	cost := r.Metrics.CostMicros.String()
	conv := r.Metrics.Conversions.String()
	convVal := r.Metrics.ConversionsValue.String()
	ctr := r.Metrics.CTR.String()
	avgCPCRaw := r.Metrics.AverageCpc.String()
	cpconv := r.Metrics.CostPerConversion.String()
	sis := r.Metrics.SearchImpressionShare.String()

	costCLP := microsToCLP(parseInt64FromString(cost))
	convCount := parseFloatFromString(conv)
	cpl := 0.0
	if convCount > 0 {
		cpl = costCLP / convCount
	}
	clicksI := parseInt64FromString(clicks)
	convRate := 0.0
	if clicksI > 0 {
		convRate = (convCount / float64(clicksI)) * 100
	}

	// CPC: usamos average_cpc de Google, pero si viene en 0 (campañas nuevas o
	// campos no poblados) lo derivamos de gasto / clics, que siempre son reales.
	avgCPC := microsToCLP(parseInt64FromString(avgCPCRaw))
	if avgCPC == 0 && clicksI > 0 {
		avgCPC = costCLP / float64(clicksI)
	}

	_ = cpconv // por ahora no lo exponemos, derivamos CPL desde cost/conversions
	return CampaignInsights{
		CampaignID:       r.campaignIDString(),
		CampaignName:     r.Campaign.Name,
		Status:           r.Campaign.Status,
		Impressions:      parseInt64FromString(imp),
		Clicks:           clicksI,
		CostCLP:          costCLP,
		Conversions:      convCount,
		ConversionsValue: parseFloatFromString(convVal),
		CTR:              parseFloatFromString(ctr) * 100, // Google da fracción, mostramos %
		AvgCPC:           avgCPC,
		CPL:              cpl,
		ConversionRate:   convRate,
		SearchImprShare:  parseFloatFromString(sis) * 100,
		StartDate:        dateStart,
		EndDate:          dateStop,
	}
}

// GetSearchTerms trae los términos de búsqueda reales que dispararon anuncios
// para una campaña en un rango. Es información exclusiva de Search Ads.
func (c *Client) GetSearchTerms(ctx context.Context, campaignID, dateStart, dateStop string, limit int) ([]SearchTerm, error) {
	if limit <= 0 {
		limit = 50
	}
	gaql := fmt.Sprintf(`
		SELECT
			search_term_view.search_term,
			search_term_view.status,
			segments.keyword.match_type,
			metrics.impressions,
			metrics.clicks,
			metrics.cost_micros,
			metrics.conversions,
			metrics.ctr,
			metrics.average_cpc
		FROM search_term_view
		WHERE campaign.id = %s
		  AND segments.date BETWEEN '%s' AND '%s'
		ORDER BY metrics.clicks DESC
		LIMIT %d
	`, campaignID, dateStart, dateStop, limit)

	rows, err := c.searchStream(ctx, gaql)
	if err != nil {
		return nil, err
	}
	out := make([]SearchTerm, 0, len(rows))
	for _, raw := range rows {
		var r row
		if err := json.Unmarshal(raw, &r); err != nil {
			continue
		}
		clicks := parseInt64FromString(r.Metrics.Clicks.String())
		costCLP := microsToCLP(parseInt64FromString(r.Metrics.CostMicros.String()))
		conv := parseFloatFromString(r.Metrics.Conversions.String())
		cpl := 0.0
		if conv > 0 {
			cpl = costCLP / conv
		}
		out = append(out, SearchTerm{
			Term:        r.SearchTermView.SearchTerm,
			Status:      r.SearchTermView.Status,
			MatchType:   r.Segments.KeywordInfoMatchType,
			Impressions: parseInt64FromString(r.Metrics.Impressions.String()),
			Clicks:      clicks,
			CostCLP:     costCLP,
			Conversions: conv,
			CTR:         parseFloatFromString(r.Metrics.CTR.String()) * 100,
			AvgCPC:      microsToCLP(parseInt64FromString(r.Metrics.AverageCpc.String())),
			CPL:         cpl,
		})
	}
	return out, nil
}

// GetKeywordQualityScores trae las keywords de una campaña con su Quality Score
// y los componentes (expected CTR, ad relevance, landing page experience).
func (c *Client) GetKeywordQualityScores(ctx context.Context, campaignID string) ([]KeywordQS, error) {
	gaql := fmt.Sprintf(`
		SELECT
			ad_group_criterion.keyword.text,
			ad_group_criterion.keyword.match_type,
			ad_group_criterion.quality_info.quality_score,
			ad_group_criterion.quality_info.creative_quality_score,
			ad_group_criterion.quality_info.post_click_quality_score,
			ad_group_criterion.quality_info.search_predicted_ctr,
			ad_group.name
		FROM keyword_view
		WHERE campaign.id = %s
		  AND ad_group_criterion.status = 'ENABLED'
		ORDER BY ad_group_criterion.quality_info.quality_score ASC
	`, campaignID)

	rows, err := c.searchStream(ctx, gaql)
	if err != nil {
		return nil, err
	}
	out := make([]KeywordQS, 0, len(rows))
	for _, raw := range rows {
		var r row
		if err := json.Unmarshal(raw, &r); err != nil {
			continue
		}
		out = append(out, KeywordQS{
			KeywordText:    r.AdGroupCriterion.Keyword.Text,
			MatchType:      r.AdGroupCriterion.Keyword.MatchType,
			AdGroupName:    r.AdGroup.Name,
			QualityScore:   r.AdGroupCriterion.QualityInfo.QualityScore,
			ExpectedCTR:    r.AdGroupCriterion.QualityInfo.SearchPredictedCtr,
			AdRelevance:    r.AdGroupCriterion.QualityInfo.CreativeQualityScore,
			LandingPageExp: r.AdGroupCriterion.QualityInfo.PostClickQualityScore,
		})
	}
	return out, nil
}
