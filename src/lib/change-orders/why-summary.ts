/**
 * "What's changing & why" — the plain-English explanation a homeowner reads
 * before approving a change order (a trust moment: they're being asked to
 * pay more).
 *
 * The operator's `description` field IS the customer-facing why — it's the
 * primary source. This helper provides a DETERMINISTIC fallback summary
 * built from the diff line counts when the operator left the description
 * blank, so the public page is never bare. v1 is rules-based (no LLM in the
 * path); a future Henry pass can draft a richer narrative and flag it ✦.
 *
 * Returns `{ text, authoredByHenry }`. `authoredByHenry` is false for v1
 * (operator text or deterministic fallback); the field exists so callers can
 * render the ✦ HENRY chrome once Henry-authored summaries land.
 */

import type { ChangeOrderLineRow } from '@/lib/db/queries/change-orders';

export type ChangeOrderWhy = {
  text: string;
  authoredByHenry: boolean;
};

/** Build the deterministic fallback sentence from diff line counts. */
function deterministicSummary(diffLines: ChangeOrderLineRow[], timelineDays: number): string {
  const counts = { add: 0, modify: 0, remove: 0, modify_envelope: 0 };
  for (const d of diffLines) counts[d.action] += 1;

  const parts: string[] = [];
  if (counts.add > 0) parts.push(`${counts.add} new ${counts.add === 1 ? 'item' : 'items'}`);
  if (counts.modify > 0)
    parts.push(`${counts.modify} adjusted ${counts.modify === 1 ? 'item' : 'items'}`);
  if (counts.remove > 0)
    parts.push(`${counts.remove} removed ${counts.remove === 1 ? 'item' : 'items'}`);
  if (counts.modify_envelope > 0)
    parts.push(
      `${counts.modify_envelope} budget ${counts.modify_envelope === 1 ? 'adjustment' : 'adjustments'}`,
    );

  if (parts.length === 0) {
    return 'This change order updates the agreed scope of work for your project.';
  }

  // Oxford-style join: "A, B and C".
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  let text = `This change order covers ${joined} on your project.`;
  if (timelineDays > 0) {
    text += ` It adds about ${timelineDays} ${timelineDays === 1 ? 'day' : 'days'} to the schedule.`;
  }
  return text;
}

/**
 * Resolve the customer-facing "why" for a CO. Prefers the operator's
 * description (the plain-English field they fill in the editor); falls back
 * to a deterministic line-count summary so the public page is never empty.
 */
export function changeOrderWhy(input: {
  description: string | null | undefined;
  diffLines: ChangeOrderLineRow[];
  timelineDays: number;
}): ChangeOrderWhy {
  const desc = input.description?.trim();
  if (desc) {
    return { text: desc, authoredByHenry: false };
  }
  return {
    text: deterministicSummary(input.diffLines, input.timelineDays),
    authoredByHenry: false,
  };
}
