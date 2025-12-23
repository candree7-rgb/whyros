import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { detectChannel, getPrimaryClickId, sanitizeString, isBot, getClientIp } from '../lib/utils.js';
import type { TrackEventRequest, TrackResponse } from '@palacios/shared';

const track = new Hono();

/**
 * POST /track
 * Empfängt Events vom Tracking Snippet
 */
track.post('/', async (c) => {
  try {
    const userAgent = c.req.header('user-agent');

    // Ignoriere Bots
    if (isBot(userAgent)) {
      return c.json<TrackResponse>({ success: true }, 200);
    }

    const body = await c.req.json<TrackEventRequest>();

    // Validierung
    if (!body.visitor_id || !body.event_type || !body.page?.url) {
      return c.json<TrackResponse>(
        { success: false, error: 'Missing required fields: visitor_id, event_type, page.url' },
        400
      );
    }

    // Visitor erstellen oder aktualisieren
    const visitorId = await upsertVisitor(body, c.req.raw.headers);

    // Event speichern
    const eventId = await createEvent(body, visitorId);

    // Touchpoint erstellen wenn relevant
    await maybeCreateTouchpoint(body, visitorId);

    return c.json<TrackResponse>({
      success: true,
      event_id: eventId,
      visitor_id: visitorId,
    });
  } catch (error) {
    console.error('Track error:', error);
    return c.json<TrackResponse>(
      { success: false, error: 'Internal server error' },
      500
    );
  }
});

/**
 * Erstellt oder aktualisiert einen Visitor
 */
async function upsertVisitor(data: TrackEventRequest, headers: Headers): Promise<string> {
  const visitorId = data.visitor_id;
  const clientIp = getClientIp(headers);

  // Prüfe ob Visitor existiert
  const { data: existingVisitor } = await supabase
    .from('visitors')
    .select('id')
    .eq('id', visitorId)
    .single();

  if (existingVisitor) {
    // Update last_seen
    await supabase
      .from('visitors')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', visitorId);

    return visitorId;
  }

  // Neuen Visitor erstellen
  const { error } = await supabase.from('visitors').insert({
    id: visitorId,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),

    // First Touch Attribution
    first_utm_source: sanitizeString(data.utm?.source),
    first_utm_medium: sanitizeString(data.utm?.medium),
    first_utm_campaign: sanitizeString(data.utm?.campaign),
    first_utm_content: sanitizeString(data.utm?.content),
    first_utm_term: sanitizeString(data.utm?.term),
    first_referrer: sanitizeString(data.page?.referrer),
    first_landing_page: sanitizeString(data.page?.url),
    first_click_id: getPrimaryClickId(data.click_ids),

    // Device Info
    device_type: data.device?.type || null,
    browser: sanitizeString(data.device?.browser),
    os: sanitizeString(data.device?.os),

    // Geo Info
    country: sanitizeString(data.geo?.country),
    city: sanitizeString(data.geo?.city),
  });

  if (error) {
    console.error('Error creating visitor:', error);
    // Bei Unique Constraint Error (Visitor existiert bereits), ignorieren
    if (error.code === '23505') {
      return visitorId;
    }
  }

  return visitorId;
}

/**
 * Erstellt ein Event
 */
async function createEvent(data: TrackEventRequest, visitorId: string): Promise<string> {
  const eventId = crypto.randomUUID();

  const { error } = await supabase.from('events').insert({
    id: eventId,
    visitor_id: visitorId,

    event_type: data.event_type,
    event_name: sanitizeString(data.event_name),
    event_properties: data.properties || null,

    page_url: sanitizeString(data.page?.url),
    page_title: sanitizeString(data.page?.title),
    referrer: sanitizeString(data.page?.referrer),

    utm_source: sanitizeString(data.utm?.source),
    utm_medium: sanitizeString(data.utm?.medium),
    utm_campaign: sanitizeString(data.utm?.campaign),
    utm_content: sanitizeString(data.utm?.content),
    utm_term: sanitizeString(data.utm?.term),

    fbclid: sanitizeString(data.click_ids?.fbclid),
    gclid: sanitizeString(data.click_ids?.gclid),
    ttclid: sanitizeString(data.click_ids?.ttclid),
    li_fat_id: sanitizeString(data.click_ids?.li_fat_id),

    session_id: data.session_id,
  });

  if (error) {
    console.error('Error creating event:', error);
  }

  return eventId;
}

/**
 * Erstellt einen Touchpoint wenn der Event Marketing-relevant ist
 */
async function maybeCreateTouchpoint(data: TrackEventRequest, visitorId: string): Promise<void> {
  // Touchpoints nur bei relevanten Events erstellen
  const relevantEventTypes = ['pageview', 'form_submit'];
  const hasMarketingParams = data.utm?.source || data.click_ids?.fbclid || data.click_ids?.gclid;

  // Nur bei erstem Pageview mit Marketing-Parametern oder bei Form-Submit
  if (!relevantEventTypes.includes(data.event_type) && !hasMarketingParams) {
    return;
  }

  // Nur Pageviews mit UTM/Click-IDs oder Form-Submits werden zu Touchpoints
  if (data.event_type === 'pageview' && !hasMarketingParams) {
    return;
  }

  const channel = detectChannel(data.utm, data.click_ids);

  const touchpointType = data.event_type === 'form_submit'
    ? 'form_submit'
    : 'ad_click';

  // Prüfe ob dies der erste Touchpoint ist
  const { count } = await supabase
    .from('touchpoints')
    .select('*', { count: 'exact', head: true })
    .eq('visitor_id', visitorId);

  const isFirstTouch = count === 0;

  const { error } = await supabase.from('touchpoints').insert({
    visitor_id: visitorId,
    channel,
    source: sanitizeString(data.utm?.source),
    medium: sanitizeString(data.utm?.medium),
    campaign: sanitizeString(data.utm?.campaign),
    content: sanitizeString(data.utm?.content),
    touchpoint_type: touchpointType,
    is_first_touch: isFirstTouch,
    is_last_touch: false, // Wird bei Kauf aktualisiert
  });

  if (error) {
    console.error('Error creating touchpoint:', error);
  }
}

export default track;
