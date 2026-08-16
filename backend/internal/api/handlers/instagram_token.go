package handlers

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
)

// ============================================================================
// H-107 — token de Instagram con fuente de verdad en Django
// ----------------------------------------------------------------------------
// El token de Instagram Login vivía SOLO como env var y venció en silencio a los
// ~60 días (caso real 2026-08-15, OAuthException 190 en plena conversación).
// Ahora Django guarda el token (editable en admin) y lo AUTO-REFRESCA contra
// Meta cuando este fetch se lo pide (~cada 7 días). Acá solo se cachea y se cae
// a la env var INSTAGRAM_ACCESS_TOKEN si Django no responde o no tiene token
// (resiliencia + transición). SOLO uso server-side: el token jamás viaja al
// navegador (no hay ruta pública hacia esto).
// ============================================================================

var igToken struct {
	mu    sync.Mutex
	valor string
	hasta time.Time
}

const (
	igTokenTTL      = 10 * time.Minute // cache normal
	igTokenTTLCorto = 1 * time.Minute  // tras usar el fallback: reintentar Django pronto
)

// instagramToken devuelve el token vigente: Django (cacheado) o la env var.
// Devuelve "" solo si no hay token en ninguna de las dos fuentes.
func instagramToken(cfg *config.Config) string {
	igToken.mu.Lock()
	defer igToken.mu.Unlock()
	if igToken.valor != "" && time.Now().Before(igToken.hasta) {
		return igToken.valor
	}
	if cfg.LunaAPIKey != "" && cfg.BookingSystemURL != "" {
		raw, err := bookings.NewClient(cfg.BookingSystemURL).GetInstagramTokenRaw(cfg.LunaAPIKey)
		if err == nil {
			var out struct {
				Token        string `json:"token"`
				RefreshError string `json:"refresh_error"`
			}
			if json.Unmarshal(raw, &out) == nil && strings.TrimSpace(out.Token) != "" {
				if out.RefreshError != "" {
					// El token guardado sigue vigente pero el refresh está fallando:
					// dejar rastro para el forense (el email de alerta lo manda Django).
					log.Printf("[instagram] token OK pero el auto-refresh reporta error: %s", out.RefreshError)
				}
				igToken.valor = strings.TrimSpace(out.Token)
				igToken.hasta = time.Now().Add(igTokenTTL)
				return igToken.valor
			}
		} else {
			log.Printf("[instagram] no se pudo leer el token desde Django (%v) → fallback env", err)
		}
	}
	// Fallback: comportamiento histórico (env var). Cache corto para reintentar Django.
	if cfg.InstagramAccessToken != "" {
		igToken.valor = cfg.InstagramAccessToken
		igToken.hasta = time.Now().Add(igTokenTTLCorto)
		return igToken.valor
	}
	return ""
}
