package aremko

import (
	"fmt"

	"github.com/spf13/cobra"
)

var (
	version = "0.1.0-alpha"
)

var rootCmd = &cobra.Command{
	Use:   "aremko",
	Short: "aremko-cli - Sistema de gestión inteligente para Aremko Spa",
	Long: `aremko-cli es un sistema híbrido (CLI + Web + API) diseñado para
centralizar información, automatizar tareas y transformar la gestión de Aremko Spa
en una operación impulsada por datos.

Comandos disponibles:
  brief    - Genera el brief semanal automatizado
  ads      - Gestiona y analiza campañas publicitarias
  stats    - Muestra estadísticas y KPIs en tiempo real
  server   - Inicia el servidor web y API (próximamente)`,
	Version: version,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🏥 aremko-cli v" + version)
		fmt.Println("\nUsa 'aremko --help' para ver todos los comandos disponibles")
		fmt.Println("\n📚 Documentación: https://github.com/aremko/aremko-cli")
	},
}

// Execute ejecuta el comando raíz
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.SetVersionTemplate("aremko-cli version {{.Version}}\n")
}
