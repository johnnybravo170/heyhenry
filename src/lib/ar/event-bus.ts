/**
 * AR event bus — writes events and converts them into enrollments.
 *
 * Flow:
 *   1. App code calls `emitArEvent({ tenantId, eventType, payload, contact })`
 *      — writes a row to `ar_events` and upserts the contact.
 *   2. Worker calls `processArEvents()` inside the AR cron tick — picks
 *      unprocessed events, finds sequences whose `trigger_type='event'` and
 *      `trigger_config.event_type` matches, enrolls the contact (payload
 *      stored in `ar_enrollments.metadata` for merge-tag resolution).
 *
 * Contact upsert is keyed by email-or-phone within the tenant scope. Same
 * rules as the MCP `ar_upsert_contact` tool.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type ArEventContact = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  timezone?: string | null;
};

export async function emitArEvent(params: {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  contact?: ArEventContact | null;
}): Promise<{ eventId: string; contactId: string | null }> {
  const admin = createAdminClient();

  let contactId: string | null = null;
  if (params.contact && (params.contact.email || params.contact.phone)) {
    contactId = await upsertContact(params.tenantId, params.contact);
  }

  const { data, error } = await admin
    .from('ar_events')
    .insert({
      tenant_id: params.tenantId,
      contact_id: contactId,
      event_type: params.eventType,
      payload: params.payload,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`emitArEvent: ${error?.message ?? 'insert_failed'}`);
  }
  return { eventId: data.id as string, contactId };
}

async function upsertContact(tenantId: string, contact: ArEventContact): Promise<string> {
  const admin = createAdminClient();

  // Match on email first (case-insensitive), then phone.
  let match: { id: string } | null = null;
  if (contact.email) {
    const { data } = await admin
      .from('ar_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', contact.email)
      .maybeSingle();
    match = (data as { id: string } | null) ?? null;
  }
  if (!match && contact.phone) {
    const { data } = await admin
      .from('ar_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', contact.phone)
      .maybeSingle();
    match = (data as { id: string } | null) ?? null;
  }

  if (match) {
    await admin
      .from('ar_contacts')
      .update({
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        first_name: contact.firstName ?? undefined,
        last_name: contact.lastName ?? undefined,
        timezone: contact.timezone ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id);
    return match.id;
  }

  const { data: created, error } = await admin
    .from('ar_contacts')
    .insert({
      tenant_id: tenantId,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      first_name: contact.firstName ?? null,
      last_name: contact.lastName ?? null,
      timezone: contact.timezone ?? 'America/Vancouver',
    })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(`upsertContact: ${error?.message ?? 'insert_failed'}`);
  }
  return created.id as string;
}

const PROCESS_BATCH = 50;

/**
 * Drain unprocessed events. For each event, find active sequences whose
 * trigger matches and enroll the contact (payload preserved as enrollment
 * metadata for merge-tag rendering).
 */
export async function processArEvents(): Promise<{
  processed: number;
  enrollmentsCreated: number;
  errored: number;
}> {
  const admin = createAdminClient();

  const { data: events, error } = await admin
    .from('ar_events')
    .select('id, tenant_id, contact_id, event_type, payload')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(PROCESS_BATCH);
  if (error) throw new Error(`processArEvents claim: ${error.message}`);
  if (!events || events.length === 0) {
    return { processed: 0, enrollmentsCreated: 0, errored: 0 };
  }

  let enrollmentsCreated = 0;
  let errored = 0;

  for (const event of events) {
    try {
      const created = await enrollForEvent(
        event.tenant_id as string,
        event.event_type as string,
        event.contact_id as string | null,
        (event.payload as Record<string, unknown>) ?? {},
      );
      enrollmentsCreated += created;
      await admin
        .from('ar_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', event.id);
    } catch (e) {
      errored++;
      const message = e instanceof Error ? e.message : String(e);
      // Mark processed so we don't retry forever; error details are
      // captured in the ar_events row for diagnostics.
      await admin
        .from('ar_events')
        .update({
          processed_at: new Date().toISOString(),
          payload: { ...((event.payload as object) ?? {}), _process_error: message.slice(0, 500) },
        })
        .eq('id', event.id);
    }
  }

  return { processed: events.length, enrollmentsCreated, errored };
}

async function enrollForEvent(
  tenantId: string,
  eventType: string,
  contactId: string | null,
  payload: Record<string, unknown>,
): Promise<number> {
  if (!contactId) return 0; // no recipient → nothing to enroll

  const admin = createAdminClient();
  const { data: sequences, error } = await admin
    .from('ar_sequences')
    .select('id, version, allow_reenrollment, trigger_config')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .eq('trigger_type', 'event');
  if (error) throw new Error(`list sequences: ${error.message}`);

  let created = 0;
  for (const seq of sequences ?? []) {
    const cfg = (seq.trigger_config as { event_type?: string } | null) ?? {};
    if (cfg.event_type !== eventType) continue;

    if (!seq.allow_reenrollment) {
      const { data: existing } = await admin
        .from('ar_enrollments')
        .select('id')
        .eq('sequence_id', seq.id)
        .eq('contact_id', contactId)
        .maybeSingle();
      if (existing) continue;
    }

    const { error: enrollErr } = await admin.from('ar_enrollments').insert({
      contact_id: contactId,
      sequence_id: seq.id,
      version: seq.version,
      next_run_at: new Date().toISOString(),
      metadata: payload,
    });
    if (enrollErr) throw new Error(`enroll: ${enrollErr.message}`);
    created++;
  }
  return created;
}
