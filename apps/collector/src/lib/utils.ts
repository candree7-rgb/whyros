import { CLICK_ID_PARAMS, PLATFORM_MAPPING } from '@palacios/shared';
import type { Channel } from '@palacios/shared';

/**
 * Ermittelt den Channel basierend auf UTM-Parametern und Click-IDs
 */
export function detectChannel(
  utm?: { source?: string; medium?: string },
  clickIds?: { fbclid?: string; gclid?: string; ttclid?: string; li_fat_id?: string }
): Channel {
  // Prüfe Click-IDs zuerst (höchste Priorität)
  if (clickIds?.fbclid) return 'meta_ads';
  if (clickIds?.gclid) return 'google_ads';
  if (clickIds?.ttclid) return 'tiktok_ads';
  if (clickIds?.li_fat_id) return 'linkedin_ads';

  // Prüfe UTM Source
  if (utm?.source) {
    const source = utm.source.toLowerCase();
    const mappedChannel = PLATFORM_MAPPING[source];
    if (mappedChannel) {
      return mappedChannel as Channel;
    }

    // Prüfe auf bekannte Patterns
    if (source.includes('facebook') || source.includes('fb') || source.includes('instagram') || source.includes('meta')) {
      return 'meta_ads';
    }
    if (source.includes('google') || source.includes('youtube')) {
      return 'google_ads';
    }
    if (source.includes('linkedin')) {
      return 'linkedin_ads';
    }
    if (source.includes('tiktok')) {
      return 'tiktok_ads';
    }
    if (source.includes('email') || source.includes('customerio') || source.includes('newsletter')) {
      return 'email';
    }
  }

  // Prüfe UTM Medium
  if (utm?.medium) {
    const medium = utm.medium.toLowerCase();
    if (medium === 'cpc' || medium === 'paid' || medium === 'ppc') {
      // Paid traffic, aber Plattform unbekannt - default zu direct
      return 'direct';
    }
    if (medium === 'email') {
      return 'email';
    }
    if (medium === 'organic') {
      return 'organic';
    }
    if (medium === 'referral') {
      return 'referral';
    }
  }

  return 'direct';
}

/**
 * Extrahiert den primären Click-ID-Wert
 */
export function getPrimaryClickId(
  clickIds?: { fbclid?: string; gclid?: string; ttclid?: string; li_fat_id?: string }
): string | null {
  if (!clickIds) return null;
  return clickIds.fbclid || clickIds.gclid || clickIds.ttclid || clickIds.li_fat_id || null;
}

/**
 * Validiert eine E-Mail-Adresse
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitiert Eingabedaten
 */
export function sanitizeString(input: string | null | undefined, maxLength = 500): string | null {
  if (!input) return null;
  return input.trim().slice(0, maxLength);
}

/**
 * Generiert eine UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Prüft ob eine Anfrage von einem Bot kommt
 */
export function isBot(userAgent?: string): boolean {
  if (!userAgent) return false;

  const botPatterns = [
    'bot',
    'crawler',
    'spider',
    'scraper',
    'headless',
    'phantom',
    'selenium',
    'puppeteer',
    'lighthouse',
    'pagespeed',
    'gtmetrix',
  ];

  const ua = userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Extrahiert IP-Adresse aus Request Headers
 */
export function getClientIp(headers: Headers): string | null {
  // Versuche verschiedene Header (in Reihenfolge der Priorität)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return null;
}
