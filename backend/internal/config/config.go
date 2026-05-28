package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// MetaAccount representa una cuenta publicitaria de Meta con etiqueta humana
type MetaAccount struct {
	ID    string // ej. "act_323860814935576"
	Label string // ej. "Cuenta Principal"
}

type Config struct {
	// Meta Ads
	MetaAccessToken string
	MetaAdAccountID string        // legacy singular (mantiene compatibilidad)
	MetaAdAccounts  []MetaAccount // lista de cuentas a monitorear

	// Campaña Refugio (vista dedicada en brief/dashboard)
	MetaRefugioCampaignID string
	MetaRefugioBudgetCLP  float64 // presupuesto total declarado para mostrar % usado

	// Google Analytics 4
	GA4PropertyID      string
	GA4CredentialsPath string

	// OpenRouter (AI)
	OpenRouterAPIKey string
	OpenRouterBaseURL string

	// Booking System (Django)
	BookingSystemURL string

	// Auth para endpoints write de Operación Vuelta a Casa (header X-API-KEY)
	AutomationAPIKey string

	// Database
	DatabaseURL string

	// Server
	Port        string
	Environment string

	// Features
	EnableMetaAds     bool
	EnableGoogleAds   bool
	EnableLinkedIn    bool
	EnableBookings    bool
	EnableGA4         bool
	EnableAI          bool
}

var AppConfig *Config

// LoadConfig carga la configuración desde variables de entorno
func LoadConfig() (*Config, error) {
	// Intentar cargar .env si existe (desarrollo local)
	_ = godotenv.Load()

	config := &Config{
		MetaAccessToken:       getEnvOrDefault("META_ACCESS_TOKEN", ""),
		MetaAdAccountID:       getEnvOrDefault("META_AD_ACCOUNT_ID", ""),
		MetaAdAccounts:        parseMetaAccounts(),
		MetaRefugioCampaignID: getEnvOrDefault("META_REFUGIO_CAMPAIGN_ID", ""),
		MetaRefugioBudgetCLP:  parseFloatEnv("META_REFUGIO_BUDGET_CLP", 100000),
		GA4PropertyID:      getEnvOrDefault("GA4_PROPERTY_ID", ""),
		GA4CredentialsPath: getEnvOrDefault("GA4_CREDENTIALS_PATH", "ga4-credentials.json"),
		OpenRouterAPIKey:   getEnvOrDefault("OPENROUTER_API_KEY", ""),
		OpenRouterBaseURL:  getEnvOrDefault("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
		BookingSystemURL:   getEnvOrDefault("BOOKING_SYSTEM_URL", "http://localhost:8002"),
		AutomationAPIKey:   getEnvOrDefault("AUTOMATION_API_KEY", ""),
		DatabaseURL:        getEnvOrDefault("DATABASE_URL", "postgres://localhost/aremko?sslmode=disable"),
		Port:               getEnvOrDefault("PORT", "8080"),
		Environment:        getEnvOrDefault("ENVIRONMENT", "development"),
		EnableMetaAds:      getEnvOrDefault("ENABLE_META_ADS", "true") == "true",
		EnableGoogleAds:    getEnvOrDefault("ENABLE_GOOGLE_ADS", "false") == "true",
		EnableLinkedIn:     getEnvOrDefault("ENABLE_LINKEDIN", "false") == "true",
		EnableBookings:     getEnvOrDefault("ENABLE_BOOKINGS", "true") == "true",
		EnableGA4:          getEnvOrDefault("ENABLE_GA4", "true") == "true",
		EnableAI:           getEnvOrDefault("ENABLE_AI", "true") == "true",
	}

	// Validar configuración mínima
	if config.MetaAccessToken == "" && config.EnableMetaAds {
		return nil, fmt.Errorf("META_ACCESS_TOKEN es requerido cuando ENABLE_META_ADS=true")
	}

	AppConfig = config
	return config, nil
}

// GetMetaToken obtiene el token de Meta desde la configuración o keychain
func GetMetaToken() (string, error) {
	if AppConfig == nil {
		if _, err := LoadConfig(); err != nil {
			return "", err
		}
	}

	// Si no está en variables de entorno, intentar obtener desde keychain (macOS)
	if AppConfig.MetaAccessToken == "" {
		// TODO: Implementar lectura desde keychain usando security command
		return "", fmt.Errorf("META_ACCESS_TOKEN no configurado")
	}

	return AppConfig.MetaAccessToken, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseFloatEnv(key string, defaultValue float64) float64 {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultValue
	}
	var v float64
	if _, err := fmt.Sscanf(raw, "%f", &v); err != nil {
		return defaultValue
	}
	return v
}

// parseMetaAccounts arma la lista de cuentas desde META_AD_ACCOUNT_IDS +
// META_ACCOUNT_LABELS (CSV). Si solo está el legacy META_AD_ACCOUNT_ID,
// devuelve una sola cuenta con label "Principal" para no romper deploys.
func parseMetaAccounts() []MetaAccount {
	idsRaw := strings.TrimSpace(os.Getenv("META_AD_ACCOUNT_IDS"))
	labelsRaw := strings.TrimSpace(os.Getenv("META_ACCOUNT_LABELS"))

	if idsRaw == "" {
		// backwards compat: una sola cuenta desde META_AD_ACCOUNT_ID
		single := strings.TrimSpace(os.Getenv("META_AD_ACCOUNT_ID"))
		if single == "" {
			return nil
		}
		return []MetaAccount{{ID: single, Label: "Principal"}}
	}

	ids := splitCSV(idsRaw)
	labels := splitCSV(labelsRaw)

	accounts := make([]MetaAccount, 0, len(ids))
	for i, id := range ids {
		label := ""
		if i < len(labels) {
			label = labels[i]
		}
		if label == "" {
			label = id // fallback al ID si no hay etiqueta
		}
		accounts = append(accounts, MetaAccount{ID: id, Label: label})
	}
	return accounts
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
