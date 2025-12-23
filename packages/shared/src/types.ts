// ============================================
// Palacios Attribution System - Shared Types
// ============================================

// Visitor - Anonyme Besucher vor Identifikation
export interface Visitor {
  id: string;
  fingerprint: string | null;
  first_seen: string;
  last_seen: string;

  // First Touch Attribution
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_utm_term: string | null;
  first_referrer: string | null;
  first_landing_page: string | null;
  first_click_id: string | null;
  first_ad_id: string | null;
  first_adset_id: string | null;
  first_campaign_id: string | null;

  // Geo & Device
  country: string | null;
  city: string | null;
  device_type: 'mobile' | 'desktop' | 'tablet' | null;
  browser: string | null;
  os: string | null;

  created_at: string;
}

// Contact - Identifizierte Kontakte
export interface Contact {
  id: string;
  visitor_id: string | null;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;

  customerio_id: string | null;

  status: ContactStatus;
  lead_score: number;

  identified_at: string;
  first_purchase_at: string | null;
  last_purchase_at: string | null;

  total_revenue: number;
  total_purchases: number;

  created_at: string;
  updated_at: string;
}

export type ContactStatus = 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer';

// Event - Alle Events (Pageviews, Clicks, etc.)
export interface Event {
  id: string;
  visitor_id: string | null;
  contact_id: string | null;

  event_type: EventType;
  event_name: string | null;
  event_properties: Record<string, unknown> | null;

  page_url: string | null;
  page_title: string | null;
  referrer: string | null;

  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;

  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  li_fat_id: string | null;

  session_id: string | null;

  created_at: string;
}

export type EventType =
  | 'pageview'
  | 'click'
  | 'form_submit'
  | 'video_play'
  | 'video_progress'
  | 'scroll'
  | 'custom';

// Touchpoint - Marketing-relevante Interaktionen
export interface Touchpoint {
  id: string;
  visitor_id: string | null;
  contact_id: string | null;

  channel: Channel;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;

  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;

  email_id: string | null;
  email_name: string | null;
  email_type: 'broadcast' | 'automated' | 'transactional' | null;

  touchpoint_type: TouchpointType;

  is_first_touch: boolean;
  is_last_touch: boolean;

  created_at: string;
}

export type Channel =
  | 'meta_ads'
  | 'google_ads'
  | 'linkedin_ads'
  | 'tiktok_ads'
  | 'email'
  | 'organic'
  | 'direct'
  | 'referral';

export type TouchpointType =
  | 'ad_click'
  | 'email_open'
  | 'email_click'
  | 'page_visit'
  | 'webinar_register'
  | 'webinar_attend'
  | 'call_booked'
  | 'form_submit';

// Purchase - Käufe / Conversions
export interface Purchase {
  id: string;
  contact_id: string;

  product_id: string | null;
  product_name: string;
  product_category: string | null;

  amount: number;
  currency: string;
  amount_chf: number | null;

  payment_provider: 'stripe' | 'digistore24' | 'ablefy' | null;
  payment_id: string | null;
  payment_status: 'completed' | 'refunded' | 'pending';

  funnel_name: string | null;
  order_bump: boolean;
  upsell: boolean;

  attributed_channel: string | null;
  attributed_campaign: string | null;
  attributed_ad_id: string | null;

  purchased_at: string;
  refunded_at: string | null;

  created_at: string;
}

// Attribution - Berechnete Attribution für Käufe
export interface Attribution {
  id: string;
  purchase_id: string;
  contact_id: string;

  first_touch: AttributionResult | null;
  last_touch: AttributionResult | null;
  linear: AttributionResult[] | null;
  time_decay: AttributionResult[] | null;
  position_based: AttributionResult[] | null;

  first_touch_channel: string | null;
  last_touch_channel: string | null;
  touchpoint_count: number;
  days_to_conversion: number;

  created_at: string;
}

export interface AttributionResult {
  touchpoint_id: string;
  channel: string;
  campaign: string | null;
  attributed_amount: number;
  weight: number;
}

// Meeting - Gebuchte Calls
export interface Meeting {
  id: string;
  contact_id: string | null;

  meeting_type: 'discovery_call' | 'sales_call' | 'follow_up' | null;
  scheduled_at: string | null;
  duration_minutes: number | null;

  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled';

  outcome: 'qualified' | 'not_qualified' | 'closed_won' | 'closed_lost' | null;
  notes: string | null;

  booking_source: 'hubspot' | 'calendly' | null;
  booking_id: string | null;

  associated_ad_spend: number | null;

  created_at: string;
}

// Ad Spend - Täglich synchronisiert
export interface AdSpend {
  id: string;
  date: string;

  platform: 'meta' | 'google' | 'linkedin' | 'tiktok';
  account_id: string | null;

  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;

  spend: number;
  currency: string;
  impressions: number | null;
  clicks: number | null;

  created_at: string;
}

// Funnel
export interface Funnel {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;

  steps: FunnelStep[] | null;
  product_ids: string[] | null;

  created_at: string;
}

export interface FunnelStep {
  name: string;
  url_pattern?: string;
  event_name?: string;
}

// ============================================
// API Request/Response Types
// ============================================

// Track Event Request
export interface TrackEventRequest {
  visitor_id: string;
  session_id: string;
  event_type: EventType;
  event_name?: string;
  properties?: Record<string, unknown>;
  page: {
    url: string;
    title?: string;
    referrer?: string;
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  click_ids?: {
    fbclid?: string;
    gclid?: string;
    ttclid?: string;
    li_fat_id?: string;
  };
  device?: {
    type?: 'mobile' | 'desktop' | 'tablet';
    browser?: string;
    os?: string;
  };
  geo?: {
    country?: string;
    city?: string;
  };
}

// Identify Request
export interface IdentifyRequest {
  visitor_id: string;
  email: string;
  properties?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    [key: string]: unknown;
  };
}

// Track Response
export interface TrackResponse {
  success: boolean;
  event_id?: string;
  visitor_id?: string;
  error?: string;
}
