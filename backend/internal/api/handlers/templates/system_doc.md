# Sistema Aremko-CLI — Documento Funcional y Técnico Completo

**Versión del documento:** generada al {{FECHA}}
**Audiencia:** compradores potenciales, equipos técnicos de integración, agentes IA de consulta
**Repositorio:** github.com/ecolonco/aremko-cli

---

## Resumen Ejecutivo

Aremko-CLI es la plataforma de **inteligencia operativa y análisis de marketing** de Aremko Spa Boutique. Consume datos del sistema de reservas (aremko-booking, Django), de Google Analytics 4, de Meta Ads (Facebook + Instagram orgánico), de Google y TripAdvisor (reseñas), y de una red de competidores monitoreados; los consolida en un **dashboard ejecutivo único** y genera **análisis automatizados con IA** por cada área del negocio.

El problema central que resuelve es la fragmentación analítica típica de un negocio multicanal: el dueño debía abrir cinco pestañas distintas (Google Analytics, Meta Ads Manager, Django admin, Google reviews, scraping manual) para entender qué estaba pasando cada lunes. Aremko-CLI consolida esos seis puntos de información en una sola página, agrega análisis cruzado con IA, permite consultas en lenguaje natural sobre ventas e historial de clientes, y exporta a PDF en formato carta para reportes ejecutivos.

A diferencia de un BI tradicional, el sistema es **mono-tenant y opinionated**: está construido para Aremko, conoce su modelo de negocio (tinajas, masajes, cabañas, packs), inyecta contexto operativo real (automatizaciones, campañas, programas de fidelización vigentes) en cada prompt de IA, y permite afinarse iterativamente sin pasar por un equipo de datos externo.

## Pilares Funcionales

| Pilar | Descripción resumida |
|---|---|
| Brief Semanal Consolidado | 7 pestañas con métricas de Web, Social, Ventas, Opiniones, Competencia y resumen integral con IA |
| Análisis IA por área | Cada pestaña tiene un botón "Generar Análisis IA" que produce diagnóstico + recomendaciones accionables en 5-15 segundos |
| Consulta en Lenguaje Natural | Input de texto libre que el LLM traduce a query estructurada sobre ventas (filtros por fecha, familia, servicio, masajista, cliente) |
| Historial completo de cliente | Filtro por teléfono/email/RUT/nombre con alerta visual de cliente lapsed (>90d, >180d, >1 año) para campañas de reactivación |
| Inyección de Contexto Operativo | Bloque markdown editable + auto-descubierto se prepende a cada prompt IA para evitar recomendar lo que ya existe |
| Export PDF e Impresión | Cada pestaña se exporta a PDF formato carta o se imprime nativamente con CSS @media print |
| Multi-rol Multi-usuario | Sidebars y dashboards diferenciados por rol (Jorge, Deborah, Angelica, Ernesto) con auth NextAuth |
| Mobile-friendly | Sidebar colapsable, top bar sticky con hamburger, layout responsive en todas las cards y tablas |

## Stack Técnico Resumido

El sistema corre sobre **Go** (backend API, chi router) y **Next.js 16 + React 19** (frontend SSR/SPA híbrido en App Router). El backend Go consume APIs externas (Django de aremko-booking, GA4, Meta Graph, OpenRouter) y expone un API REST propio que el frontend consume. La capa de presentación usa **Tailwind CSS v4** con sus colores modernos (oklch). Para PDF se usa `html2canvas-pro` + `jspdf` (canvas-based, soporta colores modernos de Tailwind 4). Para autenticación, NextAuth con providers configurables. El despliegue es **Render** (backend Go) + **Vercel** (frontend Next.js) deployando del mismo commit.

## Métricas Reales de Escala (al 2026-05-20)

| Métrica | Valor |
|---|---|
| Líneas de código Go (backend) | 5.535 |
| Archivos Go | 20 |
| Archivos TypeScript/TSX (frontend) | 24 |
| Endpoints HTTP expuestos | 19 |
| Pestañas del Brief Semanal | 7 |
| Áreas con análisis IA dedicado | 6 (Web, Instagram, Meta Ads, Ventas, Opiniones, Overview) |
| Roles de usuario soportados | 4 (Jorge, Deborah, Angelica, Ernesto) |
| Integraciones externas | 5 (aremko-booking, GA4, Meta Graph, OpenRouter, NextAuth) |
| Modelo LLM por defecto | google/gemini-3.1-flash-lite |

## Valor Diferenciador

1. **Análisis cruzado con datos reales en menos de 10 segundos**. La pestaña IA del Brief integra GA4, Bookings, Meta Ads, Instagram, Reviews y Competencia en paralelo (goroutines + sync.WaitGroup) y los pasa al LLM con un prompt que pide veredicto general, hallazgos cruzados, 3 cosas que funcionan, 3 que fallan y plan de acción a 30 días.

2. **Contexto Operativo dinámico inyectado en cada prompt**. Antes de cada análisis, el backend Go consulta `/aremko-cli/operating-context/` en Django, que devuelve un markdown auto-descubierto (cron jobs activos, plantillas SMS/email vigentes, packs de descuento, gift cards, reglas de negocio en código) combinado con una sección manual editable desde el admin. El LLM recibe instrucción explícita: si una recomendación que iba a sugerir ya está implementada según ese contexto, no la propone de cero — sugiere cómo mejorarla.

3. **Consulta en lenguaje natural sin SQL libre**. Un input de texto se procesa con gemini-3.1-flash-lite en modo JSON-only, extrayendo `{fecha_desde, fecha_hasta, familia, servicio, proveedor, cliente}` y llamando a un endpoint Django bien tipado. Sin riesgo de queries pesadas o inyección SQL: el modelo solo elige parámetros, el código compilado ejecuta la query.

4. **Detección automática de clientes lapsed**. Al consultar por cliente (vía teléfono, email, RUT o nombre), el sistema calcula última visita y días desde, y muestra un banner color-coded (verde activo / amarillo >90d / naranja >180d / rojo >365d) directamente accionable para campañas de reactivación.

5. **PDF en formato carta exporta solo la pestaña activa**. Cada `TabsContent` lleva un `data-tab-export` atributo, el botón "Descargar PDF" usa html2canvas-pro (soporta colores modernos de Tailwind 4) + jspdf con paginación manual multi-página. Los botones de acción, sidebar y tabs no aparecen en el PDF gracias a la clase `no-print`.

6. **Sidebar colapsable que también funciona en celular**. El layout `DashboardShell` detecta viewport con `matchMedia('(min-width: 768px)')`, abre el sidebar en desktop, lo deja cerrado en móvil. Hamburger toggle siempre visible. En print mode, sidebar y top bar se ocultan automáticamente.

7. **Cache de contexto y datos in-memory de 1h**. El operating context tiene cache local en el backend Go para que abrir 6 análisis seguidos solo dispare 1 fetch HTTP a Django. El cliente Django también cachea respuestas con TTL configurable.

---

# Parte 1 — Arquitectura Técnica

## Stack Tecnológico

### Backend (Go)

| Capa | Tecnología | Notas |
|---|---|---|
| Lenguaje | Go 1.22+ | Compilado a binario estático |
| Router HTTP | chi v5 | Con middleware Timeout 180s, Recoverer, RequestID, RealIP, Logger custom |
| CORS | go-chi/cors | Permite `*.vercel.app`, `*.onrender.com`, localhost |
| Cliente HTTP | net/http stdlib | Timeouts 10s en clientes externos |
| Cliente LLM | OpenRouter API | Modelo por defecto: `google/gemini-3.1-flash-lite` |
| Concurrencia | sync.WaitGroup + sync.Mutex | Goroutines para fetches paralelos en Overview Analysis |
| Despliegue | Render | Plan free/starter, auto-deploy desde main |

### Frontend (Next.js)

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js | 16.2.6 (App Router) |
| Runtime UI | React | 19.2.4 |
| Lenguaje | TypeScript | strict mode |
| Estilos | Tailwind CSS v4 | Con colores oklch modernos |
| Componentes UI | shadcn/ui (Card, Tabs, Button, Badge) | Custom |
| Iconos | lucide-react + heroicons | Mix |
| PDF | jspdf + html2canvas-pro | Canvas-based, soporta Tailwind 4 |
| Auth | NextAuth | Multi-provider |
| Despliegue | Vercel | Auto-deploy desde main |

### Integraciones Externas

| Servicio | Propósito | Dependencia |
|---|---|---|
| aremko-booking (Django) | Fuente de verdad: clientes, reservas, contexto operativo | Endpoints `/ventas/api/aremko-cli/*` |
| OpenRouter | Acceso unificado a LLMs (gemini, claude, deepseek, etc.) | `openrouter.ai/api/v1/chat/completions` |
| Google Analytics 4 | Tráfico web, top pages, traffic sources, tendencias semanales | `google-analytics-data` lib |
| Meta Graph API | Campañas Ads + Instagram orgánico (insights, top posts) | Marketing API v18+ |
| Render | Hosting backend Go | Auto-build desde GitHub main |
| Vercel | Hosting frontend Next.js | Auto-deploy desde GitHub main |

## Estructura del Backend Go

```
backend/
├── main.go                          # Entry point: lee config, arranca server
├── cmd/aremko/                      # Comandos CLI (root, server, brief)
└── internal/
    ├── ai/openrouter_client.go      # 8 métodos de análisis IA + parser NL
    ├── analytics/ga4_client.go      # Cliente GA4 (Data API)
    ├── api/
    │   ├── server.go                # Routing + middleware
    │   ├── middleware/logger.go     # Log de requests
    │   └── handlers/
    │       ├── brief.go             # 6 handlers de análisis + brief consolidado
    │       ├── ga4.go               # 3 endpoints GA4
    │       ├── meta.go              # 4 endpoints Meta Ads
    │       └── nl_query.go          # Endpoint NL → Django detalle
    ├── bookings/
    │   ├── client.go                # Cliente Django (reservas, clientes, familias)
    │   └── operating_context.go     # Cliente con cache 1h del contexto
    ├── competitors/                 # Cliente + scraper de competidores
    ├── config/config.go             # ENV vars: tokens, URLs, feature flags
    ├── meta/client.go               # Cliente Meta Graph (Ads + IG)
    ├── reviews/client.go            # Cliente reviews (encuestas + snapshots)
    └── social/instagram_client.go   # Cliente IG orgánico
```

## Estructura del Frontend Next.js

```
frontend/app/
├── layout.tsx                       # Root layout (fuentes, providers)
├── globals.css                      # Tailwind v4 + @media print
├── page.tsx                         # Landing redirige a /login o /dashboard
├── login/page.tsx                   # NextAuth login
├── api/auth/[...nextauth]/          # NextAuth routes
└── dashboard/
    ├── jorge/
    │   ├── layout.tsx               # Wrap con DashboardShell + Sidebar
    │   ├── page.tsx                 # Redirige a /brief
    │   ├── brief/page.tsx           # ★ Brief Semanal — 7 pestañas, IA, NL query, PDF
    │   ├── analytics/page.tsx       # GA4 standalone
    │   └── meta-ads/page.tsx        # Meta Ads standalone
    ├── deborah/                     # Dashboard rol comercial
    ├── angelica/                    # Dashboard rol operaciones
    ├── ernesto/                     # Dashboard rol contabilidad
    └── campaigns/page.tsx           # Gestión de campañas (placeholder)

frontend/components/
├── layout/
│   ├── DashboardShell.tsx           # Wrap con sidebar colapsable + topbar
│   └── Sidebar.tsx                  # Nav lateral por rol
└── ui/
    ├── card.tsx, tabs.tsx, button.tsx, badge.tsx
    └── StatCard.tsx                 # KPI grande con label
```

---

# Parte 2 — Funcionalidades por Módulo

## 2.1 Brief Semanal — Pestaña Resumen

La pestaña por defecto al abrir `/dashboard/jorge/brief`. Muestra el rango analizado (últimos 7 días vs día -1), un panel con el análisis IA acumulado del overview (si ya fue generado), las KPIs principales del negocio y un calendario de contenido sugerido por IA (cuando se genera con el botón "Generar con IA" del header).

Se nutre del endpoint `GET /api/v1/brief/weekly` que llama a los seis dominios en paralelo: GA4, Bookings, Meta Ads, Instagram, Reviews, Competidores. Si alguno falla, la sección correspondiente devuelve `{status: "error", error: "..."}` pero las otras siguen funcionando.

## 2.2 Pestaña Web (Google Analytics 4)

Consume GA4 Data API directamente desde el backend Go usando credenciales de service account (path en `GA4_CREDENTIALS_PATH`, property ID en `GA4_PROPERTY_ID`). Muestra: usuarios activos, sesiones, page views, bounce rate, duración promedio de sesión, top 10 páginas más visitadas, top fuentes de tráfico y tendencias semanales de las últimas 4 semanas. Botón "Generar Análisis IA" llama a `POST /api/v1/analytics/web/analyze` que devuelve un análisis con resumen ejecutivo, tendencias, páginas, fuentes, puntos de atención y recomendaciones accionables.

## 2.3 Pestaña Social (Instagram Orgánico + Meta Ads)

Dos secciones independientes con su propio botón de análisis IA:

**Instagram Orgánico**: alcance, impresiones, engagement rate, top 10 posts ordenados por engagement (con caption truncado y media_type), conteo de comments/likes/saves. Backend en `internal/social/instagram_client.go` usando Graph API v18 con el `META_ACCESS_TOKEN`.

**Meta Ads**: gasto total del período, CTR, CPC, CPM, mejor y peor campaña, top 10 campañas de los últimos 90 días ordenadas por spend. Backend en `internal/meta/client.go`. El análisis IA usa benchmarks de spa/turismo (CTR 1-2%, CPC USD 0.5-2, CPM USD 5-15) para diagnosticar eficiencia.

## 2.4 Pestaña Ventas

La más densa. Contiene:

- **Card de Consulta en Lenguaje Natural** (al inicio): input que acepta preguntas como "ventas del 1 de mayo familia masajes", "masajes de Paul en mayo 2026", "qué compró +56958655810". Llama a `POST /api/v1/analytics/nl-query` que parsea con LLM y consulta Django.
- **Card de Análisis IA** con botón "Generar Análisis IA" (resumen + diagnóstico + recomendaciones de ventas).
- **KPIs**: total reservas, ingresos, ticket promedio, distribución de pagos.
- **Clientes**: únicos esta semana, nuevos, recurrentes.
- **Ventas por Familia de Servicios** (Tinas, Masajes, Cabañas, Otros) con comparativa vs mes anterior y año anterior, indicadores % de cambio.
- **Ventas por Familia — Mes a la Fecha**: misma estructura pero del 1 del mes actual al día anterior, con períodos dinámicos.
- **Ventas por Método de Pago**: Mercado Pago, Flow, transferencia, tarjeta, gift card, etc.
- **Evolución 12 Semanas**: matriz 12 semanas × 4 familias mostrando clientes nuevos vs recurrentes, con banner de tendencia (promedio de primeras 4 semanas vs últimas 4).
- **Ventas Diarias**: tabla día por día de la semana actual.

El revenue se calcula como `precio_unitario × cantidad_personas` (en Django) para reflejar el cobro real — las reservas de pareja en tinas se cobran a doble valor.

## 2.5 Pestaña Opiniones

Combina dos fuentes: encuestas internas post-visita (NPS + 12 dimensiones de calidad) y reseñas externas (Google Maps, TripAdvisor):

- **NPS visual** con distribución promotores / pasivos / detractores.
- **Tabla 12 dimensiones**: limpieza_cabana, atencion_recepcion, calidad_masaje, etc., ordenadas por promedio, color-coded (≥4.7 verde, <4.4 naranja).
- **Snapshots Google y TripAdvisor**: rating actual + delta vs snapshot anterior.
- **Comentarios destacados**: 3 reviews seleccionadas (mejores del período).
- **Botón Análisis IA**: identifica fortalezas, áreas de mejora, embajadores naturales (personal mencionado por nombre), reviews sin responder.

## 2.6 Pestaña Competencia

Lista de competidores monitoreados (Termas Cochamó, Alma Lemu, etc.) con sus precios scrapeados, atenuando filas cuyo scraping falló. Cada competidor muestra:

- Precio actual vs precio de referencia de Aremko
- Servicios listados en su sitio
- Snapshot del último scraping (fecha, éxito, error si aplica)
- Sección "Presencia en Redes Sociales" (placeholder — modelo `CompetitorSocialMedia` aún sin scraper en Django)

## 2.7 Pestaña IA (Análisis Integral)

Resumen agregado que cruza todas las áreas anteriores. Card morada con gradient. El handler `AnalyzeOverview` ejecuta 6 fetches en paralelo (goroutines + `sync.WaitGroup` + `sync.Mutex`) — GA4, Bookings, Meta Ads, Instagram, Reviews, Competitors — reduciendo el tiempo de ~30s secuencial a ~5-8s paralelo. Luego adelgaza el payload con `trimForAIPrompt` (limita top_posts a 3, recent_campaigns a 5, trunca captions a 120 chars, drops media_url, etc.) para caber en el cap de input de OpenRouter, y llama al LLM con un prompt estructurado de "Veredicto General + Estado por Área + Hallazgos Cruzados + 3 cosas que funcionan + 3 que fallan + Plan 30 días + Métricas a vigilar + Idea bonus".

## 2.8 Consulta en Lenguaje Natural sobre Ventas

Implementado en `handlers/nl_query.go` + `internal/ai/openrouter_client.go::ParseVentasDetalleQuery`. El flujo:

1. El usuario tipea pregunta libre (ej: "masajes de Paul en mayo 2026").
2. Frontend hace `POST /api/v1/analytics/nl-query {"query": "..."}` con AbortController timeout 15s.
3. Backend invoca gemini-3.1-flash-lite con un system prompt JSON-only que define la estructura `{fecha_desde, fecha_hasta, familia, servicio, proveedor, cliente, error}` y 8 ejemplos few-shot.
4. El LLM devuelve JSON parseado en `VentasDetalleQuery`.
5. Si hay `error` (pregunta fuera de scope), se devuelve al frontend.
6. Si no, se llama `GetVentasDetalle(...)` que consulta `/ventas/api/aremko-cli/bookings/detalle/` en Django con los params (URL-encoded vía `net/url.Values`).
7. Django devuelve filas (reserva_id, fecha, cliente, servicio, familia, proveedor_nombre, cantidad_personas, precio_unitario, total, método_pago, estado).
8. El frontend muestra:
   - Línea "La IA entendió: [rango] · familia X · servicio Y · proveedor Z · cliente W"
   - Si hay filtro `cliente`: card de alerta con clasificación (activo / >3 meses / >6 meses / lapsed >1 año), última visita, primera visita, días distintos, clientes que matchean.
   - Tabla de resultados con columnas Fecha, Hora, Cliente, Servicio, Proveedor, Personas, Precio Unit., Total, Pago.
   - Botón "Exportar CSV" descarga el resultado.

**Timeouts en cascada**: DB statement_timeout 8s en Django → fetch Django 10s en Go → chi middleware 180s → AbortController 15s en frontend.

## 2.9 Filtro por Cliente con Historial Completo

Cuando el LLM detecta cliente (teléfono +56xxx, email, RUT, o nombre), las fechas son opcionales: Django devuelve todo el historial desde 2000-01-01. El cap de 3 meses se levanta automáticamente porque el resultado siempre es pequeño (clientes vienen 3-4 veces al año máximo). Match en Django con `Q(reserva__cliente__nombre__icontains) | Q(...telefono__icontains) | Q(...email__icontains) | Q(...rut__icontains)`.

## 2.10 Inyección de Contexto Operativo

Sistema bidireccional con aremko-booking que evita que la IA proponga acciones que Aremko ya implementa:

1. **En Django**: modelo `ContextoOperativo` (singleton) con `seccion_manual` (editable en admin) y `seccion_automatica_cache` (regenerada al GET cada 1h). El endpoint `GET /ventas/api/aremko-cli/operating-context/` auto-descubre: cron jobs activos, plantillas SMS/email, packs de descuento, gift cards, campañas, reglas de negocio hardcoded.
2. **En aremko-cli**: `bookings.Client.GetOperatingContext()` con cache local de 1h. `OpenRouterClient.OperatingContext` se pre-llena vía helper `newAIClientWithOperatingContext(cfg)`.
3. **En el prompt**: `wrapSystemPrompt(base)` prepende el contexto al system prompt base de cada uno de los 8 métodos AI, con instrucción explícita: "Si una acción que ibas a sugerir YA está implementada según el contexto, no la propongas de cero — sugiere cómo mejorarla, ampliarla o refinar su targeting".

## 2.11 Export PDF e Impresión

Dos botones en el header del Brief:

- **Descargar PDF**: invoca `handleExportPDF` que importa dinámicamente `html2canvas-pro` + `jspdf` (lazy load para no inflar el bundle inicial), renderiza el `[data-tab-export="X"]` activo a un canvas con `scale: 2`, lo convierte a JPEG quality 0.95, y construye un PDF en formato carta (8.5×11 in) con paginación manual multi-página. El archivo se llama `aremko-brief-{pestaña}-{YYYY-MM-DD}.pdf`. `ignoreElements` excluye cualquier elemento con clase `no-print`.
- **Imprimir**: invoca `window.print()` con CSS `@media print` que setea `@page { size: letter; margin: 0.5in; }`, oculta sidebar, top bar, tabs y action buttons (via `no-print`), permite que `html, body { height: auto; overflow: visible }` para que el contenido fluya entre páginas, y aplica `break-inside: avoid` a cards y tablas para no cortarlas a la mitad.

## 2.12 Sidebar Colapsable Mobile-Friendly

Implementado en `DashboardShell.tsx` + `Sidebar.tsx`. El estado `sidebarOpen` se inicializa en `false` para evitar mismatch de hidratación, y en `useEffect` se abre automáticamente si `matchMedia('(min-width: 768px)').matches` (desktop). Botón hamburger sticky arriba siempre visible. Sidebar fixed con `transform: translateX` y backdrop overlay sólo en mobile. Botón X dentro del sidebar visible solo en `md:hidden`. En print mode, todo el chrome desaparece automáticamente vía `no-print`.

## 2.13 Roles y Vistas Diferenciadas

Cuatro dashboards independientes según el usuario logueado:

- **Jorge** (dueño): nav simplificado a "Informes" (alias del Brief Semanal) + Configuración + Cerrar sesión. `/dashboard/jorge` redirige a `/dashboard/jorge/brief`.
- **Deborah** (comercial): vista enfocada en ventas, conversiones, pipeline.
- **Angelica** (operaciones): vista enfocada en agenda, comandas, salas.
- **Ernesto** (contabilidad): vista enfocada en pagos, ingresos, conciliación.

Cada rol tiene su `layout.tsx` que envuelve los children con `DashboardShell` y pasa `userRole`, `userName`, `userFullName` desde la sesión NextAuth.

---

# Parte 3 — Sistema de IA

## 3.1 Modelo por Defecto

Todos los análisis usan `google/gemini-3.1-flash-lite` vía OpenRouter. Razones:

- **Costo**: ~$0.0001 por 1K tokens — al borde del cero para el volumen de Aremko.
- **Latencia**: 5-10s para outputs de 2000 tokens.
- **Calidad**: suficiente para análisis estructurado con español natural, especialmente cuando el system prompt es detallado y few-shot.
- **Cap de tokens**: la key tiene un límite de input ~11K tokens por request, lo que obliga a disciplina en el payload (helper `trimForAIPrompt` para Overview).

El modelo se puede cambiar setting el segundo argumento de `c.Generate(ctx, prompt, user, MODEL, temp, max)`. Modelos probados: deepseek-v4-pro (caro), claude-haiku-4.5 (similar costo a gemini, mejor calidad), gemini-flash-1.5 (versión anterior).

## 3.2 Pattern de Prompt Engineering

Los 8 métodos de `openrouter_client.go` siguen el mismo patrón:

```go
func (c *OpenRouterClient) GenerateXAnalysis(ctx, data) (*LLMResult, error) {
    systemPrompt := `Eres un experto en X para Aremko Spa Boutique.
    [Reglas de formato: máx 2 páginas, bullets, emojis, **negritas**]
    [Estructura obligatoria del análisis: 6-8 secciones con título emoji]
    [Ejemplos de recomendaciones buenas (✅) y malas (❌)]`

    dataJSON, _ := json.MarshalIndent(data, "", "  ")
    userPrompt := fmt.Sprintf("Analiza estos datos:\n%s", dataJSON)

    return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt,
        "google/gemini-3.1-flash-lite", 0.7, 2000)
}
```

`c.wrapSystemPrompt()` agrega el contexto operativo + instrucción de evitar duplicar lo existente.

## 3.3 Pattern Function-Calling Manual

`ParseVentasDetalleQuery` no usa el tool-calling nativo de OpenRouter (gemini-flash-lite no lo soporta confiablemente) sino **JSON mode forzado por prompt**: el system prompt declara la estructura exacta del JSON esperado, da 8 ejemplos few-shot, y el código en Go limpia el texto buscando `{...}` con substring matching para descartar markdown wrapping. Temperature 0.0 para máxima determinismo.

## 3.4 Trim de Payload para Overview

El handler `AnalyzeOverview` arma un payload de ~10-15K tokens (datos de 6 áreas). Para que entre en el cap, `trimForAIPrompt`:

- Instagram top_posts: 3 entradas, caption truncado a 120 chars, drop media_url
- Meta Ads recent_campaigns: 5 entradas, name truncado a 80 chars
- Competidores: drop horario/promociones/meta_description/fecha_captura del snapshot
- Reviews destacadas: 3 entradas, comentario truncado a 100
- Reviews recientes: 3 entradas
- Web top_pages y traffic_sources: 5 entradas máx

Combinado con `json.Marshal` sin indentación, esto ahorra ~30% de tokens vs `MarshalIndent`.

## 3.5 Inyección de Contexto Operativo

Detallado en sección 2.10. Resumen del impacto en cada análisis: el system prompt crece ~1700 tokens (contexto markdown de ~6.8K chars), lo cual deja menos espacio para el payload pero produce recomendaciones más precisas y menos genéricas. Para Overview específicamente, se podría requerir trim adicional si pasa del cap.

## 3.6 Memoria Persistente y Caching

- **Operating context cache**: 1h TTL en backend Go (in-memory). Si Django falla, se devuelve el último valor cacheado en lugar de bloquear el análisis.
- **No hay cache de outputs IA**: cada click del usuario re-ejecuta el análisis. Se asume que en una misma sesión el usuario hace 1-2 generaciones por área y los datos cambian día a día.

---

# Parte 4 — API HTTP Pública

Todas las rutas bajo `/api/v1/` salvo `/health`.

### Brief Semanal

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/brief/weekly` | Brief consolidado sin IA |
| GET | `/api/v1/brief/weekly-ai` | Brief consolidado + análisis IA básico |
| POST | `/api/v1/brief/generate` | Trigger regeneración (placeholder) |

### Análisis IA por área

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/analytics/web/analyze` | Análisis IA de GA4 |
| POST | `/api/v1/analytics/instagram/analyze` | Análisis IA de Instagram orgánico |
| POST | `/api/v1/analytics/meta-ads/analyze` | Análisis IA de Meta Ads |
| POST | `/api/v1/analytics/sales/analyze` | Análisis IA de ventas |
| POST | `/api/v1/analytics/reviews/analyze` | Análisis IA de opiniones |
| POST | `/api/v1/analytics/overview/analyze` | Análisis integral cruzado |
| POST | `/api/v1/analytics/nl-query` | Consulta NL → query estructurada Django |

### Datos crudos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/ga4/stats` | Stats agregados GA4 |
| GET | `/api/v1/ga4/top-pages` | Top páginas del período |
| GET | `/api/v1/ga4/traffic-sources` | Fuentes de tráfico |
| GET | `/api/v1/meta-ads/campaigns` | Listado campañas Meta |
| GET | `/api/v1/meta-ads/insights` | Insights del período |
| GET | `/api/v1/meta-ads/account-summary` | Resumen cuenta |
| GET | `/api/v1/meta-ads/campaigns-with-insights` | Campañas + métricas merged |
| GET | `/api/v1/stats/overview` | Stats consolidados (placeholder) |
| GET | `/health` | Health check |

### Request/Response convencional

Todos los handlers usan `respondJSON(w, status, payload)` con `{"success": bool, "data": ..., "error": ...}` o variantes específicas. Las respuestas de análisis IA tienen forma:

```json
{
  "success": true,
  "analysis": {
    "content": "...markdown...",
    "model": "google/gemini-3.1-flash-lite",
    "input_tokens": 8420,
    "output_tokens": 1980,
    "latency_ms": 7234
  }
}
```

---

# Parte 5 — Integración con Aremko-Booking

Aremko-cli no tiene base de datos propia. Toda la persistencia está en aremko-booking (Django + PostgreSQL). Endpoints consumidos:

| Endpoint Django | Uso en aremko-cli |
|---|---|
| `/ventas/api/aremko-cli/health/` | Health check de Django |
| `/ventas/api/aremko-cli/bookings/stats/` | KPIs principales (total, revenue, ticket) |
| `/ventas/api/aremko-cli/bookings/daily/` | Reservas día a día |
| `/ventas/api/aremko-cli/bookings/by-family/` | Ventas por familia (7d) con YoY/MoM |
| `/ventas/api/aremko-cli/bookings/by-family-mtd/` | Ventas por familia (Mes a la Fecha) |
| `/ventas/api/aremko-cli/bookings/by-payment-method/` | Ventas por método de pago |
| `/ventas/api/aremko-cli/bookings/weekly-breakdown/` | Matriz 12 semanas × familias × clientes |
| `/ventas/api/aremko-cli/bookings/detalle/` | Detalle reservas fila por fila (NL query) |
| `/ventas/api/aremko-cli/clients/stats/` | Stats clientes (únicos, nuevos, recurrentes) |
| `/ventas/api/aremko-cli/operating-context/` | Markdown auto-descubierto + manual |
| `/ventas/api/aremko-cli/reviews/...` | Snapshots Google/TripAdvisor + encuestas internas |
| `/ventas/api/aremko-cli/competitors/...` | Snapshots de competidores |

Todos los endpoints están bajo el prefijo `/ventas/api/aremko-cli/` para aislarlos de la API pública de reservas. La autenticación es por IP/host (Render → Render) o por API key (no implementada actualmente, ya que aremko-cli es la única integración).

---

# Parte 6 — Despliegue e Infraestructura

## 6.1 Backend Go (Render)

- Repositorio: `ecolonco/aremko-cli`
- Dockerfile o buildpack auto-detectado
- Variables de entorno mínimas: `OPENROUTER_API_KEY`, `BOOKING_SYSTEM_URL`, `META_ACCESS_TOKEN`, `META_ACCOUNT_ID`, `GA4_PROPERTY_ID`, `GA4_CREDENTIALS_PATH`, `PORT`, `ENABLE_AI=true`, `ENABLE_BOOKINGS=true`, `ENABLE_META_ADS=true`, `ENABLE_GA4=true`
- Auto-deploy desde rama `main` al push
- Plan: free/starter (suficiente para volumen actual)

## 6.2 Frontend Next.js (Vercel)

- Mismo repositorio, root path `frontend/`
- Variable de entorno: `NEXT_PUBLIC_API_URL` (URL del backend Render)
- Variables NextAuth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, providers
- Auto-deploy desde `main`
- Build: `next build`

## 6.3 Patrón de Coordinación de Deploys

Cuando un cambio afecta tanto backend como frontend (ej: nuevo endpoint + UI que lo consume), **ambos deploys deben quedar en el mismo commit** para evitar 404 en endpoints que el frontend espera. Si Render falla y Vercel ya deployó, el frontend muestra "Error de red" hasta que Render recupere. Se monitorea cancelando deploys "Initializing" stuck >25 min en Vercel.

---

# Parte 7 — Cómo Extender

## Agregar una nueva pestaña al Brief

1. Agregar `<TabsTrigger value="X" />` en `brief/page.tsx::TabsList`.
2. Agregar `<TabsContent value="X" data-tab-export="X">` con el contenido.
3. Si necesita análisis IA, agregar un método `GenerateXAnalysis` en `openrouter_client.go` siguiendo el pattern de los 6 existentes.
4. Agregar handler en `handlers/brief.go` que se llame con `newAIClientWithOperatingContext(cfg)`.
5. Registrar ruta `r.Post("/analytics/X/analyze", ...)` en `server.go`.
6. Agregar state + handler + UI en el frontend (gradient card con botón y card de resultado).
7. Agregar entrada en `tabLabels` para el filename del PDF.

## Agregar un nuevo filtro a la consulta NL

1. Agregar campo a `VentasDetalleQuery` struct (Go) y a la URL de `GetVentasDetalle`.
2. Agregar campo a `VentasDetalleQuery` JSON schema en el system prompt + ejemplos.
3. Agregar parámetro al endpoint Django `/bookings/detalle/`.
4. Mostrar el nuevo campo en la línea "La IA entendió" del frontend.

## Agregar un nuevo modelo LLM

Cambiar el string en el segundo argumento de `c.Generate()`. Si el modelo cobra distinto, ajustar `max_tokens` para mantener costo. Algunos modelos (Claude, GPT-4) soportan tool-calling nativo; en ese caso reescribir `ParseVentasDetalleQuery` para usar tool definitions en lugar de JSON mode forzado.

## Agregar prompt caching

Para modelos Anthropic (Claude), agregar `cache_control: {type: "ephemeral"}` en el último `system` message del request a OpenRouter. Gemini no soporta caching del lado API; el caching es solo de Anthropic.

## Agregar autenticación de la API

Hoy el backend Go acepta requests sin auth (depende del CORS allowlist). Para producción seria, agregar middleware tipo `chimiddleware.Verifier(jwtAuth)` y emitir tokens desde NextAuth en el frontend.

---

# Información de Contacto y Soporte

## Equipo Aremko

Punto de contacto: equipo Aremko Spa Boutique a través de los canales oficiales. Para cambios sobre este sistema, abrir issue en `github.com/ecolonco/aremko-cli`.

## Proveedores Tecnológicos Activos

| Proveedor | Servicio |
|---|---|
| Render | Hosting backend Go |
| Vercel | Hosting frontend Next.js |
| OpenRouter | Gateway unificado de LLMs |
| Google Cloud | GA4 Data API |
| Meta | Marketing API + Instagram Graph |
| GitHub | Repositorio + CI/CD trigger |

## Documentación Relacionada

- Sistema Aremko-Booking (Django): `/Users/jorgeaguilera/Downloads/Aremko_Sistema_Completo.pdf`
- Contexto Operativo actualizado: editable en admin Django (`/admin/ventas/contextooperativo/`)
- Brief Semanal en vivo: `https://aremko-cli-frontend.vercel.app/dashboard/jorge/brief`

---

# Anexo Técnico — Inventario en Vivo

Snapshot tomado al {{FECHA}}.

## Endpoints HTTP del backend Go (19)

```
GET  /health
GET  /api/v1/brief/weekly
GET  /api/v1/brief/weekly-ai
POST /api/v1/brief/generate
POST /api/v1/analytics/web/analyze
POST /api/v1/analytics/instagram/analyze
POST /api/v1/analytics/meta-ads/analyze
POST /api/v1/analytics/sales/analyze
POST /api/v1/analytics/reviews/analyze
POST /api/v1/analytics/overview/analyze
POST /api/v1/analytics/nl-query
GET  /api/v1/ga4/stats
GET  /api/v1/ga4/top-pages
GET  /api/v1/ga4/traffic-sources
GET  /api/v1/meta-ads/campaigns
GET  /api/v1/meta-ads/insights
GET  /api/v1/meta-ads/account-summary
GET  /api/v1/meta-ads/campaigns-with-insights
GET  /api/v1/stats/overview
```

## Rutas del frontend Next.js (8 dashboards)

```
/login
/dashboard/jorge                  → redirect /brief
/dashboard/jorge/brief            ★ Brief Semanal 7 pestañas
/dashboard/jorge/analytics        GA4 standalone
/dashboard/jorge/meta-ads         Meta Ads standalone
/dashboard/deborah                Vista comercial
/dashboard/angelica               Vista operaciones
/dashboard/ernesto                Vista contabilidad
/dashboard/campaigns              Gestión campañas (placeholder)
```

## Métodos del cliente IA (`OpenRouterClient`)

```
Generate                          → Llamada genérica al LLM
GenerateBriefAnalysis             → Análisis general del brief
GenerateContentCalendar           → Calendario contenido IG/blog
GenerateWebAnalyticsAnalysis      → IA pestaña Web
GenerateInstagramAnalysis         → IA pestaña Instagram orgánico
GenerateMetaAdsAnalysis           → IA pestaña Meta Ads
GenerateSalesAnalysis             → IA pestaña Ventas
GenerateReviewsAnalysis           → IA pestaña Opiniones
GenerateOverviewAnalysis          → IA pestaña Resumen (integral)
ParseVentasDetalleQuery           → Parser NL a query estructurada
wrapSystemPrompt                  → Prepende Contexto Operativo (privado)
trimForAIPrompt                   → Adelgaza payload para cap input (privado)
```

## Métodos del cliente Bookings (`bookings.Client`)

```
HealthCheck
GetBookingStats(date_start, date_stop)
GetDailyBookings(date_start, date_stop)
GetClientStats()
GetServiceFamilyStats(date_start, date_stop)
GetPaymentMethodStats(date_start, date_stop)
GetWeeklyBreakdown(weeks)
GetFamilyStatsMTD(date_stop)
GetVentasDetalle(desde, hasta, familia, servicio, proveedor, cliente)
GetOperatingContext()             → Cache 1h, fallback al último valor
```

---

_Documento generado al {{FECHA}}. Para regenerar este documento desde la app, abrir Sistema Completo en el sidebar y descargar el .md actualizado._
