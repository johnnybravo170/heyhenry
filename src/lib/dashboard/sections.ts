/**
 * Stable identity + canonical order for the owner dashboard's top-level
 * sections. Shared by the server (page render, persistence) and the client
 * drag wrapper so a saved order in `tenant_members.dashboard_section_order`
 * is always interpreted against the same key set.
 *
 * Keys are permanent — renaming one orphans every saved order that
 * referenced it. Add new sections to the end of DEFAULT_DASHBOARD_SECTION_ORDER;
 * normalizeSectionOrder() appends any not-yet-seen key so existing saved
 * orders pick the new section up at the bottom rather than dropping it.
 */

export const DASHBOARD_SECTION_KEYS = ['attention', 'jobs', 'pipeline', 'metrics'] as const;

export type DashboardSectionKey = (typeof DASHBOARD_SECTION_KEYS)[number];

export const DEFAULT_DASHBOARD_SECTION_ORDER: DashboardSectionKey[] = [...DASHBOARD_SECTION_KEYS];

function isSectionKey(value: string): value is DashboardSectionKey {
  return (DASHBOARD_SECTION_KEYS as readonly string[]).includes(value);
}

/**
 * Coerce a raw saved order (possibly null, partial, reordered, or carrying
 * stale keys from an old build) into a complete, de-duplicated order over
 * exactly the current key set: keep recognized keys in their saved order,
 * then append any missing keys in default order.
 */
export function normalizeSectionOrder(saved: string[] | null | undefined): DashboardSectionKey[] {
  const seen = new Set<DashboardSectionKey>();
  const result: DashboardSectionKey[] = [];
  for (const key of saved ?? []) {
    if (isSectionKey(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  for (const key of DEFAULT_DASHBOARD_SECTION_ORDER) {
    if (!seen.has(key)) result.push(key);
  }
  return result;
}
