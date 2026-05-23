/**
 * Phase-name → Tailwind color classes for Gantt bars.
 *
 * Two layers per phase:
 *   - `firm`: solid bar fill (operator's confidence='firm' or default)
 *   - `rough`: dashed border + tinted fill (operator's confidence='rough')
 *
 * Customer-facing Gantt only uses `firm` — homeowners don't need the
 * confidence dimension. High-disruption tasks override the phase color
 * with the warning amber.
 *
 * Match is case-insensitive against `project_phases.name` (the trigger-
 * seeded names from migration 0122). Custom phase names fall through
 * to a neutral primary color.
 */

export type GanttPhaseColors = {
  /** Solid bar fill for confidence=firm and the customer view. */
  firm: string;
  /** Dashed/tinted variant for confidence=rough. */
  rough: string;
};

const NEUTRAL: GanttPhaseColors = {
  firm: 'bg-primary',
  rough: 'border border-dashed border-primary bg-primary/10',
};

/**
 * Canonical mappings keyed by lower-cased phase name. Aligned with the
 * default phase seed in `seed_project_phases_on_insert()` (migration
 * 0122) and the `trade_templates.typical_phase` strings used by the
 * Gantt bootstrap.
 */
const PHASE_COLOR_MAP: Record<string, GanttPhaseColors> = {
  'planning & selections': {
    firm: 'bg-slate-600',
    rough: 'border border-dashed border-slate-600 bg-slate-600/10',
  },
  demo: {
    firm: 'bg-[#C2410C]',
    rough: 'border border-dashed border-[#C2410C] bg-[#C2410C]/10',
  },
  framing: {
    firm: 'bg-[#1E40AF]',
    rough: 'border border-dashed border-[#1E40AF] bg-[#1E40AF]/10',
  },
  'rough-in': {
    firm: 'bg-[#0F766E]',
    rough: 'border border-dashed border-[#0F766E] bg-[#0F766E]/10',
  },
  inspection: {
    firm: 'bg-[#0E7490]',
    rough: 'border border-dashed border-[#0E7490] bg-[#0E7490]/10',
  },
  drywall: {
    firm: 'bg-[#6D28D9]',
    rough: 'border border-dashed border-[#6D28D9] bg-[#6D28D9]/10',
  },
  'cabinets & fixtures': {
    firm: 'bg-[#B45309]',
    rough: 'border border-dashed border-[#B45309] bg-[#B45309]/10',
  },
  finishes: {
    firm: 'bg-[#15803D]',
    rough: 'border border-dashed border-[#15803D] bg-[#15803D]/10',
  },
  'punch list': {
    firm: 'bg-[#BE123C]',
    rough: 'border border-dashed border-[#BE123C] bg-[#BE123C]/10',
  },
  'final walkthrough': {
    firm: 'bg-emerald-600',
    rough: 'border border-dashed border-emerald-600 bg-emerald-600/10',
  },
};

export function phaseColorFor(phaseName: string | null | undefined): GanttPhaseColors {
  if (!phaseName) return NEUTRAL;
  return PHASE_COLOR_MAP[phaseName.trim().toLowerCase()] ?? NEUTRAL;
}
