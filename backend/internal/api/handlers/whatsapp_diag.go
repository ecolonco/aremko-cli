package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
)

// ============================================================================
// Diagnóstico del inbound de WhatsApp
// ----------------------------------------------------------------------------
// Consulta la Graph API (solo lectura) para aislar por qué los mensajes
// entrantes no llegan al webhook: qué apps están suscritas a la WABA (y a qué
// campos), el estado de verificación del negocio / revisión de la cuenta, y el
// estado del número. NO expone el access token en la respuesta.
// ============================================================================

func fetchGraphJSON(url string) interface{} {
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return map[string]interface{}{"error": err.Error()}
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var parsed interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return map[string]interface{}{"status_code": resp.StatusCode, "raw": string(b)}
	}
	return map[string]interface{}{"status_code": resp.StatusCode, "data": parsed}
}

// WhatsAppDiagnostico — GET /api/v1/whatsapp/diagnostico
func WhatsAppDiagnostico(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.WhatsAppAccessToken == "" || cfg.WhatsAppWABAID == "" {
			respondError(w, http.StatusServiceUnavailable, "WhatsApp no configurado (token o WABA_ID)")
			return
		}
		const base = "https://graph.facebook.com/v21.0"
		tok := "access_token=" + cfg.WhatsAppAccessToken

		out := map[string]interface{}{
			"waba_id":         cfg.WhatsAppWABAID,
			"phone_number_id": cfg.WhatsAppPhoneNumberID,
		}
		// ¿Qué apps están suscritas a la WABA y a qué campos? (clave del inbound)
		out["subscribed_apps"] = fetchGraphJSON(base + "/" + cfg.WhatsAppWABAID + "/subscribed_apps?" + tok)
		// Estado de verificación del negocio + revisión de la cuenta.
		out["waba"] = fetchGraphJSON(base + "/" + cfg.WhatsAppWABAID +
			"?fields=id,name,account_review_status,business_verification_status,messaging_limit_tier,country&" + tok)
		// Estado del número (calidad, plataforma, verificación).
		if cfg.WhatsAppPhoneNumberID != "" {
			out["phone_number"] = fetchGraphJSON(base + "/" + cfg.WhatsAppPhoneNumberID +
				"?fields=id,display_phone_number,verified_name,quality_rating,status,platform_type,code_verification_status&" + tok)
		}
		// Estado de las plantillas (caso real 2026-08-20: envíos de "Contactando"
		// aceptados por la API y luego `failed` por webhook — una plantilla PAUSED /
		// DISABLED / REJECTED o con quality_score RED explica exactamente ese patrón).
		out["templates"] = fetchGraphJSON(base + "/" + cfg.WhatsAppWABAID +
			"/message_templates?fields=name,status,category,language,quality_score,rejected_reason&limit=50&" + tok)
		respondJSON(w, http.StatusOK, out)
	}
}
