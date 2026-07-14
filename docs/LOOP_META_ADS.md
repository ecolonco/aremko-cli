# Loop de mejora continua — Meta Ads

> Bitácora del loop dedicado (sesión propia, `/loop`) que revisa el desempeño de
> Meta Ads y lo cruza con ventas reales. Cada ciclo LEE este archivo antes de
> proponer algo nuevo (para no repetir lo mismo) y AGREGA su entrada al final.

## Reglas de autonomía (definidas con Jorge, 2026-07-02)

- **Nivel 2: SOLO PROPONE.** El loop nunca pausa campañas, cambia presupuesto,
  ni edita nada — solo analiza y deja recomendaciones esperando aprobación de
  Jorge. (Ya existe capacidad de escritura real vía Graph API — `internal/meta/write.go`
  — pero este loop NO debe usarla mientras siga en Nivel 2.)
- **⚠️ NUNCA basar una recomendación en "conversiones" reportadas por la
  plataforma (Meta/Google).** Ya se comprobó que fallan (el reporte de Google
  mostró 0 conversiones con ventas reales ocurriendo). Usar SIEMPRE el puente
  de ventas reales: `GET /ventas/api/aremko-cli/bookings/family-combinations-range/`
  (Django, ver H-053/H-053b en `docs/HANDOFFS.md` del repo Django) vía
  `bookings.GetFamilyCombinationsRange` (cliente Go ya existe en este repo).
- Programas activos a rastrear: Ritual del Río (`cabanas_tinas_masajes_1n`),
  Refugio (`_2n`), Pausa junto al río (`tinas_masajes`), Noche de Aguas
  Calientes (`cabanas_tinas_1n`, ver H-055). Campañas Meta correspondientes se
  descubren por nombre (`findCampaignByName` en `internal/api/handlers/brief.go`).

## Qué hacer en cada ciclo

1. Leer la última entrada de este archivo (qué se propuso, si Jorge respondió algo).
2. Traer desempeño Meta Ads de los últimos 7-14 días (gasto, CTR, alcance) por campaña.
3. Cruzar con ventas reales del mismo período (bridge de arriba) — NO usar conversiones de plataforma.
4. Comparar contra el ciclo anterior: ¿cambió algo? ¿se implementó la recomendación pasada?
5. Producir 1-3 recomendaciones NUEVAS y concretas (no repetir un reporte completo).
6. Agregar una entrada nueva abajo con fecha, snapshot corto, y las recomendaciones.
7. Presentar a Jorge un resumen breve en el chat, dejando explícito que no se ejecutó nada.

---

## Bitácora de ciclos

### 2026-07-02 — Ciclo 1 (primera corrida)

**Ventana:** 2026-06-18 → 2026-07-02 (14d), con sub-ventana 7d (06-25 → 07-02).
Fuentes: `campaigns-with-insights` (backend Go en Render) + `family-combinations-range` (Django, ventas reales).

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Clicks | CTR | CPC |
|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $24.055 | 21.381 | 1.597 | 4,93% | $15 |
| Pausa junto al río – junio 2026 | ACTIVE | $23.042 | 16.064 | 1.079 | 4,63% | $21 |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** (cuenta vieja `act_455070225054110`) | $0 | — | — | — | — |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — |

Gasto total 14d: ~$47.000 CLP (~$3.400/día entre ambas activas).

**Ventas reales del período (bridge Django, 14d / 7d):**

| Programa (combinación) | 14d | 7d |
|---|---|---|
| Ritual (`cabanas_tinas_masajes_1n`) | 7 res / $1.667.000 | 5 res / $1.175.000 |
| Pausa (`tinas_masajes`) | 9 res / $1.290.000 | 6 res / $845.000 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 8 res / $1.260.000 | 5 res / $820.000 |
| Refugio (`cabanas_tinas_masajes_2n`) | 3 res / $830.000 | 2 res / $560.000 |
| **Total sitio (todas las combinaciones)** | 96 res / $9.567.099 | 56 res / $5.967.099 |

Lectura: la segunda semana acelera (7d ≈ 60-70% del total 14d en casi todas las líneas).
Los 4 programas venden ($5,05M en 14d) con un gasto publicitario ínfimo; CTR ~4,6-4,9%
y CPC $15-21 son muy sanos.

**Comparación con ciclo anterior:** no hay (primera corrida).

**Recomendaciones (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **Reactivar Refugio en la cuenta operativa.** Refugio vendió 3 reservas / $830.000
   en 14d SIN pauta activa: la única campaña Meta está pausada y vive en la cuenta
   vieja `act_455070225054110`. Propuesta: recrear la campaña en la cuenta operativa
   `act_214650980544393` (no reactivar la vieja), presupuesto de prueba similar a
   Ritual (~$1.700/día), landing del Refugio.
2. **Crear campaña dedicada para Noche de Aguas Calientes.** 8 reservas / $1.260.000
   en 14d sin campaña propia — demanda probada sin empuje pagado. Es el programa de
   ticket de entrada más bajo y hoy no aparece en ninguna pauta. Propuesta: campaña
   Meta propia (o ad set dentro de una campaña programas) apuntando a su landing.
3. **Refrescar "junio 2026" → julio + evaluar subir presupuesto.** Ambas campañas
   activas siguen nombradas/creadas para junio; julio = vacaciones de invierno en
   Chile (calendario comercial relevante). Propuesta: refrescar copy/creatividades
   al ángulo invierno-vacaciones y, dado CPC $15-21 con CTR ~4,8%, probar +50% de
   presupuesto en Ritual y Pausa por un ciclo (hoy se gasta ~$47k/14d contra $5M
   de ventas de programas).

### 2026-07-03 — Ciclo 2

**Ventana:** 2026-06-19 → 2026-07-02 (14d). Fuentes: `campaigns-with-insights`
(backend Go en Render) + `family-combinations-range` (Django, ventas reales).

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Impres. | Clicks | CTR | CPC | Cuenta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $27.827 | 23.992 | 37.486 | 1.799 | 4,80% | $15 | operativa `214650…` |
| Pausa junto al río – junio 2026 | ACTIVE | $26.937 | 18.950 | 28.384 | 1.264 | 4,45% | $21 | operativa `214650…` |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** | $0 | — | — | — | — | — | vieja `455070…` |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — | — | — |

Gasto total 14d: ~$54.764 CLP (~$3.912/día entre ambas activas). Sube ~16% vs
Ciclo 1 (~$47k), sobre todo por correr la ventana un día más hacia julio.

**Ventas reales del período (bridge Django, 14d):**

| Programa (combinación) | Ciclo 2 (14d) | Ciclo 1 (14d) |
|---|---|---|
| Ritual (`cabanas_tinas_masajes_1n`) | 6 res / $1.407.000 | 7 res / $1.667.000 |
| Pausa (`tinas_masajes`) | 9 res / $1.260.000 | 9 res / $1.290.000 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 6 res / $970.000 | 8 res / $1.260.000 |
| Refugio (`cabanas_tinas_masajes_2n`) | 3 res / $830.000 | 3 res / $830.000 |
| **Total sitio (todas las combinaciones)** | 88 res / $8.602.099 | 96 res / $9.567.099 |

Lectura: ventana casi idéntica a Ciclo 1 (desplazada 1 día), por eso las líneas
se mueven poco. Los 4 programas vuelven a vender (~$4,47M solo en estas 4 líneas)
con gasto publicitario ínfimo. Eficiencia directional: los 2 programas con pauta
(Ritual + Pausa) vendieron $2.667.000 con $54.764 de gasto (~49× gasto→ingreso,
sin atribución fina). CTR 4,45–4,80% y CPC $15–21 siguen muy sanos.

**Comparación con Ciclo 1 (¿se implementó lo propuesto?):** NO. Las 3
recomendaciones del 02-jul siguen pendientes — Refugio sigue PAUSED en la cuenta
vieja, Noche de Aguas Calientes sigue sin campaña, y ambas activas siguen
nombradas "junio 2026" pese a que hoy ya es 3 de julio (plena temporada de
vacaciones de invierno). Señal nueva: **Pausa muestra fatiga incipiente** — su
CTR bajó (4,63% → 4,45%) y su CPC ($21) es ~40% más caro que el de Ritual ($15).

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **Camino rápido para desbloquear Refugio + Noche a la vez: duplicar la
   campaña ganadora.** En vez de crear dos campañas desde cero (recs #1 y #2 del
   Ciclo 1, aún pendientes), duplicar en la cuenta operativa `214650…` la campaña
   de Ritual (estructura ya probada: CTR ~4,8%, CPC $15) dos veces — una apuntada
   a la landing de Refugio y otra a la de Noche de Aguas Calientes — con
   presupuesto de prueba ~$1.700/día c/u. Reutiliza segmentación y formato que ya
   funcionan; reduce el esfuerzo de "armar de cero" que hasta ahora frenó ambas.
2. **Antes de subir presupuesto en Pausa, rotar su creativo (fatiga incipiente).**
   Pausa es la única línea con CTR a la baja y su CPC ($21) es 40% mayor que el de
   Ritual. Propuesta: cargar 1–2 creatividades nuevas de Pausa este ciclo (mismo
   ángulo tina+masaje, foto/hook fresco) y recién escalar presupuesto cuando el
   CTR se recupere. Escalar sobre creativo cansado sube el CPC.
3. **Reasignar el mix de presupuesto hacia Ritual en vez de subir parejo.** Con
   CPC $15 vs $21 y ticket mayor ($234k prom. Ritual vs $140k Pausa), el peso
   debería inclinarse a Ritual. Propuesta: en lugar del "+50% a ambas" del Ciclo
   1, mover el gasto a ~60/40 Ritual/Pausa y, de paso, renombrar ambas a
   "julio – vacaciones de invierno" con hook estacional (ya es julio; el nombre
   "junio" quedó vencido).

### 2026-07-14 — Ciclo 3

**Ventana:** 2026-06-28 → 2026-07-11 (14d). Fuentes: `campaigns-with-insights`
(backend Go en Render) + `family-combinations-range` (Django, ventas reales,
mismo rango). Nota: el bridge Django devolvió por defecto una ventana 2 días
más adelante; se re-consultó con fechas explícitas para alinear ambas fuentes.

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Impres. | Clicks | CTR | CPC | Cuenta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $69.997 | 42.386 | 85.221 | 3.760 | 4,41% | $19 | operativa `214650…` |
| Pausa junto al río – junio 2026 | ACTIVE | $70.000 | 39.121 | 76.628 | 2.883 | 3,76% | $24 | operativa `214650…` |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** | $0 | — | — | — | — | — | vieja `455070…` |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — | — | — |

Gasto total 14d: **~$139.997 CLP (~$10.000/día, 50/50)**. **Salto grande: +156%
vs Ciclo 2** (~$54.764). El presupuesto SÍ se escaló (~2,6×) desde el ciclo
pasado — la primera recomendación estructural (subir pauta) se implementó, pero
50/50 y sobre los mismos creativos "junio 2026".

**Ventas reales del período (bridge Django, 14d alineado):**

| Programa (combinación) | Ciclo 3 (14d) | Ciclo 2 (14d) | Ticket prom. |
|---|---|---|---|
| Ritual (`cabanas_tinas_masajes_1n`) | 10 res / $2.255.000 | 6 res / $1.407.000 | $225.500 |
| Pausa (`tinas_masajes`) | 15 res / $1.810.000 | 9 res / $1.260.000 | $120.667 |
| Refugio (`cabanas_tinas_masajes_2n`) | 5 res / $1.425.000 | 3 res / $830.000 | $285.000 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 6 res / $992.100 | 6 res / $970.000 | $165.350 |
| **Total sitio (todas las combinaciones)** | 89 res / $9.941.099 | 88 res / $8.602.099 | — |

Lectura: los 2 programas CON pauta crecieron fuerte tras escalar el gasto —
Ritual 6→10 res, Pausa 9→15 res; ventas combinadas $2.667.000 → **$4.065.000**.
Pero la eficiencia (ingreso/gasto) bajó de **48,7× a 29,0×** (rendimientos
decrecientes al escalar). ROAS incremental sobre el gasto EXTRA (+$85.233):
**16,4×** — todavía muy sano. Ojo: el sitio total sólo subió ~15% ($8,6M→$9,94M)
mientras estos 2 programas subieron ~52%; parte es empuje pagado, parte
temporada de invierno (correlación, no atribución fina). **Refugio volvió a
crecer (3→5 res, $1,425M, el ticket más alto $285k) SIN NADA de pauta.**

**Comparación con Ciclo 2 (¿se implementó lo propuesto?):** PARCIAL.
- ✅ Subir presupuesto: hecho (~2,6×), pero 50/50 en vez del 60/40 hacia Ritual
  que se propuso, y sin renombrar (siguen "junio 2026").
- ❌ Rotar creativo de Pausa ANTES de escalar (Ciclo 2 rec #2): NO se hizo — y
  pasó exactamente lo advertido. La fatiga de Pausa se profundizó: CTR
  4,63%→4,45%→**3,76%** y CPC subió a **$24** (29% más caro que Ritual $19). Se
  escaló sobre un creativo cansado.
- ❌ Refugio sigue PAUSED en la cuenta vieja; Noche sigue sin campaña.

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **Frenar el escalado de Pausa hasta rotar su creativo — ya no es opcional.**
   Post-escalado, Pausa quedó con CTR 3,76% (mínimo histórico) y CPC $24 con
   $5.000/día encima. Se está pagando más por menos: cada peso extra en Pausa
   entra sobre un anuncio en clara fatiga. Propuesta concreta: bajar Pausa a su
   presupuesto pre-escalado (~$1.900/día) HASTA cargar 1–2 creativos nuevos
   (foto/hook fresco, mismo ángulo tina+masaje); recién ahí volver a subir.
2. **Rebalancear el presupuesto ya escalado hacia Ritual (65/35), no 50/50.**
   Bajo el mismo escalado, Ritual aguantó mucho mejor que Pausa: CTR 4,41% vs
   3,76%, CPC $19 vs $24, ticket $225k vs $121k, y creció más en ventas. En vez
   del $5k/$5k actual, mover a ~$6.500/día Ritual y ~$3.500/día Pausa. Rationale
   nuevo: no es sólo el ticket (arg. del Ciclo 2) sino que Ritual demostró
   responder mejor AL ESCALADO real de este ciclo.
3. **Financiar el lanzamiento de Refugio con el presupuesto liberado de Pausa.**
   Refugio es hoy el mejor "vendedor gratis" (5 res / $1,425M, ticket más alto
   $285k) y sigue sin pauta. Ya está probado que hay apetito de ~$10k/día. En vez
   de pedir presupuesto nuevo, redirigir los ~$1.600/día que se le quitan a Pausa
   para lanzar Refugio en la cuenta operativa `214650…` duplicando la estructura
   de Ritual (que acaba de demostrar que escala bien). Conecta la recomendación
   pendiente de Refugio (Ciclos 1 y 2) con una fuente concreta de fondos.
