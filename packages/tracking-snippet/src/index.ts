/**
 * Palacios Attribution Tracking Snippet
 * Lightweight tracking for marketing attribution
 *
 * Features:
 * - Automatic UTM parameter capture
 * - Click ID capture (fbclid, gclid, etc.)
 * - Cookie-based visitor identification
 * - Pageview tracking
 * - Custom event tracking
 * - Form submit tracking
 * - Scroll depth tracking
 * - User identification
 */

// ============================================
// Configuration
// ============================================

interface PalaciosConfig {
  endpoint: string;
  siteId?: string;
  trackPageviews?: boolean;
  trackForms?: boolean;
  trackScroll?: boolean;
  scrollThresholds?: number[];
  debug?: boolean;
}

interface TrackingData {
  visitor_id: string;
  session_id: string;
  event_type: string;
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
    type?: string;
    browser?: string;
    os?: string;
  };
}

// ============================================
// Constants
// ============================================

const COOKIE_VISITOR = 'palacios_vid';
const COOKIE_SESSION = 'palacios_sid';
const COOKIE_UTM = 'palacios_utm';

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const CLICK_ID_PARAMS = ['fbclid', 'gclid', 'ttclid', 'li_fat_id'];

// ============================================
// Utility Functions
// ============================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function setCookie(name: string, value: string, days: number): void {
  let expires = '';
  if (days > 0) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
}

function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
}

function getQueryParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const search = window.location.search.substring(1);
  if (!search) return params;

  search.split('&').forEach((param) => {
    const [key, value] = param.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  });

  return params;
}

function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('MSIE') || ua.includes('Trident')) return 'IE';
  return 'Unknown';
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}

// ============================================
// Main Tracker Class
// ============================================

class PalaciosTracker {
  private config: PalaciosConfig;
  private visitorId: string;
  private sessionId: string;
  private utm: Record<string, string>;
  private clickIds: Record<string, string>;
  private scrollTracked: Set<number> = new Set();
  private initialized = false;

  constructor() {
    this.config = {
      endpoint: '',
      trackPageviews: true,
      trackForms: true,
      trackScroll: true,
      scrollThresholds: [25, 50, 75, 100],
      debug: false,
    };
    this.visitorId = '';
    this.sessionId = '';
    this.utm = {};
    this.clickIds = {};
  }

  /**
   * Initialisiert den Tracker mit der gegebenen Konfiguration
   */
  init(config: PalaciosConfig): void {
    if (this.initialized) {
      this.log('Tracker already initialized');
      return;
    }

    this.config = { ...this.config, ...config };

    if (!this.config.endpoint) {
      console.error('[Palacios] Endpoint is required');
      return;
    }

    // Visitor ID (365 Tage Cookie)
    this.visitorId = getCookie(COOKIE_VISITOR) || generateId();
    setCookie(COOKIE_VISITOR, this.visitorId, 365);

    // Session ID (30 Minuten Cookie)
    const existingSession = getCookie(COOKIE_SESSION);
    if (existingSession) {
      this.sessionId = existingSession;
    } else {
      this.sessionId = generateId();
    }
    setCookie(COOKIE_SESSION, this.sessionId, 0.0208); // 30 min

    // UTM & Click IDs aus URL extrahieren
    this.extractTrackingParams();

    // Auto-Tracking initialisieren
    this.initAutoTracking();

    this.initialized = true;
    this.log('Tracker initialized', { visitorId: this.visitorId, sessionId: this.sessionId });

    // Initial Pageview
    if (this.config.trackPageviews) {
      this.page();
    }
  }

  /**
   * Extrahiert UTM-Parameter und Click-IDs aus der URL
   */
  private extractTrackingParams(): void {
    const params = getQueryParams();

    // UTM-Parameter
    UTM_PARAMS.forEach((param) => {
      if (params[param]) {
        this.utm[param.replace('utm_', '')] = params[param];
      }
    });

    // Persistiere UTM in Cookie wenn vorhanden
    if (Object.keys(this.utm).length > 0) {
      setCookie(COOKIE_UTM, JSON.stringify(this.utm), 30);
    } else {
      // Lade aus Cookie wenn nicht in URL
      const savedUtm = getCookie(COOKIE_UTM);
      if (savedUtm) {
        try {
          this.utm = JSON.parse(savedUtm);
        } catch (e) {
          // Ignoriere ungültiges JSON
        }
      }
    }

    // Click IDs
    CLICK_ID_PARAMS.forEach((param) => {
      if (params[param]) {
        this.clickIds[param] = params[param];
      }
    });
  }

  /**
   * Initialisiert Auto-Tracking Features
   */
  private initAutoTracking(): void {
    // Form Tracking
    if (this.config.trackForms) {
      this.initFormTracking();
    }

    // Scroll Tracking
    if (this.config.trackScroll) {
      this.initScrollTracking();
    }
  }

  /**
   * Initialisiert Form Submit Tracking
   */
  private initFormTracking(): void {
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (!form || form.tagName !== 'FORM') return;

      const formData: Record<string, string> = {};

      // Extrahiere Form-ID und Name
      if (form.id) formData.form_id = form.id;
      if (form.name) formData.form_name = form.name;
      if (form.action) formData.form_action = form.action;

      // Suche nach E-Mail-Feld (für Auto-Identify)
      const emailInput = form.querySelector<HTMLInputElement>(
        'input[type="email"], input[name*="email"], input[name*="Email"]'
      );

      if (emailInput && emailInput.value) {
        // Auto-Identify wenn E-Mail vorhanden
        this.identify(emailInput.value, formData);
      }

      this.track('form_submit', form.id || form.name || 'form', formData);
    });
  }

  /**
   * Initialisiert Scroll Depth Tracking
   */
  private initScrollTracking(): void {
    const thresholds = this.config.scrollThresholds || [25, 50, 75, 100];

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      thresholds.forEach((threshold) => {
        if (scrollPercent >= threshold && !this.scrollTracked.has(threshold)) {
          this.scrollTracked.add(threshold);
          this.track('scroll', `scroll_${threshold}`, { depth: threshold });
        }
      });
    });
  }

  /**
   * Tracked ein Pageview-Event
   */
  page(): void {
    this.sendEvent({
      event_type: 'pageview',
    });
  }

  /**
   * Tracked ein Custom Event
   */
  track(eventType: string, eventName?: string, properties?: Record<string, unknown>): void {
    this.sendEvent({
      event_type: eventType as 'custom',
      event_name: eventName,
      properties,
    });
  }

  /**
   * Identifiziert den Benutzer mit einer E-Mail-Adresse
   */
  identify(email: string, properties?: Record<string, unknown>): void {
    const data = {
      visitor_id: this.visitorId,
      email,
      properties,
    };

    this.sendRequest('/identify', data);
    this.log('Identify', data);
  }

  /**
   * Sendet ein Event an den Collector
   */
  private sendEvent(event: {
    event_type: string;
    event_name?: string;
    properties?: Record<string, unknown>;
  }): void {
    const data: TrackingData = {
      visitor_id: this.visitorId,
      session_id: this.sessionId,
      event_type: event.event_type,
      event_name: event.event_name,
      properties: event.properties,
      page: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
      },
      device: {
        type: detectDeviceType(),
        browser: detectBrowser(),
        os: detectOS(),
      },
    };

    // UTM-Parameter hinzufügen wenn vorhanden
    if (Object.keys(this.utm).length > 0) {
      data.utm = this.utm;
    }

    // Click IDs hinzufügen wenn vorhanden
    if (Object.keys(this.clickIds).length > 0) {
      data.click_ids = this.clickIds;
    }

    this.sendRequest('/track', data);
    this.log('Track', data);
  }

  /**
   * Sendet eine Anfrage an den Collector
   */
  private sendRequest(path: string, data: unknown): void {
    const url = this.config.endpoint + path;

    // Verwende Beacon API für bessere Zuverlässigkeit
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      // Fallback zu fetch
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch((err) => {
        if (this.config.debug) {
          console.error('[Palacios] Request failed:', err);
        }
      });
    }
  }

  /**
   * Debug-Logging
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[Palacios] ${message}`, data || '');
    }
  }

  /**
   * Gibt die Visitor ID zurück
   */
  getVisitorId(): string {
    return this.visitorId;
  }

  /**
   * Gibt die Session ID zurück
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// ============================================
// Export & Auto-Initialize
// ============================================

// Globale Instanz
const tracker = new PalaciosTracker();

// Exponiere API auf window.palacios
const palacios = {
  init: tracker.init.bind(tracker),
  page: tracker.page.bind(tracker),
  track: tracker.track.bind(tracker),
  identify: tracker.identify.bind(tracker),
  getVisitorId: tracker.getVisitorId.bind(tracker),
  getSessionId: tracker.getSessionId.bind(tracker),
};

// Auto-Attach wenn als Script geladen
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).palacios = palacios;
}

export default palacios;
