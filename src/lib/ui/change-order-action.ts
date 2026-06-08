/**
 * Change-order DIFF-ACTION palette.
 *
 * This is a deliberate semantic system for the four edit-action types a
 * change order can carry against the signed scope:
 *
 *   add             — a brand-new line / scope (ok-soft / green, glyph "+")
 *   change (modify) — an edited qty/price on an existing line (info-soft / blue, "↔")
 *   remove          — a struck-out line (danger-soft / red, "−")
 *   modify_envelope — a category budget bump, shown as "budget" (chip-fill / muted, "□")
 *
 * IMPORTANT — this is SEPARATE from lifecycle `status-tokens.ts`.
 * `status-tokens` answers "what state is this CO in" (draft / pending /
 * approved / declined). This module answers "what KIND of edit is this row".
 * They must not be conflated: a green "add" row is not a "success" status,
 * and a red "remove" row is not a "declined" status. Used identically in the
 * operator diff editor and the customer-facing public diff view so the eye
 * is trained once.
 *
 * Every tone is paired with a label + glyph so we are never colour-only
 * (WCAG 2.2 SC 1.4.1). Maps to the OD `.act-*` recipes in
 * `od-change-order/screens/desktop.html` (ok/info/danger-soft + chip-fill).
 *
 * PATTERNS.md §29.
 */

import type { ChangeOrderLineRow } from '@/lib/db/queries/change-orders';

export type ChangeOrderAction = 'add' | 'modify' | 'remove' | 'modify_envelope';

export type ChangeOrderActionStyle = {
  /** Short uppercase label rendered in the chip. */
  label: string;
  /** Mono glyph paired with the label so the chip isn't colour-only. */
  glyph: string;
  /** Pill class string (fill + text + border) — spread into `className`. */
  chipClass: string;
  /** Subtle full-row wash class for the editor diff rows. */
  rowClass: string;
  /** Class for the signed Δ figure on this kind of row. */
  deltaClass: string;
};

/**
 * One tone per action. The chip/row/delta classes intentionally use the
 * same emerald/blue/red/neutral families the rest of the app's soft pills
 * use (so the diff palette reads as part of the system) — but the *meaning*
 * here is edit-action, not lifecycle status.
 */
export const changeOrderActionStyle: Record<ChangeOrderAction, ChangeOrderActionStyle> = {
  add: {
    label: 'Add',
    glyph: '+',
    chipClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rowClass: 'bg-emerald-50/40',
    deltaClass: 'text-foreground',
  },
  modify: {
    label: 'Change',
    glyph: '↔',
    chipClass: 'bg-blue-100 text-blue-800 border-blue-200',
    rowClass: 'bg-blue-50/40',
    deltaClass: 'text-foreground',
  },
  remove: {
    label: 'Remove',
    glyph: '−',
    chipClass: 'bg-red-100 text-red-800 border-red-200',
    rowClass: 'bg-red-50/40',
    deltaClass: 'text-emerald-700',
  },
  modify_envelope: {
    label: 'Budget',
    glyph: '□',
    chipClass: 'bg-muted text-muted-foreground border-border',
    rowClass: 'bg-muted/30',
    deltaClass: 'text-foreground',
  },
};

/** Derive the before/after/delta price figures for one diff line, the same
 *  way the editor and the public view both need them. Pure — no JSX. */
export function changeOrderLineDelta(d: ChangeOrderLineRow): {
  beforeCents: number;
  afterCents: number;
  deltaCents: number;
} {
  const before = d.before_snapshot as {
    line_price_cents?: number;
    estimate_cents?: number;
  } | null;
  const isEnvelope = d.action === 'modify_envelope';
  const beforeCents = isEnvelope ? (before?.estimate_cents ?? 0) : (before?.line_price_cents ?? 0);
  const afterCents = d.action === 'remove' ? 0 : (d.line_price_cents ?? 0);
  return { beforeCents, afterCents, deltaCents: afterCents - beforeCents };
}
