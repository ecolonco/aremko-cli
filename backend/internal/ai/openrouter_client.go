package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OpenRouterClient maneja la comunicación con OpenRouter API
type OpenRouterClient struct {
	APIKey  string
	BaseURL string
	Client  *http.Client
	// OperatingContext, si está set, se inyecta al final del system prompt de
	// cada análisis para que la IA evite recomendar acciones que Aremko ya
	// implementa. Se llena desde el handler con bookings.Client.GetOperatingContext().
	OperatingContext string
}

// wrapSystemPrompt prepends Aremko's current operating context to the analysis
// system prompt, so the LLM tailors recommendations to what's not already in place.
// If OperatingContext is empty, returns base unchanged.
func (c *OpenRouterClient) wrapSystemPrompt(base string) string {
	if c.OperatingContext == "" {
		return base
	}
	return fmt.Sprintf(`%s

---

## Contexto operativo actual de Aremko Spa Boutique
_(generado automáticamente desde el código y la BD del sistema de reservas)_

%s

---

IMPORTANTE — usar el contexto operativo al recomendar:
- Si una acción que ibas a sugerir YA está implementada según el contexto de arriba, NO la propongas de cero. En su lugar, sugiere cómo MEJORARLA, AMPLIARLA, REFINAR su targeting, o medir su efectividad.
- Si una sugerencia entra en conflicto, duplica o canibaliza algo existente, dilo explícitamente.
- Tus mejores recomendaciones son las que combinan los datos del payload con lo que ya hay en el contexto operativo para proponer algo concreto y no obvio.`, base, c.OperatingContext)
}

// LLMResult encapsula la respuesta del modelo
type LLMResult struct {
	Text         string `json:"text"`
	Model        string `json:"model"`
	InputTokens  int    `json:"input_tokens"`
	OutputTokens int    `json:"output_tokens"`
	LatencyMs    int64  `json:"latency_ms"`
	Error        string `json:"error,omitempty"`
}

// ChatMessage representa un mensaje en el formato OpenAI
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenRouterRequest estructura la solicitud a OpenRouter
type OpenRouterRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

// OpenRouterResponse estructura la respuesta de OpenRouter
type OpenRouterResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// NewOpenRouterClient crea una nueva instancia del cliente
func NewOpenRouterClient(apiKey, baseURL string) *OpenRouterClient {
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}

	return &OpenRouterClient{
		APIKey:  apiKey,
		BaseURL: baseURL,
		Client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// Generate envía un prompt a OpenRouter y retorna el resultado
func (c *OpenRouterClient) Generate(ctx context.Context, systemPrompt, userPrompt, model string, temperature float64, maxTokens int) (*LLMResult, error) {
	startTime := time.Now()

	// Usar DeepSeek V4 Pro por defecto
	if model == "" {
		model = "google/gemini-3.1-flash-lite"
	}

	// Construir request
	reqBody := OpenRouterRequest{
		Model: model,
		Messages: []ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: temperature,
		MaxTokens:   maxTokens,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling request: %v", err)}, err
	}

	// Crear HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error creating request: %v", err)}, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("HTTP-Referer", "https://aremko.cl")
	req.Header.Set("X-Title", "Aremko Brief Semanal")

	// Ejecutar request
	resp, err := c.Client.Do(req)
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error executing request: %v", err)}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error reading response: %v", err)}, err
	}

	// Verificar status code
	if resp.StatusCode != http.StatusOK {
		errorMsg := fmt.Sprintf("OpenRouter API error (status %d): %s", resp.StatusCode, string(body))
		return &LLMResult{Error: errorMsg}, fmt.Errorf(errorMsg)
	}

	// Parsear respuesta
	var openRouterResp OpenRouterResponse
	if err := json.Unmarshal(body, &openRouterResp); err != nil {
		return &LLMResult{Error: fmt.Sprintf("error parsing response: %v", err)}, err
	}

	// Extraer resultado
	if len(openRouterResp.Choices) == 0 {
		return &LLMResult{Error: "no choices in response"}, fmt.Errorf("no choices in response")
	}

	latency := time.Since(startTime).Milliseconds()

	return &LLMResult{
		Text:         openRouterResp.Choices[0].Message.Content,
		Model:        openRouterResp.Model,
		InputTokens:  openRouterResp.Usage.PromptTokens,
		OutputTokens: openRouterResp.Usage.CompletionTokens,
		LatencyMs:    latency,
		Error:        "",
	}, nil
}

// GenerateBriefAnalysis genera análisis inteligente del brief semanal
func (c *OpenRouterClient) GenerateBriefAnalysis(ctx context.Context, briefData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un analista de marketing experto para Aremko Spa, un spa de lujo en Puerto Varas, Chile.

Tu trabajo es analizar datos de desempeño semanal y generar insights accionables en español.

Genera un análisis estructurado con:
1. RESUMEN EJECUTIVO (2-3 párrafos clave)
2. HALLAZGOS PRINCIPALES (3-5 bullets con insights)
3. RECOMENDACIONES (3-4 acciones específicas)
4. ALERTAS (si hay métricas preocupantes)

Sé específico, usa números, y enfócate en acciones concretas.`

	// Convertir briefData a JSON string
	briefJSON, err := json.MarshalIndent(briefData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("error marshaling brief data: %v", err)
	}

	userPrompt := fmt.Sprintf(`Analiza el siguiente brief semanal de Aremko Spa:

%s

Genera tu análisis siguiendo la estructura definida.`, string(briefJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
}

// GenerateContentCalendar genera calendario de contenido para redes sociales
func (c *OpenRouterClient) GenerateContentCalendar(ctx context.Context, briefData map[string]interface{}, days int) (*LLMResult, error) {
	systemPrompt := `Eres un estratega de contenido para Aremko Spa, un spa de lujo en Puerto Varas, Chile.

Genera un calendario de contenido para Instagram y blog basado en datos de desempeño.

Para cada post incluye:
- DÍA: (ej: Lunes 15 Mayo)
- CANAL: Instagram/Blog
- TIPO: Educativo/Promocional/Testimonial/Inspiracional
- TEMA: Título del post
- COPY: Texto completo (max 150 palabras para Instagram, 300 para blog)
- HASHTAGS: 5-8 hashtags relevantes (solo Instagram)
- CTA: Call to action específico
- UTM: Parámetros de tracking sugeridos

Prioriza contenido que:
1. Capitalice en servicios con mejor desempeño
2. Eduque sobre temas de bienestar
3. Muestre resultados y testimonios
4. Aproveche estacionalidad y fechas especiales`

	briefJSON, err := json.MarshalIndent(briefData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("error marshaling brief data: %v", err)
	}

	userPrompt := fmt.Sprintf(`Basándote en estos datos de desempeño:

%s

Genera un calendario de contenido para los próximos %d días.
Incluye al menos 1 post de Instagram y 1 artículo de blog por semana.`, string(briefJSON), days)

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.8, 4000)
}

// GenerateWebAnalyticsAnalysis genera un análisis completo de los datos de web analytics
func (c *OpenRouterClient) GenerateWebAnalyticsAnalysis(ctx context.Context, webAnalyticsData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un experto analista de marketing digital especializado en Google Analytics 4.
Tu tarea es analizar datos de tráfico web y proporcionar insights accionables.

IMPORTANTE:
- Escribe un análisis de máximo 2 páginas (aproximadamente 1000-1500 palabras)
- Usa lenguaje claro y directo, sin jerga innecesaria
- Enfócate en lo MÁS RELEVANTE y accionable
- Organiza el análisis en secciones claras con títulos
- Usa bullets (•) para listas, no números
- Destaca con **negritas** los puntos clave
- Incluye emojis relevantes para hacer el texto más visual (📊 📈 📉 ⚠️ ✅ 🎯 💡)

ESTRUCTURA DEL ANÁLISIS:

## 📊 Resumen Ejecutivo
- 2-3 puntos clave sobre el rendimiento general
- Tendencia principal (positiva/negativa/estable)

## 📈 Tendencias Principales
- Análisis de las tendencias semanales (últimas 4 semanas)
- ¿Qué métricas están mejorando? ¿Cuáles empeorando?
- ¿Hay patrones o anomalías?

## 🎯 Páginas Más Visitadas
- ¿Qué páginas están funcionando mejor?
- ¿Hay páginas en declive que requieren atención?
- ¿Qué oportunidades hay?

## 🌐 Fuentes de Tráfico
- ¿De dónde viene el tráfico principal?
- ¿Qué fuentes están creciendo o cayendo?
- ¿Hay dependencia excesiva de alguna fuente?

## ⚠️ Puntos de Atención
- 3-5 aspectos que requieren atención inmediata
- Ser específico sobre qué está mal y por qué importa

## 💡 Recomendaciones Accionables
- 5-7 acciones CONCRETAS y SIMPLES que se pueden implementar
- Priorizar por impacto potencial
- Cada recomendación debe ser clara y específica
- Enfocarse en quick wins (resultados rápidos)

Ejemplos de recomendaciones:
✅ "Optimizar la página /alojamientos/ que tiene 45% de bounce rate - agregar CTA más claros"
✅ "Invertir más en Google Ads, está generando 30% más tráfico que el mes pasado"
❌ "Mejorar el SEO" (muy vago)
❌ "Analizar el comportamiento del usuario" (no es accionable)`

	// Convertir datos a JSON
	dataJSON, err := json.MarshalIndent(webAnalyticsData, "", "  ")
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Analiza estos datos de Google Analytics 4 de www.aremko.cl (spa boutique en Puerto Varas, Chile):

%s

Genera un análisis completo y accionable siguiendo la estructura especificada.
Recuerda: máximo 2 páginas, enfoque en lo más relevante, recomendaciones concretas y simples.`, string(dataJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 4000)
}

// GenerateInstagramAnalysis genera un análisis completo con IA de los datos de Instagram Orgánico
func (c *OpenRouterClient) GenerateInstagramAnalysis(ctx context.Context, instagramData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un experto en marketing de Instagram y redes sociales.
Tu tarea es analizar datos orgánicos de Instagram y proporcionar insights accionables.

IMPORTANTE:
- Escribe un análisis de máximo 2 páginas (aproximadamente 1000-1500 palabras)
- Usa lenguaje claro y directo, sin jerga innecesaria
- Enfócate en lo MÁS RELEVANTE y accionable
- Organiza el análisis en secciones claras con títulos
- Usa bullets (•) para listas, no números
- Destaca con **negritas** los puntos clave
- Incluye emojis relevantes para hacer el texto más visual (📸 📊 📈 📉 ⚠️ ✅ 🎯 💡 ❤️ 💬 🔖)

ESTRUCTURA DEL ANÁLISIS:

## 📊 Resumen Ejecutivo
- 2-3 puntos clave sobre el rendimiento general
- Tendencia principal (crecimiento/declive/estable)

## 📈 Tendencias de Crecimiento
- Análisis de las tendencias semanales (últimas 4 semanas)
- Evolución de alcance, impresiones, engagement
- ¿Qué métricas están mejorando? ¿Cuáles empeorando?

## 📸 Contenido que Funciona
- ¿Qué tipo de posts tienen mejor engagement?
- ¿Hay patrones en el contenido exitoso?
- Análisis de los top posts

## 👥 Audiencia y Engagement
- Análisis de interacciones (likes, comentarios, saves)
- Engagement rate y su evolución
- Oportunidades para mejorar la conexión

## ⚠️ Puntos de Atención
- 3-5 aspectos que requieren atención inmediata
- Ser específico sobre qué está mal y por qué importa

## 💡 Recomendaciones Accionables
- 5-7 acciones CONCRETAS y SIMPLES que se pueden implementar
- Priorizar por impacto potencial
- Enfocarse en quick wins (resultados rápidos)

Ejemplos de recomendaciones:
✅ "Publicar más contenido del tipo [X] que tiene 40% más engagement"
✅ "Aumentar frecuencia de stories - solo hay [N] por semana vs. ideal de 3-5"
❌ "Mejorar el contenido" (muy vago)
❌ "Analizar la audiencia" (no es accionable)`

	// Convertir datos a JSON
	dataJSON, err := json.MarshalIndent(instagramData, "", "  ")
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Analiza estos datos de Instagram Orgánico de @aremkospa (spa boutique en Puerto Varas, Chile):

%s

Genera un análisis completo y accionable siguiendo la estructura especificada.
Recuerda: máximo 2 páginas, enfoque en lo más relevante, recomendaciones concretas y simples.`, string(dataJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
}

// GenerateMetaAdsAnalysis genera un análisis completo de los datos de Meta Ads (Facebook/Instagram)
func (c *OpenRouterClient) GenerateMetaAdsAnalysis(ctx context.Context, metaAdsData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un experto en publicidad pagada en Meta Ads (Facebook e Instagram).
Tu tarea es analizar datos de campañas y proporcionar insights accionables para optimizar el rendimiento publicitario.

IMPORTANTE:
- Escribe un análisis de máximo 2 páginas (aproximadamente 1000-1500 palabras)
- Usa lenguaje claro y directo, sin jerga innecesaria
- Enfócate en lo MÁS RELEVANTE y accionable
- Organiza el análisis en secciones claras con títulos
- Usa bullets (•) para listas, no números
- Destaca con **negritas** los puntos clave
- Incluye emojis relevantes para hacer el texto más visual (💰 📊 📈 📉 ⚠️ ✅ 🎯 💡 🏆 🚫)
- Los montos están en la moneda de la cuenta (probablemente USD o CLP). Si los valores son grandes (>1000), asume CLP.

ESTRUCTURA DEL ANÁLISIS:

## 📊 Resumen Ejecutivo
- 2-3 puntos clave sobre el rendimiento general de la inversión publicitaria
- ROAS aparente, eficiencia del gasto y dirección general (mejora/empeora/estable)

## 💰 Eficiencia del Gasto
- Análisis de inversión total, CPC, CPM y CTR vs. benchmarks típicos
- Benchmarks de referencia para spas/turismo: CTR 1-2%, CPC $0.5-2 USD, CPM $5-15 USD
- ¿El gasto está rindiendo o se está desperdiciando?

## 🏆 Campañas Ganadoras
- Identifica las campañas con mejor rendimiento (mayor CTR, menor CPC)
- ¿Qué tienen en común? ¿Por qué funcionan?
- Recomienda escalar inversión en estas campañas

## 🚫 Campañas Problemáticas
- Identifica las campañas con peor rendimiento
- ¿Qué está mal? (CTR bajo, CPC alto, baja audiencia)
- Recomienda pausar, reformular o reducir presupuesto

## ⚠️ Puntos de Atención
- 3-5 problemas críticos que requieren acción inmediata
- Ejemplos: presupuesto mal distribuido, creativos saturados, audiencias muy estrechas

## 💡 Recomendaciones Accionables
- 5-7 acciones CONCRETAS para mejorar el rendimiento
- Priorizar por impacto potencial y facilidad de implementación
- Enfocarse en quick wins (resultados rápidos)

Ejemplos de recomendaciones:
✅ "Pausar campaña 'X' con CTR de 0.3% y redirigir su presupuesto a 'Y' que tiene 3.5%"
✅ "Refrescar creativos en campañas con más de 14 días activas - probable fatiga publicitaria"
✅ "Probar audiencias lookalike basadas en compradores recientes"
❌ "Mejorar las campañas" (muy vago)
❌ "Optimizar el ROAS" (no es accionable)`

	// Convertir datos a JSON
	dataJSON, err := json.MarshalIndent(metaAdsData, "", "  ")
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Analiza estos datos de Meta Ads (Facebook/Instagram) de Aremko Spa (spa boutique en Puerto Varas, Chile):

%s

Genera un análisis completo y accionable siguiendo la estructura especificada.
Recuerda: máximo 2 páginas, enfoque en lo más relevante, recomendaciones concretas y simples.`, string(dataJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
}

// GenerateSalesAnalysis genera un análisis completo de las ventas y reservas del sistema
func (c *OpenRouterClient) GenerateSalesAnalysis(ctx context.Context, salesData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres el analista ejecutivo de Aremko Spa Boutique (Puerto Varas, Chile). Tu audiencia es el DUEÑO del negocio, que toma decisiones de presupuesto, contratación y campañas. NO es un resumen rápido — es el documento de análisis profundo que él lee con un café el lunes a la mañana para entender qué está pasando y decidir el rumbo de las próximas semanas. Cuanto más densidad analítica y más cruces de datos, mejor.

Los montos están en pesos chilenos (CLP).

# REGLAS NO NEGOCIABLES

## R1 — Contexto operativo (lo más importante)
El bloque de "Contexto Operativo de Aremko Spa Boutique" arriba lista LAS AUTOMATIZACIONES, CAMPAÑAS, PROMOCIONES, GIFT CARDS, REGLAS DE NEGOCIO Y PLANTILLAS QUE YA EXISTEN. Antes de cada recomendación, verifica si ya está ahí.
- Si existe: NO propongas "lanzar X" — propón "REFINAR X" citando el nombre exacto del trigger/plantilla/pack y diciendo qué afinar (segmento, copy, timing, descuento, ramp).
- Si NO existe: explícitamente decir "no detecté esto en el contexto operativo".

## R2 — Cuantificar SIEMPRE el impacto
Cada recomendación lleva un campo "Impacto estimado" con número anclado a datos del payload. Fórmula: base actual × tasa de conversión esperada × ticket. Ejemplo: "47 nuevos × 20% retorno × $40K = +$376K en 60 días".
- Si no se puede cuantificar honestamente: "impacto difícil de cuantificar — propongo medir X durante Y semanas antes de escalar".
- NUNCA inventar números sin base. Si N<5 unidades: "muestra muy chica, no concluyente".

## R3 — Estacionalidad antes de declarar crecimiento
Antes de decir "creció X%", compara contra el MISMO MES DEL AÑO ANTERIOR usando monthly_trends.data (24 meses disponibles). "+75% vs mes pasado" puede ser estacional. Reportar SIEMPRE ambas: vs mes anterior Y vs mismo mes año anterior. Si el slope de monthly_trends contradice la lectura semanal, mencionar la contradicción.

## R4 — Señal vs ruido
N=1, N=2, N=3 NO son tendencia. Si una métrica involucra <5 unidades: "muestra muy chica". "Flow de 0 a $X" puede ser que estaba CAÍDO, no éxito — cuestiona discontinuidades.

## R5 — Periodicidad explícita
Sé EXPLÍCITO sobre qué con qué: "semana actual vs misma semana del mes anterior", "semana actual vs todo el mes anterior", "semana actual vs promedio mensual histórico de los últimos 24 meses". No mezcles.

## R6 — Cero vaguedad
PROHIBIDO: "mejorar atención", "optimizar X", "evaluar Y", "potenciar Z", "trabajar en W". Solo VERBOS ACCIONABLES + OBJETO ESPECÍFICO + UMBRAL.

## R7 — Profundidad y cruces de datos
Cada sección debe cruzar AL MENOS 2 datasets del payload (ej: family_combinations × monthly_trends × by_family_mtd). Si una afirmación se sostiene en un solo número, busca el segundo dato que la confirme o la matice. La densidad analítica es el valor agregado de este reporte vs leer las tablas a mano.

# ESTRUCTURA DE SALIDA — EXACTA, EN ESTE ORDEN

## 🎯 Veredicto
**Primera línea:** titular tipo periodístico (1 frase, máx 25 palabras), prefijado con 🟢 (negocio saludable) / 🟡 (atención) / 🔴 (problema).
**Segundo párrafo (3-5 frases):** contexto del titular. Qué está pasando bajo la superficie, qué señal lo confirma, qué tensión central define la semana/mes. Cita 3-4 números específicos del payload.

## 📌 3 Cifras que Importan
Exactamente 3 cifras. Cada una en este formato (mínimo 4 líneas por cifra):
- **Cifra:** [nombre] = [valor] ([Δ vs período comparable])
- **Por qué importa:** [explicación de qué representa esta cifra para el negocio]
- **Contexto:** [comparativa contra histórico — promedio últimos 6 meses, año anterior, target]
- **Implicación:** [qué decisión cambia si esta cifra empeora/mejora]

## 🔍 Análisis Profundo por Familia
Un sub-bloque por familia principal (Tinas, Masajes, Cabañas). Cada sub-bloque cubre:
- **Volumen actual:** count + revenue de la semana y del mes a la fecha (by_family_mtd)
- **Evolución 24 meses:** slope_pct + lectura del trend (¿acelera, plateau, desacelera?)
- **Estacionalidad:** ¿el mes en curso supera o queda por debajo del mismo mes año anterior en monthly_trends?
- **Cross-sell:** ¿qué % de las reservas de esta familia vienen en bundle vs solo? (cruzar con family_combinations)
- **Lectura ejecutiva:** 2-3 frases con la implicación estratégica.

## ⚡ Movida de la Semana
UNA SOLA recomendación, la de mayor impacto × menor esfuerzo. Formato completo:
- **Acción:** [verbo + objeto específico]
- **Por qué:** [cita explícita de datos del payload, mínimo 2 cifras]
- **Es nueva o refina existente?** [si refina, citar nombre EXACTO del trigger/pack del contexto operativo y qué se cambia respecto a la versión actual]
- **Impacto estimado:** [fórmula explícita con números del payload, mostrando todos los supuestos]
- **Esfuerzo:** [horas o días, lo más honesto posible]
- **Cuándo se ejecuta:** [día específico]
- **Quién la ejecuta:** [equipo/rol]
- **Métrica de éxito:** [qué número se moverá, umbral, plazo de medición]
- **Riesgos:** [qué puede salir mal y cómo mitigarlo]

## 🎯 3 Apuestas del Mes
Tres recomendaciones más, ordenadas DESC por (impacto estimado / esfuerzo en días). Numerar 1, 2, 3. **CADA UNA con el formato completo de Movida de la Semana** (no condensado — el mismo nivel de detalle).

## ⏸️ Qué Pausar o Refinar
2-3 procesos que el contexto operativo dice que están corriendo pero los datos sugieren que no mueven la aguja. Cada item desarrollado (mínimo 5 líneas):
- **Proceso actual:** [nombre exacto del trigger/pack del contexto operativo]
- **Hipótesis de bajo rendimiento:** [datos del payload que lo respaldan, mínimo 2]
- **Evidencia indirecta:** [si no hay dato directo, qué proxy podría confirmar]
- **Decisión propuesta:** [pausar / refinar copy / refinar segmento / cambiar timing / cambiar incentivo]
- **Cómo medir si la decisión fue correcta**

Si NO encuentras nada que pausar honestamente: "no detecté nada que claramente convenga pausar — recomiendo agregar instrumentación para medir efectividad de las automatizaciones existentes antes de tocar".

## 📊 Estado por Dimensión
Una sección por dimensión (no una línea — un párrafo de 3-5 frases por dimensión, con bullets de sub-datos cuando aplique). Las 6 dimensiones obligatorias:

### 🟢/🟡/🔴 Revenue
Vs target del mes (si está disponible), vs mes anterior, vs mismo mes año anterior. Mencionar avg_monthly_revenue de monthly_trends como referencia histórica. Si el revenue del mes en curso está por debajo del promedio histórico, alertar.

### 🟢/🟡/🔴 Bundling y Mix
Share de Solo Tinas vs share de bundles (Tin+Mas, Cab+Tin, Cab+Tin+Mas). Tendencia del share de cada combinación en family_combinations.summary.trend_slope_pct_by_combination. ¿El mix se está enriqueciendo (más bundles) o empobreciendo (más single-service)?

### 🟢/🟡/🔴 Adquisición vs Retención
Ratio nuevos/recurrentes esta semana. weekly_breakdown.summary.trend para ver dirección de las últimas 4 semanas vs las primeras 4. ¿La acquisición compensa la fuga? ¿La retención está cayendo?

### 🟢/🟡/🔴 Largo plazo
Slopes de las 3 familias principales (monthly_trends.summary_by_family). ¿Hay divergencia entre familias (una sube fuerte, otra cae)? ¿Hay algún slope negativo preocupante?

### 🟢/🟡/🔴 Pagos
Mix de métodos de pago. Discontinuidades (método que pasó de 0 a $X — revisar si estaba caído antes). Concentración riesgosa (si Mercado Pago = 70%+ del revenue, ¿qué pasa si MP falla?).

### 🟢/🟡/🔴 Estacionalidad
Mes en curso vs mismo mes año anterior (monthly_trends.data). Si está bajo, ¿es estructural o es un mes raro? Si está sobre, ¿qué impulsó el cambio?

## ⚠️ Riesgos y Escenarios
Sección nueva. Identificar 2-3 riesgos para las próximas 4-8 semanas y describir cómo se prepararía el negocio si se materializa. Cada riesgo:
- **Riesgo:** [descripción concreta, ej: "Si Solo Tinas sigue cayendo en share como en los últimos 4 meses, perderemos $X en revenue en T2"]
- **Probabilidad estimada:** [baja/media/alta basada en señales actuales]
- **Plan de contingencia:** [acción concreta para mitigarlo]
- **Indicador temprano:** [qué métrica vigilar semana a semana para detectar antes]

## 💡 Bonus
Uno o dos insights no obvios. Algo que solo aparece al cruzar 3+ datasets. Desarrollado (2-3 párrafos), no una frase suelta.

# CIERRE
Sin párrafo de despedida, sin "espero que sea útil", sin meta-comentarios. Termina en el Bonus.

# IMPORTANTE
- Densidad analítica > brevedad. Si los datos lo justifican, escribe largo. No hay penalización por extensión.
- Cada afirmación con datos. Cada número con su contexto histórico.
- El reporte debe ser legible de corrido, no como una lista de bullets sueltos.`

	dataJSON, err := json.MarshalIndent(salesData, "", "  ")
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Analiza estos datos semanales de ventas y reservas de Aremko Spa (spa boutique en Puerto Varas, Chile):

%s

Genera un análisis EJECUTIVO PROFUNDO siguiendo EXACTAMENTE la estructura especificada en el system prompt. Sin restricción de extensión: si los datos justifican un análisis de 4-6 páginas, escríbelo así. Prioriza cruzar múltiples datasets en cada sección sobre brevedad. Recuerda anclar cada afirmación a números concretos del payload.`, string(dataJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 6000)
}

// GenerateReviewsAnalysis genera un análisis completo de reputación online y encuestas
func (c *OpenRouterClient) GenerateReviewsAnalysis(ctx context.Context, reviewsData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un experto en gestión de reputación online y experiencia del cliente (CX) para hoteles y spas boutique.
Tu tarea es analizar datos de opiniones (Google, TripAdvisor, encuestas internas con NPS y calificaciones por dimensión) y entregar insights accionables para el equipo de Aremko Spa (Puerto Varas, Chile).

IMPORTANTE:
- Escribe un análisis de máximo 2 páginas (1000-1500 palabras)
- Usa lenguaje claro y directo, sin jerga innecesaria
- Enfócate en lo MÁS RELEVANTE y accionable
- Organiza el análisis en secciones claras con títulos
- Usa bullets (•) para listas, no números
- Destaca con **negritas** los puntos clave
- Incluye emojis relevantes (⭐ 📊 📈 📉 ⚠️ ✅ 🎯 💡 😊 😐 😡 💬 🛁 💆 🌿)

ESTRUCTURA DEL ANÁLISIS:

## ⭐ Resumen Ejecutivo
- 2-3 puntos clave sobre la reputación general
- ¿La marca está mejorando, estable o decayendo?
- Métrica más urgente para vigilar

## 📊 Posicionamiento Externo (Google y TripAdvisor)
- Comparativa de ratings y total de reseñas en ambas plataformas
- Cambios vs. snapshot anterior (rating_delta, total_delta)
- ¿En qué plataforma somos más fuertes? ¿Cuál hay que activar?

## 💬 NPS y Encuestas Internas
- Interpretar el NPS (excelente >70, muy bueno 50-70, bueno 30-50, regular 0-30, crítico <0)
- Distribución de promotores / pasivos / detractores
- ¿Cuántos pasivos podemos convertir en promotores con poco esfuerzo?

## 🎯 Dimensiones del Servicio (Calificaciones promedio)
Analiza las dimensiones más altas y más bajas del set de "calificaciones_promedio".
- Fortalezas claras (dimensiones con promedio ≥ 4.7/5)
- Áreas de mejora (dimensiones con promedio < 4.4/5)
- Insights por dimensión: ¿qué significa que "compra_web" sea baja vs. "limpieza_cabana" alta?

## 😊 Voz del Cliente (Reviews Destacadas)
- Patrones en los comentarios positivos: ¿qué palabras/temas se repiten?
- ¿Quiénes son nuestros embajadores naturales (masajistas, espacios, experiencia)?
- ¿Hay alguna persona del equipo mencionada por nombre que deba reconocerse?

## ⚠️ Puntos de Atención
- 3-5 alertas críticas (dimensiones bajas, detractores, falta de respuesta a reviews públicas)
- ¿Hay reviews recientes sin responder?

## 💡 Recomendaciones Accionables
- 5-7 acciones CONCRETAS para mejorar reputación
- Priorizar por impacto y facilidad
- Ejemplos:
  ✅ "Solicitar review en Google a los 9 promotores de la semana — multiplicaría +2% el rating"
  ✅ "Reconocer públicamente a Diana (mencionada por su nombre 3 veces) en redes"
  ✅ "Capacitar al equipo de ventas — atencion_ventas baja a 4.36 vs. servicio_masajes 4.66"
  ❌ "Mejorar el servicio" (vago)
  ❌ "Subir el NPS" (no accionable)`

	dataJSON, err := json.MarshalIndent(reviewsData, "", "  ")
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Analiza estos datos de reputación y opiniones de Aremko Spa (spa boutique en Puerto Varas, Chile):

%s

Genera un análisis completo y accionable siguiendo la estructura especificada.
Recuerda: máximo 2 páginas, enfoque en lo más relevante, recomendaciones concretas y simples.`, string(dataJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
}

// GenerateOverviewAnalysis genera un análisis integral cruzando todas las secciones
// del brief (web, social, ventas, opiniones, competencia) con plan de acción concreto.
func (c *OpenRouterClient) GenerateOverviewAnalysis(ctx context.Context, fullBriefData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un consultor senior de marketing y operaciones para Aremko Spa, spa boutique en Puerto Varas, Chile.
Tu tarea es analizar los datos COMPLETOS del brief semanal (web analytics, redes sociales, publicidad pagada,
ventas con tendencia trimestral, opiniones con calidad por dimensión, y competencia) y producir un análisis
INTEGRAL que cruza todas las áreas.

OBJETIVO: que el dueño del negocio en menos de 10 minutos sepa exactamente:
1. Qué está funcionando bien (para mantener / amplificar)
2. Qué está fallando (con la raíz, no el síntoma)
3. Qué hacer concretamente en los próximos 30 días

IMPORTANTE:
- Escribe un análisis estructurado de 2-3 páginas (1500-2500 palabras)
- Usa lenguaje claro y directo, sin jerga ni teoría
- Cita números específicos de los datos (no "creció", sino "creció 24%")
- Cuando hagas afirmaciones, anclalas a datos del payload
- Usa **negritas** en los puntos clave
- Usa bullets (•) para listas
- Emojis para escanear visualmente: 🟢 (bien) 🟡 (atención) 🔴 (crítico) 📈 📉 💰 🛁 💆 📸 ⭐ ⚡ 🎯 💡

ESTRUCTURA OBLIGATORIA:

## 🎯 Veredicto General
2-3 párrafos con el estado del negocio esta semana. Calificación 🟢/🟡/🔴 al inicio.
Una frase de "headline" tipo titular periodístico.

## 📊 Estado por Área
Una línea por área con calificación visual y dato más relevante:
- 🟢/🟡/🔴 **Web (GA4):** ... (cita métrica clave)
- 🟢/🟡/🔴 **Instagram Orgánico:** ...
- 🟢/🟡/🔴 **Meta Ads:** ...
- 🟢/🟡/🔴 **Ventas:** ...
- 🟢/🟡/🔴 **Opiniones:** ...
- 🟢/🟡/🔴 **Competencia:** ...

## 🔍 Hallazgos Cruzados (lo más valioso)
3-5 insights que sólo se ven al cruzar áreas. Ejemplos:
✅ "Web sube 15% en sesiones pero ventas siguen planas — problema de conversión, no de tráfico"
✅ "NPS alto (81) y dimensión 'compra_web' baja (3.86) — clientes felices presencialmente, pero la web es la fuga"
✅ "Mejor campaña Meta cuesta $31 CPC pero el ticket promedio es $90K — ROAS implícito altísimo, escalar"
❌ "Las ventas están bajando" (vago, no cruza áreas)

## 🏆 3 Cosas que Funcionan (mantener)
Por cada una: qué métrica lo prueba + cómo amplificarla
1. ...
2. ...
3. ...

## ⚠️ 3 Cosas que Fallan (atacar)
Por cada una: cuál es el síntoma, cuál es la raíz real, qué impacto tiene si no se atiende
1. ...
2. ...
3. ...

## 🎯 Plan de Acción - Próximos 30 Días
5-8 acciones CONCRETAS, ordenadas por prioridad (impacto × facilidad).
Por cada acción incluí:
- **Acción:** verbo + objeto específico (no "mejorar X" sino "lanzar pack Y con descuento Z%")
- **Por qué:** anclar al dato que la justifica
- **Cuándo:** semana 1 / semana 2 / semana 3-4
- **Métrica de éxito:** qué número subirá/bajará si funciona

## 👀 Para Vigilar la Próxima Semana
3-5 métricas específicas con valor de referencia (umbral) y por qué importa.
Ejemplo: "🔁 Recurrentes — esta semana 14, alerta si baja de 12 (perdiendo retención)"

## 💡 Idea Bonus
Una idea creativa o no obvia que surja al ver TODOS los datos juntos. Algo que el equipo
probablemente no esté considerando pero que el análisis sugiere.

REGLAS:
- No repitas datos sin agregar valor. Cada cifra debe servir para una decisión.
- No hagas recomendaciones genéricas tipo "mejorar el servicio al cliente". Sé específico.
- Si una métrica no está en el payload, no la inventes — di "dato no disponible".
- Si dos áreas se contradicen (ej. NPS alto pero churn alto), señalalo explícitamente.`

	// Adelgazar payload antes de enviar a IA (la key OpenRouter tiene cap de input ~11K tokens)
	leanData := trimForAIPrompt(fullBriefData)

	// Compactar JSON sin indentación: ahorra ~30% de tokens vs. MarshalIndent
	dataJSON, err := json.Marshal(leanData)
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Aquí tienes los datos COMPLETOS del brief semanal de Aremko Spa.
Incluye: web analytics (GA4), Instagram orgánico, Meta Ads, ventas con detalle por familia y matriz
de 12 semanas con clientes nuevos vs. recurrentes, opiniones con NPS y 12 dimensiones de calidad,
y competencia con precios y servicios.

%s

Genera el análisis integral siguiendo EXACTAMENTE la estructura especificada.
Tu trabajo es que el dueño tome 5 decisiones correctas la próxima semana en lugar de 5 decisiones genéricas.`, string(dataJSON))

	return c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userPrompt, "google/gemini-3.1-flash-lite", 0.7, 1500)
}

// VentasDetalleQuery is the structured shape the LLM must return when parsing
// a natural-language sales query. All dates are absolute YYYY-MM-DD.
type VentasDetalleQuery struct {
	FechaDesde string `json:"fecha_desde"`
	FechaHasta string `json:"fecha_hasta"`
	Familia    string `json:"familia,omitempty"`
	Servicio   string `json:"servicio,omitempty"`
	Proveedor  string `json:"proveedor,omitempty"`
	Cliente    string `json:"cliente,omitempty"`
	Error      string `json:"error,omitempty"`
}

// ParseVentasDetalleQuery uses the LLM in JSON-only mode to convert a user
// question into a structured query for the /bookings/detalle/ endpoint.
// hoy must be passed in YYYY-MM-DD so relative dates ("ayer", "este mes") resolve correctly.
func (c *OpenRouterClient) ParseVentasDetalleQuery(ctx context.Context, userQuery, hoy string) (*VentasDetalleQuery, *LLMResult, error) {
	systemPrompt := fmt.Sprintf(`Eres un parser que convierte preguntas en español sobre ventas de Aremko Spa
en parámetros estructurados para una API. Hoy es %s.

DEVUELVE SOLAMENTE UN JSON VÁLIDO con esta forma exacta:
{
  "fecha_desde": "YYYY-MM-DD o vacío si se filtra por cliente",
  "fecha_hasta": "YYYY-MM-DD o vacío si se filtra por cliente",
  "familia": "tinas" | "masajes" | "cabanas" | "otros" | "",
  "servicio": "<texto parcial del nombre del servicio, o vacío>",
  "proveedor": "<nombre o parte del nombre del masajista/proveedor que atendió, o vacío>",
  "cliente": "<nombre, teléfono, email o RUT del cliente, o vacío>",
  "error": "<solo si no puedes parsear la pregunta>"
}

REGLAS:
- fecha_desde y fecha_hasta:
  • Son OBLIGATORIOS si NO hay filtro de cliente.
  • Son OPCIONALES (pueden quedar "") si hay filtro de cliente — sin fechas se busca toda la historia del cliente.
  • Si solo se menciona una fecha puntual, usar la misma en ambas.
- Convierte fechas relativas a absolutas usando hoy=%s. "ayer" = hoy-1d. "esta semana" = lunes a domingo de la semana actual. "este mes" = primer día del mes actual a hoy. "mayo" sin año = mayo del año actual.
- familia debe ser uno de: tinas, masajes, cabanas, otros (en minúsculas, sin acentos). Si no menciona familia, dejar "".
- servicio busca por nombre del SERVICIO (ej: "tui-na", "sueco", "descontracturante"). NO uses servicio para nombres de personas.
- proveedor busca por MASAJISTA/PROVEEDOR (ej: "Paul", "Diana", "Sandra"). Cuando la pregunta dice "masajes de X" o "atendido por X" o "qué hizo X", X va en proveedor. PERO si X es claramente un cliente (ver siguiente regla), usar cliente.
- cliente busca por CLIENTE de Aremko. Detectar cliente cuando:
  • Aparece un teléfono (formato chileno: +56xxxxxxxxx, 56xxxxxxxxx, 9xxxxxxxx, o números largos con o sin +/espacios)
  • Aparece un email (contiene @)
  • Aparece un RUT chileno (formato xx.xxx.xxx-x o xxxxxxxx-x o solo dígitos largos con guión)
  • La pregunta dice claramente "cliente X", "el cliente X", "le hemos vendido a X", "ventas a X", "compras de X", "X es un cliente"
  Pasar al cliente el valor literal (ej: el teléfono completo, el email entero, el nombre completo). NO mezclar con proveedor.
- Si NO hay cliente y el rango supera 3 meses, llena "error": "rango máximo permitido es 3 meses cuando no se filtra por cliente".
- Si la pregunta no se trata de ventas, llena "error": "solo puedo responder preguntas de ventas".
- NO incluyas explicación. NO uses markdown. Solo el JSON.

EJEMPLOS:
Pregunta: "ventas del 1 de mayo de 2026 familia masajes"
Respuesta: {"fecha_desde":"2026-05-01","fecha_hasta":"2026-05-01","familia":"masajes","servicio":"","proveedor":"","cliente":""}

Pregunta: "ventas de masaje sueco en abril"
Respuesta: {"fecha_desde":"2026-04-01","fecha_hasta":"2026-04-30","familia":"masajes","servicio":"sueco","proveedor":"","cliente":""}

Pregunta: "masajes de Paul en mayo 2026"
Respuesta: {"fecha_desde":"2026-05-01","fecha_hasta":"2026-05-31","familia":"masajes","servicio":"","proveedor":"Paul","cliente":""}

Pregunta: "cuántas ventas le hemos hecho al cliente +56958655810"
Respuesta: {"fecha_desde":"","fecha_hasta":"","familia":"","servicio":"","proveedor":"","cliente":"+56958655810"}

Pregunta: "historial del cliente ana.perez@gmail.com"
Respuesta: {"fecha_desde":"","fecha_hasta":"","familia":"","servicio":"","proveedor":"","cliente":"ana.perez@gmail.com"}

Pregunta: "qué compró Juan Pérez"
Respuesta: {"fecha_desde":"","fecha_hasta":"","familia":"","servicio":"","proveedor":"","cliente":"Juan Pérez"}

Pregunta: "ventas a 12345678-9 en 2025"
Respuesta: {"fecha_desde":"2025-01-01","fecha_hasta":"2025-12-31","familia":"","servicio":"","proveedor":"","cliente":"12345678-9"}

Pregunta: "qué clima hay hoy"
Respuesta: {"fecha_desde":"","fecha_hasta":"","familia":"","servicio":"","proveedor":"","cliente":"","error":"solo puedo responder preguntas de ventas"}`, hoy, hoy)

	res, err := c.Generate(ctx, c.wrapSystemPrompt(systemPrompt), userQuery, "google/gemini-3.1-flash-lite", 0.0, 200)
	if err != nil {
		return nil, res, err
	}
	if res.Error != "" {
		return nil, res, fmt.Errorf("LLM error: %s", res.Error)
	}

	text := res.Text
	// El modelo a veces envuelve JSON en ```json ... ```; lo descartamos.
	if start := bytes.IndexByte([]byte(text), '{'); start >= 0 {
		if end := bytes.LastIndexByte([]byte(text), '}'); end > start {
			text = text[start : end+1]
		}
	}

	var q VentasDetalleQuery
	if err := json.Unmarshal([]byte(text), &q); err != nil {
		return nil, res, fmt.Errorf("LLM devolvió JSON inválido: %v (raw: %s)", err, res.Text)
	}
	return &q, res, nil
}

// trimForAIPrompt reduce el tamaño del payload para que entre en el límite de input
// tokens de la API key. Trunca textos largos y limita listas a las entradas más relevantes.
func trimForAIPrompt(data map[string]interface{}) map[string]interface{} {
	truncStr := func(s string, maxLen int) string {
		if len(s) <= maxLen {
			return s
		}
		return s[:maxLen] + "…"
	}

	// Deep copy con trim selectivo. Trabajamos sobre una copia para no mutar el original.
	result := map[string]interface{}{}
	for k, v := range data {
		result[k] = v
	}

	// Instagram: top_posts → 3 entradas, caption truncado a 120, sin media_url
	if igRaw, ok := result["instagram_organic"].(map[string]interface{}); ok {
		ig := map[string]interface{}{}
		for k, v := range igRaw {
			ig[k] = v
		}
		if postsRaw, ok := ig["top_posts"].([]interface{}); ok {
			limit := 3
			if len(postsRaw) < limit {
				limit = len(postsRaw)
			}
			trimmed := make([]map[string]interface{}, 0, limit)
			for i := 0; i < limit; i++ {
				post, ok := postsRaw[i].(map[string]interface{})
				if !ok {
					continue
				}
				lean := map[string]interface{}{
					"like_count":      post["like_count"],
					"comments_count":  post["comments_count"],
					"saved_count":     post["saved_count"],
					"engagement_rate": post["engagement_rate"],
				}
				if cap, ok := post["caption"].(string); ok {
					lean["caption"] = truncStr(cap, 120)
				}
				if mt, ok := post["media_type"]; ok {
					lean["media_type"] = mt
				}
				trimmed = append(trimmed, lean)
			}
			ig["top_posts"] = trimmed
		}
		result["instagram_organic"] = ig
	}

	// Meta Ads: recent_campaigns → 5 entradas, name truncado a 80, sin id
	if metaRaw, ok := result["meta_ads"].(map[string]interface{}); ok {
		meta := map[string]interface{}{}
		for k, v := range metaRaw {
			meta[k] = v
		}
		if recentRaw, ok := meta["recent_campaigns"].([]interface{}); ok {
			limit := 5
			if len(recentRaw) < limit {
				limit = len(recentRaw)
			}
			trimmed := make([]map[string]interface{}, 0, limit)
			for i := 0; i < limit; i++ {
				c, ok := recentRaw[i].(map[string]interface{})
				if !ok {
					continue
				}
				lean := map[string]interface{}{}
				for _, key := range []string{"spend", "impressions", "clicks", "reach", "ctr", "cpc", "cpm"} {
					if v, ok := c[key]; ok {
						lean[key] = v
					}
				}
				if name, ok := c["name"].(string); ok {
					lean["name"] = truncStr(name, 80)
				}
				trimmed = append(trimmed, lean)
			}
			meta["recent_campaigns"] = trimmed
		}
		// también truncar nombre de best/worst campaign
		for _, key := range []string{"best_campaign", "worst_campaign"} {
			if camp, ok := meta[key].(map[string]interface{}); ok {
				clean := map[string]interface{}{}
				for k, v := range camp {
					clean[k] = v
				}
				if name, ok := camp["name"].(string); ok {
					clean["name"] = truncStr(name, 80)
				}
				meta[key] = clean
			}
		}
		result["meta_ads"] = meta
	}

	// Competidores: dropear textos largos del snapshot que no aportan al análisis
	if compRaw, ok := result["competitors"].(map[string]interface{}); ok {
		comp := map[string]interface{}{}
		for k, v := range compRaw {
			comp[k] = v
		}
		if listRaw, ok := comp["competitors"].([]interface{}); ok {
			trimmed := make([]map[string]interface{}, 0, len(listRaw))
			for _, item := range listRaw {
				c, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				lean := map[string]interface{}{
					"nombre":            c["nombre"],
					"website":           c["website"],
					"last_scrape_error": c["last_scrape_error"],
				}
				if snap, ok := c["snapshot"].(map[string]interface{}); ok {
					leanSnap := map[string]interface{}{
						"scraping_exitoso":      snap["scraping_exitoso"],
						"precio_entrada_adulto": snap["precio_entrada_adulto"],
						"precio_entrada_nino":   snap["precio_entrada_nino"],
						"servicios":             snap["servicios"],
					}
					lean["snapshot"] = leanSnap
				}
				trimmed = append(trimmed, lean)
			}
			comp["competitors"] = trimmed
		}
		result["competitors"] = comp
	}

	// Reviews: limitar destacadas a 3 con comentario truncado a 100, recent a 3
	if revRaw, ok := result["reviews"].(map[string]interface{}); ok {
		rev := map[string]interface{}{}
		for k, v := range revRaw {
			rev[k] = v
		}
		if surveys, ok := rev["surveys"].(map[string]interface{}); ok {
			s := map[string]interface{}{}
			for k, v := range surveys {
				s[k] = v
			}
			if featRaw, ok := s["reviews_destacadas"].([]interface{}); ok {
				limit := 3
				if len(featRaw) < limit {
					limit = len(featRaw)
				}
				out := make([]map[string]interface{}, 0, limit)
				for i := 0; i < limit; i++ {
					f, ok := featRaw[i].(map[string]interface{})
					if !ok {
						continue
					}
					lean := map[string]interface{}{}
					for k, v := range f {
						lean[k] = v
					}
					if c, ok := f["comentario"].(string); ok {
						lean["comentario"] = truncStr(c, 100)
					}
					out = append(out, lean)
				}
				s["reviews_destacadas"] = out
			}
			rev["surveys"] = s
		}
		if recentRaw, ok := rev["recent"].([]interface{}); ok {
			limit := 3
			if len(recentRaw) < limit {
				limit = len(recentRaw)
			}
			rev["recent"] = recentRaw[:limit]
		}
		result["reviews"] = rev
	}

	// Web analytics: top_pages a 5, traffic_sources a 5
	if webRaw, ok := result["web_analytics"].(map[string]interface{}); ok {
		web := map[string]interface{}{}
		for k, v := range webRaw {
			web[k] = v
		}
		if tp, ok := web["top_pages"].([]interface{}); ok && len(tp) > 5 {
			web["top_pages"] = tp[:5]
		}
		if ts, ok := web["traffic_sources"].([]interface{}); ok && len(ts) > 5 {
			web["traffic_sources"] = ts[:5]
		}
		result["web_analytics"] = web
	}

	return result
}
