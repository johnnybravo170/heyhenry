import { TimeExpenseTab } from '@/components/features/projects/time-expense-tab';
import { WorkerInvoicesSection } from '@/components/features/projects/worker-invoices-section';
import { Money } from '@/components/ui/money';
import { getCurrentTenant, getCurrentUser } from '@/lib/auth/helpers';
import { getOperatorProfile } from '@/lib/db/queries/profile';
import { getProject } from '@/lib/db/queries/projects';
import { listTimeEntries } from '@/lib/db/queries/time-entries';
import { listInvoicesForProject } from '@/lib/db/queries/worker-invoices';
import { listWorkerProfiles } from '@/lib/db/queries/worker-profiles';
import { getOperatorNamesForTenant } from '@/lib/operator-names';
import { createClient } from '@/lib/supabase/server';

/**
 * Time tab — labour only. Expenses moved to the Costs tab (2026-04-24) so
 * the full cost lifecycle (sub quote → PO → bill → expense) stays together.
 */
export default async function TimeTabServer({ projectId }: { projectId: string }) {
  const [project, user, tenant] = await Promise.all([
    getProject(projectId),
    getCurrentUser(),
    getCurrentTenant(),
  ]);
  if (!project || !tenant) return null;

  const supabase = await createClient();
  const [operatorProfile, timeEntries, workerInvoices, crewWorkers, operatorNames, costLinesRes] =
    await Promise.all([
      user ? getOperatorProfile(tenant.id, user.id) : null,
      listTimeEntries({ project_id: projectId, limit: 100 }),
      listInvoicesForProject(project.tenant_id, projectId),
      listWorkerProfiles(project.tenant_id),
      getOperatorNamesForTenant(project.tenant_id),
      // Cost lines feed the cost-line picker on the Time form so labour
      // can be tagged to a specific line (not just its parent category).
      // Without this, the Budget tab's per-line Spent column never sees
      // category-only labour. Skip zero-priced lines — they're stubs.
      supabase
        .from('project_cost_lines')
        .select('id, label, budget_category_id, line_price_cents')
        .eq('project_id', projectId)
        .order('sort_order')
        .order('created_at'),
    ]);
  const ownerRateCents = operatorProfile?.defaultHourlyRateCents ?? null;

  // Resolve display names for crew workers. display_name is often null on
  // auto-created profiles — fall back to business_name, then the member's
  // first+last name so the picker never shows the generic "Worker" label.
  const memberNamesRes =
    crewWorkers.length > 0
      ? await supabase
          .from('tenant_members')
          .select('id, first_name, last_name')
          .in(
            'id',
            crewWorkers.map((w) => w.tenant_member_id),
          )
      : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] };
  const memberNameById = new Map(
    (memberNamesRes.data ?? []).map((m) => [
      m.id,
      [m.first_name, m.last_name].filter(Boolean).join(' ') || null,
    ]),
  );

  // Labour summary roll-up (computed server-side, passed to the body panel).
  // Hours: straight sum of every time-entry's hours.
  // Labour cost: sum of hours × the entry's own hourly_rate_cents (null rate
  //   contributes nothing — matches the table's "Billed" column exactly).
  // Awaiting: worker invoices in the operator's approval queue (submitted).
  const summaryTotalHours = timeEntries.reduce((s, e) => s + Number(e.hours), 0);
  const summaryLabourCostCents = timeEntries.reduce(
    (s, e) => s + Math.round(Number(e.hours) * (e.hourly_rate_cents ?? 0)),
    0,
  );
  const awaitingInvoices = workerInvoices.filter((inv) => inv.status === 'submitted');
  const summaryAwaitingCount = awaitingInvoices.length;
  const summaryAwaitingCents = awaitingInvoices.reduce((s, inv) => s + inv.total_cents, 0);

  const costLines = (
    (costLinesRes.data ?? []) as Array<{
      id: string;
      label: string;
      budget_category_id: string | null;
      line_price_cents: number;
    }>
  ).map((l) => ({
    id: l.id,
    label: l.label,
    budget_category_id: l.budget_category_id,
  }));

  return (
    <div className="space-y-6">
      {/* Summary roll-up — twin of the Costs "Money out" panel. Internal
          labour view: hours, hours×rate cost, and the worker-invoice
          approval queue. Billed work surfaces on Spend. */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-baseline justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Labour</span>
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Internal · hours &amp; worker invoices
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total hours
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {summaryTotalHours}
              <span className="ml-0.5 text-sm font-normal text-muted-foreground">h</span>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Labour cost
            </span>
            <Money cents={summaryLabourCostCents} className="text-lg font-semibold" />
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Hours × rate
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Awaiting you
            </span>
            {summaryAwaitingCount > 0 ? (
              <>
                <span className="text-lg font-semibold tabular-nums">
                  {summaryAwaitingCount}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    invoice{summaryAwaitingCount === 1 ? '' : 's'}
                  </span>
                </span>
                <a
                  href="#worker-invoices"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  <Money cents={summaryAwaitingCents} className="text-brand" /> to approve →
                </a>
              </>
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">All approved</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-1 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>Hours roll into Budget actuals · billed work shows on</span>
          <a
            href={`/projects/${projectId}?tab=costs`}
            className="font-medium text-foreground hover:underline"
          >
            Spend →
          </a>
        </div>
      </div>

      <div id="worker-invoices">
        <h3 className="mb-2 text-sm font-semibold">Worker invoices</h3>
        <WorkerInvoicesSection invoices={workerInvoices} />
      </div>
      <TimeExpenseTab
        projectId={projectId}
        categories={project.budget_categories}
        costLines={costLines}
        workers={crewWorkers.map((w) => ({
          id: w.id,
          display_name:
            w.display_name ?? w.business_name ?? memberNameById.get(w.tenant_member_id) ?? null,
          default_hourly_rate_cents: w.default_hourly_rate_cents,
        }))}
        ownerRateCents={ownerRateCents}
        showExpenses={false}
        expenses={[]}
        timeEntries={timeEntries.map((e) => {
          const wp = e.worker_profile_id
            ? crewWorkers.find((w) => w.id === e.worker_profile_id)
            : null;
          // Prefer worker display name; otherwise resolve owner/admin from
          // tenant_members + auth email so we don't fall back to
          // "Owner/admin" when the person actually has a name set.
          const workerName = wp
            ? (wp.display_name ??
              wp.business_name ??
              memberNameById.get(wp.tenant_member_id) ??
              null)
            : null;
          const posterName =
            workerName ?? (e.user_id ? operatorNames.get(e.user_id) : undefined) ?? null;
          const cat = e.budget_category_id
            ? project.budget_categories.find((b) => b.id === e.budget_category_id)
            : null;
          const line = e.cost_line_id ? costLines.find((l) => l.id === e.cost_line_id) : null;
          return {
            id: e.id,
            entry_date: e.entry_date,
            hours: Number(e.hours),
            hourly_rate_cents: e.hourly_rate_cents ?? null,
            notes: e.notes ?? null,
            worker_profile_id: e.worker_profile_id ?? null,
            worker_name: posterName,
            budget_category_id: e.budget_category_id ?? null,
            budget_category_name: cat?.name ?? null,
            cost_line_id: e.cost_line_id ?? null,
            cost_line_label: line?.label ?? null,
          };
        })}
      />
    </div>
  );
}
