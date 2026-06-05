package social

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"time"
)

// FacebookClient consulta la Página de Facebook (orgánico): info de la página y
// posts recientes con engagement. Espejo de InstagramClient.
type FacebookClient struct {
	accessToken string
	httpClient  *http.Client
}

type FacebookInsights struct {
	PageID         string         `json:"page_id"`
	Name           string         `json:"name"`
	FanCount       int64          `json:"fan_count"`
	FollowersCount int64          `json:"followers_count"`
	TopPosts       []FacebookPost `json:"top_posts"`
}

type FacebookPost struct {
	ID             string    `json:"id"`
	Message        string    `json:"message"`
	Permalink      string    `json:"permalink"`
	Timestamp      time.Time `json:"timestamp"`
	Reactions      int64     `json:"reactions"`
	Comments       int64     `json:"comments_count"`
	Shares         int64     `json:"shares"`
	Reach          int64     `json:"reach"`
	Impressions    int64     `json:"impressions"`
	Engagement     int64     `json:"engagement"`
	EngagementRate float64   `json:"engagement_rate"`
}

func NewFacebookClient(accessToken string) *FacebookClient {
	return &FacebookClient{
		accessToken: accessToken,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// GetPageInsights obtiene la Página gestionada + sus posts recientes con engagement.
// reactions/comments/shares vienen por campos (confiables). reach/impressions por
// insights (post_impressions_unique) — Meta los deprecará el 15-jun-2026; si fallan,
// se loguea y se sigue sin reach.
func (c *FacebookClient) GetPageInsights(ctx context.Context, limit int) (*FacebookInsights, error) {
	pagesURL := fmt.Sprintf("https://graph.facebook.com/v21.0/me/accounts?fields=id,name,fan_count,followers_count,access_token&access_token=%s", c.accessToken)
	req, err := http.NewRequestWithContext(ctx, "GET", pagesURL, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating FB pages request: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error fetching FB pages: %w", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("FB pages API error (status %d): %s", resp.StatusCode, string(body))
	}

	var pagesResp struct {
		Data []struct {
			ID             string `json:"id"`
			Name           string `json:"name"`
			FanCount       int64  `json:"fan_count"`
			FollowersCount int64  `json:"followers_count"`
			AccessToken    string `json:"access_token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &pagesResp); err != nil {
		return nil, fmt.Errorf("error parsing FB pages: %w", err)
	}
	if len(pagesResp.Data) == 0 {
		return nil, fmt.Errorf("no Facebook Page found for this token")
	}

	page := pagesResp.Data[0]
	pageToken := page.AccessToken
	if pageToken == "" {
		pageToken = c.accessToken
	}
	fmt.Printf("[FB] page=%s (%s) fans=%d followers=%d\n", page.Name, page.ID, page.FanCount, page.FollowersCount)

	insights := &FacebookInsights{
		PageID:         page.ID,
		Name:           page.Name,
		FanCount:       page.FanCount,
		FollowersCount: page.FollowersCount,
	}

	postsURL := fmt.Sprintf("https://graph.facebook.com/v21.0/%s/posts?fields=id,message,created_time,permalink_url,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares&limit=%d&access_token=%s",
		page.ID, limit*2, pageToken)
	preq, err := http.NewRequestWithContext(ctx, "GET", postsURL, nil)
	if err != nil {
		return insights, nil
	}
	presp, err := c.httpClient.Do(preq)
	if err != nil {
		return insights, nil
	}
	pbody, _ := io.ReadAll(presp.Body)
	presp.Body.Close()
	if presp.StatusCode != http.StatusOK {
		fmt.Printf("[FB] posts error (status %d): %s\n", presp.StatusCode, string(pbody))
		return insights, nil
	}

	var postsResp struct {
		Data []struct {
			ID           string `json:"id"`
			Message      string `json:"message"`
			CreatedTime  string `json:"created_time"`
			PermalinkURL string `json:"permalink_url"`
			Reactions    struct {
				Summary struct {
					TotalCount int64 `json:"total_count"`
				} `json:"summary"`
			} `json:"reactions"`
			Comments struct {
				Summary struct {
					TotalCount int64 `json:"total_count"`
				} `json:"summary"`
			} `json:"comments"`
			Shares struct {
				Count int64 `json:"count"`
			} `json:"shares"`
		} `json:"data"`
	}
	if err := json.Unmarshal(pbody, &postsResp); err != nil {
		return insights, nil
	}

	var posts []FacebookPost
	for _, p := range postsResp.Data {
		ts, _ := time.Parse(time.RFC3339, p.CreatedTime)
		post := FacebookPost{
			ID:        p.ID,
			Message:   p.Message,
			Permalink: p.PermalinkURL,
			Timestamp: ts,
			Reactions: p.Reactions.Summary.TotalCount,
			Comments:  p.Comments.Summary.TotalCount,
			Shares:    p.Shares.Count,
		}
		post.Engagement = post.Reactions + post.Comments + post.Shares

		insURL := fmt.Sprintf("https://graph.facebook.com/v21.0/%s/insights?metric=post_impressions_unique,post_impressions&access_token=%s", p.ID, pageToken)
		if ireq, err := http.NewRequestWithContext(ctx, "GET", insURL, nil); err == nil {
			if iresp, err := c.httpClient.Do(ireq); err == nil {
				ibody, _ := io.ReadAll(iresp.Body)
				iresp.Body.Close()
				if iresp.StatusCode != http.StatusOK {
					fmt.Printf("[FB] insights error post %s (status %d): %s\n", p.ID, iresp.StatusCode, string(ibody))
				}
				var ins struct {
					Data []struct {
						Name   string `json:"name"`
						Values []struct {
							Value int64 `json:"value"`
						} `json:"values"`
					} `json:"data"`
				}
				if json.Unmarshal(ibody, &ins) == nil {
					for _, m := range ins.Data {
						if len(m.Values) > 0 {
							switch m.Name {
							case "post_impressions_unique":
								post.Reach = m.Values[0].Value
							case "post_impressions":
								post.Impressions = m.Values[0].Value
							}
						}
					}
				}
			}
		}

		if post.Reach > 0 {
			post.EngagementRate = float64(post.Engagement) / float64(post.Reach) * 100
		}
		posts = append(posts, post)
	}

	// Mejores por engagement, recortado a limit.
	sort.Slice(posts, func(i, j int) bool { return posts[i].Engagement > posts[j].Engagement })
	if len(posts) > limit {
		posts = posts[:limit]
	}
	insights.TopPosts = posts

	return insights, nil
}
