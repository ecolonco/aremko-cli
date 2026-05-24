package operacionvueltaacasa

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client consume los 9 endpoints REST de Operación Vuelta a Casa en aremko-booking.
// Todos los endpoints requieren auth con header X-API-KEY contra AUTOMATION_API_KEY.
type Client struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTPClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

// ============================================================================
// Structs de respuesta — espejos de los endpoints Django
// ============================================================================

// ClienteSummary es el bloque "cliente" dentro de un contacto.
type ClienteSummary struct {
	ID             int    `json:"id"`
	Nombre         string `json:"nombre"`
	Telefono       string `json:"telefono"`
	TelefonoLimpio string `json:"telefono_limpio"`
}

// PerfilResumen es el bloque "perfil_resumen" mostrado en la tarjeta del operador.
type PerfilResumen struct {
	EstadoValor            string   `json:"estado_valor"`
	DiasSinVenir           int      `json:"dias_sin_venir"`
	Cohorte                string   `json:"cohorte"`
	VisitasTotales         int      `json:"visitas_totales"`
	GastoHistorico         int      `json:"gasto_historico"`
	UltimaVisita           string   `json:"ultima_visita"`
	UltimaVisitaHumanizada string   `json:"ultima_visita_humanizada,omitempty"`
	ServiciosFavoritos     []string `json:"servicios_favoritos,omitempty"`
	PatronHabitual         string   `json:"patron_habitual,omitempty"`
}

// Contacto es el contacto WhatsApp completo devuelto por siguiente/.
type Contacto struct {
	ID                  int            `json:"id"`
	Cliente             ClienteSummary `json:"cliente"`
	PerfilResumen       PerfilResumen  `json:"perfil_resumen"`
	ScriptID            string         `json:"script_id"`
	Salva               int            `json:"salva"`
	MensajeRenderizado  string         `json:"mensaje_renderizado"`
	Prioridad           int            `json:"prioridad"`
	MensajeEnviadoOrig  string         `json:"mensaje_enviado_editado,omitempty"`
	FechaEnvio          string         `json:"fecha_envio,omitempty"`
	TipoRespuestaActual string         `json:"tipo_respuesta,omitempty"`
}

// Progreso es el bloque "progreso" del response de siguiente/.
type Progreso struct {
	CompletadosHoy        int `json:"completados_hoy"`
	PendientesHoy         int `json:"pendientes_hoy"`
	RespuestasPendientes  int `json:"respuestas_pendientes"`
	CelebracionesPending  int `json:"celebraciones_pendientes"`
}

// ResumenSemana es lo que aparece dentro del resumen_dia/ en "semana_actual".
type ResumenSemana struct {
	MensajesEnviados    int     `json:"mensajes_enviados"`
	RespuestasRecibidas int     `json:"respuestas_recibidas"`
	TasaRespuesta       float64 `json:"tasa_respuesta"`
	ReservasAtribuidas  int     `json:"reservas_atribuidas"`
	IngresoAtribuido    int     `json:"ingreso_atribuido"`
}

// ResumenDia es el response del endpoint resumen-dia/.
type ResumenDia struct {
	Fecha               string        `json:"fecha"`
	Operador            string        `json:"operador,omitempty"`
	Enviados            int           `json:"enviados"`
	Omitidos            int           `json:"omitidos"`
	NoAplica            int           `json:"no_aplica"`
	TiempoTotalMinutos  int           `json:"tiempo_total_minutos,omitempty"`
	SemanaActual        ResumenSemana `json:"semana_actual"`
}

// SiguienteResponse es el response del endpoint /bandeja-whatsapp/siguiente/.
// El tipo determina qué pintar en pantalla.
type SiguienteResponse struct {
	Tipo       string      `json:"tipo"` // respuesta_pendiente | celebracion | nuevo_contacto | fin_del_dia
	Contacto   *Contacto   `json:"contacto,omitempty"`
	Progreso   Progreso    `json:"progreso"`
	ResumenDia *ResumenDia `json:"resumen_dia,omitempty"`
}

// Conflict409 es el shape del 409 cuando el cliente cambió de estado entre
// la generación de la bandeja y el momento de marcar enviado.
type Conflict409 struct {
	Error             string `json:"error"`
	Mensaje           string `json:"mensaje"`
	EjeValorAnterior  string `json:"eje_valor_anterior"`
	EjeValorActual    string `json:"eje_valor_actual"`
}

// MarcarEnviadoResponse incluye opcionalmente el siguiente contacto pre-resuelto
// para ahorrar round-trip del frontend.
type MarcarEnviadoResponse struct {
	Status              string             `json:"status"`
	ContactoID          int                `json:"contacto_id,omitempty"`
	SiguienteContacto   *SiguienteResponse `json:"siguiente_contacto,omitempty"`
}

// ExplicacionResponse es el "por qué este mensaje" generado por la IA (stub por ahora).
type ExplicacionResponse struct {
	Explicacion string `json:"explicacion"`
	Fuente      string `json:"fuente,omitempty"` // "stub" | "llm"
}

// MatrixMovimientoCell es una fila de la matriz origen→destino del eje valor.
type MatrixMovimientoCell struct {
	Antes              string `json:"antes"`
	Despues            string `json:"despues"`
	Cantidad           int    `json:"cantidad"`
	AtribuidosWhatsApp int    `json:"atribuidos_whatsapp"`
}

// MovimientoDia es el conteo de movimientos por día.
type MovimientoDia struct {
	Fecha     string `json:"fecha"`
	Positivos int    `json:"positivos"`
	Negativos int    `json:"negativos"`
}

// MovimientosTotales son los agregados del período consultado.
type MovimientosTotales struct {
	Positivos          int `json:"positivos"`
	Negativos          int `json:"negativos"`
	SaldoNeto          int `json:"saldo_neto"`
	AtribuidosWhatsApp int `json:"atribuidos_whatsapp"`
}

// MovimientosResponse es el shape del endpoint /movimientos/.
type MovimientosResponse struct {
	Periodo            map[string]string      `json:"periodo"`
	Totales            MovimientosTotales     `json:"totales"`
	MatrizEjeValor     []MatrixMovimientoCell `json:"matriz_eje_valor"`
	MovimientosPorDia  []MovimientoDia        `json:"movimientos_por_dia"`
}

// ScriptStats es la performance de un script en un período.
type ScriptStats struct {
	ScriptID         string  `json:"script_id"`
	Nombre           string  `json:"nombre"`
	Enviados         int     `json:"enviados"`
	Respondieron     int     `json:"respondieron"`
	TasaRespuesta    float64 `json:"tasa_respuesta"`
	Reservaron       int     `json:"reservaron"`
	TasaConversion   float64 `json:"tasa_conversion"`
	IngresoAtribuido int     `json:"ingreso_atribuido"`
}

// ScriptsEstadisticasResponse es el shape de /scripts-estadisticas/.
type ScriptsEstadisticasResponse struct {
	Scripts []ScriptStats `json:"scripts"`
}

// ============================================================================
// Bodies de request
// ============================================================================

// MarcarEnviadoRequest es el body de POST /marcar-enviado/.
type MarcarEnviadoRequest struct {
	Operador               string `json:"operador"`
	MensajeEnviadoEditado  string `json:"mensaje_enviado_editado,omitempty"`
}

// MarcarOmitidoRequest es el body de POST /marcar-omitido/.
type MarcarOmitidoRequest struct {
	Operador string `json:"operador"`
}

// MarcarNoAplicaRequest es el body de POST /marcar-no-aplica/.
type MarcarNoAplicaRequest struct {
	Operador string `json:"operador"`
	Razon    string `json:"razon,omitempty"`
}

// RegistrarRespuestaRequest es el body de POST /registrar-respuesta/.
type RegistrarRespuestaRequest struct {
	Respondio      bool   `json:"respondio"`
	TipoRespuesta  string `json:"tipo_respuesta"`
	NotaOperador   string `json:"nota_operador,omitempty"`
	Operador       string `json:"operador"`
}

// BloquearClienteRequest es el body de POST /bloquear-cliente/.
// Ambos campos son opcionales según el backend.
type BloquearClienteRequest struct {
	Operador string `json:"operador,omitempty"`
	Razon    string `json:"razon,omitempty"`
}

// BloquearClienteResponse incluye 2 flags para distinguir efectos reales
// de idempotencia / contactos ya enviados.
type BloquearClienteResponse struct {
	Success              bool `json:"success"`
	ClienteID            int  `json:"cliente_id"`
	ClienteBloqueado     bool `json:"cliente_bloqueado"`      // false si ya estaba bloqueado
	ContactoID           int  `json:"contacto_id"`
	ContactoActualizado  bool `json:"contacto_actualizado"`   // false si ya estaba enviado
}

// ============================================================================
// Helper interno: build request con auth
// ============================================================================

const basePath = "/ventas/api/aremko-cli/operacion-vuelta-a-casa"

func (c *Client) buildRequest(method, path string, body interface{}) (*http.Request, error) {
	fullURL := c.BaseURL + basePath + path

	var bodyReader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("error marshaling body: %w", err)
		}
		bodyReader = bytes.NewReader(buf)
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}
	req.Header.Set("X-API-KEY", c.APIKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

// doJSON ejecuta la request y deserializa el response en `out` si fue 200.
// Devuelve el statusCode + raw body para que el caller decida cómo manejar 4xx/5xx.
func (c *Client) doJSON(req *http.Request, out interface{}) (int, []byte, error) {
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("error executing request: %w", err)
	}
	defer resp.Body.Close()
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, fmt.Errorf("error reading body: %w", err)
	}
	if resp.StatusCode == http.StatusOK && out != nil {
		if err := json.Unmarshal(rawBody, out); err != nil {
			return resp.StatusCode, rawBody, fmt.Errorf("error parsing response: %w", err)
		}
	}
	return resp.StatusCode, rawBody, nil
}

// ============================================================================
// Endpoint methods
// ============================================================================

// Siguiente devuelve el próximo cliente a procesar para el operador.
// Tipo: "respuesta_pendiente" | "celebracion" | "nuevo_contacto" | "fin_del_dia".
func (c *Client) Siguiente() (*SiguienteResponse, error) {
	req, err := c.buildRequest("GET", "/bandeja-whatsapp/siguiente/", nil)
	if err != nil {
		return nil, err
	}
	var result SiguienteResponse
	status, body, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("siguiente returned %d: %s", status, string(body))
	}
	return &result, nil
}

// MarcarEnviado marca el contacto como enviado. Devuelve también el siguiente
// pre-resuelto para ahorrar round-trip.
// Si el cliente cambió de estado entre las 06:00 y ahora, devuelve 409 — el
// caller debe interpretar conflictErr y mostrar warning al operador.
func (c *Client) MarcarEnviado(contactoID int, body MarcarEnviadoRequest) (*MarcarEnviadoResponse, *Conflict409, error) {
	path := fmt.Sprintf("/bandeja-whatsapp/%d/marcar-enviado/", contactoID)
	req, err := c.buildRequest("POST", path, body)
	if err != nil {
		return nil, nil, err
	}
	var result MarcarEnviadoResponse
	status, rawBody, err := c.doJSON(req, &result)
	if err != nil {
		return nil, nil, err
	}
	if status == http.StatusConflict {
		var conflict Conflict409
		if jerr := json.Unmarshal(rawBody, &conflict); jerr != nil {
			return nil, nil, fmt.Errorf("error parsing conflict 409: %w", jerr)
		}
		return nil, &conflict, nil
	}
	if status != http.StatusOK {
		return nil, nil, fmt.Errorf("marcar-enviado returned %d: %s", status, string(rawBody))
	}
	return &result, nil, nil
}

// MarcarOmitido deja el contacto disponible para mañana.
func (c *Client) MarcarOmitido(contactoID int, body MarcarOmitidoRequest) error {
	path := fmt.Sprintf("/bandeja-whatsapp/%d/marcar-omitido/", contactoID)
	req, err := c.buildRequest("POST", path, body)
	if err != nil {
		return err
	}
	status, rawBody, err := c.doJSON(req, nil)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("marcar-omitido returned %d: %s", status, string(rawBody))
	}
	return nil
}

// MarcarNoAplica setea gracia 90d para el cliente.
func (c *Client) MarcarNoAplica(contactoID int, body MarcarNoAplicaRequest) error {
	path := fmt.Sprintf("/bandeja-whatsapp/%d/marcar-no-aplica/", contactoID)
	req, err := c.buildRequest("POST", path, body)
	if err != nil {
		return err
	}
	status, rawBody, err := c.doJSON(req, nil)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("marcar-no-aplica returned %d: %s", status, string(rawBody))
	}
	return nil
}

// RegistrarRespuesta registra qué pasó con un mensaje enviado.
// tipo_respuesta válidos: reservo, interesado, consulto_precio, mas_adelante,
// rechazo, opt_out, sin_respuesta.
func (c *Client) RegistrarRespuesta(contactoID int, body RegistrarRespuestaRequest) error {
	path := fmt.Sprintf("/bandeja-whatsapp/%d/registrar-respuesta/", contactoID)
	req, err := c.buildRequest("POST", path, body)
	if err != nil {
		return err
	}
	status, rawBody, err := c.doJSON(req, nil)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("registrar-respuesta returned %d: %s", status, string(rawBody))
	}
	return nil
}

// GetExplicacion devuelve el "por qué este mensaje" (stub por ahora hasta que
// se conecte el LLM via OpenRouter).
func (c *Client) GetExplicacion(contactoID int) (*ExplicacionResponse, error) {
	path := fmt.Sprintf("/bandeja-whatsapp/explicacion/%d/", contactoID)
	req, err := c.buildRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	var result ExplicacionResponse
	status, body, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("explicacion returned %d: %s", status, string(body))
	}
	return &result, nil
}

// GetResumenDia devuelve stats del día + acumulado semana ISO.
// Si fecha es "", asume hoy.
func (c *Client) GetResumenDia(fecha string) (*ResumenDia, error) {
	path := "/bandeja-whatsapp/resumen-dia/"
	if fecha != "" {
		path += "?fecha=" + url.QueryEscape(fecha)
	}
	req, err := c.buildRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	var result ResumenDia
	status, body, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("resumen-dia returned %d: %s", status, string(body))
	}
	return &result, nil
}

// GetMovimientos devuelve la matriz origen-destino del período + atribución WhatsApp.
// Formato fechas: "YYYY-MM-DD".
func (c *Client) GetMovimientos(desde, hasta string) (*MovimientosResponse, error) {
	q := url.Values{}
	q.Set("desde", desde)
	q.Set("hasta", hasta)
	path := "/movimientos/?" + q.Encode()
	req, err := c.buildRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	var result MovimientosResponse
	status, body, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("movimientos returned %d: %s", status, string(body))
	}
	return &result, nil
}

// ContactoHistorial es la versión extendida del Contacto devuelta por /del-dia/.
type ContactoHistorial struct {
	ID                    int            `json:"id"`
	Cliente               ClienteSummary `json:"cliente"`
	PerfilResumen         PerfilResumen  `json:"perfil_resumen"`
	ScriptID              string         `json:"script_id"`
	Salva                 int            `json:"salva"`
	MensajeRenderizado    string         `json:"mensaje_renderizado"`
	MensajeEnviadoEditado string         `json:"mensaje_enviado_editado,omitempty"`
	Prioridad             int            `json:"prioridad"`
	FechaSugerido         string         `json:"fecha_sugerido,omitempty"`
	Estado                string         `json:"estado"`
	FechaEnvio            string         `json:"fecha_envio,omitempty"`
	Operador              string         `json:"operador,omitempty"`
	Respondio             bool           `json:"respondio"`
	TipoRespuesta         string         `json:"tipo_respuesta,omitempty"`
	NotaOperador          string         `json:"nota_operador,omitempty"`
	ClienteOptOutActual   bool           `json:"cliente_opt_out_actual"`
}

// DelDiaStats son los conteos por estado del día.
type DelDiaStats struct {
	Enviados    int `json:"enviados"`
	Omitidos    int `json:"omitidos"`
	NoAplica    int `json:"no_aplica"`
	Pendientes  int `json:"pendientes"`
	Descartados int `json:"descartados"`
}

// DelDiaResponse es el shape del endpoint /bandeja-whatsapp/del-dia/.
type DelDiaResponse struct {
	Fecha          string              `json:"fecha"`
	OperadorFiltro string              `json:"operador_filtro,omitempty"`
	Total          int                 `json:"total"`
	Stats          DelDiaStats         `json:"stats"`
	LimitAplicado  int                 `json:"limit_aplicado"`
	Contactos      []ContactoHistorial `json:"contactos"`
}

// DelDiaOptions son los parámetros para GetDelDia.
type DelDiaOptions struct {
	Fecha    string // YYYY-MM-DD, vacío = hoy
	Operador string // vacío = todos
	Limit    int    // 0 = default (100)
}

// GetDelDia lista todos los contactos del día (procesados + pendientes) para el
// drawer "Historial del día" del Asistente Deborah.
func (c *Client) GetDelDia(opts DelDiaOptions) (*DelDiaResponse, error) {
	q := url.Values{}
	if opts.Fecha != "" {
		q.Set("fecha", opts.Fecha)
	}
	if opts.Operador != "" {
		q.Set("operador", opts.Operador)
	}
	if opts.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", opts.Limit))
	}
	path := "/bandeja-whatsapp/del-dia/"
	if encoded := q.Encode(); encoded != "" {
		path += "?" + encoded
	}
	req, err := c.buildRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	var result DelDiaResponse
	status, body, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("del-dia returned %d: %s", status, string(body))
	}
	return &result, nil
}

// BloquearCliente marca permanentemente al cliente como opt_out_whatsapp=true
// y, si el contacto está pendiente, lo marca como no_aplica.
// Idempotente: bloquear 2 veces devuelve cliente_bloqueado=false la 2ª vez.
// Si el contacto ya fue enviado, bloquea al cliente pero respeta el estado del contacto.
func (c *Client) BloquearCliente(contactoID int, body BloquearClienteRequest) (*BloquearClienteResponse, error) {
	path := fmt.Sprintf("/bandeja-whatsapp/%d/bloquear-cliente/", contactoID)
	req, err := c.buildRequest("POST", path, body)
	if err != nil {
		return nil, err
	}
	var result BloquearClienteResponse
	status, rawBody, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("bloquear-cliente returned %d: %s", status, string(rawBody))
	}
	return &result, nil
}

// GetScriptsEstadisticas devuelve la performance de cada script en el período.
// Solo devuelve scripts que tuvieron al menos un uso.
func (c *Client) GetScriptsEstadisticas(desde, hasta string) (*ScriptsEstadisticasResponse, error) {
	q := url.Values{}
	q.Set("desde", desde)
	q.Set("hasta", hasta)
	path := "/scripts-estadisticas/?" + q.Encode()
	req, err := c.buildRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	var result ScriptsEstadisticasResponse
	status, body, err := c.doJSON(req, &result)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("scripts-estadisticas returned %d: %s", status, string(body))
	}
	return &result, nil
}
