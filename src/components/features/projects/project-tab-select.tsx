'use client';

/**
 * Narrow-viewport tab picker for the project detail page. Rendered below
 * the `lg` breakpoint; the desktop row of links stays a server render.
 *
 * The desktop nav surfaces per-tab attention counts as label badges; this
 * is the mobile equivalent (the nav collapses to a `<select>`, so the
 * badge layer moves here per the Project Hub "Alert surfacing model"). Each
 * option carries its own count (`Spend · 1`) and a soft-amber total pill
 * sits beside the trigger so the operator sees the total without opening
 * the menu. `counts` is keyed by tab key; the total = Σ counts, which is
 * kept consistent with the desktop row + the Overview "Needs You" strip.
 */

import { useRouter } from 'next/navigation';

export function ProjectTabSelect({
  projectId,
  currentTab,
  tabs,
  counts,
}: {
  projectId: string;
  currentTab: string;
  tabs: { key: string; label: string }[];
  /** Per-tab attention counts, keyed by tab key. Omitted while streaming. */
  counts?: Record<string, number>;
}) {
  const router = useRouter();
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0) : 0;
  return (
    <div className="flex items-center gap-2">
      <select
        value={currentTab}
        onChange={(e) => router.push(`/projects/${projectId}?tab=${e.target.value}`)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
      >
        {tabs.map((t) => {
          const n = counts?.[t.key] ?? 0;
          return (
            <option key={t.key} value={t.key}>
              {n > 0 ? `${t.label} · ${n > 9 ? '9+' : n}` : t.label}
            </option>
          );
        })}
      </select>
      {total > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {total > 9 ? '9+' : total}
          <span className="font-normal">{total === 1 ? 'alert' : 'alerts'}</span>
        </span>
      ) : null}
    </div>
  );
}
