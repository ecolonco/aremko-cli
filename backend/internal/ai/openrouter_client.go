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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 2000)
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

	return c.Generate(ctx, systemPrompt, userPrompt, "google/gemini-3.1-flash-lite", 0.7, 1500)
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
