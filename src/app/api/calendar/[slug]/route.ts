import { generateCalendarFeed, type IcsEventOptions } from '@/lib/calendar/ics-generator';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/calendar/:slug.ics
 *
 * Public iCal feed for a tenant's scheduled jobs. No auth required (but the
 * slug must be known). Intended for subscribing from Google Calendar, Apple
 * Calendar, or Outlook via "Add calendar from URL".
 *
 * Returns events for the next 90 days.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Strip .ics extension if present in the slug
  const cleanSlug = slug.replace(/\.ics$/, '');

  const admin = createAdminClient();

  // Look up tenant by slug
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id, name')
    .eq('slug', cleanSlug)
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
      'id, status, scheduled_at, notes, customers:customer_id (id, name, email, address_line1, city, province)',
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
    const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
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
      'Content-Disposition': `attachment; filename="${cleanSlug}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
