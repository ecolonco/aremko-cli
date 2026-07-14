// TikTokClient lee estadísticas de la CUENTA PROPIA de TikTok de Aremko
// (@aremko.spa) para el brief semanal — solo lectura de videos/perfil, NO es
// mensajería (esa vía se investigó y se descartó por ahora, ver
// docs/HANDOFFS.md). Usa OAuth2 con refresh token (Login Kit + Display API,
// scopes user.info.basic + user.info.stats + video.list).
package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const tiktokAPIBase = "https://open.tiktokapis.com"

// TikTokClient
//
// ⚠️ LIMITACIÓN CONOCIDA: la documentación de TikTok no confirma si el
// refresh_token rota (invalida el anterior) en cada uso. Este cliente cachea
// en memoria el refresh_token más reciente durante la vida del proceso, pero
// si Render reinicia el servicio y TikTok SÍ rota, hay que rehacer el OAuth
// una vez (GET /api/v1/tiktok/oauth/authorize-url) y actualizar
// TIKTOK_REFRESH_TOKEN a mano en Render. Si aparecen errores "invalid
// refresh token" después de un deploy, esa es la causa más probable.
type TikTokClient struct {
	clientKey    string
	clientSecret string
	httpClient   *http.Client

	mu           sync.Mutex
	refreshToken string
	accessToken  string
	expiresAt    time.Time
}

func NewTikTokClient(clientKey, clientSecret, refreshToken string) *TikTokClient {
	return &TikTokClient{
		clientKey:    clientKey,
		clientSecret: clientSecret,
		refreshToken: refreshToken,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

type tiktokTokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int64  `json:"expires_in"`
	RefreshExpiresIn int64  `json:"refresh_expires_in"`
	OpenID           string `json:"open_id"`
	Scope            string `json:"scope"`
	TokenType        string `json:"token_type"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

// accessTokenFor obtiene un access_token válido, refrescándolo si está por
// vencer (margen de 1h). Cachea en memoria — ver limitación en el doc del tipo.
func (c *TikTokClient) accessTokenFor(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.accessToken != "" && time.Now().Before(c.expiresAt) {
		return c.accessToken, nil
	}

	form := url.Values{}
	form.Set("client_key", c.clientKey)
	form.Set("client_secret", c.clientSecret)
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", c.refreshToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tiktokAPIBase+"/v2/oauth/token/", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("tiktok: refresh token request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var tok tiktokTokenResponse
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", fmt.Errorf("tiktok: decode token response failed: %w (raw=%s)", err, truncateTikTok(string(body), 300))
	}
	if tok.Error != "" || tok.AccessToken == "" {
		return "", fmt.Errorf("tiktok: refresh failed: %s — %s (raw=%s)", tok.Error, tok.ErrorDescription, truncateTikTok(string(body), 300))
	}

	c.accessToken = tok.AccessToken
	c.expiresAt = time.Now().Add(time.Duration(tok.ExpiresIn-3600) * time.Second) // margen de 1h
	if tok.RefreshToken != "" {
		c.refreshToken = tok.RefreshToken
	}
	return c.accessToken, nil
}

func truncateTikTok(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ─── Estadísticas de cuenta ─────────────────────────────────────────────────

type TikTokAccountInfo struct {
	OpenID         string `json:"open_id"`
	DisplayName    string `json:"display_name"`
	AvatarURL      string `json:"avatar_url"`
	FollowerCount  int64  `json:"follower_count"`
	FollowingCount int64  `json:"following_count"`
	LikesCount     int64  `json:"likes_count"`
	VideoCount     int64  `json:"video_count"`
}

type tiktokUserInfoResponse struct {
	Data struct {
		User TikTokAccountInfo `json:"user"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// GetAccountInfo trae seguidores/siguiendo/likes/cantidad de videos de la
// cuenta autorizada (@aremko.spa).
func (c *TikTokClient) GetAccountInfo(ctx context.Context) (*TikTokAccountInfo, error) {
	token, err := c.accessTokenFor(ctx)
	if err != nil {
		return nil, err
	}
	fields := "open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tiktokAPIBase+"/v2/user/info/?fields="+fields, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tiktok: user info request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var out tiktokUserInfoResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("tiktok: decode user info failed: %w (raw=%s)", err, truncateTikTok(string(body), 300))
	}
	if out.Error.Code != "" && out.Error.Code != "ok" {
		return nil, fmt.Errorf("tiktok: user info error %s: %s", out.Error.Code, out.Error.Message)
	}
	return &out.Data.User, nil
}

// ─── Videos ─────────────────────────────────────────────────────────────────

type TikTokVideo struct {
	ID             string  `json:"id"`
	Title          string  `json:"title"`
	CoverImageURL  string  `json:"cover_image_url"`
	ShareURL       string  `json:"share_url"`
	ViewCount      int64   `json:"view_count"`
	LikeCount      int64   `json:"like_count"`
	CommentCount   int64   `json:"comment_count"`
	ShareCount     int64   `json:"share_count"`
	CreateTime     int64   `json:"create_time"`     // unix seconds
	EngagementRate float64 `json:"engagement_rate"` // (likes+coment.+shares)/views*100, mismo criterio que Instagram (engagement/reach)
}

type tiktokVideoListResponse struct {
	Data struct {
		Videos  []TikTokVideo `json:"videos"`
		Cursor  int64         `json:"cursor"`
		HasMore bool          `json:"has_more"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// GetTopVideos trae hasta `limit` videos recientes (máx 20, límite de la API
// por request) con sus estadísticas.
func (c *TikTokClient) GetTopVideos(ctx context.Context, limit int) ([]TikTokVideo, error) {
	if limit <= 0 || limit > 20 {
		limit = 20
	}
	token, err := c.accessTokenFor(ctx)
	if err != nil {
		return nil, err
	}
	fields := "id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time"
	payload, _ := json.Marshal(map[string]int{"max_count": limit})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tiktokAPIBase+"/v2/video/list/?fields="+fields, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tiktok: video list request failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var out tiktokVideoListResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("tiktok: decode video list failed: %w (raw=%s)", err, truncateTikTok(string(body), 300))
	}
	if out.Error.Code != "" && out.Error.Code != "ok" {
		return nil, fmt.Errorf("tiktok: video list error %s: %s", out.Error.Code, out.Error.Message)
	}
	videos := out.Data.Videos
	for i := range videos {
		if videos[i].ViewCount > 0 {
			videos[i].EngagementRate = float64(videos[i].LikeCount+videos[i].CommentCount+videos[i].ShareCount) / float64(videos[i].ViewCount) * 100
		}
	}
	return videos, nil
}
