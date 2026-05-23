'use client';

/**
 * Projects list — desktop table + mobile cards.
 *
 * Sort is server-side and URL-driven (`?sort=&dir=`) so it's correct across
 * paginated result sets: clicking a sortable header (Project, Start) navigates.
 * Status is a filter (not a sort); % complete is computed per page (display
 * only). One progress number + an "over budget" flag — no second burn metric.
 */

import { ChevronDown, ChevronsUpDown, ChevronUp, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useTransition } from 'react';
import { CloneProjectDialog } from '@/components/features/projects/clone-project-dialog';
import { ProjectNameEditor } from '@/components/features/projects/project-name-editor';
import { ProjectStatusBadge } from '@/components/features/projects/project-status-badge';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { ProjectListSort } from '@/lib/db/queries/projects';
import { cn } from '@/lib/utils';
import type { LifecycleStage } from '@/lib/validators/project';

type ProjectRow = {
  id: string;
  name: string;
  lifecycle_stage: LifecycleStage;
  start_date: string | null;
  estimate_sent_at: string | null;
  work_status_pct: number;
  over_budget: boolean;
  customer: { id: string; name: string } | null;
  /** Job-site locale ("Abbotsford · BC") shown under the project name. */
  region: string | null;
};

type CustomerOption = { id: string; name: string };

function daysSince(iso: string, nowMs: number): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((nowMs - then) / 86_400_000));
}

/** Progress cell: one % complete + a mini bar; over-budget rows lead with the flag. */
function Progress({ pct, overBudget }: { pct: number; overBudget: boolean }) {
  const width = `${Math.min(100, Math.max(0, pct))}%`;
  const isZero = pct === 0;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      {overBudget ? (
        // Text-only flag (no leading icon, no border) — OD `.over-flag`:
        // soft red fill, ink red text, semibold.
        <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-semibold text-[#B91C1C]">
          Over budget
        </span>
      ) : null}
      <span
        className={cn(
          'tabular-nums',
          // Over-budget demotes the % to a secondary cue; zero reads faintest.
          overBudget ? 'text-xs font-semibold text-muted-foreground' : 'text-base font-bold',
          isZero && !overBudget && 'text-muted-foreground/60',
        )}
      >
        {pct}
        <span
          className={cn(
            'text-xs',
            overBudget
              ? 'font-semibold text-muted-foreground'
              : isZero
                ? 'text-muted-foreground/60'
                : 'text-muted-foreground',
          )}
        >
          %
        </span>
      </span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-[#ECE3D0]">
        <span
          className={cn('block h-full rounded-full', overBudget ? 'bg-[#B91C1C]' : 'bg-[#3A3A3A]')}
          style={{ width }}
        />
      </span>
    </span>
  );
}

export function ProjectsTable({
  projects,
  sort,
  dir,
  nowMs,
  customerOptions,
  footer,
}: {
  projects: ProjectRow[];
  sort: ProjectListSort;
  dir: 'asc' | 'desc';
  /** Server-stable timestamp for "sent Nd ago" (avoids hydration drift). */
  nowMs: number;
  customerOptions: CustomerOption[];
  /** Card footer row (pager + range count) rendered inside the table card. */
  footer?: ReactNode;
}) {
  const tz = useTenantTimezone();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function sortHref(key: ProjectListSort): string {
    const params = new URLSearchParams(searchParams?.toString());
    const nextDir = sort === key && dir === 'asc' ? 'desc' : 'asc';
    params.set('sort', key);
    params.set('dir', nextDir);
    params.delete('page');
    return `/projects?${params.toString()}`;
  }
  function navigateSort(key: ProjectListSort) {
    startTransition(() => router.replace(sortHref(key)));
  }

  function startLabel(iso: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  }

  function sentCue(p: ProjectRow): string | null {
    if (p.lifecycle_stage !== 'awaiting_approval' || !p.estimate_sent_at) return null;
    const d = daysSince(p.estimate_sent_at, nowMs);
    return d === 0 ? 'sent today' : `sent ${d}d ago`;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden rounded-xl border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <SortHeader
                  label="Project"
                  sortKey="name"
                  sort={sort}
                  dir={dir}
                  onClick={navigateSort}
                />
                <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <SortHeader
                  label="Start"
                  sortKey="start"
                  sort={sort}
                  dir={dir}
                  onClick={navigateSort}
                />
                <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  % complete
                </th>
                <th className="w-px px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const cue = sentCue(p);
                return (
                  <tr key={p.id} className="group border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <Link href={`/projects/${p.id}`} className="font-bold hover:underline">
                          {p.name}
                        </Link>
                        <ProjectNameEditor projectId={p.id} name={p.name} variant="inline" />
                      </span>
                      {p.region ? (
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                          <MapPin className="size-3" aria-hidden />
                          {p.region}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.customer ? (
                        <Link href={`/contacts/${p.customer.id}`} className="hover:underline">
                          {p.customer.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <ProjectStatusBadge stage={p.lifecycle_stage} />
                        {cue ? <span className="text-xs text-muted-foreground">{cue}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {startLabel(p.start_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Progress pct={p.work_status_pct} overBudget={p.over_budget} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <CloneProjectDialog
                        projectId={p.id}
                        projectName={p.name}
                        defaultCustomerId={p.customer?.id ?? null}
                        customers={customerOptions}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {footer}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {projects.map((p) => {
          const cue = sentCue(p);
          return (
            <div key={p.id} className="relative flex flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-semibold after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none"
                >
                  {p.name}
                </Link>
                <ProjectStatusBadge stage={p.lifecycle_stage} />
              </div>
              {p.region ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" aria-hidden />
                  {p.region}
                </span>
              ) : null}
              {p.customer ? (
                <Link
                  href={`/contacts/${p.customer.id}`}
                  className="relative z-10 w-fit text-sm text-muted-foreground hover:underline"
                >
                  {p.customer.name}
                </Link>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{startLabel(p.start_date)}</span>
                <Progress pct={p.work_status_pct} overBudget={p.over_budget} />
                {cue ? <span className="text-xs">{cue}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  dir,
  onClick,
}: {
  label: string;
  sortKey: ProjectListSort;
  sort: ProjectListSort;
  dir: 'asc' | 'desc';
  onClick: (key: ProjectListSort) => void;
}) {
  const isActive = sort === sortKey;
  const Icon = !isActive ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide hover:text-foreground',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span>{label}</span>
        <Icon className="size-3.5 opacity-70" />
      </button>
    </th>
  );
}
