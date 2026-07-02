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

_(vacío — la primera corrida del loop agrega la primera entrada acá)_
