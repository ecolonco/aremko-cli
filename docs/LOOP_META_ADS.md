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

## Metodología de trabajo con Jorge (definida 2026-07-14)

- **El loop TERMINA EN ACCIONES, no en recomendaciones.** Tras el diagnóstico
  debe decir "debemos ejecutar las siguientes N acciones" (lista concreta y
  numerada), no un set de sugerencias abiertas.
- **Guiar a Jorge una acción a la vez.** Indicarle exactamente dónde hacer cada
  cambio en Meta Ads Manager, esperar su confirmación antes de pasar a la
  siguiente. (Sigue Nivel 2: el loop NO ejecuta por API; Jorge aplica manual.)
- **Documentar cada cambio ejecutado en la bitácora** (con fecha) apenas Jorge
  confirma que lo hizo — no solo la propuesta, sino el "hecho".
- **El ciclo siguiente EVALÚA lo ejecutado.** No solo comparar métricas: partir
  por "¿qué acción se ejecutó el ciclo pasado y qué efecto tuvo?".
- En corridas autónomas (Jorge ausente) el output es la lista de acciones lista
  para ejecutar cuando Jorge aparezca en una sesión interactiva.

## Qué hacer en cada ciclo

1. Leer la última entrada de este archivo: ¿qué acciones se ejecutaron?, ¿qué quedó pendiente?
2. Traer desempeño Meta Ads de los últimos 7-14 días (gasto, CTR, alcance) por campaña.
3. Cruzar con ventas reales del mismo período (bridge de arriba) — NO usar conversiones de plataforma.
4. **Evaluar el efecto de las acciones ejecutadas** en el ciclo anterior (¿mejoró lo que se cambió?).
5. Convertir el diagnóstico en una LISTA CONCRETA DE ACCIONES numeradas (no recomendaciones abiertas).
6. Agregar una entrada nueva abajo con fecha, snapshot corto, y la lista de acciones.
7. Si Jorge está presente: guiarlo una acción a la vez y documentar cada cambio confirmado.

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

**Addendum (mismo día) — límite de ejecución detectado.** Jorge aprobó ejecutar las
3, pero `internal/meta/write.go` solo sabe hacer 3 cosas: pausar, activar y fijar
`daily_budget` de una campaña. NO puede crear campañas, ad sets ni creatividades, ni
editar copy. Consecuencia:
- Rec 1 y 2 (crear/recrear campañas) **no son automatizables hoy** — requieren Ads
  Manager o agregar capacidad de creación al código.
- Rec 3: el cambio de presupuesto sí es posible por endpoint, pero el cliente de
  lectura solo pide `id,name,status` — **no se conoce el `daily_budget` actual**, así
  que no se puede calcular el +50% sin adivinar. No se ejecutó.
- Nota para el próximo ciclo: proponer solo acciones dentro de pausar/activar/budget,
  o marcar explícitamente cuáles requieren mano humana.

---

### 2026-08-09 — Ciclo 2 · ⚠️ CORRECCIÓN del ciclo 1

**El ciclo 1 analizó una ventana equivocada.** Se tomó 2026-06-18 → 2026-07-02
anclándose en el reloj del backend, cuando la fecha real era agosto. Todo el
snapshot y las 3 recomendaciones del ciclo 1 quedaron **~5 semanas desactualizados**.
Regla nueva: anclar SIEMPRE la ventana en la fecha del sistema (`date`), no en
`/health` ni en el último commit.

**Snapshot real — 14d (2026-07-27 → 2026-08-09):**

| Campaña | Gasto | Gasto/día | Alcance | Clicks | CTR | CPC |
|---|---|---|---|---|---|---|
| Ritual del Río | $69.994 | ~$5.000 | 43.885 | 3.023 | 3,36% | $23 |
| Pausa junto al río | $69.755 | ~$4.982 | 24.012 | 1.086 | 2,80% | **$64** |

**Comparado con la ventana de junio del ciclo 1:**

| | Ritual | Pausa |
|---|---|---|
| Gasto/día | $1.988 → $5.000 (**2,5x**) | $1.928 → $4.982 (**2,6x**) |
| CTR | 4,93% → 3,36% (−32%) | 4,63% → 2,80% (−40%) |
| CPC | $15 → $23 (+53%) | $21 → **$64 (+205%)** |
| Clicks | 1.597 → 3.023 | 1.079 → **1.086 (plano)** |

**Ventas reales (14d 27jul-9ago / 7d 3-9ago):**

| Programa | 14d | 7d |
|---|---|---|
| Pausa (`tinas_masajes`) | 17 res / $2.210.000 | 8 res / $1.120.000 |
| Ritual (`cabanas_tinas_masajes_1n`) | 9 res / $2.080.000 | 6 res / $1.350.000 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 8 res / $940.000 | 4 res / $620.000 |
| Refugio (`cabanas_tinas_masajes_2n`) | **0** | **0** |
| **Total sitio** | 82 res / $7.977.000 | 39 res / $4.275.000 |

**Hallazgos:**

1. **Pausa junto al río está quemando plata.** Gastó 2,6x más y trajo la misma
   cantidad de clicks (1.079 → 1.086). El CPC se triplicó a $64. Sus ventas
   subieron (9 → 17 res), pero eso es más consistente con vacaciones de invierno
   que con la pauta: la pauta entregó cero clicks incrementales por $42.000 extra.
2. **Fatiga de creatividad confirmada.** Ambas campañas siguen con creatividad y
   nombre de "junio 2026" corriendo hace ~7 semanas. CTR cayó 32-40% en ambas.
3. **Refugio pasó de $830.000 a CERO** reservas en 14 días. Sin pauta activa,
   y el programa de 2 noches desapareció de las ventas del período.

**Recomendación del ciclo 1 RETIRADA:** la nº3 proponía subir +50% el presupuesto
de ambas campañas. Con los datos reales eso es lo contrario de lo correcto para
Pausa — el presupuesto YA se subió ~2,6x y el retorno en clicks fue nulo. No se
ejecutó nada, por suerte.

**Addendum — la escritura en Meta NO funciona (token sin permiso).** Jorge pidió
pausar "Pausa junto al río"; el endpoint respondió 502 con error de Meta:

```
OAuthException code 200, subcode 4841013
"El usuario no tiene permiso para realizar esta acción"
```

El `META_ACCESS_TOKEN` de Render sirve para leer (`ads_read`) pero **no tiene
`ads_management`** — o el usuario detrás del token tiene rol *Analista* en la
cuenta `act_214650980544393` en vez de *Anunciante/Administrador*. Verificado tras
el intento: ambas campañas siguen **ACTIVE**, no quedó estado a medias.

Implicancia: mientras no se arregle el token, el loop **no puede** pasar de Nivel 2
a ejecutar nada — ni pausar, ni ajustar presupuesto. Todo cambio pasa por el panel.

**CAMBIO EJECUTADO — 2026-08-09, por Jorge desde el panel.**
"Pausa junto al río – junio 2026" (`120251270498180782`) → **PAUSED**
(verificado vía API tras el cambio). Ritual del Río sigue ACTIVE a ~$5.000/día.

**Qué debe medir el ciclo 3** (esto es un experimento, no solo un corte de gasto):
las ventas de `tinas_masajes` corrían en 17 res / $2.210.000 por 14d con la campaña
prendida. Comparar los 14d posteriores al 09-08 contra esa base:
- Si las ventas **se mantienen** → la pauta no las estaba generando (era temporada
  de invierno) y los ~$5.000/día eran desperdicio puro. Confirmaría la hipótesis.
- Si las ventas **caen** → la campaña sí aportaba pese al CPC de $64, y el problema
  era de eficiencia, no de inutilidad. Ahí correspondería relanzarla con
  creatividad nueva en vez de dejarla apagada.
Ojo con el confound: agosto avanza y las vacaciones de invierno terminan, así que
parte de cualquier caída es estacional. Mirar también `solo_tinas` como control.

---

### 2026-08-09 — Ciclo 2b · ⚠️⚠️ ERROR DE MÉTRICA: se midió lo que no era

**Los ciclos 1 y 2 usaron el endpoint equivocado.** Se usó
`/meta-ads/campaigns-with-insights`, que reporta *clicks de enlace* y `leads`
(action_type `lead`/`fb_pixel_lead`). Pero **Ritual y Pausa son campañas de
MENSAJES** (`objective: mensajes (conversaciones/WhatsApp)`): su resultado son
conversaciones iniciadas, y `leads` da 0 siempre. El CPC de "$64" que motivó pausar
Pausa medía una métrica que la campaña ni siquiera optimiza.

El endpoint correcto — el que el prompt del loop pedía desde el inicio — es
`/api/v1/brief/weekly` (`brief.go`), que ya entrega conversaciones, costo por
conversación **y** las cruza con reservas e ingresos reales por programa.

**Datos correctos, últimas 4 semanas (12-07 → 02-08), gasto vs VENTAS REALES:**

| | Pausa junto al río | Ritual del Río |
|---|---|---|
| Gasto | $118.733 | $139.978 |
| Conversaciones | 216 | 401 |
| Costo/conversación | $552 | $350 |
| **Reservas reales** | **47** | **17** |
| **Ingresos reales** | **$5.900.000** | **$3.900.000** |
| **Costo por reserva** | **$2.526** | **$8.234** |
| **ROAS** | **~50x** | **~28x** |

**Conclusión invertida:** por la regla madre del loop (ventas reales, no métricas de
plataforma), **Pausa era la MEJOR de las dos**, no la peor. Costaba más por
conversación pero convertía 2,8x mejor a reserva. Se recomendó pausar la campaña
más rentable de las dos.

**Matiz importante — ninguna de las dos muestra respuesta causal clara al gasto:**

| Semana | Pausa: gasto → reservas | Ritual: gasto → reservas |
|---|---|---|
| 14-06 | $0 → 4 | $0 → 4 |
| 28-06 | $35.000 → 7 | $34.997 → 5 |
| 12-07 | **$16.182 → 17** | $34.990 → 4 |
| 02-08 | $34.901 → 8 | $34.996 → 6 |

La mejor semana de Pausa (17 reservas) fue la de **medio presupuesto**. Ritual vende
4 reservas gastando $0 y 6 gastando $35.000/semana. Ambos programas venden solos;
el gasto no mueve la aguja de forma proporcional.

**Regla nueva para el loop:** antes de juzgar una campaña, leer su `objective`.
Campaña de mensajes → conversaciones + costo/conversación + reservas reales. NUNCA
juzgar por CPC de enlace. Y usar `/brief/weekly`, no `campaigns-with-insights`.

**ESTADO FINAL 2026-08-09:** Pausa se pausó y se **reactivó el mismo día** (ambas
acciones por Jorge desde el panel; verificado vía API: las dos campañas ACTIVE).
Neto: sin cambio de configuración, solo un corte de entrega de algunas horas el
09-08 — tenerlo en cuenta si esa fecha aparece como anomalía en los datos del
ciclo 3. **No se ejecutó ningún cambio real de estrategia; todo sigue como estaba.**

**Pendientes reales para el ciclo 3** (con la métrica correcta esta vez):
1. Ambas campañas llevan ~7 semanas con creatividad de junio; CTR de Ritual bajó de
   4,9% a 3,7%. La fatiga sigue siendo el problema de fondo, no el presupuesto.
2. Probar Pausa a medio presupuesto (~$16.000/semana), que es donde tuvo su mejor
   semana (17 reservas). Es una hipótesis a validar, no una certeza.
3. Ritual cuesta $8.234 por reserva vs $2.526 de Pausa, y vende 4 reservas/semana
   gastando $0. Es el candidato lógico a recortar si hay que recortar algo.
4. Refugio: $186.343 gastados históricamente para ROAS 2,68 — el peor de todos, y
   con `budget_pct_used` en 186%. Revisar antes de reactivar nada ahí.

---

### 2026-08-09 — Causa raíz del bloqueo de escritura (NO es el token)

Se rastreó el error `subcode 4841013` hasta su origen real. **No es el scope del
token ni un rol mal configurado: la cuenta operativa no le pertenece a Aremko.**

Permisos del usuario del sistema `claudeAremko` (ID `61589259339745`), en el
portfolio "Aremko Aguas Calientes":

| Cuenta publicitaria | Acceso |
|---|---|
| 43311853 | Acceso total |
| 323860814935576 | Administrar campañas ✓ |
| 455070225054110 (Cuenta Nueva, Refugio) | Acceso total |
| **214650980544393 (OPERATIVA)** | **Solo "Ver rendimiento"** |

Al intentar activar "Administrar campañas" en la operativa, Meta responde:

> "Un socio compartió este activo con tu negocio y le asignó permisos específicos.
> Solo puedes usar los permisos asignados. Si necesitas otros permisos, ponte en
> contacto con el negocio del socio propietario del activo para solicitarlos."

Los toggles están **bloqueados** y "Guardar" deshabilitado. La cuenta pertenece a
otro portfolio comercial que la compartió en modo lectura.

**Consecuencias:**
- El loop NO puede pasar a Nivel 3 sobre Ritual/Pausa/NAC por un motivo
  organizacional, no técnico. Regenerar el token no sirve de nada.
- Sí podría escribir en `455070225054110` y `43311853` (acceso total), pero ahí
  solo vive Refugio, que es la campaña de peor ROAS.
- Desbloquearlo requiere que el negocio dueño de `214650980544393` amplíe el
  permiso a "Administrar campañas". **Paso pendiente: identificar quién es ese
  dueño** (Configuración del negocio → Socios, o la ficha de la cuenta).
- Alternativa costosa si el dueño no colabora: reconstruir las campañas en una
  cuenta propia, perdiendo el aprendizaje acumulado del algoritmo.

**Dueño identificado (mismo día):** la ficha de la cuenta dice *"Propiedad de
Individua…"* — pertenece a un **individuo, no a un negocio**. Por eso "Socios" está
vacío y "Asignar socio" aparece deshabilitado: no hay empresa socia a quien pedirle
el permiso. Casi con certeza es el perfil personal de Facebook de Jorge (las
campañas más antiguas de esa cuenta son de 2019/2021, previas al portfolio
comercial). Jorge personalmente tiene control total — pausó y reactivó campañas hoy
sin problema —, pero `claudeAremko` pertenece al negocio, y al negocio solo se le
compartió lectura.

**Dos caminos para desbloquear (NINGUNO ejecutado, decisión de Jorge):**

- **A · Reclamar la cuenta para el portfolio** (arreglo definitivo): Configuración
  del negocio → Cuentas publicitarias → Agregar → "Reclamar una cuenta publicitaria".
  Luego asignar acceso total a `claudeAremko`. ⚠️ Mueve titularidad y medio de pago,
  no se deshace fácil, y la cuenta tiene campañas activas gastando. Hacerlo con calma.
- **B · Token de usuario personal** con `ads_management` en vez del usuario del
  sistema. Destraba rápido, pero los tokens personales expiran a los ~60 días y el
  loop se queda ciego cada dos meses.

Recomendación: A, sin apuro. La cuenta `43311853` y `455070225054110` sí son del
portfolio (acceso total) por si alguna vez conviene migrar campañas.

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

**Ejecución — Rec 1 (Jorge aprobó aplicarla el 2026-07-14).** Se guía paso a
paso; se marca cada acción al confirmarse. Recs 2 y 3 quedan en cola para el
próximo tramo.

- [x] **A1. Bajar presupuesto diario de Pausa a $1.900/día** — ✅ HECHO
  2026-07-14 (Jorge). Confirmado: estaba en **$5.000/día** a nivel de conjunto
  de anuncios (ABO, objetivo "Interacción"), campaña "Pausa junto al río –
  junio 2026", cuenta operativa `214650980544393`. Cambiado a **$1.900/día** y
  publicado. Enfría el gasto sobre el creativo fatigado (CTR 3,76% / CPC $24)
  hasta rotar creativo.
- [x] **A2. Definir 2 conceptos de creativo nuevos para Pausa** (hooks + copy +
  qué toma usar). ✅ ENTREGADO por Claude en Ciclo 4 (2026-07-15) — ver los 2
  conceptos completos en la entrada de ese ciclo, abajo.
- [ ] **A3. Conseguir/elegir las tomas** (B-roll tina+masaje, sin persona a
  cámara) para los 2 creativos. Lo hace Jorge.
- [ ] **A4. Subir los 2 anuncios nuevos** al ad set de Pausa y pausar el
  creativo viejo fatigado (Jorge en UI, guiado).
- [ ] **A5. Documentar en bitácora** presupuesto final + creativos cargados con
  fecha, para evaluar en el Ciclo 4.

### 2026-07-15 — Ciclo 4

**Ventana:** 2026-07-01 → 2026-07-14 (14d). Fuentes: `campaigns-with-insights`
(backend Go en Render) + `family-combinations-range` (Django, ventas reales,
mismo rango). Corrida autónoma (Jorge ausente): el output es la lista de
acciones lista para ejecutar cuando aparezca en sesión interactiva.

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Impres. | Clicks | CTR | CPC | Cuenta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $68.975 | 38.753 | 80.136 | 3.425 | 4,27% | $20,14 | operativa `214650…` |
| Pausa junto al río – junio 2026 | ACTIVE | $65.748 | 37.771 | 73.384 | 2.537 | 3,46% | $25,92 | operativa `214650…` |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** | $0 | — | — | — | — | — | vieja `455070…` |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — | — | — |

Gasto total 14d: **~$134.723 CLP (~$9.623/día, ~50/50)** — prácticamente plano
vs Ciclo 3 (~$139.997). ⚠️ **A1 (bajar Pausa a $1.900/día) se aplicó el 07-14,
el ÚLTIMO día de esta ventana** → su efecto todavía NO es medible; el gasto de
Pausa ($65.748 ≈ $4.696/día) refleja aún ~$5.000/día durante casi todo el
período. El rebalanceo 65/35 hacia Ritual (Ciclo 3 rec #2) NO se aplicó.

**Ventas reales del período (bridge Django, 14d alineado):**

| Programa (combinación) | Ciclo 4 (14d) | Ciclo 3 (14d) | Ticket prom. |
|---|---|---|---|
| Ritual (`cabanas_tinas_masajes_1n`) | 12 res / $2.670.000 | 10 res / $2.255.000 | $222.500 |
| Pausa (`tinas_masajes`) | 21 res / $2.530.000 | 15 res / $1.810.000 | $120.476 |
| Refugio (`cabanas_tinas_masajes_2n`) | 4 res / $1.155.000 | 5 res / $1.425.000 | $288.750 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 6 res / $952.100 | 6 res / $992.100 | $158.683 |
| **Total sitio (todas las combinaciones)** | 90 res / $10.326.100 | 89 res / $9.941.099 | — |

Lectura: los 2 programas CON pauta siguen creciendo con temporada de invierno —
Ritual 10→12 res, Pausa 15→21 res; ventas combinadas $4.065.000 →
**$5.200.000**. Con el gasto plano ($140k→$135k), la eficiencia ingreso/gasto de
los 2 pagados **subió de 29,0× a 38,6×** (sin atribución fina; parte es
temporada). **Refugio sigue siendo el mejor "vendedor gratis"** (4 res /
$1.155.000, ticket más alto $288.750) SIN pauta. Noche estable (6 res /
$952.100) también sin campaña.

**Comparación con Ciclo 3 (¿se implementó lo propuesto?):**
- ✅ **A1 — bajar Pausa a $1.900/día:** HECHO el 07-14 por Jorge (guiado). Pero
  al aplicarse el último día de la ventana, su efecto se evaluará recién en el
  Ciclo 5. El piso debe mantenerse hasta subir los creativos nuevos (A4).
- ✅ **A2 — 2 conceptos de creativo para Pausa:** ENTREGADO en este ciclo (abajo).
  Desbloquea A3 (tomas) y A4 (subir anuncios), que siguen a cargo de Jorge.
- ❌ **Rebalanceo 65/35 hacia Ritual (rec #2 Ciclo 3):** pendiente (sigue ~50/50).
- ❌ **Lanzar Refugio + Noche (recs Ciclos 1–3):** pendientes.
- 🆕 **Señal nueva — Ritual empieza a fatigarse también.** CTR 4,41%→**4,27%** y
  CPC $19→**$20,14** sobre el MISMO creativo "junio 2026" que ya lleva ~2 meses.
  Es el patrón temprano que tuvo Pausa antes de desplomarse a 3,46% / $25,92. Hay
  que adelantarse, no esperar a que repita.

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **[A2 cumplido] Cargar estos 2 creativos nuevos en el ad set de Pausa y
   pausar el viejo fatigado.** Ambos ángulo tina+masaje, B-roll del lugar SIN
   persona a cámara, landing `/pausa-junto-al-rio/`, precio $110.000 (dom–jue):

   - **Concepto A — "El calor que el invierno te debe".** Ángulo: contraste
     frío afuera / vapor de la tina caliente junto al río; vacaciones de invierno
     = permiso para parar.
     - *Hook (texto en pantalla, primeros 2 s):* "Julio. Frío afuera. Vapor
       subiendo del agua caliente junto al río."
     - *Copy primario:* "No hace falta viajar lejos para desconectar. Una tina
       caliente junto al río + un masaje, en la misma tarde. Volvés a casa
       nuevo/a. Pausa junto al río desde $110.000 (dom a jue)."
     - *Tomas (B-roll):* vapor saliendo de la tina al aire frío, agua del río
       corriendo, aceites y toalla, camilla de masaje con vista al bosque.
     - *CTA:* "Reservá tu Pausa" → `/pausa-junto-al-rio/`
   - **Concepto B — "Media tarde para vos".** Ángulo: pausa de medio día,
     accesible desde la ciudad (≤45 min), sin quedarte a dormir; ticket de entrada.
     - *Hook:* "¿Cuánto hace que no te tomás una tarde solo para vos?"
     - *Copy primario:* "Tina caliente + masaje relajante, en una sola tarde
       junto al río. A menos de 45 minutos de la ciudad. Tu Pausa desde $110.000."
     - *Tomas (B-roll):* luz de tarde de invierno, primer plano del agua
       humeante, detalle de manos de masaje, naturaleza alrededor. Texto en
       pantalla.
     - *CTA:* "Agendá tu Pausa" → `/pausa-junto-al-rio/`

   Falta que Jorge consiga/elija las tomas (A3) y suba los 2 anuncios pausando el
   creativo viejo (A4). Mantener el piso de $1.900/día HASTA que estén arriba.

2. **Rotar TAMBIÉN el creativo de Ritual — adelantarse a la fatiga, no repetir el
   error de Pausa.** Ritual empezó a caer (CTR 4,27%, CPC $20,14) sobre el mismo
   anuncio "junio 2026" de 2 meses. Antes de que se profundice como en Pausa,
   preparar 1 creativo fresco de Ritual con ángulo invierno (cabaña + tina +
   masaje + desayuno, la noche completa junto al río) y renombrar la campaña a
   "julio – vacaciones de invierno". Barato de hacer ahora, caro de arreglar
   después (lo demostró Pausa).

3. **Cuando se libere el gasto de Pausa, aplicar el rebalanceo 65/35 pendiente y
   financiar Refugio con eso.** A1 dejó ~$3.100/día libres de Pausa. En vez de
   pedir presupuesto nuevo: mover el mix a ~$6.500/día Ritual / $1.900/día Pausa
   y usar el remanente para lanzar Refugio en la cuenta operativa `214650…`
   duplicando la estructura de Ritual (ticket $288.750, mejor vendedor gratis 4
   ciclos seguidos). Une las recs pendientes #2 y #3 del Ciclo 3 con la fuente de
   fondos que ya existe.

**Acciones concretas para la próxima sesión interactiva (Jorge presente):**
1. Subir Concepto A y Concepto B como 2 anuncios nuevos en el ad set de Pausa;
   pausar el creativo "junio 2026" viejo (A4). Requiere que Jorge tenga las tomas.
2. Rotar el creativo de Ritual (nuevo, ángulo invierno) + renombrar a "julio".
3. Rebalancear presupuesto a ~65/35 Ritual/Pausa.
4. Lanzar Refugio en la cuenta operativa duplicando Ritual, financiado con el
   gasto liberado de Pausa.

Recs 2–4 quedan en cola; se evalúan en el Ciclo 5 junto con el efecto real de
A1 (piso de Pausa) que este ciclo aún no pudo medir.

### 2026-07-18 — Ciclo 5

**Ventana:** 2026-07-04 → 2026-07-17 (14d). Fuentes: `campaigns-with-insights`
(backend Go en Render) + `family-combinations-range` (Django, ventas reales,
mismo rango). Corrida autónoma (Jorge ausente): el output es la lista de
acciones lista para ejecutar cuando aparezca en sesión interactiva.

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Impres. | Clicks | CTR | CPC | Cuenta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $69.397 | 43.154 | 87.194 | 3.647 | 4,18% | $19,03 | operativa `214650…` |
| Pausa junto al río – junio 2026 | ACTIVE | $54.109 | 34.420 | 62.638 | 2.120 | 3,38% | $25,52 | operativa `214650…` |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** | $0 | — | — | — | — | — | vieja `455070…` |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — | — | — |

Gasto total 14d: **~$123.506 CLP (~$8.822/día)** — baja ~8% vs Ciclo 4
(~$134.723). Toda la baja viene de Pausa: su gasto cayó **−18%** ($65.748 →
$54.109) porque A1 (piso de $1.900/día, aplicado el 07-14) ya opera en la cola
de esta ventana. Ritual quedó plano (~$69k). El rebalanceo 65/35 hacia Ritual
(rec pendiente) sigue sin aplicarse.

**Ventas reales del período (bridge Django, 14d alineado):**

| Programa (combinación) | Ciclo 5 (14d) | Ciclo 4 (14d) | Ticket prom. |
|---|---|---|---|
| Ritual (`cabanas_tinas_masajes_1n`) | 9 res / $2.010.000 | 12 res / $2.670.000 | $223.333 |
| Pausa (`tinas_masajes`) | 25 res / $3.010.000 | 21 res / $2.530.000 | $120.400 |
| Refugio (`cabanas_tinas_masajes_2n`) | 4 res / $1.155.000 | 4 res / $1.155.000 | $288.750 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 8 res / $1.285.000 | 6 res / $952.100 | $160.625 |
| **Total sitio (todas las combinaciones)** | 106 res / $11.361.099 | 90 res / $10.326.100 | — |

Lectura: **el sitio marca récord del loop ($11,36M, 106 res)**, pero la mezcla se
invirtió respecto a lo que la pauta empujaba. Los 2 programas pagados: gasto
$123.506 → ventas $5.020.000 = **40,6× ingreso/gasto** (vs 38,6× Ciclo 4, sin
atribución fina). Dentro de ese total, dos movimientos opuestos y muy
informativos:

- **Ritual CAE por primera vez en el loop: 12 → 9 res (−25%) con gasto plano.**
  Es exactamente lo que se advirtió en el Ciclo 4 (CTR 4,41→4,27→**4,18%** en 3
  ciclos sobre el mismo creativo "junio 2026" de ~2 meses). La rec #2 del Ciclo 4
  (rotar el creativo de Ritual para adelantarse) NO se ejecutó, y la fatiga ya no
  es sólo señal de CTR: bajó las ventas del programa de mayor ticket.
- **Pausa SUBE 21 → 25 res (+19%) MIENTRAS se le BAJÓ el gasto (−18%).** Esto
  valida A1: recortar el presupuesto sobre el creativo fatigado (CTR 3,38%, CPC
  $25,52, el peor) NO dañó las ventas — al contrario. Confirma que las ventas de
  Pausa hoy las mueve la temporada/orgánico, no el anuncio cansado. El piso debe
  quedarse; el gasto liberado rinde más en otro lado.
- **Noche crece a 8 res / $1.285.000 (+33%, su mejor cifra en varios ciclos) y
  Refugio se mantiene (4 res, ticket más alto $288.750)** — ambos siguen
  vendiendo SIN un peso de pauta, 5 ciclos seguidos.

**Comparación con Ciclo 4 (¿se implementó lo propuesto?):**
- ✅ **A1 — piso de Pausa $1.900/día:** operando y VALIDADO. Efecto medible este
  ciclo: gasto −18%, ventas +19%. Recortar no costó ventas.
- ❌ **A4 — subir los 2 creativos nuevos de Pausa (Conceptos A/B) y pausar el
  viejo:** NO se hizo. Por eso Pausa sigue con CTR 3,38% / CPC $25,52. Bloqueado
  en A3 (Jorge debe conseguir las tomas B-roll).
- ❌ **Rec #2 Ciclo 4 — rotar creativo de Ritual:** NO se hizo → la fatiga bajó
  las ventas de Ritual este ciclo. Ya no es preventivo, es correctivo urgente.
- ❌ **Rebalanceo 65/35 y lanzar Refugio + Noche:** siguen pendientes (recs Ciclos
  1–4).

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **Rotar el creativo de Ritual YA — pasó de preventivo a correctivo.** Ritual
   perdió 3 reservas este ciclo sobre el mismo anuncio "junio 2026". Entrego el
   concepto listo para producir (mismo formato que los de Pausa del Ciclo 4:
   B-roll del lugar SIN persona a cámara, landing `/ritual-del-rio/`, precio
   $210.000 dom–jue / $240.000 vie–sáb, y renombrar la campaña a
   "julio – vacaciones de invierno"):

   - **Concepto Ritual — "La noche que el invierno pide".** Ángulo: la noche
     completa junto al río en temporada de frío — cabaña + tina caliente + masaje
     + desayuno, el ritual entero, no una escapada de tarde.
     - *Hook (texto en pantalla, primeros 2 s):* "Una noche de invierno junto al
       río: tina caliente, masaje y despertar sin apuro."
     - *Copy primario:* "Cabaña para dos, tina caliente humeando junto al río,
       masaje para soltar la semana y desayuno sin reloj a la mañana siguiente.
       El ritual completo, en plena temporada de invierno. Ritual del Río desde
       $210.000 (dom a jue)."
     - *Tomas (B-roll):* vapor de la tina subiendo al aire frío al atardecer,
       interior cálido de la cabaña con luz baja, camilla de masaje con vista al
       bosque, mesa de desayuno junto a la ventana con el río de fondo.
     - *CTA:* "Reservá tu noche" → `/ritual-del-rio/`

   Subir este anuncio al ad set de Ritual y pausar el "junio 2026" fatigado.
   Falta que Jorge consiga/elija las tomas (puede reutilizar B-roll de invierno
   que ya tenga).

2. **Fijar el piso de Pausa como definitivo y desbloquear A4 con material que ya
   existe.** A1 demostró que Pausa no necesita el gasto alto para vender; lo que
   la frena es el CTR del creativo cansado. En vez de seguir esperando tomas
   nuevas (A3 lleva 2 ciclos trabado), **cargar los Conceptos A/B del Ciclo 4 con
   fotos/clips de invierno que Aremko ya tenga en el disco** (banco de fotos web),
   pausar el creativo viejo, y mantener Pausa en $1.900/día. Perfecto es enemigo
   de hecho: cualquier creativo fresco supera al que está en 3,38%.

3. **Lanzar Refugio con el gasto liberado de Pausa — 5 ciclos de demanda probada
   sin pauta, ya no hay excusa de presupuesto.** A1 dejó ~$3.100/día libres de
   Pausa. Refugio vende solo (4 res/ciclo, ticket $288.750, el más alto) y Noche
   viene subiendo (8 res, +33%). Prioridad a **Refugio** por ticket: duplicar en
   la cuenta operativa `214650…` la estructura de Ritual, landing del Refugio,
   presupuesto de prueba ~$1.900/día tomado del gasto que Pausa ya no usa —
   presupuesto total del sistema no sube. (Noche queda como el siguiente en cola.)

**Acciones concretas para la próxima sesión interactiva (Jorge presente):**
1. Rotar Ritual: subir el "Concepto Ritual – La noche que el invierno pide",
   pausar el "junio 2026" y renombrar la campaña a "julio – vacaciones de
   invierno". (Correctivo #1 — la fatiga ya baja ventas.)
2. Subir Conceptos A/B de Pausa con fotos de invierno del banco existente, pausar
   el creativo viejo, mantener piso $1.900/día (A4, desbloqueado sin esperar A3).
3. Lanzar Refugio en la cuenta operativa duplicando Ritual, ~$1.900/día
   financiado con el gasto liberado de Pausa (sin subir el total).

Se evalúan en el Ciclo 6: efecto de la rotación de Ritual en su CTR/ventas, y si
Refugio pagado mueve la aguja sobre su venta orgánica.

### 2026-07-21 — Ciclo 6

**Ventana:** 2026-07-07 → 2026-07-20 (14d). Fuentes: `campaigns-with-insights`
(backend Go en Render) + `family-combinations-range` (Django, ventas reales,
mismo rango). Corrida autónoma (Jorge ausente): el output es la lista de
acciones lista para ejecutar cuando aparezca en sesión interactiva.

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Impres. | Clicks | CTR | CPC | Cuenta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $69.684 | 44.383 | 91.479 | 3.738 | 4,09% | $18,64 | operativa `214650…` |
| Pausa junto al río – junio 2026 | ACTIVE | $47.839 | 30.204 | 52.953 | 1.812 | 3,42% | $26,40 | operativa `214650…` |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** | $0 | — | — | — | — | — | vieja `455070…` |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — | — | — |

Gasto total 14d: **~$117.523 CLP (~$8.394/día)** — baja ~5% vs Ciclo 5
(~$123.506). El mix se inclinó a **59/41 Ritual/Pausa** (ya no 50/50): no por un
rebalanceo activo, sino porque el piso de Pausa (A1, $1.900/día) sigue enfriando
su gasto (−12% vs Ciclo 5, $54.109 → $47.839) mientras Ritual quedó plano
(~$69k). ⚠️ **Dato clave: el gasto que Pausa liberó NO se está redesplegando —
se está ahorrando.** El total del sistema bajó, Ritual no absorbió esos pesos y
Refugio sigue en $0. Hay ~$3.100/día ociosos.

**Ventas reales del período (bridge Django, 14d alineado):**

| Programa (combinación) | Ciclo 6 (14d) | Ciclo 5 (14d) | Ticket prom. |
|---|---|---|---|
| Ritual (`cabanas_tinas_masajes_1n`) | 10 res / $2.220.000 | 9 res / $2.010.000 | $222.000 |
| Pausa (`tinas_masajes`) | 26 res / $3.220.000 | 25 res / $3.010.000 | $123.846 |
| Refugio (`cabanas_tinas_masajes_2n`) | 4 res / $1.155.000 | 4 res / $1.155.000 | $288.750 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 7 res / $1.125.000 | 8 res / $1.285.000 | $160.714 |
| **Total sitio (todas las combinaciones)** | 111 res / $11.944.099 | 106 res / $11.361.099 | — |

Lectura: **el sitio marca nuevo récord del loop ($11,94M, 111 res)**, tercer ciclo
consecutivo al alza. Los 2 programas pagados: gasto $117.523 → ventas $5.440.000
= **46,3× ingreso/gasto** (vs 40,6× Ciclo 5 — mejor cifra del loop; sin
atribución fina, parte es temporada de invierno). Movimientos por línea:

- **Ritual se estabiliza: 9 → 10 res (+1) con gasto plano, y el CPC MEJORÓ**
  ($19,03 → $18,64). El desplome del Ciclo 5 (12→9) no continuó. Pero el CTR
  sigue erosionándose lento (4,18% → **4,09%**) sobre el mismo creativo "junio
  2026" de ~2,5 meses. No está en pánico; está en una meseta frágil.
- **Pausa vuelve a subir: 25 → 26 res MIENTRAS su gasto baja otro −12%.** Segundo
  ciclo que confirma A1: menos plata sobre el creativo cansado (CTR 3,42%, CPC
  $26,40, el peor) no daña las ventas. Lo que la mueve es temporada/orgánico, no
  el anuncio. El piso se queda.
- **Refugio: 6º ciclo seguido vendiendo SIN un peso de pauta** (4 res, ticket
  $288.750, el más alto de todos). **Noche baja levemente** (8 → 7 res), también
  sin campaña.

**Comparación con Ciclo 5 (¿se implementó lo propuesto?):**
- ✅ **A1 — piso de Pausa $1.900/día:** operando y re-validado (2º ciclo). Gasto
  −12%, ventas +1 res. Recortar sigue sin costar ventas.
- ❌ **A4 — subir Conceptos A/B de Pausa y pausar el viejo:** NO se hizo (3er
  ciclo trabado). Pausa sigue en CTR 3,42%. El bloqueo declarado es A3 (Jorge
  debe conseguir las tomas B-roll).
- ❌ **Rotar creativo de Ritual (rec #1 Ciclo 5, "correctivo urgente"):** NO se
  hizo. La venta no siguió cayendo, pero el CTR sigue bajando sobre el creativo
  viejo.
- ❌ **Lanzar Refugio con el gasto liberado de Pausa (rec #3):** NO se hizo. La
  plata liberada quedó ociosa (ver arriba), no se redirigió.

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **El bloqueo de A3 ("Jorge tiene que conseguir las tomas") ES FALSO — el
   propio agente puede PRODUCIR los 3 creativos pendientes esta semana desde el
   banco de clips, sin que Jorge grabe nada.** Lleva 3 ciclos frenado esperando
   material que ya existe: hay banco de clips catalogado (disco JAguilera) +
   skills `/video-aremko` y `/historia-aremko` que montan video/imagen 9:16 desde
   tomas reales, y ya se validó producción sin watermark. Acción concreta:
   autorizar al agente a producir los **3 creativos** — Concepto A y Concepto B de
   Pausa (Ciclo 4) + "Concepto Ritual – La noche que el invierno pide" (Ciclo 5) —
   desde el banco de clips de invierno, entregarlos en ~/Desktop para el OK de
   Jorge, y que Jorge solo los SUBA. Convierte 3 ítems trabados (A4 + rotación
   Ritual) en 1 entregable producible ya. Perfecto es enemigo de hecho:
   cualquier creativo fresco supera a Pausa en 3,42% y a Ritual en erosión.

2. **La plata que Pausa liberó está ociosa: úsala YA para lanzar Refugio —
   presupuesto cero adicional.** Dato nuevo de este ciclo: el gasto total bajó
   ($123.506 → $117.523), Ritual no absorbió lo de Pausa y Refugio sigue en $0 →
   ~$3.100/día no se están gastando. Refugio lleva **6 ciclos** vendiendo solo
   (ticket $288.750, el más alto). Reducirlo a su mínimo accionable: en la cuenta
   operativa `214650…`, **duplicar la campaña de Ritual**, cambiar landing a la de
   Refugio y fijar **$1.900/día** tomados del gasto ocioso de Pausa. Es un puñado
   de clics, no "armar de cero", y el total del sistema no sube.

3. **Ritual se estabilizó — aprovechar esta ventana de calma para rotar SIN
   pánico y corregir el nombre.** A diferencia del Ciclo 5 (caída de ventas), hoy
   Ritual recuperó (9→10) y su CPC mejoró: no hay urgencia correctiva, y por eso
   mismo es el momento de bajo riesgo para cambiar el creativo de 2,5 meses antes
   de que el CTR (4,09% y bajando) arrastre otra vez las ventas. Va incluido en la
   producción del punto #1; sumar el renombre pendiente de campaña **"junio 2026"
   → "julio – vacaciones de invierno"** (vencido hace 3 semanas).

**Acciones concretas para la próxima sesión interactiva (Jorge presente):**
1. **Autorizar al agente a producir los 3 creativos** (Pausa A, Pausa B, Ritual
   invierno) desde el banco de clips → entrega en ~/Desktop para OK. Desbloquea A4
   y la rotación de Ritual sin esperar tomas nuevas.
2. Subir los 2 de Pausa al ad set y pausar el "junio 2026" viejo; mantener piso
   $1.900/día. Subir el de Ritual y pausar su "junio 2026"; renombrar la campaña a
   "julio – vacaciones de invierno".
3. Lanzar Refugio en la cuenta operativa `214650…` duplicando Ritual, $1.900/día
   financiado con el gasto ocioso de Pausa (total no sube).

Se evalúan en el Ciclo 7: si los creativos producidos por el agente se subieron y
movieron el CTR de Pausa (3,42%) y Ritual (4,09%), y si Refugio pagado mueve la
aguja sobre su venta orgánica de 6 ciclos.

### 2026-07-27 — Ciclo 7

**Ventana:** 2026-07-13 → 2026-07-26 (14d). Fuentes: `campaigns-with-insights`
(backend Go en Render) + `family-combinations-range` (Django, ventas reales,
mismo rango). Corrida autónoma (Jorge ausente): el output es la lista de
acciones lista para ejecutar cuando aparezca en sesión interactiva.

**Snapshot Meta Ads (14d):**

| Campaña | Estado | Gasto CLP | Alcance | Impres. | Clicks | CTR | CPC | Cuenta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $69.984 | 47.800 | 101.725 | 3.917 | 3,85% | $17,87 | operativa `214650…` |
| Pausa junto al río – junio 2026 | ACTIVE | $48.978 | 27.441 | 47.169 | 1.408 | **2,99%** | **$34,79** | operativa `214650…` |
| Refugio Aremko - Lanzamiento Junio 2026 | **PAUSED** | $0 | — | — | — | — | — | vieja `455070…` |
| Noche de Aguas Calientes | **no existe campaña** | — | — | — | — | — | — | — |

Gasto total 14d: **~$118.962 CLP (~$8.497/día)**, mix 59/41 Ritual/Pausa —
prácticamente igual que el Ciclo 6 ($117.523). Ningún creativo nuevo se subió;
ambas campañas siguen con el anuncio "junio 2026" (ya ~3 meses).

⚠️ **Hallazgo nuevo: el piso de Pausa (A1, $1.900/día) NO está topando el gasto.**
Esta es la primera ventana casi íntegramente posterior a A1 (13 de 14 días) y
Pausa gastó **$3.498/día — 84% por encima del piso que se creía aplicado** (a
$1.900/día habría gastado ~$26.600 en la ventana, no $48.978). Su gasto además
dejó de bajar (+2,4% vs Ciclo 6) tras dos ciclos de caída. Lo más probable es que
la campaña tenga más de un conjunto de anuncios activo, o presupuesto a nivel
campaña (CBO), y que A1 sólo haya tocado un ad set.

**Ventas reales del período (bridge Django, 14d alineado):**

| Programa (combinación) | Ciclo 7 (14d) | Ciclo 6 (14d) | Ticket prom. |
|---|---|---|---|
| Pausa (`tinas_masajes`) | **30 res / $3.660.000** | 26 res / $3.220.000 | $122.000 |
| Ritual (`cabanas_tinas_masajes_1n`) | **8 res / $1.820.000** | 10 res / $2.220.000 | $227.500 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | **11 res / $1.830.000** | 7 res / $1.125.000 | $166.364 |
| Refugio (`cabanas_tinas_masajes_2n`) | **1 res / $370.000** | 4 res / $1.155.000 | $370.000 |
| **Total sitio (todas las combinaciones)** | 124 res / $12.419.098 | 111 res / $11.944.099 | — |

Lectura: **cuarto récord consecutivo del sitio ($12,42M, 124 res, +4%)**, pero por
dentro la mezcla se dio vuelta. Los 2 pagados: gasto $118.962 → ventas $5.480.000
= **46,1× ingreso/gasto** (plano vs 46,3× del Ciclo 6; sin atribución fina).

- **Rotación de la demanda hacia ticket bajo.** Los dos programas más baratos
  crecen fuerte — Pausa $122k/ticket +15% en reservas, Noche $166k/ticket **+57%
  (11 res, récord del loop)** — mientras los dos caros caen: Ritual $227k −20%
  (10→8) y Refugio $370k **−75% (4→1)**. Coincide con el cierre del tramo alto de
  vacaciones de invierno (confirmar fechas exactas del calendario escolar antes de
  fijar el mensaje de agosto), pero el patrón es nítido en las 4 líneas a la vez.
- **Refugio se desploma por primera vez en el loop.** Venía 6 ciclos vendiendo
  solo (4 res estables) y este ciclo hizo 1 reserva. La tesis de "vende gratis, se
  puede esperar" se cayó: la demanda orgánica que justificaba postergar su
  lanzamiento se agotó, y no hay pauta que la sostenga.
- **Pausa: el creativo ya está en zona crítica.** CTR **2,99%** (primera vez bajo
  3%; venía 3,42%) y CPC **$34,79 (+32%)**, el peor de todo el loop. Con el gasto
  plano se compraron **404 clicks menos (−22%)**. Sus ventas igual subieron a 30
  res, lo que reconfirma por tercer ciclo que a Pausa la mueve
  temporada/orgánico, no el anuncio.
- **Ritual: más tráfico, peor tráfico.** Con gasto plano compró +11% impresiones y
  +4,8% clicks que el Ciclo 6 — pero vendió 2 reservas menos. Meta está
  consiguiendo clicks más baratos ($17,87) y más fríos (CTR 3,85%, nuevo mínimo).
  Es la segunda caída de ventas de Ritual en tres ciclos.

**Comparación con Ciclo 6 (¿se implementó lo propuesto?):** NADA se ejecutó.
- ❌ **Producir los 3 creativos desde el banco de clips (rec #1):** no se hizo →
  4º ciclo trabado. Pausa cayó a 2,99% / $34,79 y Ritual a 3,85%.
- ❌ **Lanzar Refugio con el gasto ocioso (rec #2):** no se hizo → y esta vez costó
  caro: Refugio pasó de 4 res a 1.
- ❌ **Rotar Ritual + renombrar "junio 2026" (rec #3):** no se hizo (el nombre lleva
  ~4 semanas vencido).
- 🆕 **A1 no está topando el gasto de Pausa** (ver hallazgo arriba): el supuesto de
  los Ciclos 5 y 6 de que había "~$3.100/día ociosos y liberados" era optimista —
  esa plata en realidad sigue gastándose en el creativo más caro del sistema.

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **Auditar y cerrar de verdad el presupuesto de Pausa — A1 quedó a medias.**
   Dato nuevo: con A1 vigente 13 de 14 días, Pausa gastó $3.498/día contra el piso
   de $1.900/día que la bitácora daba por aplicado. Casi seguro hay más de un
   conjunto de anuncios activo (o presupuesto a nivel campaña). Acción: abrir la
   campaña "Pausa junto al río – junio 2026" en `214650…`, listar **todos** los ad
   sets ACTIVOS con su presupuesto, dejar uno solo en $1.900/día y apagar el resto.
   Es el gasto peor rentado del sistema (CPC $34,79, CTR 2,99%) y liberar esos
   ~$1.600/día reales es lo que financia el punto 2.

2. **Cambiar la prioridad de lanzamiento: Noche de Aguas Calientes ANTES que
   Refugio.** Los Ciclos 3–6 priorizaron Refugio por ticket ($288k–$370k). Ese
   criterio quedó desmentido por los datos: este ciclo Noche hizo **11 res /
   $1.830.000** (récord, más facturación que Ritual, que sí tiene pauta) y Refugio
   **1 res / $370.000**. Además Noche es ticket bajo, justo donde se movió la
   demanda. Acción: duplicar la campaña de Ritual en la cuenta operativa
   `214650…`, cambiar landing a Noche de Aguas Calientes, **$1.900/día** tomados
   del recorte del punto 1 (total del sistema no sube). Refugio pasa a segundo en
   cola — y su desplome sugiere que necesita un ángulo propio, no sólo pauta.

3. **Rehacer el brief de Ritual para agosto: el concepto "vacaciones de invierno"
   nace vencido.** El "Concepto Ritual – La noche que el invierno pide" (Ciclo 5)
   se apoya en vacaciones de invierno, y la rotación de demanda de este ciclo dice
   que ese empuje ya pasó. Acción: producir el creativo de Ritual con ángulo
   **escapada de fin de semana en agosto** (no vacaciones), abriendo con el precio
   ancla dom–jue $210.000 — el mercado de estas dos semanas eligió precio, no
   duración. Mantiene el B-roll sin persona a cámara y `/ritual-del-rio/`, y sigue
   sirviendo el renombre pendiente de campaña (a "agosto", ya no "julio").

**Acciones concretas para la próxima sesión interactiva (Jorge presente):**
1. Auditar los ad sets de Pausa y dejar UN solo ad set en $1.900/día (apagar el
   resto). Verifica de paso por qué A1 no topó el gasto.
2. Lanzar **Noche de Aguas Calientes** duplicando la campaña de Ritual en
   `214650…`, $1.900/día financiado con lo recortado en el paso 1.
3. Autorizar al agente a producir los creativos desde el banco de clips —
   ahora con el brief de Ritual actualizado a "agosto / escapada de fin de semana"
   y los Conceptos A/B de Pausa (Ciclo 4) — y subirlos pausando los "junio 2026".
4. Refugio: decidir si va con pauta + ángulo nuevo o se deja fuera del mix hasta
   primavera (cayó a 1 reserva).

Se evalúan en el Ciclo 8: si el gasto real de Pausa bajó a ~$1.900/día, si Noche
pagado supera sus 11 reservas orgánicas, y si Refugio rebota o confirma el
desplome.

### 2026-08-09 — Ciclo 8 · 🔴 TERCER ERROR DE MÉTRICA: el loop mide medio presupuesto

**Ventana:** Meta 2026-07-10 → 2026-08-09 (30d, serie semanal de `/brief/weekly`);
ventas reales 2026-07-26 → 2026-08-08 (14d, bridge Django). Corrida autónoma.

⚠️ **Nota de método:** este ciclo corre el MISMO día que los ciclos 2/2b, así que la
serie de Meta no avanzó (la última semana completa sigue siendo 02-08). El aporte de
este ciclo **no son datos nuevos sino un cruce que nunca se había hecho**: Google Ads.

**Snapshot Meta (30d, métrica correcta — campañas de mensajes):**

| Campaña | Estado | Gasto | Conversac. | Costo/conv | CTR | **Frecuencia** | Alcance |
|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $150.687 | 430 | $350 | 3,67% | **2,77** | 73.303 |
| Pausa junto al río – junio 2026 | ACTIVE | $129.166 | 234 | $552 | 2,98% | 2,10 | 46.556 |
| Refugio Aremko | **PAUSED** (cuenta vieja `455070…`) | $0 | — | — | — | — | — |
| Noche de Aguas Calientes | **no existe campaña** (9º ciclo) | — | — | — | — | — | — |

**Ventas reales (bridge Django, 14d 26-07 → 08-08):**

| Programa | Reservas | Ingresos | Ticket |
|---|---|---|---|
| Pausa (`tinas_masajes`) | 18 | $2.350.000 | $130.556 |
| Ritual (`cabanas_tinas_masajes_1n`) | 9 | $2.080.000 | $231.111 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | 8 | $940.000 | $117.500 |
| Refugio (`cabanas_tinas_masajes_2n`) | **0** | **$0** | — |
| **Total sitio** | 87 | $8.217.000 | — |

---

#### 🔴 Hallazgo 1 — Google Ads paga por los MISMOS programas y el loop nunca lo sumó

Semana 08-01 → 08-08, gasto publicitario real por programa:

| | Meta | Google Search | **Total real** | Reservas | Costo/reserva **solo-Meta** | Costo/reserva **REAL** |
|---|---|---|---|---|---|---|
| Ritual | $35.000 | $41.095 | **$76.095** | 6 | $5.833 | **$12.683** |
| Pausa | $34.915 | $40.729 | **$75.644** | 8 | $4.364 | **$9.455** |
| Refugio | $0 (pausada) | $26.496 | **$26.496** | **0** | — | **∞** |

**Meta es solo el 43% del gasto publicitario** ($82.566 de $190.886/semana). Los 8
ciclos anteriores calcularon costo por reserva y ROAS dividiendo las reservas totales
del programa por el gasto de UN canal, mientras el otro canal empujaba el mismo
programa en la misma semana. El ROAS "50x de Pausa" que motivó la corrección del
ciclo 2b es en realidad **14,8x**; el de Ritual, 17,7x.

Esto **no invierte** el ranking (Pausa sigue mejor que Ritual), pero sí destruye la
premisa de fondo de todo el loop: que estos programas "venden solos con gasto
ínfimo". No es gasto ínfimo — es gasto contado a medias.

**Regla nueva:** el costo por reserva se calcula por PROGRAMA sumando Meta + Google.
Ningún canal se juzga solo mientras ambos anuncien el mismo programa. Google reporta
**0 conversiones** en Ritual y Pausa esta semana, lo que reconfirma la regla madre
(no usar conversiones de plataforma) — pero el GASTO sí es real y hay que sumarlo.

#### 🔴 Hallazgo 2 — Refugio: 0 reservas reales y Google sigue gastando

Refugio lleva 14 días con **cero** reservas (`_2n` = 0), su campaña Meta está pausada
en la cuenta vieja… y **"Refugio - Search" sigue ENABLED en Google gastando
$26.496/semana**. Google reporta 1 conversión de $270.000 que las reservas reales no
respaldan. La pregunta pendiente del ciclo 7 ("¿Refugio va con pauta o sale del mix?")
tenía una premisa falsa: Refugio nunca estuvo sin pauta, estaba pagando en el otro canal.

#### 🟡 Hallazgo 3 — Ritual: la fuga está DESPUÉS del anuncio, no en el anuncio

6 semanas pagadas (28-06 → 02-08), solo Meta:

| | Gasto | Conversaciones | Reservas | **Conv → reserva** | Costo/conv |
|---|---|---|---|---|---|
| Ritual | $209.979 | 610 | 27 | **4,4%** | $344 |
| Pausa | $188.747 | 342 | 62 | **18,1%** | $552 |

Ritual compra conversaciones **1,6x más baratas** que Pausa y las convierte **4x
peor**. Son ~583 conversaciones en 6 semanas que no terminaron en reserva. Ocho ciclos
recomendando rotar creativo y mover presupuesto nunca miraron este tramo del embudo.
*Caveat honesto:* las reservas son totales del programa (no atribuidas), y Ritual es
un programa de menor volumen y ticket $231k vs $131k — parte de la brecha es
estructural, no una fuga. Pero 4x no se explica solo por eso.

#### 🟡 Hallazgo 4 — Frecuencia 2,77 en Ritual: es saturación, no (solo) fatiga

Métrica nunca reportada en el loop. Ritual va en **frecuencia 2,77** sobre 73.303
personas alcanzadas en 30 días, en una audiencia geo chica (Osorno + Pto. Montt +
Pto. Varas). La erosión de CTR (4,93% → 3,67% en 8 ciclos) acompaña a la frecuencia
subiendo. Si el problema es saturación de audiencia, **rotar el creativo no lo
arregla** — y explica por qué ese pendiente lleva 5 ciclos sin ejecutarse sin que
nada empeore dramáticamente.

---

**Estado de escritura:** sigue bloqueado a Nivel 2 por motivo organizacional (la
cuenta `214650980544393` es de un individuo y solo comparte lectura con el negocio).
Todas las acciones de abajo son manuales, en el panel.

**Acciones concretas para la próxima sesión interactiva (Jorge presente):**

1. **Apagar "Refugio - Search" en Google Ads.** Es el único gasto del sistema con
   0 reservas reales verificadas en 14 días ($26.496/semana). Ruta: Google Ads →
   Campañas → "Refugio - Search - Lanzamiento Junio 2026" → Estado → Pausar.
   Libera ~$3.785/día sin tocar nada que esté vendiendo. Es el corte de menor riesgo
   de todo el sistema y financia el punto 2 sin subir el presupuesto total.

2. **Test de canal único en Ritual por 2 semanas.** Ritual gasta $76.095/semana entre
   los dos canales para 6 reservas, y vendió 4 reservas con Meta en $0 (semana 14-06).
   Apagar **"Ritual del Río – Search"** en Google (0 conversiones, $41.095/semana) y
   dejar solo Meta. Si las reservas se mantienen en 4-6, el canal Search era
   redundante y quedan ~$5.870/día libres. Ruta: Google Ads → "Ritual del Río –
   Search" → Pausar. Medir contra la base de 6 res / $1.350.000 semanales.

3. **Auditar 20 conversaciones de WhatsApp de Ritual que no cerraron.** Antes de
   producir un creativo nuevo más (5 ciclos trabado), revisar el otro lado del embudo:
   por qué 610 conversaciones dieron 27 reservas. Hipótesis a descartar en orden:
   (a) shock de precio — el anuncio no muestra $210.000 y la conversación sí;
   (b) disponibilidad — se piden fechas que no hay (martes cerrado);
   (c) el agente no cierra ni deriva. Es diagnóstico barato y ataca un 4,4% que
   ningún cambio de creativo va a mover si la fuga está acá.

Se evalúan en el Ciclo 9: si el gasto total del sistema bajó de $190.886/semana sin
perder reservas (acciones 1 y 2), y qué mostró la auditoría de conversaciones (3).

### 2026-08-16 — Ciclo 9 · La "fuga del embudo" del Ciclo 8 no existía

**Ventana:** 2026-08-02 → 2026-08-15 (14d). Fuentes: `/brief/weekly` (conversaciones
— métrica correcta para campañas de mensajes) + `campaigns-with-insights` (alcance) +
`family-combinations-range` (Django, ventas reales, mismo rango). Corrida autónoma.

**⚠️ Ciego al otro canal.** La API de Google Ads sigue rechazando v21
(`UNSUPPORTED_VERSION`, `backend/internal/googleads/client.go:29`), ya documentado en
`LOOP_GOOGLE_ADS.md` Ciclo #5 con fix propuesto (v21 → v25). Consecuencia para ESTE
loop: **no se pueden verificar las acciones 1 y 2 del Ciclo 8** (apagar Refugio-Search
y el test de canal único en Ritual). Todos los costos por reserva de abajo son
**solo-Meta**, o sea subestimados — la regla del Ciclo 8 (sumar Meta + Google) no se
puede aplicar hasta que el fix esté arriba.

**Snapshot Meta (14d, métrica correcta — ambas son campañas de mensajes):**

| Campaña | Estado | Gasto | Gasto/día | Conversac. | Costo/conv | Reservas | Costo/reserva | ROAS solo-Meta |
|---|---|---|---|---|---|---|---|---|
| Ritual del Río - junio 2026 | ACTIVE | $69.992 | $4.999 | 142 | $493 | 12 | $5.833 | 42,0× |
| Pausa junto al río – junio 2026 | ACTIVE | $69.889 | $4.992 | 80 | $874 | 16 | $4.368 | 31,8× |
| Refugio Aremko | **PAUSED** (cuenta vieja `455070…`) | $0 | — | — | — | **0** | — | — |
| Noche de Aguas Calientes | **no existe campaña** (10º ciclo) | $0 | — | — | — | **12** | **$0** | ∞ |

Alcance/entrega: Ritual 89.022 impres. / 42.320 alcance / CPM $786 · Pausa 37.594
impres. / 23.568 alcance / **CPM $1.859 (2,4× el de Ritual)**. Frecuencia 30d: Ritual
2,76 · Pausa 2,13. Gasto total 14d **$139.881 (~$9.991/día, 50/50)**.

🔴 **El piso A1 de Pausa está muerto.** Nominal $1.900/día (jul-14); el Ciclo 7 midió
$3.498/día; hoy **$4.992/día** — de vuelta al nivel pre-A1. Nunca se auditaron los ad
sets (rec #1 del Ciclo 7), así que el gasto volvió solo.

**Ventas reales (bridge Django, 14d):**

| Programa | Ciclo 9 (14d) | Ciclo 8 (14d) | Ticket |
|---|---|---|---|
| Pausa (`tinas_masajes`) | 16 res / $2.224.000 | 18 res / $2.350.000 | $139.000 |
| Ritual (`cabanas_tinas_masajes_1n`) | **12 res / $2.939.000** | 9 res / $2.080.000 | $244.917 |
| Noche Aguas Calientes (`cabanas_tinas_1n`) | **12 res / $1.832.000** | 8 res / $940.000 | $152.667 |
| Refugio (`cabanas_tinas_masajes_2n`) | **0** | **0** | — |
| **Total sitio** | 88 res / $10.200.000 | 87 res / $8.217.000 | — |

**Serie semanal (lo que el promedio de 14d escondía):**

| Semana | Ritual | Noche | Pausa | Refugio | solo_tinas | Sitio | Gasto Pausa | Gasto Ritual |
|---|---|---|---|---|---|---|---|---|
| 05-07 | 5 | 2 | 8 | 4 | 18 | 42 | $35.000 | $35.000 |
| 12-07 | 4 | 5 | **17** | 1 | 29 | **65** | **$16.182** | $34.990 |
| 19-07 | 4 | 7 | 12 | 0 | 23 | 57 | $32.796 | $34.994 |
| 26-07 | 3 | 4 | 10 | 0 | 21 | 44 | $34.854 | $34.998 |
| 02-08 | 6 | 4 | 8 | 0 | 20 | 43 | $34.920 | $35.000 |
| 09-08 | 6 | **8** | 8 | 0 | 14 | 45 | $34.969 | $34.992 |

Dato de contexto que corrige la narrativa de los Ciclos 5–7: **el "récord del sitio" se
terminó.** El pico fue la semana del 12-07 (65 reservas); agosto corre estable en
43–45/semana, ~30% abajo. Lo que subió en el agregado de 14d es el ticket, no el volumen.

---

#### 🔴 Hallazgo 1 — La "fuga del embudo" de Ritual (Hallazgo 3 del Ciclo 8) era un artefacto

El Ciclo 8 midió que Ritual convertía conversación→reserva al **4,4%** contra 18,1% de
Pausa, y lo llamó una fuga de ~583 conversaciones. Este ciclo Ritual va en **8,5%**
(142 conv → 12 res): casi el doble, en 2 semanas.

**En Meta no cambió absolutamente nada.** Mismo creativo "junio 2026" (~3 meses), gasto
clavado en $35.000/semana por séptima semana seguida, mismo objetivo, misma audiencia.
Lo que sí cambió: el **08-08 el loop de Google subió el presupuesto de Ritual de $5.000
a $6.500/día** (`LOOP_GOOGLE_ADS.md` Ciclo #5).

El ratio conversación→reserva divide **reservas totales del programa** (no atribuidas)
por **conversaciones de un solo canal**. Cuando el otro canal mueve su presupuesto sobre
el mismo programa, el numerador se mueve y el denominador no. La "fuga" y su "curación"
son las dos el mismo artefacto de medición, con distinto signo.

**Regla nueva:** `conversación→reserva` **NO** es una métrica de calidad de creativo ni
de embudo mientras dos canales empujen el mismo programa. Solo sirve si el gasto del
otro canal está congelado y verificado. Es el mismo error de los Ciclos 1–8 (contar un
canal contra ventas de todos), ahora en versión ratio.

#### 🔴 Hallazgo 2 — Pausa: 4 semanas seguidas cayendo con gasto plano

| | Semana 12-07 | Semana 09-08 |
|---|---|---|
| Gasto | $16.182 | $34.969 (**2,2×**) |
| Conversaciones | 38 | 42 |
| **Reservas** | **17** | **8 (−53%)** |
| Share del sitio | 26% | 18% |

Serie completa de reservas: 17 → 12 → 10 → 8 → 8. La correlación gasto↔reservas de las
últimas 6 semanas es **−0,93** (−0,90 excluyendo la semana pico). *Caveat honesto:* con
el gasto casi constante entre $32.796 y $35.000, la correlación describe una caída
sostenida contra un gasto plano, **no** prueba causalidad — parte es el fin de las
vacaciones de invierno. Lo que sí es sólido: **duplicar el gasto respecto de la semana
de medio presupuesto no recuperó ni una reserva, y el CPM de Pausa ($1.859) es 2,4× el
de Ritual** — Meta cobra caro por entregar un anuncio que la gente ya no mira.

#### 🟢 Hallazgo 3 — La objeción de canibalización contra lanzar Noche no tiene sustento

El loop de Google decidió NO crear campaña para Noche de Aguas Calientes "para no
canibalizar a Ritual" (Ruta A, revalidada 3 veces). Este loop viene pidiendo lanzarla
desde el Ciclo 7. **Los dos loops dan órdenes opuestas sobre el mismo programa.**

Medido sobre las 6 semanas de arriba:

| Par | Correlación semanal |
|---|---|
| Ritual ↔ **Noche** | **+0,15** (independientes; si algo, suben juntos) |
| Ritual ↔ **Pausa** | **−0,56** |
| Noche ↔ solo_tinas | −0,13 |

Noche no le come reservas a Ritual: su mejor semana (8) es también la mejor de Ritual
(6). **El par que sí compite es Ritual ↔ Pausa** — los dos programas que hoy tienen
pauta, gastando $35.000/semana cada uno para pelearse la misma demanda. Con 6 puntos
esto es direccional, no concluyente, pero invierte la carga de la prueba: la
canibalización que se temía está en el par equivocado.

Mientras tanto Noche hizo **12 reservas / $1.832.000 con $0 de pauta en los dos
canales** — empata a Ritual en reservas, que costó $69.992 solo en Meta.

---

**Evaluación de las acciones del Ciclo 8:**
- ⬜ **Apagar "Refugio - Search" (acción 1):** no verificable (API caída). Vía indirecta:
  el loop de Google reporta que bajó a $1.500/día y propone pausarla. Refugio cumple
  **4 semanas seguidas en 0 reservas**.
- ⬜ **Test de canal único en Ritual (acción 2):** no verificable, y además **el loop de
  Google hizo lo contrario** (le subió el presupuesto de $5.000 a $6.500/día el 08-08).
  La acción quedó anulada por el otro loop sin que ninguno se enterara.
- ❌ **Auditar 20 conversaciones de WhatsApp de Ritual (acción 3):** no se hizo — y el
  Hallazgo 1 muestra que el 4,4% que la motivaba no era real. **Se retira.**
- ❌ **Rotar creativos (6º ciclo trabado)** y **auditar ad sets de Pausa (Ciclo 7):** no
  se hicieron. El gasto de Pausa volvió a $4.992/día por falta de esa auditoría.

**Recomendaciones nuevas (Nivel 2 — nada ejecutado, esperan respuesta de Jorge):**

1. **Retirar la rotación de creativo de Ritual de la cola y no tocar Ritual este ciclo.**
   Lleva 5 ciclos como "correctivo urgente" apoyada en señales que el Hallazgo 1 acaba
   de invalidar: Ritual es el programa que MÁS creció (9→12 res, $2,08M→$2,94M, ticket
   $244.917, el más alto del sistema) con el creativo viejo intacto y gasto congelado.
   Cambiarle el creativo ahora destruye la única línea que está subiendo, para corregir
   un problema que no se demostró que exista. Si más adelante se rota, que sea por
   frecuencia (2,76, la métrica que sí mide saturación), no por conv→reserva.

2. **Cortar Pausa a $2.000/día — auditando TODOS los ad sets, que es lo que nunca se
   hizo.** Es la acción con más evidencia acumulada del loop y la única que es un puñado
   de clics. Ruta exacta: Meta Ads Manager → cuenta `214650980544393` → campaña "Pausa
   junto al río – junio 2026" → pestaña **Conjuntos de anuncios** → filtrar por Estado =
   Activo. Si hay más de uno, dejar **uno solo en $2.000/día** y apagar el resto; si el
   presupuesto está a nivel campaña (CBO), cambiarlo ahí. Verificar a los 3 días que el
   gasto diario real sea ~$2.000 — el Ciclo 7 ya avisó que A1 no topó nada y nadie lo
   comprobó. Libera ~$3.000/día del gasto peor rentado del sistema.

3. **Zanjar la contradicción entre los dos loops sobre Noche, a favor de lanzarla —
   financiada con el recorte de Pausa.** El Hallazgo 3 quita la única objeción que
   existía (canibalizar a Ritual: r = +0,15). Noche lleva 10 ciclos vendiendo con $0 y
   este ciclo empató a Ritual en reservas. Acción: duplicar la campaña de Ritual en
   `214650…`, cambiar landing a Noche de Aguas Calientes, **$2.000/día tomados del
   recorte del punto 2** (el total del sistema no sube). Y anotar la decisión en
   `LOOP_GOOGLE_ADS.md` para que el otro loop no la revierta — los dos loops se pisaron
   este ciclo (ver evaluación de la acción 2 del Ciclo 8) y eso hay que cerrarlo.

**Acciones concretas para la próxima sesión interactiva (Jorge presente):**
1. Auditar los conjuntos de anuncios de Pausa y dejar UNO en $2.000/día (rec 2).
   Verificar el gasto real a los 3 días.
2. Lanzar **Noche de Aguas Calientes** duplicando Ritual en `214650…`, $2.000/día del
   recorte anterior (rec 3).
3. **No tocar Ritual** (rec 1) — dejarlo correr tal cual para tener una línea de control.
4. Aplicar el fix `client.go:29` (v21 → v25) que ya propone el loop de Google: sin él
   este loop no puede volver a calcular costo por reserva real ni verificar nada del
   canal Search.

Se evalúan en el Ciclo 10: si el gasto real de Pausa bajó a ~$2.000/día (y si sus
reservas aguantan las 8/semana), si Noche pagado supera sus 12 reservas orgánicas, si
Ritual sostiene 6 res/semana sin tocarlo, y si la API de Google volvió.

---

#### ✅ CAMBIOS EJECUTADOS — 2026-08-16, por Jorge desde el panel de Google Ads

Sesión interactiva del Ciclo 9. Antes de tocar nada se pidió a Jorge la foto del panel
de Google, porque **la API no reporta el motivo de limitación de una campaña** y ese
dato cambia la decisión. Estado real encontrado (cuenta `539-975-0827`):

| Campaña Google | Estado | Presupuesto | Motivo de limitación (solo visible en panel) |
|---|---|---|---|
| Ritual del Río – Search | ACTIVA | $6.500/día | 🔴 **Limitado por el PRESUPUESTO** |
| Pausa junto al río - Search | ACTIVA | $5.000/día | Limitada por **volumen de búsquedas** |
| Refugio - Search | ACTIVA | $1.500/día | Volumen + **conversiones mal configuradas** |
| **Total cuenta** | | **$13.000/día** | |

**Gasto real por programa (los dos canales), primera vez que el loop lo calcula:**

| Programa | Meta/día | Google/día | Total/día | Reservas 14d | Costo/reserva REAL |
|---|---|---|---|---|---|
| Ritual | $4.999 | $6.500 | $11.499 | 12 | **$13.416** |
| Pausa | $4.992 | $5.000 | $9.992 | 16 | **$8.743** |
| Refugio | $0 | $1.500 | $1.500 | **0** | **∞** |
| **Noche** | **$0** | **$0** | **$0** | **12** | **$0** |

- [x] **G1. Pausar "Refugio - Search - Lanzamiento Junio 2026"** — ✅ HECHO 2026-08-16.
  Verificado en pantalla: fila en "Detenido" y **Total: Cuenta $13.000 → $11.500/día**.
  Justificación: 4 semanas seguidas con 0 reservas reales, conversiones mal
  configuradas y limitada por volumen. Único renglón del sistema sin ninguna venta.
- [x] **G2. Subir "Ritual del Río – Search" de $6.500 a $8.000/día** — ✅ HECHO
  2026-08-16. Financiado con los $1.500/día liberados por G1; **el total de la cuenta
  vuelve a $13.000/día, no se agregó presupuesto nuevo.** Justificación: es la única
  campaña del sistema marcada "Limitado por el presupuesto" — demanda con intención de
  compra quedando sin atender — y es el programa de mayor ticket ($244.917) y el que
  más creció este ciclo. Cumple la condición que el loop de Google dejó escrita en su
  Ciclo #5 rec #3 ("mover los $1.500 a Ritual SOLO si el panel dice limitado por
  presupuesto").

**Acción del Ciclo 8 formalmente RETIRADA:** la nº2 proponía apagar "Ritual del Río –
Search" para un test de canal único. El panel muestra que esa campaña está topando
presupuesto: apagarla habría cortado la única línea con demanda insatisfecha del
sistema. Se hizo lo contrario y por buen motivo.

**A medir en el Ciclo 10:** Ritual venía en 12 res / $2.939.000 por 14d con $6.500/día
en Search. Con $8.000/día: si las reservas suben, el techo era presupuestario; si no se
mueven, el techo es otro y se recuperan los $1.500/día.

