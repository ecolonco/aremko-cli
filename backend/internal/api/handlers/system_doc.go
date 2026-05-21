package handlers

import (
	_ "embed"
	"net/http"
	"strings"
	"time"
)

//go:embed templates/system_doc.md
var systemDocTemplate string

// SystemDocMarkdown serves the live snapshot of the aremko-cli system
// documentation. The markdown template lives at handlers/templates/system_doc.md
// and is embedded at compile time. Placeholders ({{FECHA}}) are replaced at
// request time so the document always carries the current date.
func SystemDocMarkdown() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		doc := strings.ReplaceAll(systemDocTemplate, "{{FECHA}}", time.Now().Format("2006-01-02"))

		// Allow download with filename when ?download=1
		if r.URL.Query().Get("download") == "1" {
			filename := "aremko-cli-sistema-completo-" + time.Now().Format("2006-01-02") + ".md"
			w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
		}
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(doc))
	}
}
