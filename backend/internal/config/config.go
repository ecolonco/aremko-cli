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

	// Campaña GiftCard Día del Padre (vista dedicada en brief, termina 22-jun-2026)
	MetaGiftCardCampaignID string
	MetaGiftCardBudgetCLP  float64 // presupuesto total declarado ($5.000/día × 11 días)

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
	// OpenRouterModel: si está seteado, sobreescribe el modelo de TODAS las
	// llamadas de IA (un solo knob para cambiar de modelo desde Render, sin tocar
	// código). Ej: "google/gemini-2.5-pro". Vacío = usa los modelos por defecto del código.
	OpenRouterModel string
	// OpenRouterMaxTokens: si > 0, sobreescribe el largo (max tokens de salida)
	// de TODAS las llamadas de IA. 0 = usa los largos por defecto del código
	// (los análisis por sección están en 12000). Ej: 6000 = informes más cortos/rápidos.
	OpenRouterMaxTokens int

	// Booking System (Django)
	BookingSystemURL string

	// Auth para endpoints write de Operación Vuelta a Casa (header X-API-KEY)
	AutomationAPIKey string

	// API key para leer endpoints /api/ del Django de aremko.cl (header X-API-Key).
	// Usado para traer leads reales del formulario Refugio (ventas_refugiolead).
	LunaAPIKey string

	// Reporte diario por email (cron-job.org → /api/v1/cron/reporte-diario)
	SendGridAPIKey       string   // envío de email (mismo SendGrid de Aremko)
	ReporteCronToken     string   // protege el endpoint del cron (?token=...)
	ReporteFromEmail     string   // remitente verificado en SendGrid
	ReporteFromName      string   // nombre visible del remitente
	ReporteDestinatarios []string // lista de distribución (coma-separada en la env var)

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
		// Default = ID real de la campaña creada el 11-jun-2026; la env var permite
		// apuntar a otra campaña (o vaciarla para ocultar el bloque) sin redeploy de código.
		MetaGiftCardCampaignID: getEnvOrDefault("META_GIFTCARD_CAMPAIGN_ID", "120249461833490134"),
		MetaGiftCardBudgetCLP:  parseFloatEnv("META_GIFTCARD_BUDGET_CLP", 55000),
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
		OpenRouterModel:    getEnvOrDefault("OPENROUTER_MODEL", ""),
		OpenRouterMaxTokens: parseIntEnv("OPENROUTER_MAX_TOKENS", 0),
		BookingSystemURL:   getEnvOrDefault("BOOKING_SYSTEM_URL", "http://localhost:8002"),
		AutomationAPIKey:   getEnvOrDefault("AUTOMATION_API_KEY", ""),
		LunaAPIKey:         getEnvOrDefault("LUNA_API_KEY", ""),
		SendGridAPIKey:       getEnvOrDefault("SENDGRID_API_KEY", ""),
		ReporteCronToken:     getEnvOrDefault("REPORTE_CRON_TOKEN", ""),
		ReporteFromEmail:     getEnvOrDefault("REPORTE_FROM_EMAIL", "noreply@aremko.cl"),
		ReporteFromName:      getEnvOrDefault("REPORTE_FROM_NAME", "Aremko · Reporte diario"),
		ReporteDestinatarios: parseCSVEnv("REPORTE_DIARIO_DESTINATARIOS"),
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

func parseIntEnv(key string, defaultValue int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultValue
	}
	var v int
	if _, err := fmt.Sscanf(raw, "%d", &v); err != nil {
		return defaultValue
	}
	return v
}

// parseCSVEnv devuelve una lista a partir de una env var coma-separada,
// recortando espacios y descartando vacíos. Ej: "a@x.cl, b@y.cl" → [a@x.cl b@y.cl].
func parseCSVEnv(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
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
