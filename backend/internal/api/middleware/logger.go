package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// Logger es un middleware personalizado para logging de requests
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		t1 := time.Now()

		defer func() {
			duration := time.Since(t1)

			// Log colorizado según el status code
			statusColor := getStatusColor(ww.Status())
			methodColor := "\033[1;34m" // Azul
			resetColor := "\033[0m"

			fmt.Printf("%s%s%s %s%d%s %s %v\n",
				methodColor, r.Method, resetColor,
				statusColor, ww.Status(), resetColor,
				r.URL.Path,
				duration,
			)
		}()

		next.ServeHTTP(ww, r)
	})
}

func getStatusColor(status int) string {
	switch {
	case status >= 200 && status < 300:
		return "\033[1;32m" // Verde
	case status >= 300 && status < 400:
		return "\033[1;36m" // Cyan
	case status >= 400 && status < 500:
		return "\033[1;33m" // Amarillo
	case status >= 500:
		return "\033[1;31m" // Rojo
	default:
		return "\033[0m" // Default
	}
}
