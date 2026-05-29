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
  web_analytics?: {
    active_users: number;
    total_users: number;
    sessions: number;
    page_views: number;
    bounce_rate: number;
    avg_session_duration: number;
    new_users: number;
    event_count: number;
    status?: string;
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
    by_family?: ServiceFamilyStats[];
    by_payment_method?: PaymentMethodStats[];
  };
}

// Service Family Stats
export interface ServiceFamilyStats {
  family: string;
  current_count: number;
  current_revenue: number;
  previous_month_count: number;
  previous_month_revenue: number;
  previous_year_count: number;
  previous_year_revenue: number;
}

// Payment Method Stats
export interface PaymentMethodStats {
  payment_method: string;
  current_count: number;
  current_revenue: number;
  previous_month_count: number;
  previous_month_revenue: number;
  previous_year_count: number;
  previous_year_revenue: number;
}

// Refugio (campaña dedicada)

export interface RefugioSummary {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  budget_total_clp: number;
  budget_pct_used: number;
}

export interface RefugioAdset {
  adset_id: string;
  adset_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
}

export interface RefugioVariant {
  key: 'A' | 'B' | 'C';
  label: string;
  ad_count: number;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
}

export interface RefugioThresholds {
  ctr: { green_min: number; yellow_min: number };
  cpl_clp: { green_max: number; yellow_max: number };
  frequency: { green_max: number; yellow_max: number };
  landing_view_rate: { green_min: number; yellow_min: number };
}

export interface RefugioPlatformRow {
  platform: string; // facebook | instagram | audience_network | messenger | threads
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
}

export interface RefugioPositionRow extends RefugioPlatformRow {
  position: string; // feed | facebook_reels | instagram_stories | etc
}

export interface RefugioCampaign {
  campaign_id: string;
  campaign_name: string;
  account_id: string;
  account_label: string;
  period: { start: string; end: string };
  summary: RefugioSummary;
  adsets: RefugioAdset[];
  variants: RefugioVariant[];
  platforms?: RefugioPlatformRow[];
  positions?: RefugioPositionRow[];
  thresholds: RefugioThresholds;
}

// Google Ads — Refugio
export interface GoogleAdsSummary {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  avg_cpc: number;
  cpl: number;
  conversion_rate: number;
  search_impression_share: number;
  budget_total_clp: number;
  budget_pct_used: number;
}

export interface GoogleAdsSearchTerm {
  term: string;
  match_type: string;
  status: string;
  impressions: number;
  clicks: number;
  cost_clp: number;
  conversions: number;
  ctr: number;
  avg_cpc: number;
  cpl: number;
}

export interface GoogleAdsKeywordQS {
  keyword_text: string;
  match_type: string;
  ad_group_name: string;
  quality_score: number;
  expected_ctr: string;
  ad_relevance: string;
  landing_page_experience: string;
}

export interface GoogleAdsThresholds {
  ctr_search: { green_min: number; yellow_min: number };
  cpl_clp: { green_max: number; yellow_max: number };
  search_impression_share: { green_min: number; yellow_min: number };
  quality_score: { green_min: number; yellow_min: number };
  budget_remaining_pct: { green_min: number; yellow_min: number };
}

export interface GoogleAdsRefugio {
  campaign_id: string;
  campaign_name: string;
  period: { start: string; end: string };
  summary: GoogleAdsSummary;
  search_terms: GoogleAdsSearchTerm[];
  quality_scores: GoogleAdsKeywordQS[];
  thresholds: GoogleAdsThresholds;
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
