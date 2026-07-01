// Package report arma el email HTML del reporte diario de gestión: convierte el
// análisis IA (markdown) a HTML con un renderizador mínimo (sin dependencias) y
// construye los "cuadros" (tablas) directamente desde los números de Meta Ads,
// no desde el texto de la IA, para que sean siempre exactos.
package report

import (
	"encoding/json"
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

// SplitReport separa el análisis en dos piezas para el correo:
//   - ejecutivo: Veredicto + 3 Cifras + Refugio/GiftCard + Acciones priorizadas
//   - detalle: el "Análisis Profundo por Campaña" + "Estado por Dimensión"
//
// Hace match por TEXTO PLANO ("Análisis Profundo", "Acciones priorizadas") en vez
// de por el header exacto con emoji, porque el modelo no siempre reproduce el
// mismo nivel/emoji del encabezado. Si no encuentra la estructura, degrada
// devolviendo todo como ejecutivo y detalle vacío (sin duplicar).
func SplitReport(md string) (ejecutivo, detalle string) {
	// Fin del INTRO = primer header de campaña/análisis tras "3 Cifras".
	// El ejecutivo tight = solo Veredicto + 3 Cifras (intro) + Acciones priorizadas.
	// Todo lo del medio (detalle Refugio, GiftCard, Análisis Profundo, Estado,
	// Bonus) baja al bloque "detalle".
	// Fin del intro = el siguiente header "## " DESPUÉS de "3 Cifras". Anclamos
	// en "3 Cifras" (solo aparece como header) en vez de en nombres de campaña,
	// que el modelo también usa en la prosa del veredicto.
	introEnd := -1
	if cifras := strings.Index(md, "3 Cifras"); cifras >= 0 {
		if rel := strings.Index(md[cifras:], "\n## "); rel >= 0 {
			introEnd = cifras + rel + 1 // +1 = inicio de la línea "## "
		}
	}
	if introEnd < 0 {
		introEnd = lineStartOf(md, "Análisis Profundo") // degradación
	}
	act := lineStartOf(md, "Acciones priorizadas")

	if introEnd < 0 {
		return md, "" // estructura inesperada → todo al cuerpo, sin detalle
	}
	intro := strings.TrimRight(md[:introEnd], "\n ")

	if act > introEnd {
		detalle = strings.TrimSpace(md[introEnd:act])
		ejecutivo = intro + "\n\n" + md[act:]
		return ejecutivo, detalle
	}
	// No hay sección de Acciones separada → todo lo del medio va a detalle
	detalle = strings.TrimSpace(md[introEnd:])
	return intro, detalle
}

// lineStartOf devuelve el índice del INICIO de la línea que contiene needle
// (para no cortar a media línea), o -1 si no aparece.
func lineStartOf(s, needle string) int {
	i := strings.Index(s, needle)
	if i < 0 {
		return -1
	}
	ls := strings.LastIndex(s[:i], "\n")
	if ls < 0 {
		return 0
	}
	return ls + 1
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

	// Cuadros 4/5/6 — Ritual, Refugio y Pausa. Evolución SEMANAL (últimas 8 semanas):
	// gasto + actividad (conversaciones o leads) de la campaña junto a las ventas reales
	// del programa, para ver el efecto de la campaña sobre las ventas. Los 3 son
	// mutuamente excluyentes (Ritual=1 noche, Refugio=2 noches, Pausa=tina+masaje) → sus
	// ventas no se solapan.
	for _, mp := range []struct{ key, title string }{
		{"ritual", "🌙 Ritual del Río (1 noche) — últimas 8 semanas"},
		{"refugio", "🌿 Refugio (2 noches) — últimas 8 semanas"},
		{"pausa", "🍃 Pausa junto al río — últimas 8 semanas"},
	} {
		blk, ok := meta[mp.key].(map[string]interface{})
		if !ok {
			continue
		}
		if weekly, ok := blk["weekly"].([]map[string]interface{}); ok && len(weekly) > 0 {
			activityHdr := str(blk["activity_label"])
			if activityHdr == "" {
				activityHdr = "Conversac."
			}
			b.WriteString(tableTitle(mp.title))
			b.WriteString(tableOpenN([]string{"Semana", "Gasto Meta", activityHdr, "Ventas", "Ingresos"}))
			var totSpend, totAct, totRes, totIng float64
			for _, wk := range weekly {
				totSpend += num(wk["spend"])
				totAct += num(wk["activity"])
				totRes += num(wk["reservas"])
				totIng += num(wk["ingresos"])
				b.WriteString(tr([]string{
					tdName(str(wk["label"])),
					tdR(clp(num(wk["spend"]))),
					tdR(fmt.Sprintf("%.0f", num(wk["activity"]))),
					tdR(fmt.Sprintf("%.0f", num(wk["reservas"]))),
					tdR(clp(num(wk["ingresos"]))),
				}))
			}
			b.WriteString(tr([]string{
				tdName("Total 8 sem."),
				tdR(clp(totSpend)),
				tdR(fmt.Sprintf("%.0f", totAct)),
				tdR(fmt.Sprintf("%.0f", totRes)),
				tdR(clp(totIng)),
			}))
			b.WriteString(tableClose())
			b.WriteString("<p style=\"font-size:11px;color:#9ca3af;margin:2px 0 14px\">Ventas / Ingresos = reservas del programa en TODOS los canales (no solo Meta); el gasto en ads es una fracción de lo que genera el programa. Semana = inicio (dd-mm), 7 días.</p>")
		} else if s, ok := blk["summary"].(map[string]interface{}); ok && mp.key != "refugio" {
			// Fallback: resumen 30d si no llegó la serie semanal. Refugio no cae acá
			// (ya tiene su cuadro detallado arriba; no lo duplicamos).
			b.WriteString(tableTitle(strings.Replace(mp.title, "últimas 8 semanas", "resumen (30 días)", 1)))
			b.WriteString(kvTable([][2]string{
				{"Gasto (30 días)", clp(num(s["spend"]))},
				{"Conversaciones", fmt.Sprintf("%.0f", num(s["conversations"]))},
				{"Costo por conversación", cplOrDash(num(s["cost_per_conversation"]), num(s["conversations"]))},
				{"Alcance", fmt.Sprintf("%.0f", num(s["reach"]))},
				{"Clics", fmt.Sprintf("%.0f", num(s["clicks"]))},
				{"CTR", fmt.Sprintf("%.2f%%", num(s["ctr"]))},
			}))
		}
	}

	return b.String()
}

// BuildCuadrosGoogleAds arma las tablas HTML del reporte de Google Ads (Búsqueda)
// desde el map de getGoogleAdsData. Normaliza a maps genéricos (los datos vienen
// con structs de googleads) para leer con num()/str() sin acoplar a ese paquete.
func BuildCuadrosGoogleAds(ga map[string]interface{}) string {
	norm := ga
	if b, err := json.Marshal(ga); err == nil {
		tmp := map[string]interface{}{}
		if json.Unmarshal(b, &tmp) == nil {
			norm = tmp
		}
	}

	var b strings.Builder

	// Cuadro 1 — Campañas de Google con actividad (top por gasto).
	if camps, ok := norm["campaigns"].([]interface{}); ok && len(camps) > 0 {
		rows := make([]map[string]interface{}, 0, len(camps))
		for _, c := range camps {
			if m, ok := c.(map[string]interface{}); ok {
				if num(m["cost_clp"]) > 0 || num(m["clicks"]) > 0 {
					rows = append(rows, m)
				}
			}
		}
		sort.Slice(rows, func(i, j int) bool { return num(rows[i]["cost_clp"]) > num(rows[j]["cost_clp"]) })
		if len(rows) > 10 {
			rows = rows[:10]
		}
		if len(rows) > 0 {
			b.WriteString(tableTitle("🔍 Google Ads — campañas (período)"))
			b.WriteString(tableOpen([]string{"Campaña", "Gasto", "Clics", "Conv.", "CPC"}))
			for _, c := range rows {
				b.WriteString(tr([]string{
					tdName(str(c["campaign_name"])),
					tdR(clp(num(c["cost_clp"]))),
					tdR(fmt.Sprintf("%.0f", num(c["clicks"]))),
					tdR(fmt.Sprintf("%.0f", num(c["conversions"]))),
					tdR(clp(num(c["avg_cpc"]))),
				}))
			}
			b.WriteString(tableClose())
		}
	}

	// Cuadro 2 — Refugio (Google) resumen.
	if ref, ok := norm["refugio"].(map[string]interface{}); ok {
		if s, ok := ref["summary"].(map[string]interface{}); ok {
			b.WriteString(tableTitle("🌿 Refugio (Google) — resumen"))
			b.WriteString(kvTable([][2]string{
				{"Gasto", clp(num(s["spend"])) + " de " + clp(num(s["budget_total_clp"])) + fmt.Sprintf(" (%.0f%%)", num(s["budget_pct_used"]))},
				{"Clics", fmt.Sprintf("%.0f", num(s["clicks"]))},
				{"Conversiones", fmt.Sprintf("%.0f", num(s["conversions"]))},
				{"CPL (costo/conv.)", cplOrDash(num(s["cpl"]), num(s["conversions"]))},
			}))
		}
	}

	// Cuadros 3/4/5 — Ritual, Refugio y Pausa: evolución SEMANAL (8 semanas) del gasto+clics
	// de Google junto a las ventas reales del programa (todos los canales). H-053. Los datos
	// vienen JSON-normalizados (weekly = []interface{}), no como los maps nativos de Meta.
	for _, mp := range []struct{ key, title string }{
		{"ritual", "🌙 Ritual del Río (1 noche) — últimas 8 semanas"},
		{"refugio", "🌿 Refugio (2 noches) — últimas 8 semanas"},
		{"pausa", "🍃 Pausa junto al río — últimas 8 semanas"},
	} {
		blk, ok := norm[mp.key].(map[string]interface{})
		if !ok {
			continue
		}
		weekly, ok := blk["weekly"].([]interface{})
		if !ok || len(weekly) == 0 {
			continue
		}
		activityHdr := str(blk["activity_label"])
		if activityHdr == "" {
			activityHdr = "Clics"
		}
		b.WriteString(tableTitle(mp.title))
		b.WriteString(tableOpenN([]string{"Semana", "Gasto Google", activityHdr, "Ventas", "Ingresos"}))
		var totSpend, totAct, totRes, totIng float64
		for _, wkRaw := range weekly {
			wk, ok := wkRaw.(map[string]interface{})
			if !ok {
				continue
			}
			totSpend += num(wk["spend"])
			totAct += num(wk["activity"])
			totRes += num(wk["reservas"])
			totIng += num(wk["ingresos"])
			b.WriteString(tr([]string{
				tdName(str(wk["label"])),
				tdR(clp(num(wk["spend"]))),
				tdR(fmt.Sprintf("%.0f", num(wk["activity"]))),
				tdR(fmt.Sprintf("%.0f", num(wk["reservas"]))),
				tdR(clp(num(wk["ingresos"]))),
			}))
		}
		b.WriteString(tr([]string{
			tdName("Total 8 sem."),
			tdR(clp(totSpend)),
			tdR(fmt.Sprintf("%.0f", totAct)),
			tdR(fmt.Sprintf("%.0f", totRes)),
			tdR(clp(totIng)),
		}))
		b.WriteString(tableClose())
		b.WriteString("<p style=\"font-size:11px;color:#9ca3af;margin:2px 0 14px\">Ventas / Ingresos = reservas del programa en TODOS los canales (no solo Google); el gasto en ads es una fracción de lo que genera el programa. Semana = inicio (dd-mm), 7 días.</p>")
	}

	if b.Len() == 0 {
		b.WriteString("<p style=\"color:#9ca3af;font-size:13px\">Sin actividad de Google Ads en el período (campañas de bajo volumen / sin clics).</p>")
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
// tableOpenN abre una tabla con SOLO la primera columna a la izquierda y el resto a la
// derecha (para tablas donde de la col 2 en adelante son numéricas, ej. la serie semanal).
func tableOpenN(headers []string) string {
	var b strings.Builder
	b.WriteString("<table style=\"width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px\"><thead><tr>")
	for i, h := range headers {
		align := "right"
		if i == 0 {
			align = "left"
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
