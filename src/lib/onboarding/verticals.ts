/**
 * Selectable verticals for the first-run onboarding pass.
 *
 * Lives in a plain module (not the `'use server'` actions file) because a
 * `'use server'` module may only export async server actions — a sync
 * type-guard like `isSelectableVertical` there fails the Turbopack build.
 */

// The verticals an owner can self-select during first run. Mirrors the
// pricebook-seeds catalog; kept narrow on purpose — more tiles land later.
export const SELECTABLE_VERTICALS = ['renovation', 'pressure_washing'] as const;

export type SelectableVertical = (typeof SELECTABLE_VERTICALS)[number];

export function isSelectableVertical(v: string): v is SelectableVertical {
  return (SELECTABLE_VERTICALS as readonly string[]).includes(v);
}
