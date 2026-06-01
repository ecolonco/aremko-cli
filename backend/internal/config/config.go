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

	// Google Ads (cuenta nueva 539-975-0827, OAuth2 + refresh token)
	GoogleAdsDeveloperToken    string
	GoogleAdsClientID          string
	GoogleAdsClientSecret      string
	GoogleAdsRefreshToken      string
	GoogleAdsCustomerID        string // sin guiones, ej 5399055633
	GoogleAdsLoginCustomerID   string // ID del MCC si la cuenta está administrada
	GoogleAdsRefugioCampaignID string // ID de la campaña Refugio Search
	GoogleAdsBudgetCLP         float64

	// WhatsApp Cloud API (piloto inbound Refugio)
	WhatsAppAccessToken   string
	WhatsAppPhoneNumberID string
	WhatsAppWABAID        string
	WhatsAppVerifyToken   string
	WhatsAppAppSecret     string

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
	EnableWhatsApp    bool
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
		GoogleAdsDeveloperToken:    getEnvOrDefault("GOOGLE_ADS_DEVELOPER_TOKEN", ""),
		GoogleAdsClientID:          getEnvOrDefault("GOOGLE_ADS_CLIENT_ID", ""),
		GoogleAdsClientSecret:      getEnvOrDefault("GOOGLE_ADS_CLIENT_SECRET", ""),
		GoogleAdsRefreshToken:      getEnvOrDefault("GOOGLE_ADS_REFRESH_TOKEN", ""),
		GoogleAdsCustomerID:        getEnvOrDefault("GOOGLE_ADS_CUSTOMER_ID", ""),
		GoogleAdsLoginCustomerID:   getEnvOrDefault("GOOGLE_ADS_LOGIN_CUSTOMER_ID", ""),
		GoogleAdsRefugioCampaignID: getEnvOrDefault("GOOGLE_ADS_REFUGIO_CAMPAIGN_ID", ""),
		GoogleAdsBudgetCLP:         parseFloatEnv("GOOGLE_ADS_BUDGET_CLP", 100000),
		WhatsAppAccessToken:   getEnvOrDefault("WHATSAPP_ACCESS_TOKEN", ""),
		WhatsAppPhoneNumberID: getEnvOrDefault("WHATSAPP_PHONE_NUMBER_ID", ""),
		WhatsAppWABAID:        getEnvOrDefault("WHATSAPP_WABA_ID", ""),
		WhatsAppVerifyToken:   getEnvOrDefault("WHATSAPP_VERIFY_TOKEN", ""),
		WhatsAppAppSecret:     getEnvOrDefault("WHATSAPP_APP_SECRET", ""),
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
		EnableGoogleAds:    googleAdsAutoEnabled(),
		EnableLinkedIn:     getEnvOrDefault("ENABLE_LINKEDIN", "false") == "true",
		EnableBookings:     getEnvOrDefault("ENABLE_BOOKINGS", "true") == "true",
		EnableGA4:          getEnvOrDefault("ENABLE_GA4", "true") == "true",
		EnableAI:           getEnvOrDefault("ENABLE_AI", "true") == "true",
		EnableWhatsApp:     getEnvOrDefault("ENABLE_WHATSAPP", "false") == "true",
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

// googleAdsAutoEnabled activa Google Ads cuando todas las credenciales mínimas
// están presentes. ENABLE_GOOGLE_ADS explícito siempre gana (true/false). Así,
// agregar las env vars en Render lo prende sin un flag extra.
func googleAdsAutoEnabled() bool {
	if v := os.Getenv("ENABLE_GOOGLE_ADS"); v != "" {
		return v == "true"
	}
	required := []string{
		"GOOGLE_ADS_DEVELOPER_TOKEN",
		"GOOGLE_ADS_CLIENT_ID",
		"GOOGLE_ADS_CLIENT_SECRET",
		"GOOGLE_ADS_REFRESH_TOKEN",
		"GOOGLE_ADS_CUSTOMER_ID",
	}
	for _, k := range required {
		if os.Getenv(k) == "" {
			return false
		}
	}
	return true
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
