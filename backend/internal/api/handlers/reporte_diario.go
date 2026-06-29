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
			fmt.Println("[REPORTE] ERROR getMetaAdsData:", err)
			respondError(w, http.StatusInternalServerError, "no se pudo traer Meta Ads: "+err.Error())
			return
		}

		// 3. Análisis IA.
		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()
		fmt.Println("[REPORTE] Generando análisis Meta Ads para el correo diario...")
		analysis, err := aiClient.GenerateMetaAdsAnalysis(ctx, metaData)
		if err != nil {
			fmt.Println("[REPORTE] ERROR GenerateMetaAdsAnalysis:", err)
			respondError(w, http.StatusInternalServerError, "fallo el análisis IA: "+err.Error())
			return
		}
		if analysis.Error != "" {
			fmt.Println("[REPORTE] ERROR analysis.Error:", analysis.Error)
			respondError(w, http.StatusInternalServerError, "análisis IA: "+analysis.Error)
			return
		}

		// 4. Un solo email: ejecutivo + cuadros arriba; detalle profundo inline
		//    al final bajo un separador (los adjuntos .html Gmail los muestra como
		//    código, así que va todo en el cuerpo, que sí renderiza).
		fecha := time.Now().Format("02-01-2006") // dd-mm-aaaa
		ejecutivoMD, detalleMD := report.SplitReport(analysis.Text)
		cuadros := report.BuildCuadros(metaData)

		bodyContent := report.MarkdownToHTML(ejecutivoMD) +
			"<div style=\"margin-top:18px\">" + cuadros + "</div>"

		if detalleMD != "" {
			bodyContent += "<div style=\"margin-top:28px;padding-top:8px;border-top:2px dashed #d1d5db\">" +
				"<p style=\"text-align:center;color:#9ca3af;font-size:12px;letter-spacing:1px;margin:8px 0 4px\">▼ INFORME COMPLETO (DETALLE) ▼</p>" +
				report.MarkdownToHTML(detalleMD) + "</div>"
		}

		footer := "Modelo: " + analysis.Model + " · Período de campañas: " + dateStart + " → " + dateStop + ".<br>" +
			"Reporte automático diario · para sumar o quitar destinatarios, avisar al equipo técnico."

		emailHTML := report.WrapEmail(
			"Reporte diario · Meta Ads",
			"Resumen ejecutivo de las campañas de Aremko + informe completo al final. Generado "+time.Now().Format("02-01-2006 15:04")+".",
			bodyContent,
			footer,
		)

		subject := "📊 Reporte Aremko · Meta Ads · " + fecha

		// 5. Enviar (sin adjunto).
		mailer := email.NewClient(cfg.SendGridAPIKey)
		err = mailer.SendHTML(
			cfg.ReporteFromEmail, cfg.ReporteFromName, subject, emailHTML,
			cfg.ReporteDestinatarios, nil,
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

// ReporteDiarioGoogleAds genera el análisis IA de Google Ads (Búsqueda) y lo envía
// por email a la misma lista, en paralelo al de Meta. Mismo patrón que
// ReporteDiarioMetaAds pero con datos/análisis/cuadros de Google.
//
//	GET|POST /api/v1/cron/reporte-diario-google?token=<REPORTE_CRON_TOKEN>
func ReporteDiarioGoogleAds(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		if cfg.GoogleAdsRefreshToken == "" || cfg.GoogleAdsDeveloperToken == "" {
			respondError(w, http.StatusServiceUnavailable, "Google Ads no configurado")
			return
		}

		// Misma ventana que el reporte de Meta (últimos 7 días cerrados); el bloque
		// Refugio usa su propio rango interno desde el lanzamiento.
		dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02")
		gaData, err := getGoogleAdsData(cfg, dateStart, dateStop)
		if err != nil {
			fmt.Println("[REPORTE-GOOGLE] ERROR getGoogleAdsData:", err)
			respondError(w, http.StatusInternalServerError, "no se pudo traer Google Ads: "+err.Error())
			return
		}

		aiClient := newAIClientWithOperatingContext(cfg)
		ctx := context.Background()
		fmt.Println("[REPORTE-GOOGLE] Generando análisis Google Ads para el correo diario...")
		analysis, err := aiClient.GenerateGoogleAdsAnalysis(ctx, gaData)
		if err != nil {
			fmt.Println("[REPORTE-GOOGLE] ERROR GenerateGoogleAdsAnalysis:", err)
			respondError(w, http.StatusInternalServerError, "fallo el análisis IA: "+err.Error())
			return
		}
		if analysis.Error != "" {
			fmt.Println("[REPORTE-GOOGLE] ERROR analysis.Error:", analysis.Error)
			respondError(w, http.StatusInternalServerError, "análisis IA: "+analysis.Error)
			return
		}

		fecha := time.Now().Format("02-01-2006")
		ejecutivoMD, detalleMD := report.SplitReport(analysis.Text)
		cuadros := report.BuildCuadrosGoogleAds(gaData)

		bodyContent := report.MarkdownToHTML(ejecutivoMD) +
			"<div style=\"margin-top:18px\">" + cuadros + "</div>"

		if detalleMD != "" {
			bodyContent += "<div style=\"margin-top:28px;padding-top:8px;border-top:2px dashed #d1d5db\">" +
				"<p style=\"text-align:center;color:#9ca3af;font-size:12px;letter-spacing:1px;margin:8px 0 4px\">▼ INFORME COMPLETO (DETALLE) ▼</p>" +
				report.MarkdownToHTML(detalleMD) + "</div>"
		}

		footer := "Modelo: " + analysis.Model + " · Período de campañas: " + dateStart + " → " + dateStop + ".<br>" +
			"Reporte automático diario · para sumar o quitar destinatarios, avisar al equipo técnico."

		emailHTML := report.WrapEmail(
			"Reporte diario · Google Ads",
			"Resumen ejecutivo de las campañas de Búsqueda de Aremko + informe completo al final. Generado "+time.Now().Format("02-01-2006 15:04")+".",
			bodyContent,
			footer,
		)

		subject := "📊 Reporte Aremko · Google Ads · " + fecha

		mailer := email.NewClient(cfg.SendGridAPIKey)
		err = mailer.SendHTML(
			cfg.ReporteFromEmail, cfg.ReporteFromName, subject, emailHTML,
			cfg.ReporteDestinatarios, nil,
		)
		if err != nil {
			fmt.Println("[REPORTE-GOOGLE] ERROR SendHTML:", err)
			respondError(w, http.StatusBadGateway, "no se pudo enviar el correo: "+err.Error())
			return
		}

		fmt.Printf("[REPORTE-GOOGLE] Enviado a %d destinatarios.\n", len(cfg.ReporteDestinatarios))
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"ok":            true,
			"enviado_a":     cfg.ReporteDestinatarios,
			"asunto":        subject,
			"modelo":        analysis.Model,
			"output_tokens": analysis.OutputTokens,
		})
	}
}
