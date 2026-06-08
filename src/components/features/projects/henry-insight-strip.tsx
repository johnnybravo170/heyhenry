/**
 * Henry "Needs You" strip on the project Overview cockpit.
 *
 * Renders the ranked insight set from `getProjectInsights` as the cockpit's
 * attention layer: an eyebrow ("NEEDS YOU · N today · ranked by Henry"),
 * up to 4 severity-ranked rows, and a native `<details>` "+N more" tail for
 * the rest. Each actionable row deep-links to the tab where it's resolved.
 * When nothing's actionable the engine returns a single calm `on_track`
 * line. Server component — the disclosure is JS-free (`<details>`).
 *
 * Tone → color comes from `status-tokens.ts` (PATTERNS.md §7), so the
 * rows train the same color as every other status surface; `bill` is the
 * peach positive-action treatment. Severity is never color-only — each row
 * carries a leading icon + the message text (WCAG 2.2 SC 1.4.1).
 */

import {
  Check,
  CircleDot,
  Hourglass,
  type LucideIcon,
  Receipt,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { getProjectInsights, type InsightTone } from '@/lib/db/queries/project-insights';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';

/** Tone → row class. status-tokens soft pairs for the canonical tones;
 *  `bill` is the peach positive-action fill (matches the AR/draw treatment). */
const TONE_CLASS: Record<InsightTone, string> = {
  danger: statusToneClass.danger,
  warning: statusToneClass.warning,
  info: statusToneClass.info,
  success: statusToneClass.success,
  neutral: 'bg-muted/40 text-muted-foreground border-transparent',
  bill: 'border-brand/20 bg-[#FEF0E3] text-brand hover:bg-[#FBE4CF]',
};

const TONE_ICON: Record<InsightTone, LucideIcon> = {
  danger: TriangleAlert,
  warning: Hourglass,
  info: Send,
  success: Check,
  neutral: CircleDot,
  bill: Receipt,
};

const VISIBLE_CAP = 4;

export async function HenryInsightStrip({ projectId }: { projectId: string }) {
  const insights = await getProjectInsights(projectId);
  if (insights.length === 0) return null;

  const actionableCount = insights.filter((i) => i.owningTab).length;
  const visible = insights.slice(0, VISIBLE_CAP);
  const overflow = insights.slice(VISIBLE_CAP);

  function row(ins: (typeof insights)[number]) {
    const Icon = TONE_ICON[ins.tone];
    const inner = (
      <>
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-[13px] font-medium leading-snug">{ins.message}</span>
        {ins.cta ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-semibold">{ins.cta} →</span>
        ) : null}
      </>
    );
    const className = cn(
      'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
      TONE_CLASS[ins.tone],
    );
    return ins.href ? (
      <Link
        key={`${ins.kind}-${ins.message}`}
        href={`/projects/${projectId}${ins.href}`}
        className={className}
      >
        {inner}
      </Link>
    ) : (
      <div key={`${ins.kind}-${ins.message}`} className={className}>
        {inner}
      </div>
    );
  }

  return (
    <section
      aria-label={`Needs you, ${actionableCount} ${actionableCount === 1 ? 'item' : 'items'}`}
    >
      {/* Eyebrow — rust ✦ marks the Henry-authored ranking. */}
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-3.5 text-brand" aria-hidden />
        <span className="text-foreground">Needs you</span>
        {actionableCount > 0 ? (
          <span className="font-normal">· {actionableCount} today · ranked by Henry</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.map(row)}

        {overflow.length > 0 ? (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40">
              <span>
                +{overflow.length} more · <span className="group-open:hidden">Show all</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="mt-1.5 flex flex-col gap-1.5">{overflow.map(row)}</div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
