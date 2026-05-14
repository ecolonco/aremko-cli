package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	// Meta Ads
	MetaAccessToken string
	MetaAdAccountID string

	// Google Analytics 4
	GA4PropertyID      string
	GA4CredentialsPath string

	// OpenRouter (AI)
	OpenRouterAPIKey string
	OpenRouterBaseURL string

	// Booking System (Django)
	BookingSystemURL string

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
		MetaAccessToken:    getEnvOrDefault("META_ACCESS_TOKEN", ""),
		MetaAdAccountID:    getEnvOrDefault("META_AD_ACCOUNT_ID", ""),
		GA4PropertyID:      getEnvOrDefault("GA4_PROPERTY_ID", ""),
		GA4CredentialsPath: getEnvOrDefault("GA4_CREDENTIALS_PATH", "ga4-credentials.json"),
		OpenRouterAPIKey:   getEnvOrDefault("OPENROUTER_API_KEY", ""),
		OpenRouterBaseURL:  getEnvOrDefault("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
		BookingSystemURL:   getEnvOrDefault("BOOKING_SYSTEM_URL", "http://localhost:8002"),
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
