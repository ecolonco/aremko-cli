# Loop de mejora continua — Google Ads

> Bitácora del loop dedicado (sesión propia, `/loop`) que revisa el desempeño de
> Google Ads (Búsqueda) y lo cruza con ventas reales. Cada ciclo LEE este archivo
> antes de proponer algo nuevo y AGREGA su entrada al final. Hermano de
> `docs/LOOP_META_ADS.md` (mismo criterio, mismas ventas reales, otra plataforma).

## Reglas de autonomía (definidas con Jorge, 2026-07-02)

- **Nivel 2: SOLO PROPONE.** El loop nunca pausa campañas, cambia presupuesto,
  ni edita keywords — solo analiza y deja recomendaciones esperando aprobación
  de Jorge.
- **⚠️ NUNCA usar el campo "conversions"/"conversions_value" de Google Ads.**
  Confirmado en vivo (2026-07-02): las 3 campañas activas muestran `conversions: 0`
  pese a que las ventas reales del período son millonarias — la atribución de
  plataforma NO funciona (el lead por WhatsApp no está importado como conversión).
  Usar SIEMPRE el puente de ventas reales: `GET /ventas/api/aremko-cli/bookings/family-combinations-range/`
  (Django, ver H-053/H-053b en `docs/HANDOFFS.md` del repo Django) vía
  `bookings.GetFamilyCombinationsRange` (cliente Go ya existe en este repo) —
  MISMA fuente que usa el loop de Meta.
- Campañas activas a rastrear (verificado en vivo, solo 3 hoy — sin campaña de
  Noche de Aguas Calientes todavía): "Refugio - Search - Lanzamiento Junio 2026",
  "Ritual del Río – Search", "Pausa junto al río - Search".

## Qué hacer en cada ciclo

1. Leer la última entrada de este archivo (qué se propuso, si Jorge respondió algo).
2. Traer desempeño Google Ads de los últimos 14 días. NO HAY TOKEN/CREDENCIALES
   de Google Ads en este entorno local — llamar al backend YA DESPLEGADO:

   ```
   curl "https://aremko-cli-backend.onrender.com/api/v1/google-ads/summary?date_start=<hoy-14d>&date_stop=<ayer>"
   ```

   (calculá las fechas con `date -v-14d +%Y-%m-%d` / `date -v-1d +%Y-%m-%d`).
   Cada campaña trae: `campaign_id`, `campaign_name`, `status`, `cost_clp`,
   `clicks`, `impressions`, `ctr`, `avg_cpc`, `search_impression_share` (útil —
   % de búsquedas relevantes donde SÍ apareció el anuncio; bajo = se pierde
   demanda), y `conversions`/`conversions_value` (**ignorar, ver regla arriba**).

   Opcional, si hace falta más detalle para una recomendación puntual:
   - `curl ".../api/v1/google-ads/quality-scores?campaign_id=<id>"` (Quality Score
     por keyword — útil si el CPC sube o el CTR baja).
   - `curl ".../api/v1/google-ads/search-terms?campaign_id=<id>"` (términos de
     búsqueda reales — para detectar negativas o keywords nuevas).

3. Cruzá esos datos con las VENTAS REALES del mismo período (mismo rango de
   fechas), llamando al endpoint de Django (público, sin token):

   ```
   curl "https://www.aremko.cl/ventas/api/aremko-cli/bookings/family-combinations-range/?date_start=<hoy-14d>&date_stop=<ayer>"
   ```

   Leé del campo "combinations": `tinas_masajes` = Pausa junto al río,
   `cabanas_tinas_masajes_1n` = Ritual del Río, `cabanas_tinas_masajes_2n` = Refugio,
   `cabanas_tinas_1n` = Noche de Aguas Calientes (cada uno trae count_reservas + revenue).

4. Comparar contra la última entrada de la bitácora: ¿qué se propuso antes?,
   ¿cambió algo desde entonces (search impression share, CPC, Quality Score)?
5. Producir 1-3 recomendaciones NUEVAS y concretas (no repetir un reporte
   completo ni recomendaciones ya hechas).
6. Agregar una entrada nueva al final de este archivo con fecha, snapshot corto
   y las recomendaciones. Commitear (solo este .md) con mensaje en español.
7. Nivel 2 — SOLO PROPONER: no ejecutar ningún cambio en Google Ads (no tocar
   presupuestos, keywords, ni pausar/activar nada). Solo proponer y esperar la
   respuesta de Jorge.

---

## Bitácora de ciclos

### 2026-07-02 — Ciclo #1 (primera corrida)

**Período analizado:** 2026-06-18 a 2026-07-01 (14 días).

**Snapshot Google Ads (Búsqueda) — cruzado con ventas reales del período:**

| Campaña | Gasto | Clicks | CPC | CTR | Search IS | Producto → ventas reales |
|---|---|---|---|---|---|---|
| Refugio (cab+tina+masaje 2n) | $128.794 (63%) | 212 | $608 | 19,7% | **72,6%** | **2 reservas / $540.000** |
| Ritual del Río (cab+tina+masaje 1n) | $50.180 (25%) | 167 | **$300** | 16,7% | **30,1%** | **6 reservas / $1.417.000** |
| Pausa (tina+masaje) | $25.154 (12%) | 46 | $547 | **10,1%** | 33,1% | **9 reservas / $1.280.000** |
| **Total Search** | **$204.128** | 425 | $480 | 16,8% | — | — |
| _(sin campaña)_ Noche de Aguas Calientes (cab+tina 1n) | — | — | — | — | — | **7 reservas / $1.130.000** |

_(Ventas totales del negocio en el período: 89 reservas / $8.647.099. Conversiones de plataforma ignoradas: 0 en las 3 campañas, atribución rota.)_

**Diagnóstico central:** el gasto está **invertido** respecto a las ventas. El producto que más gasta (Refugio, 63% del presupuesto) es el que menos vende (2 reservas) y su Search IS ya está en 72,6% → techo casi tocado, poca demanda extra que capturar. Los dos productos que más venden (Ritual 6 res, Pausa 9 res) reciben juntos solo el 37% del gasto y ambos tienen Search IS ~30% → están perdiendo ~70% de las búsquedas relevantes.

**Recomendaciones (SOLO PROPUESTA — esperar OK de Jorge):**

1. **Rebalancear presupuesto: bajar Refugio, subir Ritual del Río.** Refugio ya cubre 3 de cada 4 búsquedas relevantes (IS 72,6%) y su alto CTR (19,7%) no se traduce en reservas del combo de 2 noches (solo 2). Ritual tiene el CPC más bajo del account ($300 vs $608), vende 3× más y su IS es solo 30,1% → hay demanda sin capturar. Propuesta: mover ~$40-50k del período desde Refugio hacia Ritual (subir su presupuesto/puja). Es la apuesta más rentable.

2. **Limpiar Pausa antes de subirle presupuesto.** Sus 30 keywords son TODAS *broad match* → eso explica el CTR bajo (10,1% vs 16-20% de las otras) y el CPC alto ($547). Dos keywords tienen Quality Score 1 (`masaje descontracturante` / `masajes descontracturantes`, BELOW_AVERAGE en los 3 factores) — son búsquedas de masaje puro, no del pack: candidatas a negativizar/pausar. Además `landing_page_experience` sale BELOW_AVERAGE en TODAS (incluso la mejor, `spa puerto varas` QS 7) → revisar landing `/pausa-junto-al-rio/` o afinar keywords a lo que la landing ofrece. Pausa igual vende bien (9 res, mejor ratio gasto/venta ~2%): vale limpiarla y recién ahí subir presupuesto para capturar su IS perdido (33%).

3. **Proponer campaña nueva "Noche de Aguas Calientes" (cab+tina 1 noche).** 7 reservas / $1.130.000 en el período SIN un peso de Google Ads — 2º combo con cabaña más vendido, demanda orgánica comprobada. Crear campaña de Búsqueda dedicada (keywords tipo "cabaña con tina caliente puerto varas", "alojamiento con tinaja los lagos") con presupuesto chico y medir con el puente de ventas reales.

**Nota técnica (no bloquea el ciclo):** el endpoint `GET /api/v1/google-ads/search-terms` devuelve 400 — el GAQL usa `segments.keyword.match_type`, campo no válido para `search_term_view` (UNRECOGNIZED_FIELD). Sin él, el loop no puede leer los términos de búsqueda reales para detectar negativas. Conviene arreglarlo para el próximo ciclo.
