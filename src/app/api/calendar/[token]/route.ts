import { generateCalendarFeed, type IcsEventOptions } from '@/lib/calendar/ics-generator';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/calendar/:token.ics
 *
 * Public iCal feed for a tenant's scheduled jobs. No auth required, but the
 * URL is gated on a high-entropy per-tenant secret token (~144 bits) rather
 * than the guessable, user-chosen slug — the feed exposes customer PII
 * (names, addresses, appointment times, job notes), so it must not be
 * enumerable. Intended for subscribing from Google Calendar, Apple Calendar,
 * or Outlook via "Add calendar from URL".
 *
 * Returns events for the next 90 days.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Strip .ics extension if present in the path segment
  const cleanToken = token.replace(/\.ics$/, '');

  const admin = createAdminClient();

  // Look up tenant by its secret calendar-feed token
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id, name')
    .eq('calendar_feed_token', cleanToken)
    .is('deleted_at', null)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return new Response('Calendar not found', { status: 404 });
  }

  // Query jobs for the next 90 days
  const now = new Date();
  const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const { data: jobs, error: jobsErr } = await admin
    .from('jobs')
    .select(
      'id, status, scheduled_at, notes, contacts:contact_id (id, name, email, address_line1, city, province)',
    )
    .eq('tenant_id', tenant.id)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', ninetyDaysLater.toISOString())
    .order('scheduled_at', { ascending: true });

  if (jobsErr) {
    return new Response('Failed to load calendar', { status: 500 });
  }

  const events: IcsEventOptions[] = (jobs ?? []).map((job) => {
    const customer = Array.isArray(job.contacts) ? job.contacts[0] : job.contacts;
    const customerName = customer?.name ?? 'Customer';

    let location: string | undefined;
    if (customer?.address_line1) {
      const parts = [customer.address_line1, customer.city, customer.province].filter(Boolean);
      location = parts.join(', ');
    }

    return {
      jobId: job.id as string,
      summary: `${customerName} — ${tenant.name}`,
      description: (job.notes as string) ?? undefined,
      location,
      startTime: new Date(job.scheduled_at as string),
      organizerName: tenant.name as string,
      organizerEmail: 'noreply@heyhenry.io',
      status: job.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
    };
  });

  const feed = generateCalendarFeed(events, `${tenant.name} — Jobs`);

  return new Response(feed, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${cleanToken}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
