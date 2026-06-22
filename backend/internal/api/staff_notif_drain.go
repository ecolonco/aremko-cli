package api

import (
	"log"
	"strconv"
	"time"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/whatsapp"
)

// staffNotifInterval es cada cuánto se drena la cola de avisos de operación.
const staffNotifInterval = 20 * time.Second

// StartStaffNotifDrain arranca el drenado periódico de la cola de avisos de
// operación al staff (H-038 — Luna interna Fase 2). Django encola avisos en
// NotificacionStaff (check-in → tareas RX/OPS); acá los enviamos por WhatsApp y
// los marcamos para no reenviarlos. Es PROACTIVO (push), funciona dentro de la
// ventana de 24h del staff; si está cerrada, el envío falla y se marca 'fallida'.
func StartStaffNotifDrain(cfg *config.Config) {
	if cfg.LunaAPIKey == "" || cfg.BookingSystemURL == "" ||
		cfg.WhatsAppAccessToken == "" || cfg.WhatsAppPhoneNumberID == "" {
		log.Printf("[staff-notif] drain deshabilitado (falta LUNA_API_KEY / BookingSystemURL / token WhatsApp)")
		return
	}
	log.Printf("[staff-notif] drain de avisos de operación activo (cada %s)", staffNotifInterval)
	go func() {
		ticker := time.NewTicker(staffNotifInterval)
		defer ticker.Stop()
		for range ticker.C {
			drainStaffNotifs(cfg)
		}
	}()
}

// drainStaffNotifs procesa un lote de avisos pendientes: los envía por WhatsApp,
// registra el saliente en el hilo y marca el resultado (enviada/fallida).
func drainStaffNotifs(cfg *config.Config) {
	bc := bookings.NewClient(cfg.BookingSystemURL)
	notifs, err := bc.GetStaffNotificaciones(cfg.LunaAPIKey, 50)
	if err != nil {
		log.Printf("[staff-notif] error consultando cola: %v", err)
		return
	}
	if len(notifs) == 0 {
		return
	}

	wc := whatsapp.NewClient(cfg.WhatsAppAccessToken, cfg.WhatsAppPhoneNumberID)
	var enviadas, fallidas []int
	var ultimoError string
	for _, n := range notifs {
		if n.Telefono == "" || n.Texto == "" {
			fallidas = append(fallidas, n.ID)
			ultimoError = "aviso sin teléfono o texto"
			continue
		}
		res, e := wc.SendSessionMessage(n.Telefono, n.Texto)
		if e != nil {
			log.Printf("[staff-notif] error enviando aviso %d a %s: %v", n.ID, n.Telefono, e)
			fallidas = append(fallidas, n.ID)
			ultimoError = e.Error()
			continue
		}
		// Registrar el saliente en el hilo (best-effort) sin sacar de pendientes.
		ts := strconv.FormatInt(time.Now().Unix(), 10)
		if pe := bc.PostWhatsAppOutbound(cfg.LunaAPIKey, bookings.WhatsAppOutboundReq{
			WaMessageID:      res.MessageID,
			To:               n.Telefono,
			Body:             n.Texto,
			Timestamp:        ts,
			NoMarcarAtendido: true,
		}); pe != nil {
			log.Printf("[staff-notif] aviso %d enviado pero no se registró el saliente: %v", n.ID, pe)
		}
		enviadas = append(enviadas, n.ID)
	}

	if len(enviadas) > 0 {
		if e := bc.MarcarStaffNotificaciones(cfg.LunaAPIKey, enviadas, "enviada", ""); e != nil {
			log.Printf("[staff-notif] error marcando %d enviadas: %v", len(enviadas), e)
		}
	}
	if len(fallidas) > 0 {
		if e := bc.MarcarStaffNotificaciones(cfg.LunaAPIKey, fallidas, "fallida", ultimoError); e != nil {
			log.Printf("[staff-notif] error marcando %d fallidas: %v", len(fallidas), e)
		}
	}
	log.Printf("[staff-notif] lote procesado: %d enviadas, %d fallidas", len(enviadas), len(fallidas))
}
