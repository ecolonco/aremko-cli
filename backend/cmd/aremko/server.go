package aremko

import (
	"fmt"

	"github.com/aremko/aremko-cli/internal/api"
	"github.com/aremko/aremko-cli/internal/config"
	"github.com/spf13/cobra"
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Inicia el servidor API REST",
	Long: `Inicia el servidor API REST para exponer datos a los dashboards web.

Endpoints disponibles:
  GET  /health                           - Health check
  GET  /api/v1/meta-ads/campaigns        - Lista de campañas
  GET  /api/v1/meta-ads/insights         - Insights de campañas
  GET  /api/v1/meta-ads/account-summary  - Resumen de cuenta
  GET  /api/v1/brief/weekly              - Brief semanal
  POST /api/v1/brief/generate            - Generar brief
  GET  /api/v1/stats/overview            - Resumen general

El servidor escucha en el puerto configurado en .env (default: 8080)`,
	RunE: runServer,
}

var (
	serverPort string
)

func init() {
	rootCmd.AddCommand(serverCmd)
	serverCmd.Flags().StringVarP(&serverPort, "port", "p", "8080", "Puerto para el servidor API")
}

func runServer(cmd *cobra.Command, args []string) error {
	fmt.Println("🚀 Iniciando servidor API de aremko-cli...")
	fmt.Println("")

	// Cargar configuración
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("error al cargar configuración: %w", err)
	}

	// Override port si se especificó en flag
	if serverPort != "" {
		cfg.Port = serverPort
	}

	// Mostrar configuración
	fmt.Println("📋 Configuración:")
	fmt.Printf("  - Puerto: %s\n", cfg.Port)
	fmt.Printf("  - Ambiente: %s\n", cfg.Environment)
	fmt.Printf("  - Meta Ads: %v\n", cfg.EnableMetaAds)
	fmt.Printf("  - Google Ads: %v\n", cfg.EnableGoogleAds)
	fmt.Printf("  - LinkedIn: %v\n", cfg.EnableLinkedIn)
	fmt.Println("")

	// Crear y iniciar servidor
	server := api.NewServer(cfg)
	return server.Start()
}
