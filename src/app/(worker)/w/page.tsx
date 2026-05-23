import { AlertCircle, ChevronRight, Clock, FileText } from 'lucide-react';
import Link from 'next/link';
import { SiteSwitcher } from '@/components/features/checklist/site-switcher';
import { TeamChecklist } from '@/components/features/checklist/team-checklist';
import { Money } from '@/components/ui/money';
import { requireWorker } from '@/lib/auth/helpers';
import { listProjectsForWorker } from '@/lib/db/queries/project-assignments';
import { getLastBilledProjectForWorker } from '@/lib/db/queries/project-checklist';
import { previewUnbilledForWorker } from '@/lib/db/queries/worker-invoices';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function WorkerTodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ project?: string }>;
}) {
  const { user, tenant } = await requireWorker();
  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);
  const params = (await searchParams) ?? {};

  const tz = tenant.timezone;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  // Greeting eyebrow: "Wed · May 27" — Intl with an explicit timeZone is the
  // tenant-tz-safe path (the lint rule only blocks bare toLocale*/Intl).
  const dayLabel = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
    .format(new Date(`${today}T00:00`))
    .replace(',', ' ·');

  // Capability gate (mirror the layout): only show the sub-billing nudge when
  // the owner enabled invoicing. The worker never sees the word "subcontractor".
  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('workers_can_invoice_default')
    .eq('id', tenant.id)
    .maybeSingle();
  const canInvoice = profile.can_invoice ?? tenantRow?.workers_can_invoice_default ?? false;

  const profileIncomplete =
    !profile.display_name ||
    !profile.phone ||
    (profile.worker_type === 'subcontractor' && !profile.gst_number);

  // Today's projects: day-scheduled rows matching today + all ongoing.
  const { data: todayRows } = await admin
    .from('project_assignments')
    .select('project_id, scheduled_date, projects:project_id (name)')
    .eq('tenant_id', tenant.id)
    .eq('worker_profile_id', profile.id)
    .or(`scheduled_date.eq.${today},scheduled_date.is.null`);

  type TodayRow = {
    project_id: string;
    project_name: string;
    scheduled: boolean;
  };
  const seen = new Set<string>();
  const todaysProjects: TodayRow[] = [];
  for (const r of (todayRows ?? []) as unknown as Array<Record<string, unknown>>) {
    const pid = r.project_id as string;
    if (seen.has(pid)) continue;
    seen.add(pid);
    const proj = r.projects as { name?: string } | { name?: string }[] | null;
    const p = Array.isArray(proj) ? proj[0] : proj;
    todaysProjects.push({
      project_id: pid,
      project_name: p?.name ?? 'Project',
      scheduled: (r.scheduled_date as string | null) === today,
    });
  }
  // Scheduled first, then ongoing.
  todaysProjects.sort((a, b) => Number(b.scheduled) - Number(a.scheduled));

  const allProjects = await listProjectsForWorker(tenant.id, profile.id);

  // Sub-billing nudge — gated by can_invoice. Last 2 weeks of unbilled work.
  let unbilled: { hours: number; receipts: number; cents: number } | null = null;
  if (canInvoice) {
    const from = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
      new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
    );
    const { time, expenses } = await previewUnbilledForWorker({
      tenantId: tenant.id,
      workerProfileId: profile.id,
      fromDate: from,
      toDate: today,
    });
    if (time.length > 0 || expenses.length > 0) {
      const hours = time.reduce((s, t) => s + t.hours, 0);
      const cents =
        time.reduce((s, t) => s + t.amount_cents, 0) +
        expenses.reduce((s, x) => s + x.amount_cents, 0);
      unbilled = { hours, receipts: expenses.length, cents };
    }
  }

  // Pick the project for the team checklist widget. Priority:
  //   1. ?project= URL param (explicit switch)
  //   2. Most recent project the worker logged time against
  //   3. Today's first scheduled/ongoing project
  // Whatever we land on must still be in the worker's assigned set.
  const assignedIds = new Set(allProjects.map((p) => p.project_id));
  let activeSite: {
    project_id: string;
    project_name: string;
    customer_name: string | null;
  } | null = null;

  if (params.project && assignedIds.has(params.project)) {
    const match = allProjects.find((p) => p.project_id === params.project);
    if (match) {
      activeSite = {
        project_id: match.project_id,
        project_name: match.project_name,
        customer_name: match.customer_name,
      };
    }
  }

  if (!activeSite) {
    const last = await getLastBilledProjectForWorker(user.id);
    if (last && assignedIds.has(last.project_id)) {
      const match = allProjects.find((p) => p.project_id === last.project_id);
      if (match) {
        activeSite = {
          project_id: match.project_id,
          project_name: match.project_name,
          customer_name: match.customer_name,
        };
      }
    }
  }

  if (!activeSite && todaysProjects.length > 0) {
    const first = todaysProjects[0];
    const match = allProjects.find((p) => p.project_id === first.project_id);
    if (match) {
      activeSite = {
        project_id: match.project_id,
        project_name: match.project_name,
        customer_name: match.customer_name,
      };
    }
  }

  const switcherOptions = allProjects.map((p) => ({
    project_id: p.project_id,
    project_name: p.project_name,
    customer_name: p.customer_name,
  }));

  const firstName = profile.display_name ? profile.display_name.split(' ')[0] : '';

  return (
    <div className="flex flex-col gap-3">
      {/* Greeting */}
      <div>
        <p className="font-mono font-bold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
          {dayLabel}
        </p>
        <h1 className="mt-1 font-extrabold text-2xl text-foreground tracking-tight">
          Hi{firstName ? `, ${firstName}` : ''}.
        </h1>
      </div>

      {/* Profile-incomplete prompt — warn posture (field-readable, not raw red) */}
      {profileIncomplete ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-100 p-3.5 dark:border-amber-900/40 dark:bg-amber-900/30">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertCircle className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[14px] text-amber-900 dark:text-amber-200">
              Finish your profile
            </p>
            <p className="mt-0.5 text-[12px] text-amber-900/90 leading-snug dark:text-amber-200/90">
              Add your name, phone
              {profile.worker_type === 'subcontractor' ? (
                <>
                  {' '}
                  &amp; <strong>GST number</strong>
                </>
              ) : null}{' '}
              so your time
              {profile.worker_type === 'subcontractor' ? ' and invoices are' : ' is'} tagged
              correctly.
            </p>
            <Link
              href="/w/profile"
              className="mt-1.5 inline-flex font-bold text-[12px] text-amber-700 underline underline-offset-[3px] dark:text-amber-300"
            >
              Open profile →
            </Link>
          </div>
        </div>
      ) : null}

      {/* Today's schedule */}
      <section className="overflow-hidden rounded-[14px] border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <h2 className="font-bold text-[14px] text-foreground">Today&rsquo;s schedule</h2>
          <span className="font-mono font-bold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
            {todaysProjects.length === 0
              ? 'Off day'
              : `${todaysProjects.length} project${todaysProjects.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 px-4 pt-1 pb-4">
          {todaysProjects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-3.5 py-7 text-center">
              <span className="grid size-14 place-items-center rounded-2xl border border-border bg-paper-soft text-muted-foreground">
                <Clock className="size-[26px]" />
              </span>
              <p className="font-bold text-[14px] text-foreground">No projects scheduled today.</p>
              <p className="max-w-[280px] text-[12px] text-muted-foreground leading-snug">
                You can still log time against any project you&rsquo;re on.
              </p>
              {allProjects.length > 0 ? (
                <Link
                  href="/w/time/new"
                  className="mt-1 inline-flex h-[52px] items-center gap-2 rounded-xl border border-foreground bg-card px-5 font-bold text-[14px] text-foreground"
                >
                  <Clock className="size-4" /> Log time
                </Link>
              ) : null}
            </div>
          ) : (
            todaysProjects.map((p) => (
              <div
                key={p.project_id}
                className="flex min-h-[72px] items-center gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <span
                  className={
                    p.scheduled
                      ? 'w-2 self-stretch rounded-[4px] bg-brand'
                      : 'w-2 self-stretch rounded-[4px] border border-border bg-muted'
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={`/w/projects/${p.project_id}`}
                    className="truncate font-bold text-[16px] text-foreground leading-tight tracking-tight"
                  >
                    {p.project_name}
                  </Link>
                  <span className="font-mono font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
                    {p.scheduled ? 'Scheduled' : 'Ongoing · drop in'}
                  </span>
                </div>
                <Link
                  href={`/w/time/new?project=${p.project_id}&date=${today}`}
                  className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[11px] border border-foreground bg-foreground px-4 font-bold text-[14px] text-background"
                >
                  <Clock className="size-4" /> Log
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Sub-billing nudge — gated by can_invoice (entry point only) */}
      {unbilled ? (
        <Link
          href="/w/invoices/new"
          className="flex items-center gap-3 rounded-[14px] border border-border bg-paper-soft p-3.5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-border bg-card text-foreground">
            <FileText className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[14px] text-foreground">
              {unbilled.hours.toFixed(unbilled.hours % 1 === 0 ? 0 : 1)} hrs
              {unbilled.receipts > 0
                ? ` + ${unbilled.receipts} receipt${unbilled.receipts === 1 ? '' : 's'}`
                : ''}{' '}
              unbilled
            </p>
            <p className="mt-0.5 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
              Last 2 weeks · <Money cents={unbilled.cents} className="text-foreground" /> · Tap to
              bill
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-border bg-card text-foreground">
            <ChevronRight className="size-3.5" />
          </span>
        </Link>
      ) : null}

      {/* Team checklist + site-switcher */}
      {activeSite ? (
        <section className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-baseline justify-between gap-2 px-4 pt-3.5 pb-2.5">
            <h2 className="font-bold text-[14px] text-foreground">Team checklist</h2>
            <SiteSwitcher current={activeSite} options={switcherOptions} basePath="/w" />
          </div>
          <div className="px-4 pb-4">
            <TeamChecklist
              key={activeSite.project_id}
              projectId={activeSite.project_id}
              projectName={activeSite.project_name}
              chrome="bare"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
