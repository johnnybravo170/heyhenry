/**
 * Selection category vocabulary — what kind of thing the operator is
 * cataloging. App-side enum so verticals can extend later without a
 * schema change. The DB CHECK constraint enforces the same set; keep
 * them in sync.
 */

export const SELECTION_CATEGORIES = [
  'paint',
  'tile',
  'grout',
  'flooring',
  'trim',
  'cabinets',
  'countertop',
  'fixture',
  'appliance',
  'hardware',
  'other',
] as const;

export type SelectionCategory = (typeof SELECTION_CATEGORIES)[number];

export const selectionCategoryLabels: Record<SelectionCategory, string> = {
  paint: 'Paint',
  tile: 'Tile',
  grout: 'Grout',
  flooring: 'Flooring',
  trim: 'Trim',
  cabinets: 'Cabinets',
  countertop: 'Countertop',
  fixture: 'Fixture',
  appliance: 'Appliance',
  hardware: 'Hardware',
  other: 'Other',
};

export function isSelectionCategory(value: unknown): value is SelectionCategory {
  return typeof value === 'string' && (SELECTION_CATEGORIES as readonly string[]).includes(value);
}
