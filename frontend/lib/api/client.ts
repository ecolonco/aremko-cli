import {
  APIResponse,
  MetaAdsSummary,
  Campaign,
  StatsOverview,
  WeeklyBrief,
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
