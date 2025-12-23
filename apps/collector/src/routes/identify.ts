import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { isValidEmail, sanitizeString } from '../lib/utils.js';
import type { IdentifyRequest } from '@palacios/shared/types';

const identify = new Hono();

interface IdentifyResponse {
  success: boolean;
  contact_id?: string;
  error?: string;
}

/**
 * POST /identify
 * Verknüpft einen anonymen Visitor mit einer E-Mail-Adresse
 */
identify.post('/', async (c) => {
  try {
    const body = await c.req.json<IdentifyRequest>();

    // Validierung
    if (!body.visitor_id) {
      return c.json<IdentifyResponse>(
        { success: false, error: 'Missing required field: visitor_id' },
        400
      );
    }

    if (!body.email || !isValidEmail(body.email)) {
      return c.json<IdentifyResponse>(
        { success: false, error: 'Invalid or missing email' },
        400
      );
    }

    const email = body.email.toLowerCase().trim();

    // Prüfe ob Contact bereits existiert
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, visitor_id')
      .eq('email', email)
      .single();

    let contactId: string;

    if (existingContact) {
      // Contact existiert bereits
      contactId = existingContact.id;

      // Falls der Contact noch keinen Visitor hat, verknüpfe ihn
      if (!existingContact.visitor_id) {
        await supabase
          .from('contacts')
          .update({
            visitor_id: body.visitor_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
      }

      // Update Properties wenn vorhanden
      if (body.properties) {
        await supabase
          .from('contacts')
          .update({
            first_name: sanitizeString(body.properties.first_name) || undefined,
            last_name: sanitizeString(body.properties.last_name) || undefined,
            phone: sanitizeString(body.properties.phone) || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
      }
    } else {
      // Neuen Contact erstellen
      contactId = crypto.randomUUID();

      const { error } = await supabase.from('contacts').insert({
        id: contactId,
        visitor_id: body.visitor_id,
        email,
        first_name: sanitizeString(body.properties?.first_name),
        last_name: sanitizeString(body.properties?.last_name),
        phone: sanitizeString(body.properties?.phone),
        status: 'lead',
        identified_at: new Date().toISOString(),
      });

      if (error) {
        // Bei Unique Constraint Error (Race Condition), hole existierenden Contact
        if (error.code === '23505') {
          const { data: raceContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('email', email)
            .single();

          if (raceContact) {
            contactId = raceContact.id;
          }
        } else {
          console.error('Error creating contact:', error);
          return c.json<IdentifyResponse>(
            { success: false, error: 'Failed to create contact' },
            500
          );
        }
      }
    }

    // Verknüpfe alle bisherigen Events des Visitors mit dem Contact
    await supabase
      .from('events')
      .update({ contact_id: contactId })
      .eq('visitor_id', body.visitor_id)
      .is('contact_id', null);

    // Verknüpfe alle bisherigen Touchpoints des Visitors mit dem Contact
    await supabase
      .from('touchpoints')
      .update({ contact_id: contactId })
      .eq('visitor_id', body.visitor_id)
      .is('contact_id', null);

    return c.json<IdentifyResponse>({
      success: true,
      contact_id: contactId,
    });
  } catch (error) {
    console.error('Identify error:', error);
    return c.json<IdentifyResponse>(
      { success: false, error: 'Internal server error' },
      500
    );
  }
});

export default identify;
