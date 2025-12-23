# Palacios Attribution System – Claude Code Briefing

## Projektübersicht

Wir bauen ein maßgeschneidertes Marketing-Attribution-System für das Palacios Institut. Das System soll End-to-End Customer Journeys tracken – vom ersten Ad-Klick bis zum Kauf – und dabei die besten Features von Hyros, Triple Whale und ähnlichen Tools kombinieren.

**Business Context:**
- Hochpreisige Coaching-Ausbildungen (3.000–5.000 CHF)
- Tausende Leads pro Monat
- Lange Customer Journeys (Wochen bis Monate)
- Multi-Channel: Ads → E-Mail → Webinare → Beratungsgespräche → Kauf

---

## Tech Stack

### Backend
- **Runtime:** Node.js mit TypeScript
- **Framework:** Hono.js (leichtgewichtig, Edge-ready) oder Express
- **Datenbank:** Supabase (PostgreSQL)
- **Hosting:** Railway
- **Queue (optional):** Supabase Edge Functions oder BullMQ für Webhook-Processing

### Frontend Dashboard
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Charts:** Recharts oder Tremor
- **Hosting:** Railway (oder Vercel)

### Tracking Snippet
- **Vanilla JavaScript** (kein Framework-Dependency)
- Muss auf Webflow, WordPress, Kajabi funktionieren
- < 5KB gzipped

---

## Architektur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   Ad Platforms  │    Websites     │   E-Mail        │   Sales & Payments    │
│   ─────────────│   ─────────────│   ─────────────│   ───────────────────│
│   • Meta Ads    │   • Webflow     │   • Customer.io │   • Stripe            │
│   • Google Ads  │   • WordPress   │                 │   • Digistore24       │
│   (LinkedIn,    │   • Kajabi      │                 │   • HubSpot Meetings  │
│    TikTok later)│                 │                 │   (→ Calendly)        │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                     │
         ▼                 ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENT COLLECTOR API                                 │
│                          (Railway + Hono.js)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ /track      │  │ /webhook/   │  │ /webhook/   │  │ /webhook/stripe     │ │
│  │ (JS Snippet)│  │ customerio  │  │ hubspot     │  │ /webhook/digistore  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         PostgreSQL                                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │   │
│  │  │visitors │ │contacts │ │events   │ │purchases│ │touchpoints      │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Edge Functions                                     │   │
│  │  • Attribution Calculator (runs on purchase)                          │   │
│  │  • Daily Ad Spend Sync                                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD (Next.js)                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Overview    │  │ Attribution │  │ Customer    │  │ Sales Analytics     │ │
│  │ (ROAS, CR)  │  │ Reports     │  │ Journeys    │  │ (Cost per Call)     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Datenmodell (PostgreSQL/Supabase)

### Core Tables

```sql
-- Anonyme Besucher (vor Identifikation)
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE, -- Browser fingerprint für Wiedererkennung
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
  first_click_id TEXT, -- fbclid, gclid, etc.
  first_ad_id TEXT,
  first_adset_id TEXT,
  first_campaign_id TEXT,
  
  -- Geo & Device
  country TEXT,
  city TEXT,
  device_type TEXT, -- mobile, desktop, tablet
  browser TEXT,
  os TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  status TEXT DEFAULT 'lead', -- lead, mql, sql, opportunity, customer
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

-- Alle Events (Pageviews, Clicks, Form Submits, etc.)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id),
  contact_id UUID REFERENCES contacts(id),
  
  -- Event Details
  event_type TEXT NOT NULL, -- pageview, click, form_submit, video_play, etc.
  event_name TEXT, -- spezifischer Name, z.B. "webinar_registration"
  event_properties JSONB, -- flexible zusätzliche Daten
  
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
  ttclid TEXT, -- TikTok
  li_fat_id TEXT, -- LinkedIn
  
  -- Session
  session_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Event-Queries
CREATE INDEX idx_events_visitor ON events(visitor_id);
CREATE INDEX idx_events_contact ON events(contact_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);

-- Touchpoints (Marketing-relevante Interaktionen)
CREATE TABLE touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES visitors(id),
  contact_id UUID REFERENCES contacts(id),
  
  -- Touchpoint Details
  channel TEXT NOT NULL, -- meta_ads, google_ads, email, organic, direct, referral
  source TEXT, -- facebook, google, customerio, etc.
  medium TEXT, -- cpc, email, organic
  campaign TEXT,
  content TEXT, -- Ad Creative, E-Mail Subject
  
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
  email_type TEXT, -- broadcast, automated, transactional
  
  -- Touchpoint Type
  touchpoint_type TEXT, -- ad_click, email_open, email_click, page_visit, webinar_register, call_booked, etc.
  
  -- Für Attribution
  is_first_touch BOOLEAN DEFAULT FALSE,
  is_last_touch BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_touchpoints_contact ON touchpoints(contact_id);
CREATE INDEX idx_touchpoints_channel ON touchpoints(channel);

-- Käufe / Conversions
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) NOT NULL,
  
  -- Produkt
  product_id TEXT,
  product_name TEXT NOT NULL,
  product_category TEXT, -- ausbildung, workshop, ebook, etc.
  
  -- Beträge
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  amount_chf DECIMAL(10,2), -- normalisiert für Reporting
  
  -- Zahlungs-Details
  payment_provider TEXT, -- stripe, digistore24, ablefy
  payment_id TEXT, -- Provider-spezifische ID
  payment_status TEXT, -- completed, refunded, pending
  
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

CREATE INDEX idx_purchases_contact ON purchases(contact_id);
CREATE INDEX idx_purchases_date ON purchases(purchased_at);

-- Attribution Results (berechnet für jeden Kauf)
CREATE TABLE attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id) NOT NULL,
  
  -- Attribution Model Results (Anteil 0-1)
  first_touch JSONB, -- { touchpoint_id, channel, campaign, attributed_amount }
  last_touch JSONB,
  linear JSONB[], -- Array von touchpoints mit equal split
  time_decay JSONB[], -- Array von touchpoints mit time-weighted split
  position_based JSONB[], -- 40% first, 40% last, 20% middle
  
  -- Berechnete Werte für schnelles Reporting
  first_touch_channel TEXT,
  last_touch_channel TEXT,
  touchpoint_count INTEGER,
  days_to_conversion INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings / Calls
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  
  -- Meeting Details
  meeting_type TEXT, -- discovery_call, sales_call, follow_up
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  
  -- Status
  status TEXT, -- scheduled, completed, no_show, cancelled
  
  -- Outcome
  outcome TEXT, -- qualified, not_qualified, closed_won, closed_lost
  notes TEXT,
  
  -- Source
  booking_source TEXT, -- hubspot, calendly
  booking_id TEXT,
  
  -- Kosten (für Cost per Call)
  associated_ad_spend DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Spend (täglich synchronisiert)
CREATE TABLE ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  
  -- Platform
  platform TEXT NOT NULL, -- meta, google, linkedin, tiktok
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

CREATE INDEX idx_ad_spend_date ON ad_spend(date);
CREATE INDEX idx_ad_spend_platform ON ad_spend(platform);

-- Funnels (für Funnel-Level Reporting)
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  
  -- Funnel Steps (URLs oder Events die zum Funnel gehören)
  steps JSONB, -- [{ name, url_pattern, event_name }]
  
  -- Zugehörige Produkte
  product_ids TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Views für Reporting

```sql
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

-- ROAS by Campaign
CREATE VIEW roas_by_campaign AS
SELECT 
  ads.platform,
  ads.campaign_id,
  ads.campaign_name,
  SUM(ads.spend) as total_spend,
  SUM(CASE WHEN a.first_touch_channel = ads.platform THEN p.amount_chf ELSE 0 END) as first_touch_revenue,
  SUM(CASE WHEN a.last_touch_channel = ads.platform THEN p.amount_chf ELSE 0 END) as last_touch_revenue,
  CASE WHEN SUM(ads.spend) > 0 
    THEN SUM(CASE WHEN a.first_touch_channel = ads.platform THEN p.amount_chf ELSE 0 END) / SUM(ads.spend)
    ELSE 0 
  END as first_touch_roas,
  CASE WHEN SUM(ads.spend) > 0 
    THEN SUM(CASE WHEN a.last_touch_channel = ads.platform THEN p.amount_chf ELSE 0 END) / SUM(ads.spend)
    ELSE 0 
  END as last_touch_roas
FROM ad_spend ads
LEFT JOIN attribution a ON a.first_touch_channel = ads.platform
LEFT JOIN purchases p ON a.purchase_id = p.id
GROUP BY ads.platform, ads.campaign_id, ads.campaign_name;
```

---

## Tracking Snippet (JavaScript)

Das Snippet muss auf allen Webseiten eingebunden werden (Webflow, WordPress, Kajabi).

### Features:
- Automatische UTM-Parameter Erfassung
- Click-ID Erfassung (fbclid, gclid, etc.)
- Cookie-basierte Visitor-Identifikation
- Pageview Tracking
- Custom Event Tracking
- Form Submit Tracking
- Scroll Depth Tracking
- Video Engagement Tracking (für eingebettete Webinare)
- User Identification (wenn E-Mail bekannt)

### Snippet Structure:

```javascript
(function() {
  // Config (wird beim Einbinden gesetzt)
  var TRACKING_ENDPOINT = 'https://your-railway-app.up.railway.app/track';
  var SITE_ID = 'palacios_main'; // oder 'palacios_kajabi', etc.
  
  // Visitor ID (Cookie-basiert)
  function getVisitorId() { /* ... */ }
  
  // Session ID
  function getSessionId() { /* ... */ }
  
  // UTM & Click ID Extraction
  function getTrackingParams() { /* ... */ }
  
  // Core Track Function
  function track(eventType, eventName, properties) { /* ... */ }
  
  // Auto-tracking
  function initAutoTracking() {
    // Pageview on load
    // Form submits
    // Outbound clicks
    // Scroll depth
  }
  
  // Identify (call when email becomes known)
  window.palacios = {
    track: track,
    identify: function(email, properties) { /* ... */ },
    page: function() { /* ... */ }
  };
  
  initAutoTracking();
})();
```

### Einbindung:

```html
<!-- Palacios Tracking -->
<script>
(function(){/* minified snippet */})();
</script>
```

---

## API Endpoints

### Event Collector (Hono.js auf Railway)

```
POST /track
  Body: { visitor_id, session_id, event_type, event_name, properties, page, utm, click_ids }
  → Speichert Event in Supabase
  → Erstellt/Updated Visitor
  → Erstellt Touchpoint wenn relevant

POST /identify
  Body: { visitor_id, email, properties }
  → Verknüpft Visitor mit Contact
  → Merged alle historischen Events

POST /webhook/customerio
  → Empfängt E-Mail Events (sent, opened, clicked, etc.)
  → Erstellt Touchpoints für relevante Interaktionen

POST /webhook/stripe
  → Empfängt Payment Events
  → Erstellt Purchase
  → Triggert Attribution Calculation

POST /webhook/digistore
  → Empfängt Digistore24 IPNs
  → Erstellt Purchase

POST /webhook/hubspot
  → Empfängt Meeting Events
  → Erstellt Meeting Records

GET /api/sync/meta
  → Synchronisiert Meta Ads Spend (Daily Cron)

GET /api/sync/google
  → Synchronisiert Google Ads Spend (Daily Cron)
```

### Dashboard API

```
GET /api/overview
  Query: { from, to }
  → Aggregierte Metriken (Revenue, ROAS, Leads, etc.)

GET /api/attribution
  Query: { from, to, model, groupBy }
  → Attribution Report nach gewähltem Modell

GET /api/journeys
  Query: { from, to, limit }
  → Customer Journey Liste

GET /api/journeys/:contactId
  → Einzelne Customer Journey mit allen Touchpoints

GET /api/funnels
  → Funnel Performance

GET /api/funnels/:funnelId
  → Einzelner Funnel mit Step-Conversion-Rates

GET /api/ads
  Query: { from, to, platform, groupBy }
  → Ad Performance mit Attribution

GET /api/sales
  Query: { from, to }
  → Sales Metrics (Calls, Cost per Call, Close Rate)
```

---

## Integrationen

### 1. Meta Ads API

**Zweck:** Ad Spend & Performance Daten synchronisieren

**Benötigt:**
- Meta Business Account
- Marketing API Access Token
- Ad Account ID

**Sync:**
- Täglich: Spend, Impressions, Clicks pro Campaign/Adset/Ad
- Mapping: campaign_id, adset_id, ad_id müssen mit Click-IDs matchbar sein

### 2. Google Ads API

**Zweck:** Ad Spend & Performance Daten synchronisieren

**Benötigt:**
- Google Ads Account
- API Access (OAuth)
- Developer Token

**Sync:**
- Täglich: Spend, Impressions, Clicks pro Campaign/Adgroup/Ad
- GCLID Mapping

### 3. Customer.io Webhooks

**Zweck:** E-Mail Engagement tracken

**Events:**
- `email_sent`
- `email_opened`
- `email_clicked`
- `email_bounced`
- `email_unsubscribed`

**Webhook Payload Processing:**
- Erstelle Touchpoint bei relevanten Events (opened, clicked)
- Verknüpfe mit Contact via E-Mail

### 4. Stripe Webhooks

**Zweck:** Käufe tracken

**Events:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `charge.refunded`

**Processing:**
- Erstelle Purchase Record
- Verknüpfe mit Contact via E-Mail
- Trigger Attribution Calculation

### 5. Digistore24 IPN

**Zweck:** Käufe tracken

**Events:**
- Neue Bestellung
- Storno
- Rückbuchung

**Processing:**
- Erstelle Purchase Record
- Verknüpfe mit Contact via E-Mail

### 6. HubSpot Meetings (später Calendly)

**Zweck:** Gebuchte Calls tracken

**Webhook Events:**
- Meeting scheduled
- Meeting completed
- Meeting cancelled

**Processing:**
- Erstelle Meeting Record
- Verknüpfe mit Contact
- Erstelle Touchpoint

---

## Attribution Modelle

### 1. First Touch
100% Credit an den ersten Touchpoint.
→ Zeigt, welcher Kanal Awareness schafft.

### 2. Last Touch
100% Credit an den letzten Touchpoint vor Kauf.
→ Zeigt, welcher Kanal den Deal abschließt.

### 3. Linear
Gleicher Credit für alle Touchpoints.
→ Faire Verteilung über die gesamte Journey.

### 4. Time Decay
Mehr Credit für Touchpoints näher am Kauf.
Formel: `weight = 2^(-days_before_purchase / half_life)`
Default half_life: 7 Tage

### 5. Position Based (U-Shaped)
- 40% First Touch
- 40% Last Touch
- 20% verteilt auf Middle Touchpoints

### Attribution Calculation (Supabase Edge Function)

Wird getriggert bei jedem neuen Purchase:

```javascript
async function calculateAttribution(purchaseId) {
  // 1. Hole Purchase mit Contact
  const purchase = await getPurchase(purchaseId);
  
  // 2. Hole alle Touchpoints vor Kauf
  const touchpoints = await getTouchpoints(purchase.contact_id, { before: purchase.purchased_at });
  
  // 3. Berechne jedes Modell
  const firstTouch = calculateFirstTouch(touchpoints, purchase.amount);
  const lastTouch = calculateLastTouch(touchpoints, purchase.amount);
  const linear = calculateLinear(touchpoints, purchase.amount);
  const timeDecay = calculateTimeDecay(touchpoints, purchase.amount, purchase.purchased_at);
  const positionBased = calculatePositionBased(touchpoints, purchase.amount);
  
  // 4. Speichere Attribution
  await saveAttribution(purchaseId, {
    first_touch: firstTouch,
    last_touch: lastTouch,
    linear,
    time_decay: timeDecay,
    position_based: positionBased,
    first_touch_channel: firstTouch.channel,
    last_touch_channel: lastTouch.channel,
    touchpoint_count: touchpoints.length,
    days_to_conversion: daysBetween(touchpoints[0].created_at, purchase.purchased_at)
  });
}
```

---

## Dashboard Features

### 1. Overview Dashboard
- Gesamtumsatz (Zeitraum wählbar)
- Gesamt Ad Spend
- Blended ROAS
- Anzahl Leads
- Anzahl Käufe
- Conversion Rate
- Average Order Value
- Trend Charts (Revenue, Leads, ROAS über Zeit)

### 2. Attribution Report
- Tabelle: Channel | Spend | First Touch Rev | Last Touch Rev | Linear Rev | ROAS (pro Modell)
- Drill-down: Campaign → Adset → Ad Level
- Vergleich der Modelle visuell (Sankey oder Bar Chart)

### 3. Customer Journey View (wie Hyros)
- Liste aller Kunden mit Journeys
- Filter: Käufer, Leads, Zeitraum
- Klick auf Kunde → Timeline aller Touchpoints:
  - 📱 Meta Ad Click (Campaign X)
  - 📧 E-Mail geöffnet (Welcome Sequence #1)
  - 🖥️ Webinar angesehen (45 min)
  - 📞 Call gebucht
  - 📧 E-Mail geklickt (Angebot)
  - 💳 Kauf (Hypnose-Ausbildung, 4.500 CHF)

### 4. Funnel Analytics
- Funnel auswählen
- Step-by-Step Conversion Rates
- Drop-off Analyse
- Revenue pro Funnel
- ROAS pro Funnel

### 5. Ad Performance
- Alle Ads mit Performance
- Spalten: Spend | Impressions | Clicks | CTR | Leads | Purchases | Revenue | ROAS | CPA
- Gruppierung: Platform → Campaign → Adset → Ad
- Zeitraum-Vergleich

### 6. Sales Dashboard
- Anzahl gebuchte Calls
- Show-up Rate
- Close Rate
- Cost per Call
- Revenue per Call
- Umsatz durch Calls vs. Self-Service

### 7. Lifecycle Report
- Durchschnittliche Zeit bis Kauf
- Durchschnittliche Touchpoints bis Kauf
- Cohort-Analyse (Leads von Monat X → Käufe)

### 8. Real-time Feed (nice to have)
- Live-Stream neuer Events
- "Max M. hat gerade gekauft (4.500 CHF) – Quelle: Meta Ad → Webinar → Call"

---

## Zusätzliche Premium Features (inspiriert von Hyros, Triple Whale, etc.)

### AI-Powered Insights
- Automatische Erkennung von Top-Performing Ads
- Anomalie-Detection (plötzlicher ROAS-Drop)
- Empfehlungen ("Campaign X hat 3x besseren ROAS als Durchschnitt – Budget erhöhen?")

### Predictive LTV
- Basierend auf Touchpoint-Patterns
- "Leads mit Webinar + Call haben 4x höhere Conversion"

### Cohort Analysis
- Leads von Woche X → Wie viel % kaufen in Woche 1, 2, 4, 8?
- Vergleich zwischen Kampagnen

### Custom Events
- UI zum Definieren eigener Events
- Z.B. "Video 50% watched", "Pricing Page visited 3x"

### Alerts & Notifications
- Slack/E-Mail bei wichtigen Events
- "Neuer Kauf über 1.000 CHF"
- "ROAS unter 2 für Campaign X"

### Multi-Currency Support
- Automatische Umrechnung in CHF
- Historische Wechselkurse

### Data Export
- CSV Export aller Reports
- API für Custom Integrations

---

## Projektstruktur

```
palacios-attribution/
├── apps/
│   ├── collector/              # Event Collector Backend
│   │   ├── src/
│   │   │   ├── index.ts       # Hono app entry
│   │   │   ├── routes/
│   │   │   │   ├── track.ts
│   │   │   │   ├── identify.ts
│   │   │   │   └── webhooks/
│   │   │   │       ├── customerio.ts
│   │   │   │       ├── stripe.ts
│   │   │   │       ├── digistore.ts
│   │   │   │       └── hubspot.ts
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts
│   │   │   │   ├── attribution.ts
│   │   │   │   └── utils.ts
│   │   │   └── types/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/              # Next.js Dashboard
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx           # Overview
│       │   │   ├── attribution/
│       │   │   ├── journeys/
│       │   │   ├── funnels/
│       │   │   ├── ads/
│       │   │   ├── sales/
│       │   │   └── api/
│       │   ├── components/
│       │   │   ├── charts/
│       │   │   ├── tables/
│       │   │   └── ui/
│       │   └── lib/
│       │       ├── supabase.ts
│       │       └── queries.ts
│       ├── package.json
│       └── tailwind.config.js
│
├── packages/
│   ├── tracking-snippet/       # JavaScript Snippet
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── dist/
│   │   │   └── palacios.min.js
│   │   └── package.json
│   │
│   └── shared/                 # Shared Types & Utils
│       ├── src/
│       │   ├── types.ts
│       │   └── constants.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/             # Database Migrations
│   │   └── 001_initial_schema.sql
│   └── functions/              # Edge Functions
│       ├── calculate-attribution/
│       ├── sync-meta-ads/
│       └── sync-google-ads/
│
├── docs/
│   ├── setup.md
│   ├── integrations.md
│   └── api.md
│
├── package.json                # Monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo config
└── README.md
```

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Meta Ads
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# Google Ads
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=

# Stripe
STRIPE_WEBHOOK_SECRET=

# Digistore24
DIGISTORE_IPN_SECRET=

# Customer.io
CUSTOMERIO_WEBHOOK_SECRET=

# HubSpot
HUBSPOT_WEBHOOK_SECRET=
```

---

## Deployment

### Railway Setup

1. **Collector Service:**
   - Node.js
   - Auto-deploy from GitHub
   - Environment variables configured
   - Custom domain: `track.palacios-analytics.com`

2. **Dashboard:**
   - Next.js
   - Auto-deploy from GitHub
   - Custom domain: `analytics.palacios-analytics.com`

### Supabase Setup

1. Neues Projekt erstellen
2. Migrations ausführen
3. Edge Functions deployen
4. Cron Jobs für Ad Sync konfigurieren

---

## Entwicklungs-Reihenfolge

### Phase 1: Foundation
1. ✅ Supabase Projekt & Datenbank Setup
2. ✅ Collector Backend (basic /track endpoint)
3. ✅ Tracking Snippet (basic pageview & UTM)
4. ✅ Test: Events kommen an

### Phase 2: Core Tracking
5. User Identification (Visitor → Contact merge)
6. Touchpoint Tracking
7. Stripe Webhook Integration
8. Basic Attribution (First & Last Touch)

### Phase 3: Dashboard MVP
9. Next.js Dashboard Setup
10. Overview Page
11. Customer Journey View
12. Basic Attribution Report

### Phase 4: Full Attribution
13. Alle Attribution Modelle
14. Ad Spend Sync (Meta & Google)
15. ROAS Calculation
16. Ads Performance Report

### Phase 5: Integrations
17. Customer.io Webhooks
18. Digistore24 Integration
19. HubSpot/Calendly Meetings
20. Funnel Tracking

### Phase 6: Polish
21. Sales Dashboard
22. Lifecycle Reports
23. Alerts & Notifications
24. Data Export

---

## Wichtige Hinweise für Claude Code

1. **TypeScript überall** – Strenge Typisierung für alle Datenstrukturen

2. **Error Handling** – Webhooks müssen robust sein, niemals crashen

3. **Idempotenz** – Webhooks können mehrfach kommen, Purchase nicht doppelt anlegen

4. **Performance** – Indexes auf alle Query-relevanten Felder

5. **Privacy** – Keine PII in Logs, GDPR-konform

6. **Testing** – Unit Tests für Attribution Logic

7. **Monitoring** – Logging für Debugging (aber keine sensiblen Daten)

---

## Fragen an den Entwickler

Bevor du loslegst, kläre mit dem Team:

1. Welche Produkte/Ausbildungen gibt es genau? (für Product-Mapping)
2. Welche Funnels existieren? (URLs, Steps)
3. Gibt es bestehende UTM-Konventionen?
4. Wer braucht Dashboard-Zugang? (Auth erforderlich?)
5. Sollen historische Daten importiert werden?

---

*Dieses Dokument ist das vollständige Briefing für Claude Code. Starte mit Phase 1 und arbeite dich systematisch durch.*
