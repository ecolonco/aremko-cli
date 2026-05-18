package social

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type InstagramClient struct {
	accessToken string
	httpClient  *http.Client
}

type InstagramInsights struct {
	AccountID       string                   `json:"account_id"`
	Username        string                   `json:"username"`
	FollowersCount  int64                    `json:"followers_count"`
	FollowsCount    int64                    `json:"follows_count"`
	MediaCount      int64                    `json:"media_count"`
	WeeklyInsights  []WeeklyInstagramMetrics `json:"weekly_insights"`
	TopPosts        []InstagramPost          `json:"top_posts"`
	ProfilePicture  string                   `json:"profile_picture_url"`
}

type WeeklyInstagramMetrics struct {
	WeekLabel       string    `json:"week_label"`
	StartDate       string    `json:"start_date"`
	EndDate         string    `json:"end_date"`
	Reach           int64     `json:"reach"`
	Impressions     int64     `json:"impressions"`
	ProfileViews    int64     `json:"profile_views"`
	WebsiteClicks   int64     `json:"website_clicks"`
	EngagementRate  float64   `json:"engagement_rate"`
}

type InstagramPost struct {
	ID             string    `json:"id"`
	Caption        string    `json:"caption"`
	MediaType      string    `json:"media_type"`
	MediaURL       string    `json:"media_url"`
	Permalink      string    `json:"permalink"`
	Timestamp      time.Time `json:"timestamp"`
	LikeCount      int64     `json:"like_count"`
	CommentsCount  int64     `json:"comments_count"`
	SavesCount     int64     `json:"saves_count"`
	Reach          int64     `json:"reach"`
	Impressions    int64     `json:"impressions"`
	Engagement     int64     `json:"engagement"`
	EngagementRate float64   `json:"engagement_rate"`
}

func NewInstagramClient(accessToken string) *InstagramClient {
	return &InstagramClient{
		accessToken: accessToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetAccountInfo obtiene información básica de la cuenta de Instagram
func (c *InstagramClient) GetAccountInfo(ctx context.Context) (map[string]interface{}, error) {
	// Primero necesitamos obtener el Instagram Business Account ID desde las páginas de Facebook
	pagesURL := fmt.Sprintf("https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account&access_token=%s", c.accessToken)

	req, err := http.NewRequestWithContext(ctx, "GET", pagesURL, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching pages: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var pagesResp struct {
		Data []struct {
			InstagramBusinessAccount struct {
				ID string `json:"id"`
			} `json:"instagram_business_account"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &pagesResp); err != nil {
		return nil, fmt.Errorf("error parsing pages response: %w", err)
	}

	if len(pagesResp.Data) == 0 || pagesResp.Data[0].InstagramBusinessAccount.ID == "" {
		return nil, fmt.Errorf("no Instagram Business Account found")
	}

	igAccountID := pagesResp.Data[0].InstagramBusinessAccount.ID

	// Ahora obtenemos la información de la cuenta de Instagram
	igURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s?fields=username,followers_count,follows_count,media_count,profile_picture_url&access_token=%s", igAccountID, c.accessToken)

	req, err = http.NewRequestWithContext(ctx, "GET", igURL, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating IG request: %w", err)
	}

	resp, err = c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching IG account: %w", err)
	}
	defer resp.Body.Close()

	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading IG response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IG API error (status %d): %s", resp.StatusCode, string(body))
	}

	var accountInfo map[string]interface{}
	if err := json.Unmarshal(body, &accountInfo); err != nil {
		return nil, fmt.Errorf("error parsing IG account: %w", err)
	}

	accountInfo["account_id"] = igAccountID

	return accountInfo, nil
}

// GetWeeklyInsights obtiene insights de las últimas 4 semanas
func (c *InstagramClient) GetWeeklyInsights(ctx context.Context, accountID string) ([]WeeklyInstagramMetrics, error) {
	var weeks []WeeklyInstagramMetrics
	now := time.Now()

	for i := 0; i < 4; i++ {
		weekEnd := now.AddDate(0, 0, -1-(i*7))
		weekStart := weekEnd.AddDate(0, 0, -6)

		startDate := weekStart.Unix()
		endDate := weekEnd.Unix()

		// Obtener insights de la cuenta para este período
		metricsURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/insights?metric=reach,impressions,profile_views,website_clicks&period=day&since=%d&until=%d&access_token=%s",
			accountID, startDate, endDate, c.accessToken)

		req, err := http.NewRequestWithContext(ctx, "GET", metricsURL, nil)
		if err != nil {
			continue
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			continue
		}

		var insightsResp struct {
			Data []struct {
				Name   string `json:"name"`
				Values []struct {
					Value int64 `json:"value"`
				} `json:"values"`
			} `json:"data"`
		}

		if err := json.Unmarshal(body, &insightsResp); err != nil {
			continue
		}

		weekMetrics := WeeklyInstagramMetrics{
			StartDate: weekStart.Format("2006-01-02"),
			EndDate:   weekEnd.Format("2006-01-02"),
		}

		if i == 0 {
			weekMetrics.WeekLabel = "Esta semana"
		} else if i == 1 {
			weekMetrics.WeekLabel = "Semana pasada"
		} else {
			weekMetrics.WeekLabel = fmt.Sprintf("Semana %d", 4-i)
		}

		// Sumar valores de toda la semana
		for _, metric := range insightsResp.Data {
			var total int64
			for _, v := range metric.Values {
				total += v.Value
			}

			switch metric.Name {
			case "reach":
				weekMetrics.Reach = total
			case "impressions":
				weekMetrics.Impressions = total
			case "profile_views":
				weekMetrics.ProfileViews = total
			case "website_clicks":
				weekMetrics.WebsiteClicks = total
			}
		}

		// Calcular engagement rate aproximado
		if weekMetrics.Reach > 0 {
			weekMetrics.EngagementRate = float64(weekMetrics.ProfileViews) / float64(weekMetrics.Reach) * 100
		}

		weeks = append(weeks, weekMetrics)
	}

	// Invertir para que la semana más antigua esté primero
	for i, j := 0, len(weeks)-1; i < j; i, j = i+1, j-1 {
		weeks[i], weeks[j] = weeks[j], weeks[i]
	}

	return weeks, nil
}

// GetTopPosts obtiene los posts más recientes con mejor engagement
func (c *InstagramClient) GetTopPosts(ctx context.Context, accountID string, limit int) ([]InstagramPost, error) {
	// Obtener posts recientes
	postsURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=%d&access_token=%s",
		accountID, limit*2, c.accessToken) // Pedimos el doble para tener margen

	req, err := http.NewRequestWithContext(ctx, "GET", postsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating posts request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching posts: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading posts response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("posts API error (status %d): %s", resp.StatusCode, string(body))
	}

	var postsResp struct {
		Data []struct {
			ID            string `json:"id"`
			Caption       string `json:"caption"`
			MediaType     string `json:"media_type"`
			MediaURL      string `json:"media_url"`
			Permalink     string `json:"permalink"`
			Timestamp     string `json:"timestamp"`
			LikeCount     int64  `json:"like_count"`
			CommentsCount int64  `json:"comments_count"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &postsResp); err != nil {
		return nil, fmt.Errorf("error parsing posts: %w", err)
	}

	var posts []InstagramPost
	for _, p := range postsResp.Data {
		timestamp, _ := time.Parse(time.RFC3339, p.Timestamp)

		engagement := p.LikeCount + p.CommentsCount

		post := InstagramPost{
			ID:            p.ID,
			Caption:       p.Caption,
			MediaType:     p.MediaType,
			MediaURL:      p.MediaURL,
			Permalink:     p.Permalink,
			Timestamp:     timestamp,
			LikeCount:     p.LikeCount,
			CommentsCount: p.CommentsCount,
			Engagement:    engagement,
		}

		// Intentar obtener insights del post (reach, impressions)
		insightsURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/insights?metric=reach,impressions,saved&access_token=%s",
			p.ID, c.accessToken)

		if insightsReq, err := http.NewRequestWithContext(ctx, "GET", insightsURL, nil); err == nil {
			if insightsResp, err := c.httpClient.Do(insightsReq); err == nil {
				insightsBody, _ := io.ReadAll(insightsResp.Body)
				insightsResp.Body.Close()

				var insights struct {
					Data []struct {
						Name  string `json:"name"`
						Values []struct {
							Value int64 `json:"value"`
						} `json:"values"`
					} `json:"data"`
				}

				if json.Unmarshal(insightsBody, &insights) == nil {
					for _, metric := range insights.Data {
						if len(metric.Values) > 0 {
							switch metric.Name {
							case "reach":
								post.Reach = metric.Values[0].Value
							case "impressions":
								post.Impressions = metric.Values[0].Value
							case "saved":
								post.SavesCount = metric.Values[0].Value
							}
						}
					}

					// Calcular engagement rate
					if post.Reach > 0 {
						post.EngagementRate = float64(engagement+post.SavesCount) / float64(post.Reach) * 100
					}
				}
			}
		}

		posts = append(posts, post)

		if len(posts) >= limit {
			break
		}
	}

	return posts, nil
}
