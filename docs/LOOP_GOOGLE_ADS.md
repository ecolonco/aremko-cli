# Loop de mejora continua — Google Ads

> Bitácora del loop dedicado (sesión propia, `/loop`) que revisa el desempeño de
> Google Ads (Búsqueda) y lo cruza con ventas reales. Cada ciclo LEE este archivo
> antes de proponer algo nuevo y AGREGA su entrada al final. Hermano de
> `docs/LOOP_META_ADS.md` (mismo criterio, mismas ventas reales, otra plataforma).

## Reglas de autonomía (definidas con Jorge, 2026-07-02)

- **Nivel 2: SOLO PROPONE.** El loop nunca pausa campañas, cambia presupuesto,
  ni edita keywords — solo analiza y deja recomendaciones esperando aprobación
  de Jorge.
- **El entregable son CORRECCIONES, no un listado (definido con Jorge, 2026-07-14).**
  Cada ciclo TERMINA en cambios ejecutables listos para pegar (negativas/keywords en
  bloque con su tipo de concordancia, ajustes de config como instrucción exacta), cada
  uno con la ruta del panel donde se pega. Jorge lee → pega → listo. Un análisis sin
  correcciones concretas NO es un ciclo terminado. La integración API es de solo
  lectura → el loop nunca puede escribir en Ads; por eso el output se optimiza para que
  Jorge lo ejecute en 2 minutos.
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
5. Producir las CORRECCIONES CONCRETAS del ciclo — no un listado ni un análisis
   abstracto, sino cambios ejecutables que Jorge carga a mano en el panel:
   - Negativas y keywords en bloque **LISTO PARA PEGAR** (con comillas = frase /
     corchetes = exacta), agrupadas por dónde van (lista de cuenta / campaña X).
   - Ajustes de config como instrucción exacta ("subir presupuesto de X a $Y").
   - Cada corrección con: campaña, motivo en 1 línea y el dato que la respalda.
   - La RUTA del panel para ejecutarla.
   Regla de oro: **el ciclo termina en correcciones, no en un listado.**
6. Volcar esas correcciones a la sección "▶ Correcciones del ciclo — listas para
   pegar" (reemplazar las ya ejecutadas por Jorge; conservar las pendientes).
   Agregar además la entrada de bitácora con fecha + snapshot corto. Commitear
   (solo este .md) con mensaje en español.
7. Nivel 2 — SOLO PROPONER: no ejecutar ningún cambio en Google Ads (no tocar
   presupuestos, keywords, ni pausar/activar nada). Solo proponer y esperar la
   respuesta de Jorge.

---

## ▶ Correcciones del ciclo — LISTAS PARA PEGAR (Nivel 2: Jorge las ejecuta)

> Se cargan A MANO en el panel de Google Ads (cuenta `5399750827`, login
> `ecolonco1@gmail.com`). El loop NO las ejecuta (API de solo lectura). Al ejecutar
> una, marcar `[x]` con la fecha y medir el efecto en el ciclo siguiente.
> Origen: Ciclo #3 (2026-07-14). Las 3 correcciones del Ciclo #2 (21 negativas base +
> keywords de Ritual y Pausa) ya fueron ejecutadas por Jorge el 2026-07-14 → registradas
> en la bitácora del Ciclo #2, salen de esta lista.

**① Negativas ROUND 2 — mismas rutas, agregar al final de la lista de cuenta.**
Ruta: llave ⚙️ → *Biblioteca compartida* → *Listas de exclusión de palabras clave* →
abrir **"Negativas base Aremko"** → **+** → pegar el bloque → Guardar (ya está aplicada
a las 3 campañas). Concordancia de FRASE (las comillas ya la fuerzan).

```
"purkaus"
"santocha"
"piscina temperada"
"piscinas temperadas"
```
- Motivos (respaldo en search-terms 2026-06-30 a 2026-07-13):
  - `purkaus` → marca de sauna competidora (Pucón); en Refugio "purkaus cl" 2 clics, el
    clic más caro del período. No es Aremko.
  - `santocha` → marca de surf/yoga (Pucón); "santocha puerto varas" 1 clic, clic caro,
    intención ajena.
  - `piscina temperada` / `piscinas temperadas` → PRODUCTO EQUIVOCADO. Aremko tiene
    tinajas de agua caliente, no piscina temperada para nadar. En Pausa se van ~$2.900 en
    variantes ("piscina temperada puerto varas", "…en puerto varas", "piscinas temperadas
    en puerto montt/puerto varas"). Se necesitan las dos formas (singular y plural) porque
    la frase no cubre el plural.
- [ ] Negativas round 2 cargadas (fecha: ____)

**② ÍTEM ④ del Ciclo #2 RESUELTO con datos — NO negativizar `termas` ni `puerto montt`.**
No es un pegado: es una DECISIÓN para no bloquear demanda buena.
- `termas` genérico = intención núcleo "aguas calientes": "termas puerto varas" 9 clics,
  "termas en puerto varas" 10, "termas cerca de puerto montt" 13, todos con CTR sano. El
  competidor "termas del sol" ya está negativizado como frase → el ruido puntual ya está
  cubierto sin matar la categoría.
- `puerto montt` = geo cercana de alta intención (audiencia Meta ya incluye Pto Montt):
  "cabaña con tinaja puerto montt" 6 clics, "tinajas puerto montt" 7, "cabañas con tinajas
  puerto montt" 3. Convierte. NO negativizar.
- [x] Resuelto (2026-07-14 · decisión del Ciclo #3, respaldada en search-terms)

**③ Corrección abierta — "Noche de Aguas Calientes": resolver COLISIÓN antes de lanzar.**
La campaña sigue justificada (cab+tina 1n vende 6 res / $952k SIN Ads), PERO las keywords
"cabaña con tinaja / con jacuzzi puerto varas" que se cargaron en Ritual el 2026-07-14
sirven la MISMA intención (una búsqueda de "cabaña con tinaja" no dice si quiere masaje).
Lanzar una 2ª campaña con esas mismas keywords haría que Ritual y Noche compitan entre sí
y se suban el CPC — justo el anti-patrón que este loop viene evitando. Antes de crear la
campaña, decidir UNA de estas dos rutas (SOLO PROPUESTA, esperar OK de Jorge):
  - **Ruta A (recomendada, cero riesgo):** NO crear campaña nueva. La intención genérica
    "cabaña con tinaja" se queda capturada por Ritual (mayor ticket, incluye masaje) y
    Noche sigue vendiendo por orgánico. Medir 1-2 ciclos si la venta orgánica de Noche se
    mantiene; sólo si CAE, reconsiderar.
  - **Ruta B (si se quiere pauta propia):** crear "Noche de Aguas Calientes" con keywords
    DISTINTAS y más de fondo de embudo, SIN pisar a Ritual (p. ej. "alojamiento con tinaja
    los lagos", "cabaña aguas calientes puerto varas", "hot tub puerto varas"), presupuesto
    chico ($2-3k/día), y agregar las keywords de Ritual como NEGATIVAS de Noche (y viceversa)
    para que no se canibalicen.
- [ ] Ruta elegida (A / B) — fecha: ____

**④ NO tocar / NO aplicar (sin cambios vs Ciclo #2):** presupuestos (ninguna campaña topa
su budget de $13.000/día en total; Ritual usa solo ~75% del suyo → el IS bajo es por
rango/keywords, no por plata); y NO aplicar la recomendación de Google *"Agrega palabras
clave de concordancia amplia"* (agranda la dispersión que estamos corrigiendo).

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

---

### 2026-07-14 — Ciclo #2

**Período analizado:** 2026-06-28 a 2026-07-11 (14 días).

**⚠️ BLOQUEO — Google Ads API caída (token OAuth expirado/revocado).** Los dos
endpoints del backend (`/summary` y `/quality-scores`) devolvieron el mismo error:
`googleads: token refresh failed: oauth2: "invalid_grant" "Token has been expired
or revoked."`. El ciclo #1 (2026-07-02) SÍ leyó datos, así que el refresh token se
rompió en los últimos ~10 días. **Este ciclo quedó CIEGO en Google Ads**: sin gasto,
CPC, CTR, search impression share ni Quality Score. No hay datos de plataforma que
cruzar. La única mitad disponible fue el puente de ventas reales (Django, OK).

**Ventas reales del período (fuente de verdad, plataforma ignorada):**

| Producto (combo) | Campaña | Reservas | Revenue | vs Ciclo #1 |
|---|---|---|---|---|
| tinas_masajes | **Pausa junto al río** | 15 | $1.810.000 | ↑ (era 9 / $1,28M) |
| cabanas_tinas_masajes_1n | **Ritual del Río** | 10 | $2.255.000 | ↑ (era 6 / $1,42M) |
| cabanas_tinas_masajes_2n | **Refugio** | 5 | $1.425.000 | ↑ (era 2 / $540k) |
| cabanas_tinas_1n | _(sin campaña)_ Noche de Aguas Calientes | 6 | $992.100 | ≈ (era 7 / $1,13M) |
| **Total negocio** | — | **89** | **$9.941.099** | ↑ revenue (+$1,29M) |

**Diagnóstico:** las ventas siguen fuertes y CRECIERON en revenue en los 4 combos
clave; los 3 productos publicitados subieron reservas y facturación (Ritual es ahora
el combo de MAYOR revenue del negocio). Pero **no puedo confirmar si el rebalanceo
propuesto en el ciclo #1 se aplicó** ni medir su efecto en gasto/IS, porque la API
está caída. El crecimiento observado NO puede atribuirse a Google Ads sin datos de
plataforma.

**Recomendaciones (SOLO PROPUESTA — esperar OK de Jorge):**

1. **CRÍTICO / PREREQUISITO — Reautorizar el token OAuth de Google Ads en el backend.**
   El refresh token está expirado o revocado. Acción concreta: regenerar el refresh
   token de la Google Ads API (re-correr el flujo OAuth con la cuenta que administra
   la MCC/cuenta de Aremko) y actualizar la env var correspondiente en Render
   (backend `aremko-cli-backend`). Hasta que esto se resuelva, el loop de Google Ads
   NO puede analizar nada — es el bloqueo #1 y todo lo demás depende de él.

2. **Las 2 propuestas del ciclo #1 siguen ABIERTAS y sin respuesta de Jorge; la
   evidencia de ventas las refuerza.** (a) Rebalancear presupuesto hacia Ritual/Pausa
   y bajar Refugio — Ritual es hoy el #1 en revenue ($2,26M), lo que confirma la
   apuesta; una vez restaurado el token, primer paso = verificar en qué quedó el
   reparto de gasto actual. (b) Crear campaña dedicada "Noche de Aguas Calientes"
   (cab+tina 1n): 6 reservas / $992k este período SIN un peso de Ads, demanda
   orgánica sostenida. Ambas quedan pendientes de decisión.

3. **Priorizar el arreglo del endpoint `/search-terms` (bug 400 del ciclo #1) en el
   MISMO deploy que reautoriza el token.** Así el próximo ciclo recupera de una vez
   los términos de búsqueda reales (para detectar negativas y keywords nuevas) además
   del acceso base — evita un segundo viaje de mantención al backend.

**ACTUALIZACIÓN (mismo día, con Jorge) — TOKEN RECONECTADO, ciclo completado.**
El bloqueo se resolvió en la misma sesión. Causa real (no era falta de reautorizar
desde cero): la app OAuth ya había quedado "En producción" el 2026-07-13 (token
durable), pero el `GOOGLE_ADS_REFRESH_TOKEN` del servicio Go `aremko-cli-backend`
había quedado con un token **intermedio/muerto** (durante el debugging del 07-13 se
generaron varios y Google revocó los viejos; el bueno quedó solo en el servicio
Django `aremko-booking-system-prod`). Fix: copiar el refresh token vivo de Django →
Go y redeploy. El código Go ya estaba en `v21` (`backend/internal/googleads/client.go:29`),
así que no hubo problema de versión. Endpoint `/summary` responde OK (`success:true`).

**Snapshot Google Ads REAL (2026-06-30 a 2026-07-13, 14 días) × ventas reales:**

| Campaña | Gasto | % gasto | Clicks | CPC | CTR | Search IS | Ventas reales |
|---|---|---|---|---|---|---|---|
| Refugio (cab+tina+masaje 2n) | $37.857 | 26% | 114 | $332 | **23,8%** | 49,0% | 4 res / $1.155.000 |
| Ritual del Río (cab+tina+masaje 1n) | $52.351 | 35% | 293 | **$179** | 11,7% | **21,7%** | **11 res / $2.460.000** |
| Pausa (tina+masaje) | $57.543 | 39% | 193 | $298 | 13,7% | 32,5% | **17 res / $2.030.000** |
| **Total Search** | **$147.751** | — | 600 | $246 | 13,7% | — | — |
| _(sin campaña)_ Noche Aguas Calientes | — | — | — | — | — | — | 6 res / $952.100 |

_(Total negocio período: 83 res / $9.406.100. Conversiones de plataforma ignoradas: 0, atribución rota.)_

**Diagnóstico (vs Ciclo #1):** **el rebalanceo propuesto en el Ciclo #1 SÍ se aplicó.**
Refugio pasó de 63% → 26% del gasto (de $128.794 a $37.857) y Pausa de 12% → 39%
(de $25.154 a $57.543). El gasto ya NO está concentrado en el combo que menos vende.
Pero **Ritual quedó plano** (~$50k en ambos ciclos) y sigue siendo el mejor negocio
del account sin capitalizar: CPC más barato ($179 vs $298-332), #1 en revenue
($2,46M) y **Search IS de apenas 21,7%** → deja pasar ~78% de las búsquedas en un
mercado GRANDE (2.504 impresiones, 5× las de Refugio).

**Recomendaciones NUEVAS (SOLO PROPUESTA — esperar OK de Jorge):**

1. **Subir Ritual del Río (mover presupuesto desde Pausa).** Es donde cada peso extra
   rinde más: CPC más bajo del account, mayor revenue, y 78% de demanda de búsqueda
   sin capturar en un mercado grande. Pausa ya está en 39% del gasto con IS más alto
   (32,5%) y CPC más caro → tiene menos upside marginal. Propuesta: correr ~$15-20k
   del período desde Pausa hacia Ritual y volver a medir su Search IS (meta: llevarlo
   de 21,7% hacia ~40%).
2. **Refugio: dejarlo como está, NO subir.** Su Search IS bajó a 49% pero con solo
   478 impresiones el mercado de búsqueda es chico; su CTR 23,8% es excelente pero el
   techo de volumen es bajo (vende 4 res). Gasta poco ($37,8k) y está bien así.
3. **Ritual tiene el CTR más bajo (11,7%) pese al mejor CPC** — vale una pasada de
   copy/keywords a sus anuncios (probar variantes de titular) EN PARALELO a subirle
   presupuesto; capturar más IS con mejor CTR baja aún más el CPC. (Sigue pendiente
   arreglar el endpoint `/search-terms` (400) para leer términos reales y afinar esto.)

_(Sigue abierta del Ciclo #1: campaña dedicada "Noche de Aguas Calientes" — 6 res /
$952k sin un peso de Ads.)_

**CORRECCIÓN (con Jorge, viendo el panel de Google Ads).** Jorge mostró los
presupuestos diarios reales, que la API no exponía y que **cambian el diagnóstico**:

| Campaña | Presupuesto | Gasto real/día (÷14) | Uso del budget |
|---|---|---|---|
| Refugio | $3.000/día | ~$2.704 | 90% |
| Ritual del Río | **$5.000/día** | ~$3.739 | **75%** |
| Pausa junto al río | **$5.000/día** | ~$4.110 | 82% |
| **Total cuenta** | **$13.000/día** | | |

Estado de las 3 campañas en el panel: **"Apto (limitado): No hay suficientes palabras
clave relevantes"** — NO "Limitado por presupuesto".

➡️ **Queda DESCARTADA la recomendación #1 de arriba ("subir Ritual moviendo
presupuesto desde Pausa").** Ritual y Pausa ya tienen el MISMO presupuesto ($5.000/día)
y **ninguna campaña topa su budget** (Ritual usa solo 75% del suyo). El Search IS bajo
de Ritual (21,7%) NO es por presupuesto sino **por rango/keywords** (Google mismo dice
"no hay suficientes palabras clave relevantes"). Echarle plata a un budget que no se
gasta no captura más demanda.

**Recomendación corregida (SOLO PROPUESTA):**
1. **No subir presupuestos** — ninguno se topa; los $13.000/día quedan como están.
2. **La palanca real es ampliar/afinar KEYWORDS** (relevancia y rango), empezando por
   Ritual (mercado grande de 2.504 impresiones, IS perdido por rango). Eso sí destraba
   el ~78% de búsquedas que hoy se pierde.
3. **Prioridad técnica: arreglar el endpoint `/search-terms` (error 400).** Es el que
   habilita ver los términos de búsqueda reales para decidir qué keywords agregar y
   cuáles negativizar — sin eso, la acción correcta (keywords) queda a ciegas.

**Lección para el loop:** el Search IS de la API no distingue IS-perdido-por-presupuesto
vs IS-perdido-por-rango. Antes de recomendar mover presupuesto, confirmar en el panel
(o con métricas de lost IS budget/rank) si la campaña realmente topa su budget. Acá no
lo topaba → la plata no era la palanca.

**ANÁLISIS DE KEYWORDS (endpoint `/search-terms` YA arreglado).** La nota técnica del
Ciclo #1 (400 por `segments.keyword.match_type`) está OBSOLETA: la query ya usa
`segments.search_term_match_type` (`backend/internal/googleads/queries.go:189`) y el
endpoint responde 200. Se leyeron los 50 términos top de cada campaña (2026-06-30 a
2026-07-13). **Hallazgo central:** el IS bajo de Ritual es por **dispersión de broad
match**, no por presupuesto — la campaña gasta en tráfico tangencial (termas, domos,
spa Puerto Montt, competidores) en vez de dominar su intención núcleo. Y hay demanda
núcleo REAL sin keyword propia: 30+ clics dispersos en variantes de "cabaña con
tinaja/jacuzzi puerto varas".

**Negativas propuestas (alta confianza) — plata que se quema en tráfico que no compra:**
- **Competidores por nombre:** `termas del sol` (Pausa: 6 clics/$2.505, CTR 12%),
  `tungulu` (Refugio: 3/$1.593), `espacio sur` (Refugio: 1/$1.564), `dreams`, `enjoy`,
  `cancagua`, `cabañas del lago`, `zen spa osorno`, `antea`, `hydra`, `rucamalen`.
- **Intención ≠ producto:** `masajes descontracturantes` (QS 1 desde Ciclo #1),
  `masaje tantrico`, `domos` (Ritual: 4 clics — producto que no es), `que hacer en
  puerto varas` (turística, baja intención), `masajista`/`mujer masajista`/`masajes
  para hombres`.
- **Geo lejana:** `concepcion`, `talca`, `olmue`, `cajón del maipo` (0 clics hoy, por
  higiene).
- **A revisar con criterio (NO automático):** `termas` genérico y `puerto montt`
  pueden convertir (gente de Pto Montt busca "cabaña con tinaja puerto montt", a 20 min)
  — no negativizar a ciegas.

**Keywords nuevas propuestas (demanda real, buen CTR, alta intención):**
- Ritual/Refugio (cabaña+tina): **`cabañas con tinaja puerto varas`**, **`cabañas con
  jacuzzi puerto varas`**, **`cabaña con tinaja`** (frase/exacta) — consolidar los 30+
  clics dispersos sube relevancia (Quality Score) y baja CPC.
- Pausa (tina+masaje día): **`día de spa puerto varas`**, **`tinajas por horas`**.

Así se destraba el "no hay suficientes palabras clave relevantes": agregar las keywords
núcleo + negativizar el ruido concentra el presupuesto (que sobra) en la demanda
correcta. Es la palanca, no la plata. (Nivel 2: SOLO PROPUESTA — Jorge las carga en el
panel.)

**CIERRE Ciclo #2 (2026-07-14) — CORRECCIONES EJECUTADAS.** Jorge cargó a mano en el
panel, en vivo: (1) lista "Negativas base Aremko" (21 negativas de frase) aplicada a
las 3 campañas; (2) keywords de frase en Ritual (`cabañas con tinaja/jacuzzi puerto
varas`, `cabaña con tinaja`); (3) keywords de frase en Pausa (`día de spa puerto varas`,
`tinajas por horas`). Primer ciclo que termina en correcciones ejecutadas de punta a
punta (no en un listado). Quedan a criterio de Jorge las negativas `termas`/`puerto
montt`, y abierta la campaña "Noche de Aguas Calientes". **A MEDIR en el Ciclo #3
(comparar contra el snapshot de arriba):** (a) si las negativas bajaron el gasto en
tráfico irrelevante (competidores / masaje suelto); (b) si las keywords nuevas subieron
el Search IS de Ritual (base **21,7%**) y su CTR (base **11,7%**); (c) el efecto en las
ventas reales de cada combo. Ojo con el lag de datos de Google Ads (no es tiempo real) y
el aprendizaje de las nuevas keywords: dar ~7-14 días antes de sacar conclusiones.

---

### 2026-07-14 — Ciclo #3

**Período analizado:** 2026-06-30 a 2026-07-13 (14 días).

**⚠️ Ventana SIN avanzar respecto al Ciclo #2 → medición prematura.** Las correcciones
del Ciclo #2 (21 negativas + keywords de Ritual/Pausa) se ejecutaron el 2026-07-14 (HOY),
que cae FUERA de esta ventana (termina 07-13) — y además Google Ads tiene lag de datos.
Por eso el snapshot de plataforma es **idéntico** al del Ciclo #2 (Refugio IS 49,0% / CTR
23,8%; Ritual IS 21,7% / CTR 11,7% / CPC $179; Pausa IS 32,5% / CTR 13,7%; gasto total
$147.751 en 600 clics). Igual las ventas reales (mismo rango). **NO se puede aún medir si
las correcciones funcionaron** — eso queda para el Ciclo #4/#5 con una ventana fresca (a
partir del ~2026-07-21 empieza a verse el efecto). Ser honesto: cualquier "mejora" que se
leyera hoy sería del período pre-corrección.

**Ventas reales del período (fuente de verdad, idénticas al Ciclo #2 por mismo rango):**
Pausa 17 res / $2.030.000 · Ritual 11 res / $2.460.000 · Refugio 4 res / $1.155.000 ·
Noche de Aguas Calientes (sin campaña) 6 res / $952.100. Total negocio 83 res / $9.406.100.

**Qué SÍ se pudo avanzar este ciclo (con search-terms reales, endpoint OK):** en vez de
repetir un snapshot que no cambió, se resolvieron los dos frentes que quedaban ABIERTOS y
se detectó ruido nuevo:

1. **Ítem ④ RESUELTO — no negativizar `termas` ni `puerto montt`.** Los términos reales lo
   respaldan: `termas` genérico es la intención núcleo "aguas calientes" ("termas puerto
   varas" 9 clics, "termas en puerto varas" 10, "termas cerca de puerto montt" 13, CTR
   sano); `puerto montt` es geo cercana de alta intención ("cabaña con tinaja puerto montt"
   6 clics, "tinajas puerto montt" 7). Bloquearlos mataría demanda buena. El competidor
   "termas del sol" ya está cubierto como frase negativa → no hace falta más.

2. **Negativas ROUND 2 (nuevas, no estaban en las 21) — listas para pegar.** `purkaus`
   (marca sauna Pucón, clic más caro de Refugio), `santocha` (marca surf/yoga Pucón),
   `piscina temperada` + `piscinas temperadas` (PRODUCTO EQUIVOCADO: Aremko tiene tinajas,
   no piscina para nadar; ~$2.900 en Pausa entre variantes). Van a la misma lista de
   cuenta "Negativas base Aremko". Ver sección "▶ Correcciones del ciclo".

3. **Alerta estratégica — "Noche de Aguas Calientes" colisiona con Ritual.** Las keywords
   "cabaña con tinaja / jacuzzi puerto varas" que se cargaron en Ritual el 07-14 sirven la
   misma intención que tendría la campaña abierta de Noche (cab+tina 1n, sin masaje). Crear
   una 2ª campaña con esas keywords haría que compitan entre sí y suban el CPC. Se dejan
   dos rutas para decidir (A: no crear campaña, capturar vía Ritual + medir orgánico de
   Noche; B: crear con keywords distintas + negativas cruzadas). Ver sección de correcciones.

**Nota de diagnóstico (no bloquea, útil para próximos ciclos):** buena parte del gasto de
"Search" es tráfico de MARCA, no demanda nueva — Refugio gasta ~$13k (≈35% de su
presupuesto) sólo en "aremko spa" (79 clics); Ritual y Pausa también tienen "aremko"/
"aremko spa" en su top. Esa gente ya conoce Aremko y llegaría por orgánico. No es urgente,
pero explica por qué el Search IS "total" se ve alto en Refugio: su volumen es chico y
marquero. El IS que importa para CRECER es el de términos NO-marca (tinajas/cabaña con
tinaja/termas), donde Ritual sigue en ~22%. Candidato futuro: separar marca en su propia
campaña (CPC bajísimo) para leer el IS de no-marca limpio. (SOLO nota — no se propone
ejecutar aún.)

**Recomendaciones NUEVAS (SOLO PROPUESTA — Nivel 2, esperar OK de Jorge):**
1. Cargar las **negativas round 2** (`purkaus`, `santocha`, `piscina temperada`,
   `piscinas temperadas`) en la lista de cuenta ya existente.
2. **No negativizar** `termas` ni `puerto montt` (ítem ④ cerrado con datos).
3. Decidir la **ruta A/B de "Noche de Aguas Calientes"** ANTES de crear cualquier campaña,
   para no canibalizar a Ritual.
4. **No tocar presupuestos** (sin cambio: ninguno topa su budget).

**A MEDIR recién en el Ciclo #4/#5 (ventana ≥ 2026-07-21, ya post-corrección):** (a) si las
21 negativas del Ciclo #2 bajaron el gasto en competidores/masaje suelto; (b) si las
keywords nuevas subieron el Search IS de Ritual (base **21,7%**) y su CTR (base **11,7%**);
(c) efecto en ventas reales por combo. Dar ~7-14 días de aprendizaje antes de concluir.
