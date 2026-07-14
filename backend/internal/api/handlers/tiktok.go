package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
)

// tiktokRedirectURI DEBE coincidir EXACTO con el Redirect URI registrado en
// TikTok for Developers (Login Kit → Redirect URI). Si se cambia acá, hay
// que cambiarlo también allá (y viceversa).
const tiktokRedirectURI = "https://aremko-cli-backend.onrender.com/api/v1/tiktok/oauth/callback"

// tiktokScopes deben coincidir con los Scopes agregados en el portal de
// TikTok for Developers (Login Kit).
const tiktokScopes = "user.info.basic,user.info.stats,video.list"

// TikTokOAuthAuthorizeURL arma la URL de autorización (Jorge la abre UNA vez
// con la cuenta @aremko.spa para dar permiso). No requiere client_secret —
// client_key no es sensible del mismo modo (queda visible en la URL igual).
func TikTokOAuthAuthorizeURL(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.TikTokClientKey == "" {
			respondError(w, http.StatusServiceUnavailable, "TIKTOK_CLIENT_KEY no configurado en Render")
			return
		}
		q := url.Values{}
		q.Set("client_key", cfg.TikTokClientKey)
		q.Set("scope", tiktokScopes)
		q.Set("response_type", "code")
		q.Set("redirect_uri", tiktokRedirectURI)
		q.Set("state", "aremko-cli-brief")
		authorizeURL := "https://www.tiktok.com/v2/auth/authorize/?" + q.Encode()

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data": map[string]string{
				"authorize_url": authorizeURL,
			},
		})
	}
}

// TikTokOAuthCallback recibe el `code` tras la autorización manual y lo
// cambia por access+refresh token. Muestra el refresh_token EN PANTALLA UNA
// VEZ para guardarlo a mano como env var TIKTOK_REFRESH_TOKEN en Render — no
// hay base de datos para persistirlo solo (mismo patrón que
// GOOGLE_ADS_REFRESH_TOKEN, obtenido también una vez a mano).
func TikTokOAuthCallback(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if errParam := r.URL.Query().Get("error"); errParam != "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, "<h2>Autorización rechazada por TikTok</h2><p>%s — %s</p>", errParam, r.URL.Query().Get("error_description"))
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "falta 'code' en la URL de retorno", http.StatusBadRequest)
			return
		}
		if cfg.TikTokClientKey == "" || cfg.TikTokClientSecret == "" {
			http.Error(w, "TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET no configurados en Render", http.StatusServiceUnavailable)
			return
		}

		form := url.Values{}
		form.Set("client_key", cfg.TikTokClientKey)
		form.Set("client_secret", cfg.TikTokClientSecret)
		form.Set("code", code)
		form.Set("grant_type", "authorization_code")
		form.Set("redirect_uri", tiktokRedirectURI)

		req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://open.tiktokapis.com/v2/oauth/token/", strings.NewReader(form.Encode()))
		if err != nil {
			http.Error(w, "error armando request: "+err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		client := &http.Client{Timeout: 20 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "error llamando a TikTok: "+err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)

		var tok struct {
			AccessToken      string `json:"access_token"`
			RefreshToken     string `json:"refresh_token"`
			ExpiresIn        int64  `json:"expires_in"`
			RefreshExpiresIn int64  `json:"refresh_expires_in"`
			OpenID           string `json:"open_id"`
			Scope            string `json:"scope"`
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		if err := json.Unmarshal(body, &tok); err != nil {
			http.Error(w, "no se pudo leer la respuesta de TikTok: "+string(body), http.StatusInternalServerError)
			return
		}
		if tok.Error != "" || tok.RefreshToken == "" {
			http.Error(w, fmt.Sprintf("TikTok rechazó el intercambio: %s — %s (raw=%s)", tok.Error, tok.ErrorDescription, body), http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto">
<h2>Autorización de TikTok completada</h2>
<p>Copia este valor y guárdalo en Render como variable de entorno <code>TIKTOK_REFRESH_TOKEN</code> (servicio aremko-cli-backend):</p>
<textarea style="width:100%%;height:80px;font-family:monospace" readonly>%s</textarea>
<p>open_id: %s<br>scope: %s<br>vence en: %d días</p>
<p><b>Esta página no vuelve a mostrar este valor — cópialo ahora.</b></p>
</body></html>`, tok.RefreshToken, tok.OpenID, tok.Scope, tok.RefreshExpiresIn/86400)
	}
}
