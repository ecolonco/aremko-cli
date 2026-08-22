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
> Origen: Ciclo #5 (2026-08-14). Las correcciones ① (negativas round 3) y ② (rebalanceo
> Refugio→Ritual) del Ciclo #4 fueron ejecutadas el 2026-08-08 → quedan registradas en la
> bitácora de ese ciclo y salen de esta lista.

**① 🔴 BLOQUEANTE — Desbloquear la API de Google Ads: `v21` está deprecada y Google la
está RECHAZANDO.** Esto NO se pega en el panel: es un cambio de 1 línea en el repo
`aremko-cli`. Sin esto, el loop queda ciego a nivel plataforma (gasto, CPC, CTR, Search IS,
Quality Score, search-terms) — los 3 endpoints devuelven el mismo error hoy:
`UNSUPPORTED_VERSION: "Version v21 is deprecated. Requests to this version will be blocked."`

Archivo: `backend/internal/googleads/client.go:29`

```
apiBaseURL = "https://googleads.googleapis.com/v25"
```

(hoy dice `.../v21`). Versiones vivas en agosto 2026: **v25 (la más nueva), v24, v23**.
Se propone **v25** para tener el máximo de meses antes del próximo bloqueo; si algo fallara,
el fallback es `v24`. **Riesgo BAJO:** es solo la URL base — ningún campo GAQL de
`queries.go` cambia entre estas versiones (se verificó: `metrics.cost_micros`,
`metrics.search_impression_share`, `segments.search_term_match_type`, etc. siguen todos
vigentes). Al pushear a `main` el backend auto-despliega. Comando para verificar que quedó
arriba (debe responder `"success": true`):

```bash
curl -s "https://aremko-cli-backend.onrender.com/api/v1/google-ads/summary?date_start=$(date -v-14d +%Y-%m-%d)&date_stop=$(date -v-1d +%Y-%m-%d)" | head -c 300
```

- **Mientras tanto, chequeo manual de 10 segundos en el panel:** confirmar que NO haya
  banner rojo de saldo vencido y que las campañas digan "Apto"/publicando. Con la API caída
  el loop NO puede detectar una repetición del corte por pago del Ciclo #3.
- [ ] Pendiente

**② PAUSAR "Refugio - Search - Lanzamiento Junio 2026" — la condición que dejó escrita el
Ciclo #4 se cumplió.**
Ruta: *Campañas* → marcar el check de **Refugio** → menú **Editar** → **Pausar**.
- Motivo: **0 reservas del combo cabaña+tina+masaje 2 noches por SEGUNDO ciclo consecutivo**
  — 28 días corridos sin vender lo que publicita (Ciclo #4: 0 res; Ciclo #5: 0 res; venía de
  4 y 5 res en los ciclos #2/#3). El Ciclo #4 lo dejó por escrito: *"si sigue en 0, evaluar
  pausarla hasta octubre"*. Además el panel ya la marcaba *"Limitada por el volumen de
  búsquedas"* (mercado chico) y ~35% de su gasto era tráfico de MARCA que llega igual por
  orgánico. Reactivar en pre-temporada (octubre+), cuando el combo de 2 noches vuelve a tener
  demanda estacional.
- ⚠️ **Riesgo a medir, no ignorar:** Refugio traía 147 clics con CTR 31,4% — es posible que
  parte de esa gente reservara OTRO combo (Ritual 1 noche o Noche de Aguas Calientes) sin que
  el loop pueda verlo (atribución rota). **Qué vigilar en el Ciclo #6:** si Ritual (hoy 12 res)
  o Noche (hoy 11 res) CAEN tras pausar Refugio, esa campaña estaba alimentando ventas ajenas
  → reactivarla. Si se sostienen, la pausa fue correcta y libera $1.500/día.
- [ ] Pendiente

**③ Reasignar los $1.500/día que libera Refugio — CONDICIONADO a la columna Estado.**
Ruta: *Campañas* → columna **Estado** (mirar qué dice bajo cada campaña) → luego celda de
*Presupuesto* → editar → Guardar.
Aplicar la regla de método del Ciclo #4 (2 veces salvó de mover plata al lugar equivocado):
- **Si Ritual del Río sigue diciendo "Limitado por el presupuesto"** → subirla de $6.500 a
  **$8.000**/día. Total cuenta se mantiene NEUTRO en $13.000/día. Motivo: es el motor de
  crecimiento del negocio — **12 res / $2.909.000 este período, su récord histórico** (venía
  de 8 res / $1,84M) y hoy es el combo #1 en revenue de todo Aremko.
- **Si dice "Limitada por el volumen de búsquedas"** (o cualquier otra cosa) → **NO mover la
  plata**: dejar la cuenta en $11.500/día y quedarse el ahorro. Un budget que no se gasta no
  compra demanda.
- No se puede decidir esto desde acá: la API está caída (ítem ①) y, aunque funcionara, **no
  expone la distinción budget-vs-rango** (lección del Ciclo #4).
- [ ] Pendiente — requiere la captura de la columna Estado

**④ NO tocar:** Pausa junto al río ($5.000/día, sin cambio); las 27 negativas de la lista de
cuenta; y la **Ruta A de Noche de Aguas Calientes** — revalidada por tercera vez: subió a
**11 res / $1.592.000** (récord, venía de 9 / $1,10M) sin un peso de Ads. No se crea campaña.

**⑤ Campaña de MARCA separada (ítem ③ del Ciclo #4) — DEGRADADA, no ejecutar ahora.**
Sigue abierta pero pierde urgencia: pausar Refugio (ítem ②) elimina por sí solo **~$14k de
los ~$27k de gasto de marca** del período, que era más de la mitad del problema, y sin crear
una 4ª campaña que administrar. Reevaluar en el Ciclo #6 **con datos de plataforma reales**
(depende del ítem ①): si el gasto de marca remanente en Ritual/Pausa sigue pesando, ahí sí
crear "Marca - Search".

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

**CIERRE Ciclo #3 (2026-07-14) — negativas round 2 EJECUTADAS + hallazgo crítico de pago.**
Jorge cargó a mano en el panel (Biblioteca compartida → lista "Negativas base Aremko") las
4 negativas round 2 (`purkaus`, `santocha`, `piscina temperada`, `piscinas temperadas`),
en concordancia de frase; la lista pasó de **21 → 25** y quedó aplicada a las 3 campañas.
(Al primer intento el Guardar no tomó porque se tocó el paginador antes de guardar —
lección UI: guardar y esperar el refresco antes de navegar.) **Ítem ③ RESUELTO (mismo día):
Jorge eligió la Ruta A** — NO se crea campaña "Noche de Aguas Calientes"; esa intención se
captura vía Ritual + orgánico, y se monitorea que la venta orgánica de Noche (6 res / $952k)
no caiga. Con esto el Ciclo #3 cierra con TODAS sus correcciones resueltas (ejecutadas o
decididas): negativas round 2 cargadas, ítem ④ resuelto (no negativizar termas/puerto montt),
ítem ③ decidido (Ruta A). No quedan pendientes abiertos del Ciclo #3.

**⚠️ HALLAZGO CRÍTICO (visto en el panel, 2026-07-14): las campañas NO se están publicando
por PAGO VENCIDO.** Banner rojo en la cuenta: *"No se están publicando sus anuncios. —
Realiza un pago para tu saldo de cuenta vencido."* Las 3 campañas de Búsqueda están
detenidas por saldo impago (facturación es responsabilidad de Jorge; el loop no toca medios
de pago). **Implicancia para el loop:** el gasto / CTR / Search IS de los próximos días
quedará distorsionado (campañas caídas parte del tiempo) → NO sacar conclusiones sobre el
efecto de las negativas/keywords hasta que (a) se regularice el pago y (b) pasen ~7-14 días
de campañas efectivamente al aire. Al inicio del Ciclo #4, primero verificar si el banner de
pago desapareció; si sigue, el ciclo queda otra vez ciego a nivel plataforma.

**✅ RESUELTO (2026-07-14, mismo día): Jorge regularizó el pago vencido** → las 3 campañas
vuelven a publicarse. Igual aplica el lag de datos + aprendizaje de las keywords nuevas: el
efecto real (negativas round 1+2, keywords de Ritual/Pausa) recién se podrá medir limpio a
partir de ~7-14 días de campañas al aire SIN interrupción de pago. Ojo en el Ciclo #4:
descontar del análisis los días en que estuvieron caídas por saldo impago (gasto/IS
subestimados en esa ventana).

---

### 2026-08-08 — Ciclo #4 (primera medición POST-corrección)

**Período analizado:** 2026-07-25 a 2026-08-07 (14 días) — ventana 100% posterior a las
correcciones del 07-14 (25 negativas + keywords de Ritual/Pausa) y al corte por pago. Es
el primer ciclo que puede MEDIR el efecto de lo ejecutado.

**Snapshot Google Ads × ventas reales:**

| Campaña | Gasto | % gasto | Clicks | CPC | CTR | Search IS | Ventas reales |
|---|---|---|---|---|---|---|---|
| Refugio (cab+tina+masaje 2n) | $40.525 | 23% | 147 | $276 | 31,4% | 64,2% | **0 res / $0** |
| Ritual del Río (cab+tina+masaje 1n) | $67.435 | 38% | 426 | $158 | 11,2% | 22,3% | 8 res / $1.840.000 |
| Pausa (tina+masaje) | $68.467 | 39% | 451 | **$152** | 14,8% | 31,9% | **20 res / $2.570.000** |
| **Total Search** | **$176.427** | — | 1.024 | $172 | 14,0% | — | — |
| _(sin campaña)_ Noche Aguas Calientes | — | — | — | — | — | — | **9 res / $1.100.000** |

_(Total negocio período: 87 res / $8.292.000. Conversiones de plataforma ignoradas: 1
fantasma en Refugio, atribución sigue rota.)_

**MEDICIÓN de las correcciones del Ciclo #2/#3 (vs snapshot 06-30 a 07-13):**

- **(a) Negativas (25 de frase) → ✅ FUNCIONARON.** CPC promedio de cuenta **$246 → $172
  (-30%)**; Pausa se desplomó **$298 → $152 (-49%)**; Refugio $332 → $276. La cuenta compró
  **+71% de clics (600 → 1.024) por solo +19% de gasto** ($147,7k → $176,4k). El gasto
  basura en competidores/producto equivocado dejó de diluir la puja.
- **(b) Keywords nuevas de Ritual → ⚠️ IS AÚN PLANO.** Search IS 21,7% → 22,3% y CTR
  11,7% → 11,2%: el share no se movió. PERO el mercado creció (impresiones 2.504 → 3.807,
  +52%) y Ritual capturó +45% de clics con el CPC más bajo de su historia ($179 → $158) →
  en volumen absoluto sí creció; el share relativo sigue siendo la tarea. Dar 1 ciclo más
  de aprendizaje antes de tocar keywords de nuevo.
- **(c) Ventas reales:** Pausa 17 → 20 res (↑, sigue #1 en reservas), Ritual 11 → 8 res
  ($2,46M → $1,84M, ↓ moderada), **Refugio 4 → 0 res** (el combo 2 noches NO vendió nada),
  Noche 6 → 9 res / $952k → $1.100k (↑ — **la Ruta A queda VALIDADA**: el orgánico de
  Noche no solo se mantuvo, creció).

**Hallazgos nuevos (search-terms del período):**

1. **Refugio es hoy una campaña de MARCA disfrazada:** ~35% de su gasto (~$14k) va a
   "aremko spa"/"aremko"/variantes (70 de sus 147 clics). Su CTR 31,4% e IS 64,2% son
   espejismo marquero — y el combo que publicita vendió 0. En toda la cuenta, la marca se
   come **~15% del gasto (~$27k)**: Pausa ~$8,7k ("aremko" 72 clics + typo "aremco" 5),
   Ritual ~$4,2k.
2. **Competidor nuevo caro:** "alma lemu tinas calientes" (Refugio) 2 clics / $3.443,
   CPC $1.721 — el clic más caro de la cuenta. Negativizar `alma lemu`.
3. **Geo Chiloé:** "cabañas con tinajas en dalcahue" 3 clics / $547 en Ritual —
   negativizar `dalcahue`.
4. Los QS de las keywords "románticas" originales de Ritual siguen en 0 (sin datos/volumen):
   la demanda real de la campaña es "tinajas / termas / cabaña con tinaja", no "escapada
   romántica". Confirma que las keywords del 07-14 apuntaron bien.

5. **⭐ HALLAZGO MAYOR (visto en el panel con Jorge, 2026-08-08) — el freno de Ritual CAMBIÓ
   de lugar: ahora SÍ es presupuesto.** El estado de las campañas en el panel hoy es:
   - **Ritual del Río ($5.000/día): "Limitado por el presupuesto"** ← era *"No hay suficientes
     palabras clave relevantes"* en el Ciclo #2/#3.
   - Pausa ($5.000/día) y Refugio ($3.000/día): *"Limitada por el volumen de búsquedas"*.

   **Esto es la prueba de que las keywords del 07-14 funcionaron.** El diagnóstico del
   Ciclo #2 ("el IS bajo de Ritual es por rango/keywords, no por plata") era correcto EN SU
   MOMENTO y quedó RESUELTO: al agregar las keywords núcleo, Ritual dejó de estar limitada
   por relevancia y pasó a estar limitada por presupuesto. Es el mismo síntoma (IS 22%) con
   causa distinta — por eso el ciclo anterior acertó al NO subirle plata, y este acierta al
   SÍ subírsela. La API **no expone esta distinción** (`budget_total_clp` viene en 0 y el
   `search_impression_share` no separa lost-IS-budget de lost-IS-rank) → **el panel sigue
   siendo obligatorio para leer el estado real antes de tocar presupuestos.**

6. **Refugio arrastra un problema de configuración de conversiones** (panel: *"Las conversiones
   avanzadas presentan problemas de configuración que afectan el rendimiento"*). Encaja con la
   atribución rota que el loop viene ignorando por regla, y explica el `conversions: 1`
   fantasma de la API. No bloquea nada — pero es la raíz de por qué no se puede confiar en las
   conversiones de plataforma. Candidato a arreglar cuando se retome el tema de tracking.

**CIERRE Ciclo #4 (2026-08-08) — 2 de 3 correcciones EJECUTADAS en vivo con Jorge.**
① Negativas round 3 cargadas (`alma lemu`, `dalcahue`) → la lista "negativas base aremko"
pasó de 25 → **27** palabras clave. ② Rebalanceo ejecutado: Refugio $3.000 → **$1.500** y
Ritual $5.000 → **$6.500**, Pausa sin cambio → **total de cuenta NEUTRO en $13.000/día**.
③ (campaña de MARCA separada) queda ABIERTA, pendiente de decisión de Jorge.

**Lección de método (2ª vez que pasa, ahora al revés):** el estado del panel *"Limitado por
el presupuesto"* vs *"Limitada por el volumen de búsquedas"* es el dato que decide si mover
plata sirve o no — y la API no lo expone. En el Ciclo #2 ese chequeo DESCARTÓ subir
presupuesto; en el #4 lo JUSTIFICÓ. **Regla para próximos ciclos: antes de recomendar
cualquier cambio de presupuesto, pedir a Jorge la captura de la columna Estado del panel.**

**A MEDIR en el Ciclo #5 (ventana ≥ 2026-08-22):** (a) si Ritual con $6.500/día sube su
Search IS desde 22,3% y si deja de aparecer "Limitado por el presupuesto"; (b) si las ventas
de Ritual se recuperan (8 res este ciclo, venía de 11); (c) que desaparezca el clic de $1.721
de "alma lemu"; (d) que bajar Refugio a $1.500 NO haya afectado nada (ya vendía 0 — si sigue
en 0, evaluar pausarla hasta octubre); (e) si Noche de Aguas Calientes sostiene su orgánico
(base 9 res / $1,1M — la Ruta A depende de eso).

---

### 2026-08-21 — Auditoría competitiva (sesión con Jorge, fuera de ciclo)

**Qué la gatilló:** Jorge pidió (a) revisar si el gasto se estaba disparando y (b) una auditoría
competitiva contra Termas Cochamó / Termas del Sol / Cancagua, que había levantado de la
Biblioteca de Anuncios de **Meta**. Se auditó con datos reales de la cuenta.

**Cambios de Jorge no registrados antes (detectados en el panel):** él mismo pausó Refugio y
movió sus $1.500 a Ritual → Ritual quedó en **$8.000/día**, Pausa $5.000, Refugio $1.500
pausada. Total activo $13.000/día.

**⚠️ EL GASTO QUE REPORTA ESTE LOOP ESTABA SUBESTIMADO EN 19% — LA API NO TRAE IVA.**
La API de Google devuelve el costo **sin IVA**; la facturación cobra **+19%**. Verificado:
julio API $393.839 → boleta $468.136 (×1,19 ✓); agosto 1-19 API $260.765 → boleta $312.430 ✓.
**Regla nueva: todo número de gasto que se le muestre a Jorge va CON IVA**, porque es lo que
sale de su bolsillo. (Además, en la pantalla de facturación la columna *Pagos* NO es el gasto
del mes — incluye deuda de meses anteriores; el gasto es *Costo neto*.)

**Gasto real con IVA:** mayo $26.461 · junio $345.664 · julio $468.136 · agosto proyectado
~$488.000. Ads pesa **~2,4% de las ventas del negocio** — siete veces menos que la comisión
de una OTA (15-18%). Conclusión: el gasto NO está disparado; lo que sí escaló es el volumen.

**⭐ AUCTION INSIGHTS (leído del panel; NO existe endpoint en el backend — pendiente).**
El hallazgo mayor de la sesión: **las dos campañas compiten contra rivales distintos.**

| | Ritual del Río (alojamiento) | Pausa junto al río (spa por el día) |
|---|---|---|
| Tu impression share | **21,71%** (4° lugar) | **35,51%** (1° lugar) |
| Rival dominante | **booking.com 75,57%** · airbnb 29,96% | booking 28,78% · **cancagua 16,28%** |
| ¿Están las termas? | **NO aparecen** | **SÍ**: Cancagua, Cochamó, Termas del Sol |
| Te frena | **Presupuesto** | **Ranking / Quality Score** |
| Palanca | 💰 plata | 🔧 keywords y calidad |

Dos lecturas clave:
1. **No pierdes por ranking, pierdes por presencia.** El "porcentaje de ranking superior" contra
   casi todos los rivales ronda 19-21% y tu impression share es 21,71% — el techo para superar
   a alguien es tu propia presencia. Cuando SÍ apareces compites bien (73,16% en parte superior).
2. **La hipótesis de Meta no se traslada a Google tal cual.** Cochamó y Termas del Sol pautan
   en Meta pero no disputan la búsqueda de alojamiento; sí aparecen en la de spa-por-el-día.
   **Cancagua es el competidor real en Pausa** y le gana a Aremko el "absoluto arriba de todo"
   (33,18% vs 29,73%).

**💡 CORRECCIÓN DE JORGE que cambia el caso económico de Ritual (importante):** el loop había
calculado el beneficio de ganarle a Booking como "ahorro de comisión". **Está mal.** Booking
vende la habitación con desayuno a **$110.000**; el Ritual vale **$210.000** (semana) / $240.000
(fin de semana). Ganarle la subasta no ahorra una comisión: **cambia el producto que se vende.**
- Gana Booking → cliente paga $110.000, Aremko recibe ~$93.500 (menos 15%)
- Gana Aremko → cliente paga **$210.000** directo
- **Diferencia por reserva desviada: ~$116.500** → punto de equilibrio **637 clics/reserva**
  (Ritual lleva 768 clics en agosto). Aun en el peor escenario —que reserve el producto
  barato— se gana la comisión y el equilibrio queda en 90 clics. **Los dos escenarios
  justifican subir Ritual.**

**🔴 Problema de canal (excede a Ads, pero vale más que todo lo demás):** Booking aparece en el
**75% de las subastas de Ritual** y ahí Aremko solo tiene publicado su producto de $110.000.
Se está usando el canal más caro para vender lo más barato, y encima con comisión. Revisar qué
se lista en Booking.

**CONEXIÓN TELAR (M17 de DH) ↔ ADS — analizada con el brief real de la semana del 17-08.**
Se leyó el brief completo (`python manage.py piezas aremko` en la Shell de `datamatic-hospitality`):
29 piezas, 8 ángulos, **19 de las 29 sobre el trabajador embarcado** (turno 14x14 / 22x10).
Conclusión estructural, para no volver a discutirla:

| Hebra del Telar | Alimenta a | Por qué |
|---|---|---|
| Dolores / Ángulos | **Meta + orgánico** | Son de interrupción — nadie busca "regalo para mi marido embarcado" |
| **Fechas locales** | **Google Ads** | Es la única hebra que genera demanda de BÚSQUEDA |
| Diferenciadores (38°, río a 5m, 50 min) | **Los dos** | Datos duros, caben en 25 caracteres |

De los 8 ángulos de la semana **solo uno tenía demanda de búsqueda** (el Medio Maratón de
Puerto Varas del domingo 23) y Google Ads estuvo ciego a él. **Cadencias distintas y no
negociables:** Meta semanal; sitelinks/textos destacados de Google semanal; **RSA de Google
cada 4-6 semanas** (rotarlos semanalmente resetea el aprendizaje).

**Y el loop de vuelta (Ads → Telar), que no se había visto:** el brief publicó CUATRO horarios
distintos de desayuno (8:00, 10:00, "a la hora que necesites") porque el dato no estaba fijado.
La disciplina de los 25 caracteres de Google lo obligó a definirse. **La precisión de Ads
depura los datos del Telar.** Correcto: **desayuno servido en la cabaña a las 10:00 AM.**

**⭐ DIFERENCIADOR MAYOR descubierto por Jorge al cargar los textos:** el agua a 38° está
**GARANTIZADA — si llega a 37° o menos, la tina es gratis**, y es el único de la zona que la
ofrece. Es más fuerte que la autoridad que usa Termas del Sol ("Traveller's Choice 5 años") y
que su precio ("Ritual Patagónico $30.000, 50% off"): es una promesa con consecuencia,
verificable, que no se puede copiar sin cambiar la operación. **Pendiente: no está publicada en
aremko.cl** — el anuncio la promete y la landing no la confirma.

**EJECUTADO en vivo (2026-08-21) — de 0 a 9 textos destacados + 5 keywords de geo:**
- ✅ **4 textos destacados a nivel CUENTA** (las 3 campañas los heredan; antes había **0**):
  `Travellers' Choice 2026` · `Agua garantizada a 38°` · `Río a 5 metros` · `Masaje de 50 minutos`
- ✅ **2 en Ritual** (alojamiento): `Desayuno en tu cabaña` · `Estacionamiento gratis`
- ✅ **3 en Pausa** (contraataque a Cancagua/Cochamó/Termas del Sol, que venden agua compartida
  y por orden de llegada): `Tinaja privada 2 horas` · `Con hora agendada` · `Pasarelas, sin barro`
- ✅ **5 keywords de FRASE en Ritual** (grupo existente), quedaron «En revisión»:
  `"cabañas con tinaja puerto montt"` · `"cabaña con tinaja osorno"` · `"tinajas puerto montt"` ·
  `"tinajas osorno"` · `"termas cerca de puerto montt"`
- 🔵 Se DESCARTÓ crear un grupo de anuncios dedicado por ahora: exige escribir un RSA completo
  y los anuncios se dejaron para después. Agregar las keywords al grupo existente captura el
  grueso del beneficio (dejar de pagar la aproximación); el grupo dedicado queda pendiente.
- ⚠️ **NO se aplicaron las «ideas» que sugiere Google**: incluían `termas de puyehue` /
  `termas puyehue` (resort competidor) y `hoteles en puerto varas` (genérica donde Booking
  tiene presupuesto infinito). Regla: nunca usar «Aplicar todas» en las recomendaciones.

**⭐ HALLAZGO en las keywords de Ritual — la misma palabra, dos configuraciones, resultados
opuestos.** Dos keywords se comen **$101.074 de los $140.370** de la campaña (72%):
`spa puerto varas` en AMPLIA ($49.230) y `"cabaña con tinaja"` en frase ($51.844). Y la
comparación que importa:

| Keyword | Concordancia | Clics | Costo | CTR | CPC |
|---|---|---:|---:|---:|---:|
| `spa puerto varas` | **amplia** | 279 | $49.230 | **9,43%** | $176 |
| `"spa puerto varas"` | frase | 56 | $8.474 | **26,17%** | $151 |

La versión en frase rinde **2,8× mejor CTR con CPC 14% menor**. La amplia es la que dispersa
el gasto hacia "spa puerto montt", "masajes puerto montt" y demás. **Es la próxima corrección
—pero NO antes de que las 5 keywords de geo estén activas**, porque hoy la amplia es lo único
que captura esa demanda; cortarla primero la perdería.

**Hallazgos menores:** los 5 vínculos a sitio existentes los creó **la IA de Google** el 24-06 y
son genéricos ("Nuestras Cabañas", "Nuestros Productos") — sin un solo dato duro; **Ritual tiene
las 26 keywords en UN SOLO grupo de anuncios**, lo que explica sus Quality Scores de 3-7; y el
post de Google del Medio Maratón se publicó con el día equivocado ("sábado 23" siendo domingo).

**PENDIENTES ABIERTOS (para el Ciclo #5):**
1. **Agregar endpoint de Auction Insights al backend** — hoy obliga a pedirle capturas a Jorge.
2. **Grupo "Geo cercana" en Ritual** con keywords propias de Puerto Montt/Osorno: 160+ clics en
   30 días entran por concordancia amplia sin keyword propia. **Es el terreno de Cancagua.**
3. **Subir Ritual $8.000 → $10.000/día** (+$71.400/mes con IVA; equilibrio: 1,7 reservas).
4. **Limpiar keywords amplias sin geo de Pausa** y las de QS 1 — su freno es ranking, no plata.
5. **Separar campaña de MARCA** (~$43.000/mes en búsquedas de "aremko") — abierta desde el #4.
6. **Publicar la garantía de 38° en aremko.cl** y llevarla al Telar como diferenciador.
7. **Medir el clic a WhatsApp como conversión** — hoy Google puja a ciegas (0 conversiones).
8. **Programación por día de la semana** — RESUELTO CON DATOS (ver bloque siguiente).
9. **Revisar qué vende Booking en nombre de Aremko** (problema de canal, ver arriba).

**📐 ANTICIPACIÓN DE RESERVA — sonda corrida el 2026-08-21 (n=3.891 desde enero).** Cambia
supuestos que este loop venía arrastrando. Detalle completo en la memoria
`project_aremko_estudio_anticipacion_reserva`.

| Métrica | Resultado |
|---|---|
| Mediana de anticipación | **2 días** (P25 0 · P75 5 · **P90 13**) |
| Reserva para el MISMO día | **29,6%** |
| Dentro de 2 días | **60%** |
| Por tipo | tina **1d** · masaje **1d** · **cabaña 4d** |

Compras por día: Mié 655 · Vie 604 · Lun 603 · Jue 599 · Sáb 596 · **Mar 424** · Dom 410.
Visitas por día: **Sáb 1.118 (29%)** · Vie 630 · Dom 617 · Jue 437 · Mié 432 · Lun 343 · Mar 314.

- ✅ **Las ventanas de 14 días del loop están BIEN** (P90 = 13 días → capturan el 90% del
  efecto). Los 4 ciclos corridos son válidos por este lado.
- ⚠️ **El martes cae 31% vs los otros días de semana, y ese 31% ≈ el 29,6% que reserva para
  hoy**: el martes pierde exactamente la demanda «para el mismo día» porque el recinto está
  cerrado. Corresponde bajar la puja ~25-30% ese día, **nunca apagarla** — el resto sigue
  comprando para otros días. Ahorro chico (~$2.000/mes); el valor real está en redistribuir.
- ⚠️ **Ritmos OPUESTOS por campaña, y esto sí es estructural:** Pausa (tina+masaje) se decide
  en **1 día** — hay que estar presente hoy para hoy; Ritual/Refugio (cabaña) en **4 días** —
  hay que estar el martes para llenar el sábado. Hoy el presupuesto está plano de lunes a
  domingo en las dos, lo que es incorrecto para ambas.
- ✏️ **Matiza la crítica al destino WhatsApp:** con 30% para el mismo día, el canal está más
  alineado con el cliente de lo que el diagnóstico asumió. Lo que falta no es reserva online
  sino **medir el clic a WhatsApp** (pendiente 7).
- **Limitación:** son TODAS las reservas, no solo las de Ads; el patrón por día puede reflejar
  cuándo responde el equipo. Por eso solo el ajuste del martes tiene causa clara; lo de
  jueves/viernes es hipótesis a validar.
- **⛔ BLOQUEO TÉCNICO antes de tocar la programación:** si las campañas usan una estrategia de
  puja automática (el panel viene recomendando «Maximizar clics» y «Maximizar conversiones»),
  los ajustes de puja por día NO se aplican como en puja manual. **Verificar primero la
  estrategia de puja de cada campaña.**

---

### 2026-08-14 — Ciclo #5

**Período analizado:** 2026-07-31 a 2026-08-13 (14 días).

**⚠️ CIEGO A NIVEL PLATAFORMA — la API de Google Ads rechaza la versión v21.** Los TRES
endpoints (`/summary`, `/quality-scores`, `/search-terms`) devuelven el mismo error:
`UNSUPPORTED_VERSION — "Version v21 is deprecated. Requests to this version will be blocked."`
No es el token esta vez (el bloqueo del Ciclo #2 era OAuth): el backend Go apunta a una
versión que Google ya dejó de atender (`backend/internal/googleads/client.go:29`). **Sin
gasto, CPC, CTR, Search IS ni search-terms este ciclo.** La única mitad disponible fue el
puente de ventas reales (Django, OK). Fix propuesto en la corrección ① — 1 línea, v21 → v25.

**⚠️ Segunda salvedad — ventana solapada, medición prematura.** El Ciclo #4 analizó
07-25 a 08-07; esta ventana (07-31 a 08-13) **comparte 8 de sus 14 días** con aquella. Y las
correcciones del 08-08 (negativas round 3 + rebalanceo Ritual $6.500 / Refugio $1.500) solo
alcanzan a los **últimos 6 días**. Las comparaciones de abajo son direccionales, NO una
medición limpia — el propio Ciclo #4 pedía esperar a una ventana ≥ 2026-08-22. Lo que sí es
concluyente es lo que se sostiene a lo largo de DOS ciclos seguidos (Refugio en 0).

**Ventas reales del período (fuente de verdad, plataforma ciega):**

| Combo | Campaña | Reservas | Revenue | vs Ciclo #4 |
|---|---|---|---|---|
| cabanas_tinas_masajes_1n | **Ritual del Río** | **12** | **$2.909.000** | ↑↑ (era 8 / $1,84M) — **récord histórico** |
| solo_tinas | _(sin campaña)_ tina suelta | 35 | $2.075.000 | — |
| cabanas_tinas_1n | _(sin campaña)_ **Noche Aguas Calientes** | **11** | **$1.592.000** | ↑ (era 9 / $1,10M) — **récord** |
| tinas_masajes | **Pausa junto al río** | 14 | $1.940.000 | ↓ (era 20 / $2,57M) |
| solo_masajes | _(sin campaña)_ masaje suelto | 11 | $640.000 | — |
| cabanas_tinas_masajes_2n | **Refugio** | **0** | **$0** | = (era 0) — **2º ciclo en cero** |
| **Total negocio** | — | **85** | **$9.631.000** | revenue **↑ +16%** (era 87 res / $8,29M) |

**Diagnóstico (lo que las ventas reales sí permiten afirmar):**

1. **Ritual del Río es el motor del negocio y responde a la plata.** 8 → 12 reservas y
   $1,84M → $2,91M (+58% revenue). Bate su propio récord anterior ($2,46M del Ciclo #2) y es
   hoy el combo #1 en revenue de todo Aremko. El rebalanceo del 08-08 ($5.000 → $6.500/día)
   solo cubre 6 días de esta ventana, así que no se le puede atribuir todo el salto — pero la
   dirección es exactamente la esperada y **ninguna señal contradice subirle más** (ítem ③,
   condicionado al panel).
2. **Refugio confirma su veredicto: 28 días corridos sin vender el combo que publicita.**
   Dos ciclos consecutivos en 0 reservas, ya con presupuesto reducido a $1.500/día. La
   condición que el Ciclo #4 dejó escrita ("si sigue en 0, evaluar pausarla") **se cumplió**
   → se propone pausarla hasta octubre (ítem ②). Es la única conclusión de este ciclo que NO
   depende de la ventana solapada ni de la API caída.
3. **Noche de Aguas Calientes revalida la Ruta A por tercera vez, y ahora con récord:**
   6 → 9 → **11 reservas** ($952k → $1,10M → **$1,59M**) sin un peso de Google Ads. La
   decisión de NO crear campaña dedicada (para no canibalizar a Ritual) sigue siendo correcta:
   el orgánico no solo aguanta, acelera.
4. **Pausa junto al río bajó (20 → 14 res), pero NO es lectura limpia.** Con 8 días de
   solapamiento entre ventanas y sin datos de plataforma, no se puede saber si es caída real,
   estacionalidad de mitad de agosto o simple corrimiento de fechas. **No se toca su
   presupuesto** — se vuelve a medir en el Ciclo #6 con ventana fresca y API arriba. Ojo
   además: `solo_tinas` (35 res / $2,08M) sigue muy fuerte, así que la demanda de tina no cayó.

**Recomendaciones NUEVAS (SOLO PROPUESTA — Nivel 2, esperar OK de Jorge):**
1. **🔴 Arreglar `client.go:29` (v21 → v25).** Prerequisito de todo lo demás: es el 2º ciclo
   de 5 que queda ciego por infraestructura, y esta vez ni siquiera se puede verificar que las
   campañas estén al aire. 1 línea, riesgo bajo, ningún campo GAQL cambia.
2. **Pausar Refugio** (condición del Ciclo #4 cumplida) — vigilando en el Ciclo #6 que Ritual
   y Noche no caigan, porque sus 147 clics podrían estar alimentando ventas de otros combos.
3. **Mover sus $1.500/día a Ritual SOLO si el panel dice "Limitado por el presupuesto".**
   Si no, quedarse el ahorro y dejar la cuenta en $11.500/día.

**A MEDIR en el Ciclo #6 (ventana ≥ 2026-08-22, ya sin solape):** (a) **primero de todo**, si
la API responde — sin eso el ciclo vuelve a quedar a media máquina; (b) el efecto real del
rebalanceo del 08-08 sobre el Search IS de Ritual (base **22,3%**) con 14 días limpios;
(c) si Ritual (12 res) y Noche (11 res) se sostienen tras pausar Refugio — la prueba de si
Refugio alimentaba ventas ajenas; (d) si Pausa se recupera de las 14 res o confirma caída;
(e) que desaparezca el clic de $1.721 de "alma lemu" (quedó sin verificar por la API caída).

---

### 2026-08-16 — ✅ CAMBIOS EJECUTADOS (decididos en la sesión del Ciclo 9 de **Meta Ads**)

⚠️ **Nota de coordinación entre loops — leer antes de proponer nada sobre estas campañas.**
El Ciclo 8 del loop de Meta propuso apagar "Ritual del Río – Search"; cuatro días después
este loop le SUBIÓ el presupuesto de $5.000 a $6.500/día (Ciclo #5, 08-08). Ninguno de los
dos se enteró del otro, y esa contradicción distorsionó la medición de Meta durante dos
ciclos (ver Hallazgo 1 del Ciclo 9 en `LOOP_META_ADS.md`). **Regla nueva: todo cambio de
presupuesto o estado en Google sobre Ritual / Pausa / Refugio / Noche se anota en los DOS
archivos, con fecha.**

**Estado del panel al 2026-08-16** (dato que la API NO entrega — motivo de limitación):

| Campaña | Presupuesto | Motivo de limitación |
|---|---|---|
| Ritual del Río – Search | $6.500/día | 🔴 **Limitado por el PRESUPUESTO** |
| Pausa junto al río - Search | $5.000/día | Limitada por **volumen de búsquedas** |
| Refugio - Search | $1.500/día | Volumen + conversiones mal configuradas |

Lectura: **Pausa no tiene más demanda de búsqueda que capturar** — subirle presupuesto en
Search no tiene dónde ir. Ritual sí, y es el de mayor ticket.

- [x] **Pausar "Refugio - Search - Lanzamiento Junio 2026"** — ✅ HECHO (Jorge, panel).
  Cumple la condición que este loop dejó escrita en el Ciclo #4 y repitió en el #5
  (2 ciclos + 4 semanas con 0 reservas reales). Verificado: fila "Detenido",
  Total cuenta $13.000 → $11.500/día.
- [x] **"Ritual del Río – Search": $6.500 → $8.000/día** — ✅ HECHO (Jorge, panel).
  Financiado con los $1.500/día de Refugio; total de la cuenta de vuelta en $13.000/día,
  **sin presupuesto nuevo**. Cumple la condición del Ciclo #5 rec #3 (mover a Ritual sólo
  si el panel dice "Limitado por el presupuesto") — el panel lo dice.
- [ ] **Pendiente: `client.go:29` v21 → v25.** La API sigue caída (3er ciclo). Sin eso
  ninguno de los dos loops puede verificar estos cambios por dato, solo por panel.

**A medir en el Ciclo #6:** (a) si Ritual sube de 12 res / $2.939.000 por 14d con el
presupuesto en $8.000/día; (b) si Pausa y Noche se mantienen tras pausar Refugio
(prueba de si Refugio alimentaba ventas ajenas); (c) que el gasto total de la cuenta se
haya quedado en ~$13.000/día y no haya subido solo.
