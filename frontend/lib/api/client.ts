import {
  APIResponse,
  MetaAdsSummary,
  Campaign,
  StatsOverview,
  WeeklyBrief,
  RefugioCampaign,
  SEORankings,
  SEOBacklinksSummary,
  SEOCompetitors,
  PublicacionesSemanaResponse,
  PublicacionPlanificada,
} from '@/lib/types/api';

// Use Render backend in production, localhost in development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://aremko-cli-backend.onrender.com'
    : 'http://localhost:8080');

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          data: null as any,
          error: error.error || `HTTP ${response.status}`,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Health check
  async healthCheck() {
    return this.fetch<{ status: string; version: string; time: string }>('/health');
  }

  // Meta Ads endpoints
  async getMetaCampaigns() {
    return this.fetch<{ data: Campaign[]; count: number }>('/api/v1/meta-ads/campaigns');
  }

  async getCampaignsWithInsights(dateStart?: string, dateStop?: string) {
    const params = new URLSearchParams();
    if (dateStart) params.append('date_start', dateStart);
    if (dateStop) params.append('date_stop', dateStop);

    const query = params.toString();
    return this.fetch<any>(`/api/v1/meta-ads/campaigns-with-insights${query ? `?${query}` : ''}`);
  }

  async getMetaAccountSummary(dateStart?: string, dateStop?: string) {
    const params = new URLSearchParams();
    if (dateStart) params.append('date_start', dateStart);
    if (dateStop) params.append('date_stop', dateStop);

    const query = params.toString();
    return this.fetch<MetaAdsSummary>(`/api/v1/meta-ads/account-summary${query ? `?${query}` : ''}`);
  }

  async getRefugioCampaign(dateStart?: string, dateStop?: string) {
    const params = new URLSearchParams();
    if (dateStart) params.append('date_start', dateStart);
    if (dateStop) params.append('date_stop', dateStop);
    const query = params.toString();
    return this.fetch<RefugioCampaign>(`/api/v1/meta-ads/refugio${query ? `?${query}` : ''}`);
  }

  // Meta Ads — gestión (write). Requieren token con ads_management server-side.
  async pauseCampaign(campaignId: string) {
    return this.fetch<{ campaign_id: string; status: string }>(
      `/api/v1/meta-ads/campaigns/${encodeURIComponent(campaignId)}/pause`,
      { method: 'POST' }
    );
  }

  async activateCampaign(campaignId: string) {
    return this.fetch<{ campaign_id: string; status: string }>(
      `/api/v1/meta-ads/campaigns/${encodeURIComponent(campaignId)}/activate`,
      { method: 'POST' }
    );
  }

  async updateCampaignBudget(campaignId: string, dailyBudget: number) {
    return this.fetch<{ campaign_id: string; daily_budget: number }>(
      `/api/v1/meta-ads/campaigns/${encodeURIComponent(campaignId)}/budget`,
      { method: 'POST', body: JSON.stringify({ daily_budget: dailyBudget }) }
    );
  }

  // SEO endpoints (DataForSEO). Costos reales por llamada del lado del
  // backend — cacheado 12-24h server-side, no hace falta cuidar la
  // frecuencia de fetch desde acá.
  async getSEORankings(keywords?: string[], target?: string) {
    const params = new URLSearchParams();
    if (keywords?.length) params.append('keywords', keywords.join(','));
    if (target) params.append('target', target);
    const query = params.toString();
    return this.fetch<SEORankings>(`/api/v1/seo/rankings${query ? `?${query}` : ''}`);
  }

  async getSEOBacklinks(target?: string) {
    const params = new URLSearchParams();
    if (target) params.append('target', target);
    const query = params.toString();
    return this.fetch<SEOBacklinksSummary>(`/api/v1/seo/backlinks${query ? `?${query}` : ''}`);
  }

  async getSEOCompetitors(target?: string) {
    const params = new URLSearchParams();
    if (target) params.append('target', target);
    const query = params.toString();
    return this.fetch<SEOCompetitors>(`/api/v1/seo/competitors${query ? `?${query}` : ''}`);
  }

  // Publicaciones planificadas de la semana (asistente community manager)
  async getPublicacionesSemana(semana?: string) {
    const params = new URLSearchParams();
    if (semana) params.append('semana', semana);
    const query = params.toString();
    return this.fetch<PublicacionesSemanaResponse>(
      `/api/v1/publicaciones/semana${query ? `?${query}` : ''}`
    );
  }

  async actualizarPublicacion(
    id: number,
    payload: { estado?: string; published_url?: string; notas?: string }
  ) {
    return this.fetch<{ success: boolean; publicacion: PublicacionPlanificada }>(
      `/api/v1/publicaciones/${id}/actualizar`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  // Brief endpoints
  async getWeeklyBrief() {
    return this.fetch<WeeklyBrief>('/api/v1/brief/weekly');
  }

  async generateBrief() {
    return this.fetch<WeeklyBrief>('/api/v1/brief/generate', {
      method: 'POST',
    });
  }

  // Stats endpoints
  async getStatsOverview() {
    return this.fetch<StatsOverview>('/api/v1/stats/overview');
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for testing
export default APIClient;
