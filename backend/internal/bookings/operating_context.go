package bookings

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// OperatingContextResponse is the shape returned by Django's
// /aremko-cli/operating-context/ endpoint.
type OperatingContextResponse struct {
	ContextoMarkdown   string `json:"contexto_markdown"`
	ActualizadoEn      string `json:"actualizado_en"`
	LongitudCaracteres int    `json:"longitud_caracteres"`
}

var (
	opCtxCache    *OperatingContextResponse
	opCtxCacheAt  time.Time
	opCtxCacheMu  sync.Mutex
	opCtxCacheTTL = 1 * time.Hour
)

// GetOperatingContext fetches the operating context (auto-discovered automations +
// manual notes) from Django. Cached in-memory for 1h so that opening 6 AI analyses
// in a row only triggers a single HTTP fetch. On error returns the cached value if
// any, else empty string — analyses must run even if this fetch fails.
func (c *Client) GetOperatingContext() (string, error) {
	opCtxCacheMu.Lock()
	defer opCtxCacheMu.Unlock()

	if opCtxCache != nil && time.Since(opCtxCacheAt) < opCtxCacheTTL {
		return opCtxCache.ContextoMarkdown, nil
	}

	url := fmt.Sprintf("%s/ventas/api/aremko-cli/operating-context/", c.BaseURL)
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		if opCtxCache != nil {
			return opCtxCache.ContextoMarkdown, nil
		}
		return "", fmt.Errorf("error fetching operating context: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("operating context endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result OperatingContextResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("error parsing operating context: %w", err)
	}

	opCtxCache = &result
	opCtxCacheAt = time.Now()
	return result.ContextoMarkdown, nil
}
