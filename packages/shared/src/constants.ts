// ============================================
// Palacios Attribution System - Constants
// ============================================

// UTM Parameter Namen
export const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

// Click ID Parameter
export const CLICK_ID_PARAMS = {
  fbclid: 'meta',
  gclid: 'google',
  ttclid: 'tiktok',
  li_fat_id: 'linkedin',
} as const;

// Cookie Namen
export const COOKIES = {
  VISITOR_ID: 'palacios_vid',
  SESSION_ID: 'palacios_sid',
  FIRST_TOUCH_UTM: 'palacios_ft_utm',
  LAST_TOUCH_UTM: 'palacios_lt_utm',
} as const;

// Cookie Expiry (in Tagen)
export const COOKIE_EXPIRY = {
  VISITOR: 365,
  SESSION: 0.0208, // 30 Minuten
  UTM: 30,
} as const;

// Event Types
export const EVENT_TYPES = [
  'pageview',
  'click',
  'form_submit',
  'video_play',
  'video_progress',
  'scroll',
  'custom',
] as const;

// Channels
export const CHANNELS = [
  'meta_ads',
  'google_ads',
  'linkedin_ads',
  'tiktok_ads',
  'email',
  'organic',
  'direct',
  'referral',
] as const;

// Contact Statuses
export const CONTACT_STATUSES = [
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer',
] as const;

// Attribution Models
export const ATTRIBUTION_MODELS = [
  'first_touch',
  'last_touch',
  'linear',
  'time_decay',
  'position_based',
] as const;

// Time Decay Half Life (in Tagen)
export const TIME_DECAY_HALF_LIFE = 7;

// Position Based Weights
export const POSITION_BASED_WEIGHTS = {
  FIRST: 0.4,
  LAST: 0.4,
  MIDDLE: 0.2,
} as const;

// Platform Mapping für Channel Erkennung
export const PLATFORM_MAPPING: Record<string, string> = {
  facebook: 'meta_ads',
  fb: 'meta_ads',
  instagram: 'meta_ads',
  ig: 'meta_ads',
  meta: 'meta_ads',
  google: 'google_ads',
  youtube: 'google_ads',
  linkedin: 'linkedin_ads',
  tiktok: 'tiktok_ads',
  customerio: 'email',
  email: 'email',
};

// Tracked Domains (für Outbound Link Tracking)
export const INTERNAL_DOMAIN_PATTERNS = [
  'palacios',
  'localhost',
] as const;
