package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/email"
	"github.com/aremko/aremko-cli/internal/report"
)

// ReporteDiarioMetaAds genera el análisis IA de Meta Ads y lo envía por email a
// la lista de distribución. Pensado para cron-job.org (GET/POST diario ~9:15 CL).
//
//	GET|POST /api/v1/cron/reporte-diario?token=<REPORTE_CRON_TOKEN>
//
// El cuerpo del correo es EJECUTIVO (veredicto + cifras + acciones + cuadros con
// los números reales); el informe COMPLETO va como adjunto HTML para quien quiera
// el detalle, sin depender de acceso al dashboard.
func ReporteDiarioMetaAds(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Auth por token (igual patrón que los crons de Django).
		if cfg.ReporteCronToken == "" || r.URL.Query().Get("token") != cfg.ReporteCronToken {
			respondError(w, http.StatusUnauthorized, "token inválido")
			return
		}
		if cfg.SendGridAPIKey == "" {
			respondError(w, http.StatusServiceUnavailable, "SENDGRID_API_KEY no configurada")
			return
		}
		if len(cfg.ReporteDestinatarios) == 0 {
			respondError(w, http.StatusServiceUnavailable, "REPORTE_DIARIO_DESTINATARIOS vacía")
			return
		}
		if !cfg.EnableAI || cfg.OpenRouterAPIKey == "" {
			respondError(w, http.StatusServiceUnavailable, "IA no habilitada")
			return
		}
		if !cfg.EnableMetaAds || cfg.MetaAccessToken == "" {
			respondError(w, http.StatusServiceUnavailable, "Meta Ads no habilitado")
			return
		}

		// 2. Datos: misma ventana que el análisis del dashboard (últimos 7 días
		//    cerrados; los bloques Refugio/GiftCard usan su rango completo interno).
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")
		metaData, err := getMetaAdsData(cfg, dateStart, dateStop)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "no se pudo traer Meta Ads: "+err.Error())
			return
		}

		// 3. Análisis IA.
		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()
		fmt.Println("[REPORTE] Generando análisis Meta Ads para el correo diario...")
		analysis, err := aiClient.GenerateMetaAdsAnalysis(ctx, metaData)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "fallo el análisis IA: "+err.Error())
			return
		}
		if analysis.Error != "" {
			respondError(w, http.StatusInternalServerError, "análisis IA: "+analysis.Error)
			return
		}

		// 4. Email ejecutivo + cuadros; adjunto = informe completo.
		fecha := time.Now().Format("02-01-2006") // dd-mm-aaaa
		ejecutivoMD := report.SplitEjecutivo(analysis.Text)
		cuadros := report.BuildCuadros(metaData)
		bodyContent := report.MarkdownToHTML(ejecutivoMD) +
			"<div style=\"margin-top:18px\">" + cuadros + "</div>"

		footer := "📎 <strong>Informe completo adjunto</strong> a este correo (análisis profundo por campaña, placements y estado por dimensión).<br>" +
			"Modelo: " + analysis.Model + " · Período de campañas: " + dateStart + " → " + dateStop + "."

		emailHTML := report.WrapEmail(
			"Reporte diario · Meta Ads",
			"Resumen ejecutivo automático de las campañas de Aremko. Generado "+time.Now().Format("02-01-2006 15:04")+".",
			bodyContent,
			footer,
		)

		// Adjunto: informe completo (markdown→HTML) + cuadros.
		fullHTML := report.WrapEmail(
			"Informe completo · Meta Ads · "+fecha,
			"Análisis profundo generado por IA.",
			report.MarkdownToHTML(analysis.Text)+"<div style=\"margin-top:18px\">"+cuadros+"</div>",
			"Generado por aremko-cli · Modelo "+analysis.Model,
		)

		subject := "📊 Reporte Aremko · Meta Ads · " + fecha

		// 5. Enviar.
		mailer := email.NewClient(cfg.SendGridAPIKey)
		err = mailer.SendHTML(
			cfg.ReporteFromEmail, cfg.ReporteFromName, subject, emailHTML,
			cfg.ReporteDestinatarios,
			[]email.Attachment{{
				Filename: "informe_meta_ads_" + fecha + ".html",
				MIMEType: "text/html",
				Content:  []byte(fullHTML),
			}},
		)
		if err != nil {
			respondError(w, http.StatusBadGateway, "no se pudo enviar el correo: "+err.Error())
			return
		}

		fmt.Printf("[REPORTE] Enviado a %d destinatarios.\n", len(cfg.ReporteDestinatarios))
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"ok":            true,
			"enviado_a":     cfg.ReporteDestinatarios,
			"asunto":        subject,
			"modelo":        analysis.Model,
			"output_tokens": analysis.OutputTokens,
		})
	}
}
