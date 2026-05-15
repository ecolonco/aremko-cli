package competitors

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/net/html"
)

// CompetitorData represents scraped data from a competitor's website
type CompetitorData struct {
	CompetitorName string
	Website        string
	ScrapedAt      time.Time

	// Prices (in CLP)
	PrecioEntradaAdulto *float64
	PrecioEntradaNino   *float64

	// Services detected
	TienePiscinasTermales bool
	TieneMasajes          bool
	TieneRestaurant       bool
	TieneAlojamiento      bool

	// Other extracted data
	HorarioTexto     string
	Promociones      string
	MetaDescription  string

	// Scraping status
	ScrapingExitoso bool
	ErrorMensaje    string
}

// Scraper handles web scraping for competitors
type Scraper struct {
	HTTPClient *http.Client
	UserAgent  string
}

// NewScraper creates a new competitor scraper
func NewScraper() *Scraper {
	return &Scraper{
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		UserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
	}
}

// ScrapeCompetitor scrapes data from a competitor's website
func (s *Scraper) ScrapeCompetitor(competitorName, website string) *CompetitorData {
	data := &CompetitorData{
		CompetitorName:  competitorName,
		Website:         website,
		ScrapedAt:       time.Now(),
		ScrapingExitoso: false,
	}

	// Fetch HTML
	htmlContent, err := s.fetchHTML(website)
	if err != nil {
		data.ErrorMensaje = fmt.Sprintf("Error fetching HTML: %v", err)
		return data
	}

	// Parse HTML and extract data based on competitor
	switch competitorName {
	case "Cancagua":
		s.parseCancagua(htmlContent, data)
	case "Termas del Sol":
		s.parseTermasDelSol(htmlContent, data)
	case "Termas Cochamo":
		s.parseTermasCochamo(htmlContent, data)
	case "Alma Lemu":
		s.parseAlmaLemu(htmlContent, data)
	default:
		s.parseGeneric(htmlContent, data)
	}

	data.ScrapingExitoso = true
	return data
}

// fetchHTML fetches HTML content from a URL
func (s *Scraper) fetchHTML(url string) (string, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", s.UserAgent)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// parseCancagua extracts data specific to Cancagua
func (s *Scraper) parseCancagua(htmlContent string, data *CompetitorData) {
	// Extract meta description
	data.MetaDescription = s.extractMetaDescription(htmlContent)

	// Detect services by keyword search
	lowerHTML := strings.ToLower(htmlContent)
	data.TienePiscinasTermales = strings.Contains(lowerHTML, "piscina") || strings.Contains(lowerHTML, "termal")
	data.TieneMasajes = strings.Contains(lowerHTML, "masaje")
	data.TieneRestaurant = strings.Contains(lowerHTML, "restaurant") || strings.Contains(lowerHTML, "cafetería")
	data.TieneAlojamiento = strings.Contains(lowerHTML, "alojamiento") || strings.Contains(lowerHTML, "cabaña")

	// Try to extract prices (simple heuristic: look for $XX.XXX or $X.XXX patterns)
	if precio := s.extractPriceFromText(htmlContent); precio != nil {
		data.PrecioEntradaAdulto = precio
	}

	// Extract schedule if present
	data.HorarioTexto = s.extractScheduleInfo(htmlContent)

	// Extract promotions
	data.Promociones = s.extractPromotions(htmlContent)
}

// parseTermasDelSol extracts data for Termas del Sol
func (s *Scraper) parseTermasDelSol(htmlContent string, data *CompetitorData) {
	data.MetaDescription = s.extractMetaDescription(htmlContent)

	lowerHTML := strings.ToLower(htmlContent)
	data.TienePiscinasTermales = true // Known to have thermal pools
	data.TieneMasajes = strings.Contains(lowerHTML, "masaje")
	data.TieneRestaurant = strings.Contains(lowerHTML, "restaurant")
	data.TieneAlojamiento = strings.Contains(lowerHTML, "hotel") || strings.Contains(lowerHTML, "habitación")

	if precio := s.extractPriceFromText(htmlContent); precio != nil {
		data.PrecioEntradaAdulto = precio
	}

	data.HorarioTexto = s.extractScheduleInfo(htmlContent)
	data.Promociones = s.extractPromotions(htmlContent)
}

// parseTermasCochamo extracts data for Termas Cochamo
func (s *Scraper) parseTermasCochamo(htmlContent string, data *CompetitorData) {
	data.MetaDescription = s.extractMetaDescription(htmlContent)

	lowerHTML := strings.ToLower(htmlContent)
	data.TienePiscinasTermales = true
	data.TieneMasajes = strings.Contains(lowerHTML, "masaje")
	data.TieneRestaurant = strings.Contains(lowerHTML, "restaurant")
	data.TieneAlojamiento = strings.Contains(lowerHTML, "alojamiento")

	if precio := s.extractPriceFromText(htmlContent); precio != nil {
		data.PrecioEntradaAdulto = precio
	}

	data.HorarioTexto = s.extractScheduleInfo(htmlContent)
	data.Promociones = s.extractPromotions(htmlContent)
}

// parseAlmaLemu extracts data for Alma Lemu
func (s *Scraper) parseAlmaLemu(htmlContent string, data *CompetitorData) {
	data.MetaDescription = s.extractMetaDescription(htmlContent)

	lowerHTML := strings.ToLower(htmlContent)
	data.TienePiscinasTermales = strings.Contains(lowerHTML, "termal") || strings.Contains(lowerHTML, "piscina")
	data.TieneMasajes = strings.Contains(lowerHTML, "masaje") || strings.Contains(lowerHTML, "spa")
	data.TieneRestaurant = strings.Contains(lowerHTML, "restaurant")
	data.TieneAlojamiento = strings.Contains(lowerHTML, "alojamiento") || strings.Contains(lowerHTML, "glamping")

	if precio := s.extractPriceFromText(htmlContent); precio != nil {
		data.PrecioEntradaAdulto = precio
	}

	data.HorarioTexto = s.extractScheduleInfo(htmlContent)
	data.Promociones = s.extractPromotions(htmlContent)
}

// parseGeneric provides basic parsing for unknown competitors
func (s *Scraper) parseGeneric(htmlContent string, data *CompetitorData) {
	data.MetaDescription = s.extractMetaDescription(htmlContent)

	lowerHTML := strings.ToLower(htmlContent)
	data.TienePiscinasTermales = strings.Contains(lowerHTML, "piscina") || strings.Contains(lowerHTML, "termal")
	data.TieneMasajes = strings.Contains(lowerHTML, "masaje")
	data.TieneRestaurant = strings.Contains(lowerHTML, "restaurant")
	data.TieneAlojamiento = strings.Contains(lowerHTML, "alojamiento")

	if precio := s.extractPriceFromText(htmlContent); precio != nil {
		data.PrecioEntradaAdulto = precio
	}

	data.HorarioTexto = s.extractScheduleInfo(htmlContent)
	data.Promociones = s.extractPromotions(htmlContent)
}

// extractMetaDescription extracts meta description from HTML
func (s *Scraper) extractMetaDescription(htmlContent string) string {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return ""
	}

	var description string
	var findMeta func(*html.Node)
	findMeta = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "meta" {
			var name, content string
			for _, attr := range n.Attr {
				if attr.Key == "name" && attr.Val == "description" {
					name = "description"
				}
				if attr.Key == "content" {
					content = attr.Val
				}
			}
			if name == "description" && content != "" {
				description = content
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findMeta(c)
		}
	}
	findMeta(doc)

	if len(description) > 300 {
		description = description[:300]
	}

	return description
}

// extractPriceFromText tries to find price patterns in text (e.g., $25.000, $25000)
func (s *Scraper) extractPriceFromText(text string) *float64 {
	// Simple regex-like search for Chilean peso patterns
	// Look for: $XX.XXX or $XXXXX or entrada + number
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		line = strings.ToLower(line)
		if strings.Contains(line, "entrada") || strings.Contains(line, "precio") {
			// Try to extract number
			words := strings.Fields(line)
			for _, word := range words {
				word = strings.ReplaceAll(word, "$", "")
				word = strings.ReplaceAll(word, ".", "")
				word = strings.ReplaceAll(word, ",", "")

				// Check if it's a reasonable price (between 5000 and 50000 CLP)
				if len(word) >= 4 && len(word) <= 6 {
					var price float64
					if _, err := fmt.Sscanf(word, "%f", &price); err == nil {
						if price >= 5000 && price <= 50000 {
							return &price
						}
					}
				}
			}
		}
	}
	return nil
}

// extractScheduleInfo tries to find schedule/hours information
func (s *Scraper) extractScheduleInfo(htmlContent string) string {
	lines := strings.Split(htmlContent, "\n")
	for _, line := range lines {
		line = strings.ToLower(strings.TrimSpace(line))
		if strings.Contains(line, "horario") || strings.Contains(line, "abierto") ||
		   strings.Contains(line, "lunes") || strings.Contains(line, "monday") {
			if len(line) > 0 && len(line) < 200 {
				return strings.TrimSpace(line)
			}
		}
	}
	return ""
}

// extractPromotions tries to find promotion information
func (s *Scraper) extractPromotions(htmlContent string) string {
	lines := strings.Split(htmlContent, "\n")
	var promotions []string

	for _, line := range lines {
		line = strings.ToLower(strings.TrimSpace(line))
		if strings.Contains(line, "promoción") || strings.Contains(line, "descuento") ||
		   strings.Contains(line, "oferta") || strings.Contains(line, "especial") {
			if len(line) > 10 && len(line) < 200 {
				promotions = append(promotions, strings.TrimSpace(line))
			}
		}
	}

	if len(promotions) > 0 {
		return strings.Join(promotions[:min(3, len(promotions))], " | ")
	}

	return ""
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
