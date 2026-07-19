package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/social"
)

// H-067: cosecha semanal de métricas por publicación (Fase 3 del Asistente de
// Publicaciones — el ciclo de aprendizaje). La cosecha vive acá (Go) porque los
// tokens de IG Graph son de este backend; Django solo recibe y guarda.
//
// GET|POST /api/v1/cron/publicaciones-metricas?token=<REPORTE_CRON_TOKEN>
//   &semanas=4   ventana hacia atrás (default 4, tope 8)
//   &apply=1     escribe en Django; sin apply es DRY-RUN (arma y devuelve los
//                payloads sin tocar nada — para validar matching e insights
//                antes de que Django acepte `metricas`).
//
// Solo Instagram en F3-a (TikTok/GBP/email quedan fuera; `fuente` en el payload
// deja la puerta a "manual"). Matching por shortcode del permalink — Angélica
// pega la URL del post y con eso basta, no hace falta guardar el media-id.

type pubCandidata struct {
	ID           int                    `json:"id"`
	PiezaKey     string                 `json:"pieza_key"`
	Titulo       string                 `json:"titulo"`
	Canal        string                 `json:"canal"`
	Estado       string                 `json:"estado"`
	PublishedURL string                 `json:"published_url"`
	Metricas     map[string]interface{} `json:"metricas"`
}

// extraerShortcodeIG saca el shortcode de una URL de Instagram
// (instagram.com/p/XXX/, /reel/XXX/, /tv/XXX/). "" si no se reconoce.
func extraerShortcodeIG(rawURL string) string {
	u := strings.ToLower(strings.TrimSpace(rawURL))
	u = strings.TrimPrefix(u, "https://")
	u = strings.TrimPrefix(u, "http://")
	u = strings.TrimPrefix(u, "www.")
	if !strings.HasPrefix(u, "instagram.com/") {
		return ""
	}
	// Cortar query/fragment antes de partir el path.
	if i := strings.IndexAny(u, "?#"); i >= 0 {
		u = u[:i]
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(u, "instagram.com/"), "/"), "/")
	for i, p := range parts {
		if (p == "p" || p == "reel" || p == "reels" || p == "tv") && i+1 < len(parts) && parts[i+1] != "" {
			return parts[i+1]
		}
	}
	return ""
}

// SyncPublicacionesMetricas cosecha insights de IG por publicación publicada y
// (con apply=1) los persiste en Django vía publicacion_actualizar.
func SyncPublicacionesMetricas(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Auth por token — mismo patrón que el reporte diario (cron-job.org).
		if cfg.ReporteCronToken == "" || r.URL.Query().Get("token") != cfg.ReporteCronToken {
			respondError(w, http.StatusUnauthorized, "token inválido")
			return
		}
		if cfg.MetaAccessToken == "" {
			respondError(w, http.StatusServiceUnavailable, "META_ACCESS_TOKEN no configurado")
			return
		}
		if cfg.AutomationAPIKey == "" || cfg.BookingSystemURL == "" {
			respondError(w, http.StatusServiceUnavailable, "Django no configurado (AUTOMATION_API_KEY/BOOKING_SYSTEM_URL)")
			return
		}

		apply := r.URL.Query().Get("apply") == "1"
		semanas := 4
		if s := r.URL.Query().Get("semanas"); s != "" {
			if n, err := strconv.Atoi(s); err == nil && n >= 1 && n <= 8 {
				semanas = n
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
		defer cancel()

		// 1. Publicaciones publicadas con link de IG en la ventana.
		client := bookings.NewClient(cfg.BookingSystemURL)
		hoy := time.Now()
		wd := int(hoy.Weekday())
		if wd == 0 {
			wd = 7
		}
		lunesActual := hoy.AddDate(0, 0, -(wd - 1))

		var candidatas []pubCandidata
		for i := 0; i < semanas; i++ {
			semana := lunesActual.AddDate(0, 0, -7*i).Format("2006-01-02")
			raw, err := client.GetPublicacionesSemanaRaw(cfg.AutomationAPIKey, semana)
			if err != nil {
				continue // semana sin datos no corta la cosecha
			}
			var parsed struct {
				Publicaciones []pubCandidata `json:"publicaciones"`
			}
			if err := json.Unmarshal(raw, &parsed); err != nil {
				continue
			}
			for _, p := range parsed.Publicaciones {
				if p.Estado == "publicada" && extraerShortcodeIG(p.PublishedURL) != "" {
					candidatas = append(candidatas, p)
				}
			}
		}

		if len(candidatas) == 0 {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success": true, "dry_run": !apply, "semanas": semanas,
				"candidatas": 0,
				"nota":       "ninguna publicación 'publicada' con URL de Instagram en la ventana",
			})
			return
		}

		// 2. Media propia de IG (1 llamada) e índice por shortcode.
		igClient := social.NewInstagramClient(cfg.MetaAccessToken)
		account, err := igClient.GetAccountInfo(ctx)
		if err != nil {
			respondError(w, http.StatusBadGateway, "IG account: "+err.Error())
			return
		}
		accountID, _ := account["account_id"].(string)
		media, err := igClient.ListMedia(ctx, accountID, 60)
		if err != nil {
			respondError(w, http.StatusBadGateway, "IG media: "+err.Error())
			return
		}
		porShortcode := make(map[string]social.InstagramMediaBasic, len(media))
		for _, m := range media {
			if sc := extraerShortcodeIG(m.Permalink); sc != "" {
				porShortcode[sc] = m
			}
		}

		// 3. Match + insights solo para las matcheadas (cortesía de rate limit).
		hoyISO := time.Now().Format("2006-01-02")
		type resultado struct {
			ID         int                    `json:"id"`
			Titulo     string                 `json:"titulo"`
			Canal      string                 `json:"canal"`
			MediaID    string                 `json:"media_id"`
			Persistida bool                   `json:"persistida"`
			Error      string                 `json:"error,omitempty"`
			Metricas   map[string]interface{} `json:"metricas,omitempty"`
		}
		var resultados []resultado
		var sinMatch []map[string]interface{}

		for _, p := range candidatas {
			sc := extraerShortcodeIG(p.PublishedURL)
			m, ok := porShortcode[sc]
			if !ok {
				sinMatch = append(sinMatch, map[string]interface{}{
					"id": p.ID, "titulo": p.Titulo, "published_url": p.PublishedURL,
					"motivo": "shortcode no está en la media reciente de la cuenta (¿URL ajena o muy vieja?)",
				})
				continue
			}

			ins, insErr := igClient.GetMediaInsights(ctx, m.ID)
			time.Sleep(150 * time.Millisecond) // cortesía con Graph

			snapshot := map[string]interface{}{
				"fetched_at": hoyISO,
				"reach":      ins.Reach,
				"saves":      ins.Saves,
				"shares":     ins.Shares,
				"views":      ins.Views,
				"likes":      m.LikeCount,
				"comments":   m.CommentsCount,
			}
			if insErr != nil {
				snapshot["insights_error"] = insErr.Error()
			}

			// Merge del historial client-side: Django hace REPLACE simple.
			metricas := p.Metricas
			if metricas == nil {
				metricas = map[string]interface{}{}
			}
			metricas["fuente"] = "instagram_graph"
			metricas["media_id"] = m.ID
			metricas["permalink"] = m.Permalink
			metricas["media_type"] = m.MediaType
			metricas["caption_publicado"] = m.Caption
			snapshots, _ := metricas["snapshots"].([]interface{})
			// Si ya hay snapshot de HOY (re-corrida), se reemplaza en vez de duplicar.
			if n := len(snapshots); n > 0 {
				if last, ok := snapshots[n-1].(map[string]interface{}); ok && last["fetched_at"] == hoyISO {
					snapshots = snapshots[:n-1]
				}
			}
			snapshots = append(snapshots, snapshot)
			if len(snapshots) > 12 {
				snapshots = snapshots[len(snapshots)-12:]
			}
			metricas["snapshots"] = snapshots
			tasas := map[string]interface{}{}
			if ins.Reach > 0 {
				tasas["valiosa"] = float64(ins.Saves+ins.Shares) / float64(ins.Reach)
				tasas["interaccion"] = float64(m.LikeCount+m.CommentsCount) / float64(ins.Reach)
			}
			metricas["tasas"] = tasas

			res := resultado{ID: p.ID, Titulo: p.Titulo, Canal: p.Canal, MediaID: m.ID, Metricas: metricas}

			if apply {
				body, postErr := client.PostPublicacionActualizarRaw(cfg.AutomationAPIKey, p.ID, map[string]interface{}{"metricas": metricas})
				if postErr != nil {
					res.Error = postErr.Error()
				} else if strings.Contains(string(body), "snapshots") {
					// La respuesta serializa la publicación: si trae los snapshots,
					// Django realmente los guardó (guardia contra el no-op silencioso
					// mientras publicacion_actualizar no acepte `metricas`).
					res.Persistida = true
				} else {
					res.Error = "Django respondió sin persistir metricas (¿endpoint aún no acepta el campo?)"
				}
				res.Metricas = nil // no repetir el payload en la respuesta del apply
			}
			resultados = append(resultados, res)
		}

		persistidas := 0
		for _, r := range resultados {
			if r.Persistida {
				persistidas++
			}
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":     true,
			"dry_run":     !apply,
			"semanas":     semanas,
			"candidatas":  len(candidatas),
			"matcheadas":  len(resultados),
			"sin_match":   sinMatch,
			"persistidas": persistidas,
			"resultados":  resultados,
			"nota": fmt.Sprintf("media listada de la cuenta: %d items; ventana desde %s",
				len(media), lunesActual.AddDate(0, 0, -7*(semanas-1)).Format("2006-01-02")),
		})
	}
}
