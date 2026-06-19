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
