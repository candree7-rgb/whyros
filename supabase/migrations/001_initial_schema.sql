-- ============================================
-- Palacios Attribution System - Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Anonyme Besucher (vor Identifikation)
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),

  -- First Touch Attribution
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  first_utm_term TEXT,
  first_referrer TEXT,
  first_landing_page TEXT,
  first_click_id TEXT,
  first_ad_id TEXT,
  first_adset_id TEXT,
  first_campaign_id TEXT,

  -- Geo & Device
  country TEXT,
  city TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet')),
  browser TEXT,
  os TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Fingerprint-Lookup
CREATE INDEX idx_visitors_fingerprint ON visitors(fingerprint);

-- Identifizierte Kontakte
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,

  -- Customer.io ID für Verknüpfung
  customerio_id TEXT,

  -- Lifecycle
  status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'mql', 'sql', 'opportunity', 'customer')),
  lead_score INTEGER DEFAULT 0,

  -- Timestamps
  identified_at TIMESTAMPTZ DEFAULT NOW(),
  first_purchase_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,

  -- Aggregates (für schnelle Queries)
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes für Contacts
CREATE INDEX idx_contacts_visitor ON contacts(visitor_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);

-- Alle Events (Pageviews, Clicks, Form Submits, etc.)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id),
  contact_id UUID REFERENCES contacts(id),

  -- Event Details
  event_type TEXT NOT NULL CHECK (event_type IN ('pageview', 'click', 'form_submit', 'video_play', 'video_progress', 'scroll', 'custom')),
  event_name TEXT,
  event_properties JSONB,

  -- Page Context
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,

  -- UTM (für diesen spezifischen Hit)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  -- Click IDs
  fbclid TEXT,
  gclid TEXT,
  ttclid TEXT,
  li_fat_id TEXT,

  -- Session
  session_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes für Events
CREATE INDEX idx_events_visitor ON events(visitor_id);
CREATE INDEX idx_events_contact ON events(contact_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_events_session ON events(session_id);

-- Touchpoints (Marketing-relevante Interaktionen)
CREATE TABLE touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id),
  contact_id UUID REFERENCES contacts(id),

  -- Touchpoint Details
  channel TEXT NOT NULL CHECK (channel IN ('meta_ads', 'google_ads', 'linkedin_ads', 'tiktok_ads', 'email', 'organic', 'direct', 'referral')),
  source TEXT,
  medium TEXT,
  campaign TEXT,
  content TEXT,

  -- Ad-spezifisch
  ad_id TEXT,
  adset_id TEXT,
  campaign_id TEXT,
  ad_name TEXT,
  adset_name TEXT,
  campaign_name TEXT,

  -- E-Mail-spezifisch
  email_id TEXT,
  email_name TEXT,
  email_type TEXT CHECK (email_type IN ('broadcast', 'automated', 'transactional')),

  -- Touchpoint Type
  touchpoint_type TEXT CHECK (touchpoint_type IN ('ad_click', 'email_open', 'email_click', 'page_visit', 'webinar_register', 'webinar_attend', 'call_booked', 'form_submit')),

  -- Für Attribution
  is_first_touch BOOLEAN DEFAULT FALSE,
  is_last_touch BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes für Touchpoints
CREATE INDEX idx_touchpoints_visitor ON touchpoints(visitor_id);
CREATE INDEX idx_touchpoints_contact ON touchpoints(contact_id);
CREATE INDEX idx_touchpoints_channel ON touchpoints(channel);
CREATE INDEX idx_touchpoints_created ON touchpoints(created_at);

-- Käufe / Conversions
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) NOT NULL,

  -- Produkt
  product_id TEXT,
  product_name TEXT NOT NULL,
  product_category TEXT,

  -- Beträge
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  amount_chf DECIMAL(10,2),

  -- Zahlungs-Details
  payment_provider TEXT CHECK (payment_provider IN ('stripe', 'digistore24', 'ablefy')),
  payment_id TEXT,
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'refunded', 'pending')),

  -- Funnel Info
  funnel_name TEXT,
  order_bump BOOLEAN DEFAULT FALSE,
  upsell BOOLEAN DEFAULT FALSE,

  -- Attribution (wird berechnet)
  attributed_channel TEXT,
  attributed_campaign TEXT,
  attributed_ad_id TEXT,

  -- Timestamps
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  refunded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes für Purchases
CREATE INDEX idx_purchases_contact ON purchases(contact_id);
CREATE INDEX idx_purchases_date ON purchases(purchased_at);
CREATE INDEX idx_purchases_payment_id ON purchases(payment_id);

-- Attribution Results (berechnet für jeden Kauf)
CREATE TABLE attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id) NOT NULL,

  -- Attribution Model Results (JSONB)
  first_touch JSONB,
  last_touch JSONB,
  linear JSONB,
  time_decay JSONB,
  position_based JSONB,

  -- Berechnete Werte für schnelles Reporting
  first_touch_channel TEXT,
  last_touch_channel TEXT,
  touchpoint_count INTEGER,
  days_to_conversion INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes für Attribution
CREATE INDEX idx_attribution_purchase ON attribution(purchase_id);
CREATE INDEX idx_attribution_contact ON attribution(contact_id);

-- Meetings / Calls
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),

  -- Meeting Details
  meeting_type TEXT CHECK (meeting_type IN ('discovery_call', 'sales_call', 'follow_up')),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')),

  -- Outcome
  outcome TEXT CHECK (outcome IN ('qualified', 'not_qualified', 'closed_won', 'closed_lost')),
  notes TEXT,

  -- Source
  booking_source TEXT CHECK (booking_source IN ('hubspot', 'calendly')),
  booking_id TEXT,

  -- Kosten (für Cost per Call)
  associated_ad_spend DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes für Meetings
CREATE INDEX idx_meetings_contact ON meetings(contact_id);
CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_at);

-- Ad Spend (täglich synchronisiert)
CREATE TABLE ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,

  -- Platform
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'linkedin', 'tiktok')),
  account_id TEXT,

  -- Granularität
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,

  -- Metriken
  spend DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  impressions INTEGER,
  clicks INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, platform, campaign_id, adset_id, ad_id)
);

-- Indexes für Ad Spend
CREATE INDEX idx_ad_spend_date ON ad_spend(date);
CREATE INDEX idx_ad_spend_platform ON ad_spend(platform);
CREATE INDEX idx_ad_spend_campaign ON ad_spend(campaign_id);

-- Funnels (für Funnel-Level Reporting)
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,

  -- Funnel Steps
  steps JSONB,

  -- Zugehörige Produkte
  product_ids TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Kunden-Übersicht mit Journey-Daten
CREATE VIEW customer_journeys AS
SELECT
  c.id,
  c.email,
  c.first_name,
  c.last_name,
  c.status,
  c.total_revenue,
  c.identified_at,
  c.first_purchase_at,
  v.first_utm_source,
  v.first_utm_campaign,
  v.first_landing_page,
  (SELECT COUNT(*) FROM touchpoints t WHERE t.contact_id = c.id) as touchpoint_count,
  (SELECT COUNT(*) FROM meetings m WHERE m.contact_id = c.id) as meeting_count,
  EXTRACT(DAY FROM c.first_purchase_at - c.identified_at) as days_to_first_purchase
FROM contacts c
LEFT JOIN visitors v ON c.visitor_id = v.id;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for backend)
CREATE POLICY "Service role full access on visitors" ON visitors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on contacts" ON contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on events" ON events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on touchpoints" ON touchpoints FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on purchases" ON purchases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on attribution" ON attribution FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on meetings" ON meetings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on ad_spend" ON ad_spend FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on funnels" ON funnels FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update contact aggregates after purchase
CREATE OR REPLACE FUNCTION update_contact_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contacts
    SET
      total_revenue = total_revenue + NEW.amount_chf,
      total_purchases = total_purchases + 1,
      first_purchase_at = COALESCE(first_purchase_at, NEW.purchased_at),
      last_purchase_at = NEW.purchased_at,
      status = CASE WHEN status != 'customer' THEN 'customer' ELSE status END,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.payment_status = 'refunded' AND OLD.payment_status != 'refunded' THEN
    UPDATE contacts
    SET
      total_revenue = total_revenue - NEW.amount_chf,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for purchase updates
CREATE TRIGGER trigger_update_contact_on_purchase
AFTER INSERT OR UPDATE ON purchases
FOR EACH ROW
EXECUTE FUNCTION update_contact_on_purchase();

-- Function to update visitor last_seen
CREATE OR REPLACE FUNCTION update_visitor_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE visitors
  SET last_seen = NOW()
  WHERE id = NEW.visitor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating visitor last_seen
CREATE TRIGGER trigger_update_visitor_last_seen
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION update_visitor_last_seen();
