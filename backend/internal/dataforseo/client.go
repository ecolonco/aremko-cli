// Package dataforseo provee un cliente REST delgado para la API de
// DataForSEO (rankings SEO, backlinks, competidores). Es un servicio de pago
// por uso — cada llamada real cuesta dinero (centavos, pero no cero). Ver
// docs/LOOP_SEO.md en el repo Django para el detalle de costos y la lista de
// keywords fijas que usa el loop de mejora continua de SEO.
//
// Auth: HTTP Basic (api_login:api_password) — no hay OAuth ni token.
//
// Este cliente cachea resultados en memoria con TTL para evitar gastar saldo
// en llamadas repetidas (ej. el dashboard se recarga varias veces al día,
// pero el ranking real no cambia tan seguido).
package dataforseo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

const apiBaseURL = "https://api.dataforseo.com"

// Client habla con la API de DataForSEO en nombre de una cuenta (login+password).
type Client struct {
	apiLogin    string
	apiPassword string
	httpClient  *http.Client
	cache       *cache
}

// Config requerida para construir el cliente. Viene de variables de entorno;
// ver internal/config/config.go (DataForSEOAPILogin / DataForSEOAPIPassword).
type Config struct {
	APILogin    string
	APIPassword string
}

// NewClient valida credenciales mínimas y arma el cliente HTTP + cache.
func NewClient(cfg Config) (*Client, error) {
	if cfg.APILogin == "" || cfg.APIPassword == "" {
		return nil, fmt.Errorf("dataforseo: missing required config (api_login / api_password)")
	}
	return &Client{
		apiLogin:    cfg.APILogin,
		apiPassword: cfg.APIPassword,
		// 45s: el modo "live" de SERP hace scraping real de Google en el momento
		// y puede tardar más que un GET típico de una API REST convencional.
		httpClient: &http.Client{Timeout: 45 * time.Second},
		cache:      newCache(),
	}, nil
}

// post ejecuta un POST autenticado (Basic Auth) contra un endpoint de
// DataForSEO y devuelve el body crudo. El caller deserializa según la forma
// de respuesta esperada de ESE endpoint (varían entre sí).
func (c *Client) post(ctx context.Context, path string, payload interface{}) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("dataforseo: encode payload failed: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBaseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.apiLogin, c.apiPassword)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dataforseo: request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dataforseo: status %d: %s", resp.StatusCode, truncate(string(respBody), 300))
	}
	return respBody, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ─── Cache en memoria (evita gastar saldo en calls repetidos) ──────────────
//
// Simple, sin dependencias externas: mapa protegido por mutex + TTL por
// entrada. Suficiente para un solo proceso (así corre este backend en Render).

type cacheEntry struct {
	value     interface{}
	expiresAt time.Time
}

type cache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
}

func newCache() *cache {
	return &cache{entries: make(map[string]cacheEntry)}
}

func (c *cache) get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}

func (c *cache) set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cacheEntry{value: value, expiresAt: time.Now().Add(ttl)}
}
