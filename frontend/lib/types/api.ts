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
  leads: number; // leads REALES de Meta (formulario, BD por UTM) cuando leads_source='bd_formulario'
  cpl: number;
  budget_total_clp: number;
  budget_pct_used: number;
  // Contexto de la fuente de leads (inyectado por el backend desde la BD Refugio)
  leads_pixel?: number;        // conteo del evento Pixel (incluye reservas históricas; usado en desgloses por ad)
  leads_reales_total?: number; // total real del formulario en el período (todos los canales)
  leads_by_canal?: Record<string, number>; // { facebook, instagram, google, "directo/organico" }
  leads_source?: 'bd_formulario' | 'pixel'; // de dónde salió "leads"
  // Intención WhatsApp (Etapa 4a) — evento GA4 refugio_whatsapp_click (clic al botón wa.me)
  whatsapp_clicks?: number;             // total de clics al botón WhatsApp de la landing
  whatsapp_clicks_meta?: number;        // porción atribuible a Meta (facebook/instagram)
  whatsapp_clicks_by_source?: { source: string; medium: string; event_count: number; users: number }[];
  cost_per_whatsapp_click?: number;     // gasto Meta / clics WhatsApp
  whatsapp_to_lead_rate?: number;       // % de clics WhatsApp que dejaron datos en el form (ya en %)
  // Etapa 4b (H-002) — cruce teléfono de lead → reservas reales del booking system
  reservas_count?: number;     // leads (form + WhatsApp) que terminaron con ≥1 reserva
  reservas_revenue?: number;   // CLP facturados por esos clientes desde el inicio de campaña
  roas?: number;               // reservas_revenue / spend
  whatsapp_inbound?: number;   // contactos WhatsApp entrantes con marcador [Refugio]
  cpl_intencion?: number;      // gasto / (formulario + WhatsApp entrante)
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

// GiftCard Día del Padre (campaña dedicada de Ventas; métrica primaria = compras del píxel)

export interface GiftCardSummary {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  purchases: number; // evento Purchase del píxel (compra de gift card en el sitio)
  cost_per_purchase: number; // gasto / compras
  purchase_value: number; // CLP, action_values de Meta
  roas: number; // purchase_value / spend
  budget_total_clp: number;
  budget_pct_used: number;
}

export interface GiftCardCampaign {
  campaign_id: string;
  campaign_name: string;
  account_id: string;
  account_label: string;
  period: { start: string; end: string };
  end_date: string; // 2026-06-21 (Día del Padre)
  summary: GiftCardSummary;
  platforms?: RefugioPlatformRow[];
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

// SEO (DataForSEO: rankings reales, backlinks, competidores)

// Publicaciones planificadas de la semana (asistente community manager)

export type PublicacionEstado = 'pendiente' | 'en_produccion' | 'lista' | 'publicada' | 'no_aplica';
export type RevisionVeredicto = 'sin_revisar' | 'revisando' | 'con_observaciones' | 'aprobado';

export interface RevisionCorreccion {
  aspecto: string;
  severidad: 'critico' | 'importante' | 'menor';
  encontrado: string;
  correccion: string;
}

export interface SegmentoHistoria {
  indice: number;
  titulo: string;
  texto: string;
  material_urls: string[];
  material_meta?: Record<string, unknown>[];
  revision_veredicto: RevisionVeredicto;
  revision_resumen: string;
  revision_json: RevisionCorreccion[];
  revision_at: string | null;
}

export interface PublicacionPlanificada {
  id: number;
  semana_inicio: string;
  dia: string;
  hora_sugerida: string;
  canal: string;
  tipo: string;
  pieza_key: string;
  titulo: string;
  copy_json: Record<string, unknown>;
  responsable: string;
  tiempo_estimado: string;
  estado: PublicacionEstado;
  material_urls: string[];
  segmentos?: SegmentoHistoria[];
  revision_veredicto: RevisionVeredicto;
  revision_resumen: string;
  revision_json: RevisionCorreccion[];
  revision_at: string | null;
  notas_revision: string;
  published_url: string;
  metricas: Record<string, unknown>;
  notas: string;
  updated_at: string;
}

export interface PublicacionesSemanaResponse {
  semana_inicio: string;
  total: number;
  publicaciones: PublicacionPlanificada[];
}

export interface SEORankingResult {
  keyword: string;
  target_domain: string;
  found: boolean;
  position?: number;
  rank_absolute?: number;
  url?: string;
  competitors_above: string[];
}

export interface SEORankings {
  target: string;
  location: string;
  language: string;
  rankings: SEORankingResult[];
  found_count: number;
  total_count: number;
}

export interface SEOBacklinksSummary {
  target: string;
  rank: number;
  backlinks: number;
  referring_domains: number;
  referring_main_domains: number;
  broken_backlinks: number;
}

export interface SEOCompetitorDomain {
  domain: string;
  avg_position: number;
  intersections: number;
  organic_etv: number;
  organic_count: number;
}

export interface SEOCompetitors {
  target: string;
  competitors: SEOCompetitorDomain[];
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
