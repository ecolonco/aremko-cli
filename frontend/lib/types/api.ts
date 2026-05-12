// API Response types

export interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Meta Ads types

export interface MetaAdsSummary {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  campaigns: number;
  period: {
    start: string;
    end: string;
  };
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
}

export interface AdInsight {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  date_start: string;
  date_stop: string;
}

// Stats types

export interface StatsOverview {
  period: {
    start: string;
    end: string;
  };
  meta_ads?: {
    summary: {
      spend: number;
      impressions: number;
      clicks: number;
      reach: number;
      ctr: number;
      cpc: number;
      cpm: number;
    };
    campaigns_count: number;
    recommendations: string[];
    best_campaign?: {
      name: string;
      ctr: number;
    };
    worst_campaign?: {
      name: string;
      ctr: number;
    };
  };
  bookings: {
    total: number;
    revenue: number;
    avg_ticket: number;
    status?: string;
    paid?: number;
    pending?: number;
    partial?: number;
  };
}

// Brief types

export interface WeeklyBrief {
  title: string;
  date_start: string;
  date_stop: string;
  generated_at: string;
  meta_ads?: any;
  google_ads?: any;
  linkedin?: any;
}
