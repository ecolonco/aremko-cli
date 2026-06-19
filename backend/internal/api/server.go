package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/api/handlers"
	"github.com/aremko/aremko-cli/internal/api/middleware"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	router *chi.Mux
	config *config.Config
}

// NewServer crea una nueva instancia del servidor API
func NewServer(cfg *config.Config) *Server {
	s := &Server{
		router: chi.NewRouter(),
		config: cfg,
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

func (s *Server) setupMiddleware() {
	// Middleware básicos de Chi
	s.router.Use(chimiddleware.RequestID)
	s.router.Use(chimiddleware.RealIP)
	s.router.Use(middleware.Logger)
	s.router.Use(chimiddleware.Recoverer)

	// CORS para permitir requests desde el frontend
	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:8080", "https://*.vercel.app", "https://*.onrender.com"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Timeout de 180 segundos: el análisis integral combina 6 APIs externas + IA
	// con payload grande, fácilmente excede los 60s que tenía antes
	s.router.Use(chimiddleware.Timeout(180 * time.Second))
}

func (s *Server) setupRoutes() {
	// Health check
	s.router.Get("/health", s.handleHealth)

	// API v1 routes
	s.router.Route("/api/v1", func(r chi.Router) {
		// Meta Ads endpoints
		r.Get("/meta-ads/campaigns", handlers.GetMetaCampaigns(s.config))
		r.Get("/meta-ads/insights", handlers.GetMetaInsights(s.config))
		r.Get("/meta-ads/account-summary", handlers.GetMetaAccountSummary(s.config))
		r.Get("/meta-ads/campaigns-with-insights", handlers.GetCampaignsWithInsights(s.config))
		r.Get("/meta-ads/refugio", handlers.GetRefugioCampaign(s.config))

		// Meta Ads — gestión (write). Requiere token con ads_management.
		// Mueven dinero real → el frontend confirma antes de llamarlos.
		r.Post("/meta-ads/campaigns/{campaign_id}/pause", handlers.PauseCampaign(s.config))
		r.Post("/meta-ads/campaigns/{campaign_id}/activate", handlers.ActivateCampaign(s.config))
		r.Post("/meta-ads/campaigns/{campaign_id}/budget", handlers.UpdateCampaignBudget(s.config))

		// Google Ads endpoints
		r.Get("/google-ads/summary", handlers.GetGoogleAdsSummary(s.config))
		r.Get("/google-ads/refugio", handlers.GetGoogleAdsRefugio(s.config))
		r.Get("/google-ads/search-terms", handlers.GetGoogleAdsSearchTerms(s.config))
		r.Get("/google-ads/quality-scores", handlers.GetGoogleAdsQualityScores(s.config))

		// Google Analytics 4 endpoints
		r.Get("/ga4/stats", handlers.GetGA4Stats(s.config))
		r.Get("/ga4/top-pages", handlers.GetGA4TopPages(s.config))
		r.Get("/ga4/traffic-sources", handlers.GetGA4TrafficSources(s.config))
		r.Get("/ga4/page-metrics", handlers.GetGA4PageMetrics(s.config))
		r.Get("/ga4/conversions", handlers.GetGA4Conversions(s.config))

		// Brief endpoints
		r.Get("/brief/weekly", handlers.GetWeeklyBrief(s.config))
		r.Get("/brief/weekly-ai", handlers.GetWeeklyBriefWithAI(s.config))
		r.Post("/brief/generate", handlers.GenerateBrief(s.config))

		// Web Analytics AI Analysis
		r.Post("/analytics/web/analyze", handlers.AnalyzeWebAnalytics(s.config))

		// Instagram Organic AI Analysis
		r.Post("/analytics/instagram/analyze", handlers.AnalyzeInstagramOrganic(s.config))

		// Meta Ads AI Analysis
		r.Post("/analytics/meta-ads/analyze", handlers.AnalyzeMetaAds(s.config))

		// Social unificado (Orgánico + Pagado, lectura cruzada) — botón "todo el bloque"
		r.Post("/analytics/social/analyze", handlers.AnalyzeSocial(s.config))

		// Reporte diario por email (cron-job.org) — análisis Meta Ads a la lista de distribución
		r.Get("/cron/reporte-diario", handlers.ReporteDiarioMetaAds(s.config))
		r.Post("/cron/reporte-diario", handlers.ReporteDiarioMetaAds(s.config))

		// Sales AI Analysis
		r.Post("/analytics/sales/analyze", handlers.AnalyzeSales(s.config))

		// Reviews AI Analysis
		r.Post("/analytics/reviews/analyze", handlers.AnalyzeReviews(s.config))

		// Overview AI Analysis (cruza todas las áreas)
		r.Post("/analytics/overview/analyze", handlers.AnalyzeOverview(s.config))

		// Natural-language sales query (LLM parser + Django detalle endpoint)
		r.Post("/analytics/nl-query", handlers.NLQuery(s.config))

		// System documentation (live markdown snapshot of this codebase)
		r.Get("/system-doc/markdown", handlers.SystemDocMarkdown())

		// Monthly trends by family (6/12/18/24 months)
		r.Get("/bookings/monthly", handlers.MonthlyByFamily(s.config))
		r.Get("/bookings/monthly-by-product", handlers.MonthlyByProduct(s.config))

		// Family combinations per reservation (bundling effectiveness)
		r.Get("/bookings/family-combinations", handlers.FamilyCombinations(s.config))

		// Taxonomía de clientes (3 ejes: Valor x Estilo x Contexto)
		r.Get("/clients/segments", handlers.ClientsSegments(s.config))
		r.Get("/clients/cohort", handlers.ClientsCohort(s.config))
		r.Post("/analytics/profiles/analyze", handlers.AnalyzeProfiles(s.config))

		// Operación Vuelta a Casa — Asistente Deborah (9 endpoints)
		r.Route("/ovc", func(r chi.Router) {
			r.Get("/bandeja-whatsapp/siguiente", handlers.OVCSiguiente(s.config))
			r.Get("/bandeja-whatsapp/del-dia", handlers.OVCDelDia(s.config))
			r.Post("/bandeja-whatsapp/{contactoID}/marcar-enviado", handlers.OVCMarcarEnviado(s.config))
			r.Post("/bandeja-whatsapp/{contactoID}/marcar-omitido", handlers.OVCMarcarOmitido(s.config))
			r.Post("/bandeja-whatsapp/{contactoID}/marcar-no-aplica", handlers.OVCMarcarNoAplica(s.config))
			r.Post("/bandeja-whatsapp/{contactoID}/registrar-respuesta", handlers.OVCRegistrarRespuesta(s.config))
			r.Post("/bandeja-whatsapp/{contactoID}/bloquear-cliente", handlers.OVCBloquearCliente(s.config))
			r.Get("/bandeja-whatsapp/explicacion/{contactoID}", handlers.OVCExplicacion(s.config))
			r.Get("/bandeja-whatsapp/resumen-dia", handlers.OVCResumenDia(s.config))
			r.Get("/movimientos", handlers.OVCMovimientos(s.config))
			r.Get("/scripts-estadisticas", handlers.OVCScriptsEstadisticas(s.config))
			r.Get("/metricas-operadores", handlers.OVCMetricasOperadores(s.config))
			r.Post("/clientes/{clienteID}/actualizar-ubicacion", handlers.OVCActualizarUbicacion(s.config))
			r.Post("/clientes/{clienteID}/marcar-staff", handlers.OVCMarcarStaff(s.config))
		})

		// WhatsApp Cloud API — webhook + envío (piloto inbound Refugio)
		// El webhook lo llama Meta: sin auth de app, se valida con firma HMAC.
		r.Get("/whatsapp/webhook", handlers.WhatsAppWebhookVerify(s.config))
		r.Post("/whatsapp/webhook", handlers.WhatsAppWebhookReceive(s.config))
		r.Post("/whatsapp/send-test", handlers.WhatsAppSendTest(s.config))
		r.Post("/whatsapp/reply", handlers.WhatsAppReply(s.config))
		r.Post("/whatsapp/send-media", handlers.WhatsAppSendMedia(s.config))
		r.Get("/whatsapp/conversation", handlers.WhatsAppConversation(s.config))
		r.Get("/whatsapp/conversations", handlers.WhatsAppConversations(s.config))
		r.Post("/whatsapp/conversations/{phone}/marcar-atendido", handlers.WhatsAppMarcarAtendido(s.config))
		r.Post("/whatsapp/conversations/{phone}/editar-nombre", handlers.WhatsAppEditarNombre(s.config))
		r.Get("/whatsapp/agente/config", handlers.WhatsAppAgenteConfigGet(s.config))
		r.Post("/whatsapp/agente/config", handlers.WhatsAppAgenteConfigPost(s.config))
		r.Post("/whatsapp/agente/feedback", handlers.WhatsAppAgenteFeedback(s.config))
		r.Post("/whatsapp/agente/procesar-aprendizaje", handlers.WhatsAppAgenteProcesarAprendizaje(s.config))
		r.Get("/whatsapp/agente/sugerencias-aprendizaje", handlers.WhatsAppAgenteSugerencias(s.config))
		r.Post("/whatsapp/agente/sugerencias-aprendizaje/{id}/aprobar", handlers.WhatsAppAgenteSugerenciaAccion(s.config, "aprobar"))
		r.Post("/whatsapp/agente/sugerencias-aprendizaje/{id}/descartar", handlers.WhatsAppAgenteSugerenciaAccion(s.config, "descartar"))
		r.Get("/whatsapp/bandeja-envios", handlers.WhatsAppBandejaEnvios(s.config))
		r.Post("/whatsapp/bandeja-envios/aprobar-lote", handlers.WhatsAppBandejaAprobarLote(s.config))
		r.Post("/whatsapp/bandeja-envios/{id}/aprobar", handlers.WhatsAppBandejaEnvioAccion(s.config, "aprobar"))
		r.Post("/whatsapp/bandeja-envios/{id}/descartar", handlers.WhatsAppBandejaEnvioAccion(s.config, "descartar"))
		r.Post("/whatsapp/run-template-campaign", handlers.WhatsAppRunTemplateCampaign(s.config))
		r.Post("/whatsapp/create-templates", handlers.WhatsAppCreateTemplates(s.config))
		r.Post("/whatsapp/send-template", handlers.WhatsAppSendTemplate(s.config))
		r.Get("/whatsapp/diagnostico", handlers.WhatsAppDiagnostico(s.config))

		// Instagram Messaging API (ruta "Instagram Login") — bandeja omnicanal.
		// El webhook lo llama Meta: sin auth de app, se valida con firma HMAC.
		// Fase 1: solo recibir + loguear DMs entrantes para validar end-to-end.
		r.Get("/instagram/webhook", handlers.InstagramWebhookVerify(s.config))
		r.Post("/instagram/webhook", handlers.InstagramWebhookReceive(s.config))
		r.Post("/instagram/reply", handlers.InstagramReply(s.config))
		r.Post("/instagram/send-media", handlers.InstagramSendMedia(s.config))

		// Facebook Messenger (object "page") — bandeja omnicanal. Mismo formato
		// Messenger Platform que Instagram. Recibir + responder.
		r.Get("/messenger/webhook", handlers.MessengerWebhookVerify(s.config))
		r.Post("/messenger/webhook", handlers.MessengerWebhookReceive(s.config))
		r.Post("/messenger/reply", handlers.MessengerReply(s.config))
		r.Post("/messenger/send-media", handlers.MessengerSendMedia(s.config))

		// Bandeja omnicanal (H-016): reads unificados WhatsApp + Instagram.
		// Proxy a Django /api/inbox/*; conversación identificada por (canal, external_id).
		r.Get("/inbox/conversations", handlers.InboxConversations(s.config))
		r.Get("/inbox/conversation", handlers.InboxConversation(s.config))
		r.Get("/inbox/media-library", handlers.InboxMediaLibrary(s.config))
		// H-028: Deborah aprueba una propuesta → crea la reserva + trae el resumen.
		r.Post("/luna/crear-reserva", handlers.LunaCrearReserva(s.config))
		r.Get("/resumen-reserva/{id}", handlers.ResumenReserva(s.config))
		// Utilidad de pruebas: borrar historial + carrito de un teléfono.
		r.Post("/inbox/limpiar-conversacion", handlers.InboxLimpiarConversacion(s.config))
		r.Post("/inbox/conversations/{canal}/{externalId}/marcar-atendido", handlers.InboxMarcarAtendido(s.config))

		// Módulo de Métricas / Tablero de Evolución (H-021/H-022) — proxy a Django.
		r.Get("/metrics/campanas/reservas", handlers.MetricsReservas(s.config))
		r.Get("/metrics/{tipo}", handlers.MetricsProxy(s.config))

		// Bandeja de salida "Conexión-Masajes" — proxy a Django (emails de
		// seguimiento post-masaje que se revisan/editan/envían uno por uno).
		// El backend Go agrega la X-API-Key; el navegador no la conoce (igual
		// que WhatsApp). Reenvía status+body de Django tal cual (409/422/401).
		r.Get("/masaje/outbox", handlers.MasajeOutboxList(s.config))
		r.Get("/masaje/outbox/{id}/preview", handlers.MasajeOutboxPreview(s.config))
		r.Patch("/masaje/outbox/{id}", handlers.MasajeOutboxEdit(s.config))
		r.Post("/masaje/outbox/{id}/send", handlers.MasajeOutboxSend(s.config))
		r.Post("/masaje/outbox/{id}/cancel", handlers.MasajeOutboxCancel(s.config))

		// Stats endpoints (próximamente)
		r.Get("/stats/overview", handlers.GetStatsOverview(s.config))
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":  "healthy",
		"version": "0.1.0-alpha",
		"time":    time.Now().Format(time.RFC3339),
		"services": map[string]bool{
			"meta_ads":   s.config.EnableMetaAds,
			"google_ads": s.config.EnableGoogleAds,
			"linkedin":   s.config.EnableLinkedIn,
			"bookings":   s.config.EnableBookings,
			"ga4":        s.config.EnableGA4,
			"ai":         s.config.EnableAI,
			"whatsapp":   s.config.EnableWhatsApp,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Start inicia el servidor HTTP
func (s *Server) Start() error {
	addr := fmt.Sprintf("0.0.0.0:%s", s.config.Port)
	fmt.Printf("🚀 API Server starting on http://%s\n", addr)
	fmt.Printf("📚 API docs: http://0.0.0.0:%s/api/v1\n", s.config.Port)
	fmt.Printf("💚 Health check: http://0.0.0.0:%s/health\n", s.config.Port)
	return http.ListenAndServe(addr, s.router)
}

// Router retorna el router de Chi para testing
func (s *Server) Router() *chi.Mux {
	return s.router
}
