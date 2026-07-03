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
