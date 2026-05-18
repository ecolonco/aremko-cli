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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.8, 4000)
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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 4000)
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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
}

// GenerateSalesAnalysis genera un análisis completo de las ventas y reservas del sistema
func (c *OpenRouterClient) GenerateSalesAnalysis(ctx context.Context, salesData map[string]interface{}) (*LLMResult, error) {
	systemPrompt := `Eres un experto en análisis de ventas y operaciones de un spa boutique.
Tu tarea es analizar datos de ventas y reservas de la semana, comparándolos con el mes anterior y el año anterior, para entregar insights accionables al equipo de Aremko Spa (Puerto Varas, Chile).

IMPORTANTE:
- Escribe un análisis de máximo 2 páginas (1000-1500 palabras)
- Usa lenguaje claro y directo, sin jerga innecesaria
- Enfócate en lo MÁS RELEVANTE y accionable
- Organiza el análisis en secciones claras con títulos
- Usa bullets (•) para listas, no números
- Destaca con **negritas** los puntos clave
- Incluye emojis relevantes (💰 📊 📈 📉 ⚠️ ✅ 🎯 💡 🛁 💆 🌿 🆕 🔁)
- Los montos están en pesos chilenos (CLP)

ESTRUCTURA DEL ANÁLISIS:

## 📊 Resumen Ejecutivo
- 2-3 puntos clave sobre el rendimiento de la semana
- ¿Vamos mejor o peor que el mes anterior y que el año anterior?
- Tendencia general (crecimiento, declive, estable)

## 💰 Rendimiento Financiero
- Ingresos totales y ticket promedio
- Comparativa con mes anterior y año anterior (porcentaje)
- Estado de los pagos (pagadas / pendientes / parciales)

## 🛁 Mix de Servicios
- ¿Qué familia(s) de servicios están creciendo? ¿Cuáles cayendo?
- Identificar la familia más rentable de la semana
- Riesgos por concentración (¿demasiado dependientes de una sola familia?)

## 💳 Comportamiento de Pago
- Tendencias por método de pago (Mercado Pago, Flow, Gift Card, etc.)
- Cambios relevantes vs. períodos anteriores
- ¿Hay algún método que esté ganando o perdiendo participación?

## 🆕 Clientes
- Nuevos vs. recurrentes esta semana
- ¿La adquisición está sana? ¿La retención está fallando?
- Implicaciones para marketing y CRM

## ⚠️ Puntos de Atención
- 3-5 problemas críticos detectados en los datos
- Ser específico sobre qué métrica empeora y por qué importa

## 💡 Recomendaciones Accionables
- 5-7 acciones CONCRETAS para la próxima semana
- Priorizar por impacto y facilidad de ejecución
- Ejemplos: ajustar precios de pack, lanzar promo en familia que cae,
  reactivar clientes inactivos, mover inversión publicitaria a la familia
  que mejor convierte, etc.

Ejemplos de recomendaciones:
✅ "Lanzar pack 'Tinas + Masaje' con 10% de descuento para revertir la caída de 25% YoY en Tinas"
✅ "Activar campaña de reactivación SMS — sólo 1 cliente recurrente esta semana vs. 20 nuevos"
❌ "Mejorar las ventas" (vago)
❌ "Aumentar el ticket promedio" (no es accionable)`

	dataJSON, err := json.MarshalIndent(salesData, "", "  ")
	if err != nil {
		return &LLMResult{Error: fmt.Sprintf("error marshaling data: %v", err)}, err
	}

	userPrompt := fmt.Sprintf(`Analiza estos datos semanales de ventas y reservas de Aremko Spa (spa boutique en Puerto Varas, Chile):

%s

Genera un análisis completo y accionable siguiendo la estructura especificada.
Recuerda: máximo 2 páginas, enfoque en lo más relevante, recomendaciones concretas y simples.`, string(dataJSON))

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
}
