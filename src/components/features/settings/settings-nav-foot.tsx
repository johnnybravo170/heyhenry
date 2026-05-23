/**
 * Honest footer summary for the settings nav (desktop sidebar + mobile
 * list). Reads from `getSettingsNavCounts` so the tally can never drift
 * from what's actually rendered.
 *
 * Reads, for the renovation owner: "26 of 27 shown · 1 hidden for vertical
 * · 4 graduate"; for a member: "21 of 27 shown · 5 hidden for role · 1
 * hidden for vertical · 2 graduate". Segments with a zero count are
 * dropped so an owner never sees "0 hidden for role".
 */

import type { SettingsNavCounts } from './settings-nav-items';

export function SettingsNavFoot({ counts }: { counts: SettingsNavCounts }) {
  const segments: string[] = [];
  if (counts.hiddenForRole > 0) segments.push(`${counts.hiddenForRole} hidden for role`);
  if (counts.hiddenForVertical > 0)
    segments.push(`${counts.hiddenForVertical} hidden for vertical`);
  if (counts.graduate > 0) segments.push(`${counts.graduate} graduate`);

  return (
    <div className="mt-3 border-t pt-2.5 px-2 font-mono text-[11px] leading-relaxed tracking-[0.02em] text-muted-foreground">
      <div>
        <span className="font-semibold text-foreground">
          {counts.shown} of {counts.total}
        </span>{' '}
        shown
      </div>
      {segments.length > 0 ? <div>{segments.join(' · ')}</div> : null}
    </div>
  );
}
