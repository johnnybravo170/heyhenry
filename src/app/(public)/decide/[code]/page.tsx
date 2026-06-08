/**
 * Public landing page for SMS / email tap-to-decide links. Slice 3 of
 * the Customer Portal build (with Slice 7 being the SMS sender that
 * uses these links).
 *
 * Mirrors /approve/<code> for change orders. The homeowner taps a link
 * from their phone, sees the decision context + reference photos, and
 * gets the same Approve / Decline / Ask buttons as on the portal —
 * without having to navigate to /portal/<slug>. No login.
 */

import { Shield } from 'lucide-react';
import { DecisionPanel, type PortalDecision } from '@/components/features/portal/decision-panel';
import { PublicBrandHeader } from '@/components/features/public/public-brand-header';
import { PublicViewLogger } from '@/components/features/public/public-view-logger';
import { formatDate } from '@/lib/date/format';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = {
  title: 'Decision Request — HeyHenry',
};

const LOGO_SIGN_SECONDS = 60 * 60 * 24 * 30;

export default async function DecidePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = createAdminClient();

  const { data: decision } = await admin
    .from('project_decisions')
    .select(
      `id, approval_code, label, description, due_date, status, photo_refs, options, decided_value,
       decided_by_customer, decided_at,
       projects:project_id (name, contacts:contact_id (name)),
       tenants:tenant_id (name, logo_storage_path, timezone)`,
    )
    .eq('approval_code', code)
    .single();

  if (!decision) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold">Decision request not found</h1>
          <p className="mt-2 text-muted-foreground">
            This link may have expired or been dismissed.
          </p>
        </div>
      </div>
    );
  }

  const d = decision as Record<string, unknown>;
  const project = d.projects as Record<string, unknown> | null;
  const tenant = d.tenants as Record<string, unknown> | null;
  const customer = project?.contacts as Record<string, unknown> | null;
  const businessName = (tenant?.name as string) ?? 'Your Contractor';
  const tenantTz = (tenant?.timezone as string | null) ?? undefined;
  const projectName = (project?.name as string) ?? 'Project';
  const customerName = (customer?.name as string) ?? '';
  const status = d.status as string;

  // Sign the GC logo (private `photos` bucket) for the branded letterhead —
  // brand chrome only, never project data.
  let logoUrl: string | null = null;
  const logoPath = tenant?.logo_storage_path as string | null;
  if (logoPath) {
    const { data: signed } = await admin.storage
      .from('photos')
      .createSignedUrl(logoPath, LOGO_SIGN_SECONDS);
    logoUrl = signed?.signedUrl ?? null;
  }
  const firstName = customerName.trim().split(/\s+/)[0] || '';
  const brandContext = firstName ? `A quick decision for ${firstName}` : projectName;

  // Branded shell shared by the terminal notices + the live decide page,
  // so a re-opened link still reads as the GC's letterhead, never a bare page.
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border bg-card shadow-sm">
        <PublicBrandHeader logoUrl={logoUrl} businessName={businessName} context={brandContext} />
        <div className="px-5 py-6">{children}</div>
      </div>
    </div>
  );

  // Already responded.
  if (status === 'decided') {
    const value = d.decided_value as string;
    const who = (d.decided_by_customer as string) ?? 'You';
    return (
      <Shell>
        <PublicViewLogger resourceType="decision" identifier={code} />
        <h1 className="text-xl font-semibold">
          Already {value === 'approved' ? 'approved' : 'declined'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {who} {value} this on{' '}
          {formatDate(d.decided_at as string, { timezone: tenantTz, style: 'long' })}.
        </p>
      </Shell>
    );
  }
  if (status === 'dismissed') {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">No longer needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {businessName} dismissed this decision request.
        </p>
      </Shell>
    );
  }

  // Resolve photo refs.
  const refs = (d.photo_refs ?? []) as Array<{ storage_path?: string }>;
  const paths = refs.map((r) => r?.storage_path).filter((p): p is string => Boolean(p));
  const signedMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage.from('photos').createSignedUrls(paths, 3600);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) signedMap.set(row.path, row.signedUrl);
    }
  }

  const optionsRaw = d.options as unknown[] | null;
  const options = Array.isArray(optionsRaw)
    ? optionsRaw.filter((o): o is string => typeof o === 'string')
    : [];

  const portalDecision: PortalDecision = {
    id: d.id as string,
    approval_code: d.approval_code as string,
    label: d.label as string,
    description: (d.description as string | null) ?? null,
    due_date: (d.due_date as string | null) ?? null,
    photo_urls: refs
      .map((r) => (r?.storage_path ? signedMap.get(r.storage_path) : null))
      .filter((u): u is string => Boolean(u)),
    options,
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <PublicViewLogger resourceType="decision" identifier={code} />
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border bg-card shadow-sm">
        <PublicBrandHeader logoUrl={logoUrl} businessName={businessName} context={brandContext} />
        <div className="px-4 py-5">
          <DecisionPanel decisions={[portalDecision]} defaultCustomerName={customerName} />
          <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Shield aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
            <span>This link only lets you answer this one question — no login required.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
