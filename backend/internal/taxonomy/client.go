package taxonomy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// Client consume los endpoints de taxonomía de clientes de aremko-booking.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// EjeBucket representa una categoría de un eje con sus conteos y %.
type EjeBucket struct {
	Label            string   `json:"label"`
	Count            int      `json:"count"`
	PctTotal         float64  `json:"pct_total"`
	PctSistemaActual *float64 `json:"pct_sistema_actual"`
}

// MatrixCell es una celda de las matrices cruzadas.
type MatrixCell struct {
	Valor    string `json:"valor,omitempty"`
	Estilo   string `json:"estilo,omitempty"`
	Contexto string `json:"contexto,omitempty"`
	Count    int    `json:"count"`
}

// SegmentsResponse es el shape del endpoint /clientes/taxonomia/segments/.
type SegmentsResponse struct {
	TotalClientes         int          `json:"total_clientes"`
	NSistemaActual        int          `json:"n_sistema_actual"`
	NPreSistema           int          `json:"n_pre_sistema"`
	UltimaActualizacion   string       `json:"ultima_actualizacion"`
	MesesVentana          int          `json:"meses_ventana"`
	EjeValor              []EjeBucket  `json:"eje_valor"`
	EjeEstilo             []EjeBucket  `json:"eje_estilo"`
	EjeContexto           []EjeBucket  `json:"eje_contexto"`
	MatrizValorXEstilo    []MatrixCell `json:"matriz_valor_x_estilo"`
	MatrizEstiloXContexto []MatrixCell `json:"matriz_estilo_x_contexto"`
}

// CohortRow es una fila de cliente devuelta por el endpoint /cohort/.
type CohortRow struct {
	ClienteID            int      `json:"cliente_id"`
	EjeValor             string   `json:"eje_valor"`
	EjeEstilo            string   `json:"eje_estilo"`
	EjeContexto          string   `json:"eje_contexto"`
	TotalVisitas         int      `json:"total_visitas"`
	GastoTotal           float64  `json:"gasto_total"`
	TicketPromedio       float64  `json:"ticket_promedio"`
	DiasDesdeUltimaVisita int     `json:"dias_desde_ultima_visita"`
	AntiguedadMeses      int      `json:"antiguedad_meses"`
	AvgCantidadPersonas  *float64 `json:"avg_cantidad_personas,omitempty"`
	PctFinde             *float64 `json:"pct_finde,omitempty"`
	PctReservasBundle    *float64 `json:"pct_reservas_bundle,omitempty"`
	TieneEmail           bool     `json:"tiene_email"`
	TieneTelefono        bool     `json:"tiene_telefono"`
}

// CohortStats son los agregados de la cohorte consultada.
type CohortStats struct {
	GastoTotalSum      float64 `json:"gasto_total_sum"`
	GastoTotalAvg      float64 `json:"gasto_total_avg"`
	VisitasAvg         float64 `json:"visitas_avg"`
	TicketPromedioAvg  float64 `json:"ticket_promedio_avg"`
	AntiguedadMesesAvg float64 `json:"antiguedad_meses_avg"`
}

// CohortResponse es el shape del endpoint /clientes/taxonomia/cohort/.
type CohortResponse struct {
	Filtros     map[string]string `json:"filtros_aplicados"`
	CountTotal  int               `json:"count_total"`
	Stats       CohortStats       `json:"stats"`
	Clientes    []CohortRow       `json:"clientes"`
	Limit       int               `json:"limit"`
	OrderBy     string            `json:"order_by"`
}

// CohortOptions son los parámetros para GetCohort.
type CohortOptions struct {
	EjeValor    string
	EjeEstilo   string
	EjeContexto string
	Limit       int    // default 100, max 500
	OrderBy     string // gasto_total_desc | gasto_total_asc | visitas_desc | antiguedad_desc | recency_asc
}

// Cache in-memory de SegmentsResponse. La data en Django se refresca manual
// (no hay cron), así que un TTL de 30 minutos es razonable: si el usuario
// ejecuta el management command de refresh y vuelve al dashboard, en máx 30
// min ve la data nueva.
var (
	segmentsCache    *SegmentsResponse
	segmentsCacheAt  time.Time
	segmentsCacheMu  sync.Mutex
	segmentsCacheTTL = 30 * time.Minute
)

// GetSegments obtiene la distribución agregada con cache local 30m.
func (c *Client) GetSegments() (*SegmentsResponse, error) {
	segmentsCacheMu.Lock()
	defer segmentsCacheMu.Unlock()
	if segmentsCache != nil && time.Since(segmentsCacheAt) < segmentsCacheTTL {
		return segmentsCache, nil
	}

	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/clientes/taxonomia/segments/", c.BaseURL)
	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		if segmentsCache != nil {
			return segmentsCache, nil
		}
		return nil, fmt.Errorf("error fetching segments: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading segments: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("segments endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result SegmentsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing segments: %w", err)
	}
	segmentsCache = &result
	segmentsCacheAt = time.Now()
	return &result, nil
}

// GetCohort obtiene la lista de clientes que matchean los filtros.
// Sin cache porque cada combinación de filtros + order es distinta.
func (c *Client) GetCohort(opts CohortOptions) (*CohortResponse, error) {
	q := url.Values{}
	if opts.EjeValor != "" {
		q.Set("eje_valor", opts.EjeValor)
	}
	if opts.EjeEstilo != "" {
		q.Set("eje_estilo", opts.EjeEstilo)
	}
	if opts.EjeContexto != "" {
		q.Set("eje_contexto", opts.EjeContexto)
	}
	if opts.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", opts.Limit))
	}
	if opts.OrderBy != "" {
		q.Set("order_by", opts.OrderBy)
	}

	endpoint := fmt.Sprintf("%s/ventas/api/aremko-cli/clientes/taxonomia/cohort/?%s", c.BaseURL, q.Encode())
	resp, err := c.HTTPClient.Get(endpoint)
	if err != nil {
		return nil, fmt.Errorf("error fetching cohort: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading cohort: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cohort endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result CohortResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing cohort: %w", err)
	}
	return &result, nil
}

// InvalidateCache fuerza el siguiente GetSegments a hitar Django. Útil cuando
// el usuario refresca manualmente la taxonomía desde admin Django.
func InvalidateSegmentsCache() {
	segmentsCacheMu.Lock()
	defer segmentsCacheMu.Unlock()
	segmentsCache = nil
}
