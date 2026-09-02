package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/go-chi/chi/v5"
)

// ResumenReserva proxea el texto del resumen de una reserva (nº + servicios +
// banco/transferencia + condiciones). Sirve para mostrar/reenviar el resumen y
// para diagnosticar. GET /api/v1/resumen-reserva/{id}.
func ResumenReserva(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		id, err := strconv.Atoi(chi.URLParam(r, "id"))
		if err != nil || id <= 0 {
			respondError(w, http.StatusBadRequest, "id de reserva inválido")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).GetResumenReservaRaw(cfg.LunaAPIKey, id)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// LunaCrearReserva finaliza una propuesta de reserva tras la aprobación de Deborah
// (H-028). Hace dos cosas contra Django en una sola llamada para el front:
//  1. POST /api/luna/reservas/create/ {propuesta_id} → crea la reserva (idempotente).
//  2. GET /api/v1/resumen-reserva/{id}/ → trae el texto de resumen+pago para el cliente.
//
// Responde { success, reserva:{id,numero,total,estado_pago}, resumen_texto }.
func LunaCrearReserva(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		var body struct {
			PropuestaID string `json:"propuesta_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.PropuestaID) == "" {
			respondError(w, http.StatusBadRequest, "se requiere 'propuesta_id'")
			return
		}

		bc := bookings.NewClient(cfg.BookingSystemURL)
		raw, err := bc.CrearReservaLuna(cfg.LunaAPIKey, strings.TrimSpace(body.PropuestaID))
		if err != nil {
			// Fuera de cupo / propuesta vencida / error de Django → lo propagamos.
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		var cr struct {
			Success bool `json:"success"`
			Reserva struct {
				ID         int     `json:"id"`
				Numero     string  `json:"numero"`
				Total      float64 `json:"total"`
				EstadoPago string  `json:"estado_pago"`
			} `json:"reserva"`
		}
		if e := json.Unmarshal(raw, &cr); e != nil || cr.Reserva.ID == 0 {
			respondError(w, http.StatusBadGateway, "respuesta inesperada al crear la reserva")
			return
		}

		// Traer el resumen (nº + banco + mail + foto). Si falla, devolvemos la reserva igual.
		resumenTexto := ""
		if resumenRaw, e := bc.GetResumenReservaRaw(cfg.LunaAPIKey, cr.Reserva.ID); e == nil {
			var rr struct {
				ResumenTexto string `json:"resumen_texto"`
			}
			_ = json.Unmarshal(resumenRaw, &rr)
			resumenTexto = rr.ResumenTexto
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":       true,
			"reserva":       cr.Reserva,
			"resumen_texto": resumenTexto,
		})
	}
}

// LunaPrepararCotizacion CREA una cotización desde el cajón cuando Luna no armó
// nada — se enredó, el cliente llegó por otro canal, o simplemente hay que
// cotizar a mano (Jorge, 01-09-2026).
//
// Reenvía a Django POST /api/luna/reservas/preparar/, el MISMO endpoint de Luna,
// marcando `origen: "cajon"`: con esa marca Django exige solo el NOMBRE del
// cliente. El correo y el RUT se los pide la propia cotización al cliente cuando
// aprueba — pedirle el RUT antes de decirle el precio pierde la venta.
//
// La `idempotency_key` la manda el front y no se genera acá a propósito: si la
// generáramos por llamada, un doble clic crearía dos cotizaciones del mismo hilo.
func LunaPrepararCotizacion(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		var body struct {
			IdempotencyKey string `json:"idempotency_key"`
			Canal          string `json:"canal"`
			ExternalID     string `json:"external_id"`
			Cliente        struct {
				Nombre             string `json:"nombre"`
				Email              string `json:"email"`
				DocumentoIdentidad string `json:"documento_identidad"`
			} `json:"cliente"`
			Servicios []struct {
				ServicioID       int    `json:"servicio_id"`
				Fecha            string `json:"fecha"`
				Hora             string `json:"hora"`
				CantidadPersonas int    `json:"cantidad_personas"`
			} `json:"servicios"`
			Productos []struct {
				ProductoID int `json:"producto_id"`
				Cantidad   int `json:"cantidad"`
			} `json:"productos"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondError(w, http.StatusBadRequest, "cuerpo inválido")
			return
		}
		body.Canal = strings.TrimSpace(body.Canal)
		body.ExternalID = strings.TrimSpace(body.ExternalID)
		body.Cliente.Nombre = strings.TrimSpace(body.Cliente.Nombre)
		if body.Canal == "" || body.ExternalID == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'canal' y 'external_id'")
			return
		}
		// Cortes tempranos con el mismo criterio de Django, para que el error
		// se lea en el cajón y no como un 502 opaco del proxy.
		if len([]rune(body.Cliente.Nombre)) < 3 {
			respondError(w, http.StatusBadRequest, "el nombre del cliente es obligatorio (mín 3 caracteres)")
			return
		}
		if len(body.Servicios) == 0 {
			respondError(w, http.StatusBadRequest, "la cotización debe llevar al menos un servicio")
			return
		}
		if strings.TrimSpace(body.IdempotencyKey) == "" {
			respondError(w, http.StatusBadRequest, "se requiere 'idempotency_key' (evita cotizaciones dobles al reintentar)")
			return
		}
		if body.Productos == nil {
			body.Productos = []struct {
				ProductoID int `json:"producto_id"`
				Cantidad   int `json:"cantidad"`
			}{}
		}

		payload := map[string]interface{}{
			"idempotency_key": strings.TrimSpace(body.IdempotencyKey),
			"canal":           body.Canal,
			"external_id":     body.ExternalID,
			"payload": map[string]interface{}{
				"origen":      "cajon",
				"cliente":     body.Cliente,
				"servicios":   body.Servicios,
				"productos":   body.Productos,
				"metodo_pago": "pendiente",
			},
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).PrepararPropuestaLuna(cfg.LunaAPIKey, payload)
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// LunaEditarPropuesta corrige una propuesta de reserva antes de enviarla (H-042).
// Reenvía a Django POST /api/luna/reservas/editar/ con REEMPLAZO TOTAL de servicios +
// productos. NO mandamos precios: Django re-lee el catálogo y recalcula total/descuento.
// Tras esto el front relee la conversación y el cajón se repinta con el total corregido.
func LunaEditarPropuesta(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		var body struct {
			PropuestaID string `json:"propuesta_id"`
			Servicios   []struct {
				ServicioID       int    `json:"servicio_id"`
				Fecha            string `json:"fecha"`
				Hora             string `json:"hora"`
				CantidadPersonas int    `json:"cantidad_personas"`
			} `json:"servicios"`
			Productos []struct {
				ProductoID int `json:"producto_id"`
				Cantidad   int `json:"cantidad"`
			} `json:"productos"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.PropuestaID) == "" {
			respondError(w, http.StatusBadRequest, "se requiere 'propuesta_id'")
			return
		}
		// Django también lo valida, pero cortamos temprano: debe quedar ≥1 servicio.
		if len(body.Servicios) == 0 {
			respondError(w, http.StatusBadRequest, "la cotización debe quedar con al menos un servicio")
			return
		}
		body.PropuestaID = strings.TrimSpace(body.PropuestaID)
		if body.Productos == nil {
			body.Productos = []struct {
				ProductoID int `json:"producto_id"`
				Cantidad   int `json:"cantidad"`
			}{}
		}

		raw, err := bookings.NewClient(cfg.BookingSystemURL).EditarPropuestaLuna(cfg.LunaAPIKey, body)
		if err != nil {
			// Propaga el detalle de Django (no_editable / expirada / validation_error / etc.).
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// LunaEditarCarrito (H-079, H-046 F2): corrige el carrito EN CURSO (pre-cotización)
// de una conversación — reemplazo total de servicios + productos. A diferencia de la
// propuesta, acá las listas PUEDEN quedar vacías: Django elimina el carrito (vaciar).
func LunaEditarCarrito(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		var body struct {
			Canal      string `json:"canal"`
			ExternalID string `json:"external_id"`
			Servicios  []struct {
				ServicioID       int     `json:"servicio_id"`
				Fecha            *string `json:"fecha"`
				Hora             *string `json:"hora"`
				CantidadPersonas int     `json:"cantidad_personas"`
			} `json:"servicios"`
			Productos []struct {
				ProductoID int `json:"producto_id"`
				Cantidad   int `json:"cantidad"`
			} `json:"productos"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil ||
			strings.TrimSpace(body.Canal) == "" || strings.TrimSpace(body.ExternalID) == "" {
			respondError(w, http.StatusBadRequest, "se requieren 'canal' y 'external_id'")
			return
		}
		// Django exige que 'servicios' venga como lista (aunque sea vacía); nil → [].
		if body.Servicios == nil {
			body.Servicios = []struct {
				ServicioID       int     `json:"servicio_id"`
				Fecha            *string `json:"fecha"`
				Hora             *string `json:"hora"`
				CantidadPersonas int     `json:"cantidad_personas"`
			}{}
		}
		if body.Productos == nil {
			body.Productos = []struct {
				ProductoID int `json:"producto_id"`
				Cantidad   int `json:"cantidad"`
			}{}
		}

		raw, err := bookings.NewClient(cfg.BookingSystemURL).EditarCarritoLuna(cfg.LunaAPIKey, body)
		if err != nil {
			// Propaga el detalle de Django (carrito_not_found / validation_error / etc.).
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}

// LunaDescartarPropuesta cierra/descarta el borrador de cotización desde la
// conversación (H-042). Reenvía a Django POST /api/luna/reservas/descartar/. La
// propuesta queda 'descartada' → desaparece del cajón en la próxima lectura.
func LunaDescartarPropuesta(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado")
			return
		}
		var body struct {
			PropuestaID string `json:"propuesta_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.PropuestaID) == "" {
			respondError(w, http.StatusBadRequest, "se requiere 'propuesta_id'")
			return
		}
		raw, err := bookings.NewClient(cfg.BookingSystemURL).DescartarPropuestaLuna(cfg.LunaAPIKey, strings.TrimSpace(body.PropuestaID))
		if err != nil {
			respondError(w, http.StatusBadGateway, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
	}
}
