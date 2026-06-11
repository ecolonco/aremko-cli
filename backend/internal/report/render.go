// Package report arma el email HTML del reporte diario de gestión: convierte el
// análisis IA (markdown) a HTML con un renderizador mínimo (sin dependencias) y
// construye los "cuadros" (tablas) directamente desde los números de Meta Ads,
// no desde el texto de la IA, para que sean siempre exactos.
package report

import (
	"fmt"
	"html"
	"sort"
	"strings"
)

// ---------------------------------------------------------------------------
// Markdown → HTML (mínimo, suficiente para el formato del análisis ejecutivo)
// Soporta: ## / ### encabezados, **negrita**, listas con "- " o "1. ",
// párrafos y líneas en blanco. No es un parser completo, es un render acotado
// al formato que producen nuestros prompts.
// ---------------------------------------------------------------------------

func MarkdownToHTML(md string) string {
	lines := strings.Split(md, "\n")
	var b strings.Builder
	inList := false

	closeList := func() {
		if inList {
			b.WriteString("</ul>\n")
			inList = false
		}
	}

	for _, raw := range lines {
		line := strings.TrimRight(raw, " ")
		trimmed := strings.TrimSpace(line)

		switch {
		case trimmed == "":
			closeList()
		case strings.HasPrefix(trimmed, "### "):
			closeList()
			b.WriteString("<h3 style=\"margin:18px 0 6px;font-size:15px;color:#1f2937\">" + inline(trimmed[4:]) + "</h3>\n")
		case strings.HasPrefix(trimmed, "## "):
			closeList()
			b.WriteString("<h2 style=\"margin:22px 0 8px;font-size:17px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:4px\">" + inline(trimmed[3:]) + "</h2>\n")
		case strings.HasPrefix(trimmed, "# "):
			closeList()
			b.WriteString("<h2 style=\"margin:22px 0 8px;font-size:18px;color:#111827\">" + inline(trimmed[2:]) + "</h2>\n")
		case strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* "):
			if !inList {
				b.WriteString("<ul style=\"margin:6px 0;padding-left:20px;color:#374151\">\n")
				inList = true
			}
			b.WriteString("<li style=\"margin:3px 0\">" + inline(trimmed[2:]) + "</li>\n")
		case isOrderedItem(trimmed):
			if !inList {
				b.WriteString("<ul style=\"margin:6px 0;padding-left:20px;color:#374151\">\n")
				inList = true
			}
			b.WriteString("<li style=\"margin:3px 0\">" + inline(stripOrdinal(trimmed)) + "</li>\n")
		case trimmed == "---":
			closeList()
			b.WriteString("<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:16px 0\">\n")
		default:
			closeList()
			b.WriteString("<p style=\"margin:6px 0;color:#374151;line-height:1.5\">" + inline(trimmed) + "</p>\n")
		}
	}
	closeList()
	return b.String()
}

// inline procesa **negrita**, `código` y escapa el resto.
func inline(s string) string {
	// Escapamos primero, luego reintroducimos las marcas.
	out := html.EscapeString(s)
	out = replacePairs(out, "**", "<strong>", "</strong>")
	out = replacePairs(out, "`", "<code style=\"background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:13px\">", "</code>")
	return out
}

// replacePairs reemplaza pares de delimitadores idénticos por tags de apertura/cierre.
func replacePairs(s, delim, open, close string) string {
	var b strings.Builder
	openNext := true
	for {
		i := strings.Index(s, delim)
		if i < 0 {
			b.WriteString(s)
			break
		}
		b.WriteString(s[:i])
		if openNext {
			b.WriteString(open)
		} else {
			b.WriteString(close)
		}
		openNext = !openNext
		s = s[i+len(delim):]
	}
	return b.String()
}

func isOrderedItem(s string) bool {
	// "1. ", "12. "
	i := 0
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	return i > 0 && i+1 < len(s) && s[i] == '.' && s[i+1] == ' '
}

func stripOrdinal(s string) string {
	i := strings.Index(s, ". ")
	if i < 0 {
		return s
	}
	return s[i+2:]
}

// ---------------------------------------------------------------------------
// Split ejecutivo / completo
// El análisis IA tiene una estructura conocida (el prompt la fuerza): arranca con
// "🎯 Veredicto" + "📌 3 Cifras", trae el detalle bajo "## 🔍 Análisis Profundo
// por Campaña", y cierra con "## 🎯 Acciones priorizadas". Para el cuerpo del
// email tomamos todo MENOS el detalle profundo; el detalle va solo en el adjunto.
// ---------------------------------------------------------------------------

func SplitEjecutivo(md string) string {
	const deepMarker = "## 🔍 Análisis Profundo"
	const actionsMarker = "## 🎯 Acciones priorizadas"

	deep := strings.Index(md, deepMarker)
	if deep < 0 {
		return md // estructura inesperada → degradar a informe completo
	}
	head := md[:deep]

	if act := strings.Index(md, actionsMarker); act >= 0 {
		return strings.TrimRight(head, "\n ") + "\n\n" + md[act:]
	}
	return head
}

// ---------------------------------------------------------------------------
// Cuadros (tablas) construidos desde los números reales de meta_ads
// ---------------------------------------------------------------------------

func clp(v float64) string {
	// Formato CLP con separador de miles "."
	n := int64(v + 0.5)
	s := fmt.Sprintf("%d", n)
	neg := false
	if n < 0 {
		neg = true
		s = s[1:]
	}
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	parts = append([]string{s}, parts...)
	out := "$" + strings.Join(parts, ".")
	if neg {
		out = "-" + out
	}
	return out
}

func num(v interface{}) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case int64:
		return float64(x)
	case int:
		return float64(x)
	}
	return 0
}

func str(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// BuildCuadros arma las tablas HTML del reporte desde el map de meta_ads.
func BuildCuadros(meta map[string]interface{}) string {
	var b strings.Builder

	// Cuadro 1 — Campañas activas con gasto (top por inversión)
	if camps, ok := meta["campaigns"].([]map[string]interface{}); ok && len(camps) > 0 {
		rows := make([]map[string]interface{}, 0, len(camps))
		for _, c := range camps {
			if num(c["spend"]) > 0 {
				rows = append(rows, c)
			}
		}
		sort.Slice(rows, func(i, j int) bool { return num(rows[i]["spend"]) > num(rows[j]["spend"]) })
		if len(rows) > 8 {
			rows = rows[:8]
		}
		if len(rows) > 0 {
			b.WriteString(tableTitle("📊 Campañas con gasto (período)"))
			b.WriteString(tableOpen([]string{"Campaña", "Cuenta", "Gasto", "Clics", "CTR", "CPC"}))
			for _, c := range rows {
				b.WriteString(tr([]string{
					tdName(str(c["name"])),
					td(str(c["account_label"])),
					tdR(clp(num(c["spend"]))),
					tdR(fmt.Sprintf("%.0f", num(c["clicks"]))),
					tdR(fmt.Sprintf("%.2f%%", num(c["ctr"]))),
					tdR(clp(num(c["cpc"]))),
				}))
			}
			b.WriteString(tableClose())
		}
	}

	// Cuadro 2 — Refugio (resumen)
	if ref, ok := meta["refugio"].(map[string]interface{}); ok {
		if s, ok := ref["summary"].(map[string]interface{}); ok {
			b.WriteString(tableTitle("🌿 Refugio — resumen"))
			b.WriteString(kvTable([][2]string{
				{"Gasto", clp(num(s["spend"])) + " de " + clp(num(s["budget_total_clp"])) + fmt.Sprintf(" (%.0f%%)", num(s["budget_pct_used"]))},
				{"Leads (formulario)", fmt.Sprintf("%.0f", num(s["leads"]))},
				{"CPL", cplOrDash(num(s["cpl"]), num(s["leads"]))},
				{"CTR", fmt.Sprintf("%.2f%%", num(s["ctr"]))},
				{"Frecuencia", fmt.Sprintf("%.2f", num(s["frequency"]))},
				{"Clics WhatsApp (intención)", fmt.Sprintf("%.0f", num(s["whatsapp_clicks"]))},
			}))
		}
	}

	// Cuadro 3 — GiftCard (resumen)
	if gc, ok := meta["giftcard"].(map[string]interface{}); ok {
		if s, ok := gc["summary"].(map[string]interface{}); ok {
			b.WriteString(tableTitle("🎁 GiftCard Día del Padre — resumen"))
			b.WriteString(kvTable([][2]string{
				{"Gasto", clp(num(s["spend"])) + " de " + clp(num(s["budget_total_clp"])) + fmt.Sprintf(" (%.1f%%)", num(s["budget_pct_used"]))},
				{"Compras (píxel)", fmt.Sprintf("%.0f", num(s["purchases"]))},
				{"Costo por compra", cplOrDash(num(s["cost_per_purchase"]), num(s["purchases"]))},
				{"Ingresos atribuidos", dashIfZero(num(s["purchase_value"]))},
				{"ROAS", roasOrDash(num(s["roas"]))},
				{"CTR", fmt.Sprintf("%.2f%%", num(s["ctr"]))},
			}))
		}
	}

	return b.String()
}

func cplOrDash(cpl, leads float64) string {
	if leads <= 0 || cpl <= 0 {
		return "—"
	}
	return clp(cpl)
}
func dashIfZero(v float64) string {
	if v <= 0 {
		return "—"
	}
	return clp(v)
}
func roasOrDash(v float64) string {
	if v <= 0 {
		return "—"
	}
	return fmt.Sprintf("%.2f×", v)
}

// Helpers de tabla HTML (estilos inline para clientes de correo)
func tableTitle(t string) string {
	return "<h3 style=\"margin:20px 0 6px;font-size:15px;color:#1f2937\">" + html.EscapeString(t) + "</h3>\n"
}
func tableOpen(headers []string) string {
	var b strings.Builder
	b.WriteString("<table style=\"width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px\"><thead><tr>")
	for i, h := range headers {
		align := "left"
		if i >= 2 {
			align = "right"
		}
		b.WriteString("<th style=\"text-align:" + align + ";padding:6px 8px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-weight:600\">" + html.EscapeString(h) + "</th>")
	}
	b.WriteString("</tr></thead><tbody>")
	return b.String()
}
func tableClose() string { return "</tbody></table>\n" }
func tr(cells []string) string {
	return "<tr style=\"border-bottom:1px solid #f3f4f6\">" + strings.Join(cells, "") + "</tr>"
}
func td(s string) string {
	return "<td style=\"padding:6px 8px;color:#374151\">" + html.EscapeString(s) + "</td>"
}
func tdName(s string) string {
	if len(s) > 42 {
		s = s[:42] + "…"
	}
	return "<td style=\"padding:6px 8px;color:#111827;font-weight:500\">" + html.EscapeString(s) + "</td>"
}
func tdR(s string) string {
	return "<td style=\"padding:6px 8px;color:#374151;text-align:right\">" + html.EscapeString(s) + "</td>"
}
func kvTable(rows [][2]string) string {
	var b strings.Builder
	b.WriteString("<table style=\"width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px\"><tbody>")
	for _, r := range rows {
		b.WriteString("<tr style=\"border-bottom:1px solid #f3f4f6\"><td style=\"padding:6px 8px;color:#6b7280\">" + html.EscapeString(r[0]) + "</td><td style=\"padding:6px 8px;color:#111827;text-align:right;font-weight:500\">" + html.EscapeString(r[1]) + "</td></tr>")
	}
	b.WriteString("</tbody></table>\n")
	return b.String()
}

// WrapEmail envuelve el contenido en un documento HTML simple y centrado.
func WrapEmail(title, intro, contentHTML, footerHTML string) string {
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:680px;margin:0 auto;padding:20px">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#065f46">` + html.EscapeString(title) + `</h1>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px">` + html.EscapeString(intro) + `</p>
    ` + contentHTML + `
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">` + footerHTML + `</div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:12px">Aremko Spa Boutique · Reporte automático generado por aremko-cli</p>
</div></body></html>`
}
