package handlers

import (
	"net/http"
	"strconv"

	"github.com/aremko/aremko-cli/internal/bookings"
	"github.com/aremko/aremko-cli/internal/config"
)

// MonthlyByFamily proxies the Django monthly-by-family endpoint so the frontend
// can fetch it from the Go backend (consistent CORS, single origin). Accepts
// ?months=N (default 24, max 36).
func MonthlyByFamily(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !cfg.EnableBookings {
			respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
				"success": false,
				"error":   "Bookings integration is not enabled",
			})
			return
		}

		months := 24
		if m := r.URL.Query().Get("months"); m != "" {
			if parsed, err := strconv.Atoi(m); err == nil && parsed > 0 && parsed <= 36 {
				months = parsed
			}
		}

		client := bookings.NewClient(cfg.BookingSystemURL)
		result, err := client.GetMonthlyByFamily(months)
		if err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
			return
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"data":    result,
		})
	}
}
