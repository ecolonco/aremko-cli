package aremko

import (
	"fmt"
	"time"

	"github.com/aremko/aremko-cli/internal/config"
	"github.com/aremko/aremko-cli/internal/meta"
	"github.com/spf13/cobra"
)

var briefCmd = &cobra.Command{
	Use:   "brief",
	Short: "Genera el brief semanal automatizado",
	Long: `Genera un brief semanal con las métricas más importantes:
  - Resumen de campañas de Meta Ads
  - Rendimiento de la semana pasada
  - Comparación con período anterior
  - Recomendaciones automáticas`,
	RunE: runBrief,
}

var (
	briefPeriod string
	briefFormat string
)

func init() {
	rootCmd.AddCommand(briefCmd)
	briefCmd.Flags().StringVarP(&briefPeriod, "period", "p", "last-week", "Período a analizar (last-week, last-month, custom)")
	briefCmd.Flags().StringVarP(&briefFormat, "format", "f", "text", "Formato de salida (text, json, markdown)")
}

func runBrief(cmd *cobra.Command, args []string) error {
	fmt.Println("📊 Generando Brief Semanal de Aremko Spa...")
	fmt.Println("")

	// Cargar configuración
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("error al cargar configuración: %w", err)
	}

	// Calcular rango de fechas
	dateStop := time.Now().AddDate(0, 0, -1).Format("2006-01-02") // Ayer
	dateStart := time.Now().AddDate(0, 0, -8).Format("2006-01-02") // Hace 7 días

	fmt.Printf("📅 Período: %s a %s\n\n", dateStart, dateStop)

	// Obtener datos de Meta Ads si está habilitado
	if cfg.EnableMetaAds {
		if err := generateMetaAdsSection(cfg, dateStart, dateStop); err != nil {
			fmt.Printf("⚠️  Error al obtener datos de Meta Ads: %v\n\n", err)
		}
	} else {
		fmt.Println("ℹ️  Meta Ads deshabilitado")
	}

	// TODO: Agregar secciones de Google Ads y LinkedIn
	if cfg.EnableGoogleAds {
		fmt.Println("📢 Google Ads: (próximamente)")
	}

	if cfg.EnableLinkedIn {
		fmt.Println("💼 LinkedIn Ads: (próximamente)")
	}

	fmt.Println("\n✅ Brief generado exitosamente")
	return nil
}

func generateMetaAdsSection(cfg *config.Config, dateStart, dateStop string) error {
	fmt.Println("🎯 META ADS")
	fmt.Println("═══════════════════════════════════════")

	// Obtener token desde config o keychain
	token, err := config.GetMetaToken()
	if err != nil {
		return err
	}

	// Crear cliente de Meta
	metaClient := meta.NewClient(token, cfg.MetaAdAccountID)

	// Obtener insights de todas las campañas
	insights, err := metaClient.GetAccountInsights(dateStart, dateStop)
	if err != nil {
		return err
	}

	if len(insights) == 0 {
		fmt.Println("No hay datos disponibles para este período")
		return nil
	}

	// Calcular totales
	var totalSpend float64
	var totalImpressions int64
	var totalClicks int64
	var totalReach int64

	for _, insight := range insights {
		totalSpend += insight.Spend
		totalImpressions += insight.Impressions
		totalClicks += insight.Clicks
		totalReach += insight.Reach
	}

	// Calcular métricas agregadas
	avgCTR := 0.0
	avgCPC := 0.0
	avgCPM := 0.0

	if totalImpressions > 0 {
		avgCTR = (float64(totalClicks) / float64(totalImpressions)) * 100
		avgCPM = (totalSpend / float64(totalImpressions)) * 1000
	}
	if totalClicks > 0 {
		avgCPC = totalSpend / float64(totalClicks)
	}

	// Mostrar resumen
	fmt.Printf("\n📈 RESUMEN GENERAL\n")
	fmt.Printf("  Gasto Total:      $%.2f USD\n", totalSpend)
	fmt.Printf("  Impresiones:      %s\n", formatNumber(totalImpressions))
	fmt.Printf("  Clicks:           %s\n", formatNumber(totalClicks))
	fmt.Printf("  Alcance:          %s\n", formatNumber(totalReach))
	fmt.Printf("  CTR Promedio:     %.2f%%\n", avgCTR)
	fmt.Printf("  CPC Promedio:     $%.2f USD\n", avgCPC)
	fmt.Printf("  CPM Promedio:     $%.2f USD\n", avgCPM)

	fmt.Printf("\n📊 DETALLE POR CAMPAÑA (%d activas)\n", len(insights))
	fmt.Println("─────────────────────────────────────────")

	for i, insight := range insights {
		fmt.Printf("\n%d. %s\n", i+1, insight.CampaignName)
		fmt.Printf("   Gasto:        $%.2f USD\n", insight.Spend)
		fmt.Printf("   Impresiones:  %s\n", formatNumber(insight.Impressions))
		fmt.Printf("   Clicks:       %s\n", formatNumber(insight.Clicks))
		fmt.Printf("   CTR:          %.2f%%\n", insight.CalculateCTR())
		fmt.Printf("   CPC:          $%.2f USD\n", insight.CalculateCPC())
	}

	fmt.Println("")

	// Generar recomendaciones básicas
	fmt.Println("💡 RECOMENDACIONES")
	fmt.Println("─────────────────────────────────────────")

	if avgCTR < 1.0 {
		fmt.Println("  ⚠️  CTR bajo (<1%) - Considera mejorar el copy y creativos")
	} else if avgCTR > 3.0 {
		fmt.Println("  ✅ CTR excelente (>3%) - Mantén esta estrategia")
	}

	if avgCPC > 1.0 {
		fmt.Println("  ⚠️  CPC alto (>$1) - Revisa targeting y optimiza audiencias")
	}

	// Identificar mejor y peor campaña
	if len(insights) > 1 {
		var bestCampaign, worstCampaign *meta.AdInsights
		bestCTR := 0.0
		worstCTR := 100.0

		for i := range insights {
			ctr := insights[i].CalculateCTR()
			if ctr > bestCTR {
				bestCTR = ctr
				bestCampaign = &insights[i]
			}
			if ctr < worstCTR && insights[i].Impressions > 1000 {
				worstCTR = ctr
				worstCampaign = &insights[i]
			}
		}

		if bestCampaign != nil {
			fmt.Printf("  🏆 Mejor campaña: \"%s\" (CTR: %.2f%%)\n", bestCampaign.CampaignName, bestCTR)
		}
		if worstCampaign != nil {
			fmt.Printf("  📉 Revisar campaña: \"%s\" (CTR: %.2f%%)\n", worstCampaign.CampaignName, worstCTR)
		}
	}

	return nil
}

func formatNumber(n int64) string {
	if n < 1000 {
		return fmt.Sprintf("%d", n)
	} else if n < 1000000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	return fmt.Sprintf("%.1fM", float64(n)/1000000)
}
