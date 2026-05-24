'use client';

/**
 * Shared 3-segment Create / Merge / Skip decision toggle.
 *
 * The most-repeated bespoke control in the AI-assisted entity import
 * wizards (PATTERNS §16) — extracted here so the customer / project /
 * invoice / receipt previews share one implementation.
 *
 * Tone discipline (matches the OD render + the import brief):
 *   - Active Create / Merge → RUST (`bg-brand`) — the single accent.
 *     Rust on the active *decide* segment is one of the few sanctioned
 *     rust touchpoints in the wizard.
 *   - Active Skip → INK (`bg-foreground`) — a "set aside" state, not an
 *     accent; deliberately not rust so the eye reads Skip as neutral.
 *   - Merge is disabled (chip-fill, muted) when no dedup match exists.
 *
 * Not colour-only (WCAG SC 1.4.1): every segment carries its word, and
 * the active segment also gets a leading check glyph. The three buttons
 * form a labelled radio-style group with roving focus (arrow keys move
 * between segments; the group exposes "Decision for {label}").
 */

import { Check } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

export type ImportDecision = 'create' | 'merge' | 'skip';

const SEGMENTS: { value: ImportDecision; label: string }[] = [
  { value: 'create', label: 'Create' },
  { value: 'merge', label: 'Merge' },
  { value: 'skip', label: 'Skip' },
];

export function DecisionToggle({
  value,
  hasMatch,
  disabled = false,
  onChange,
  label,
  mergeHint,
}: {
  value: ImportDecision;
  /** Whether a dedup match exists — gates the Merge segment. */
  hasMatch: boolean;
  disabled?: boolean;
  onChange: (v: ImportDecision) => void;
  /** Accessible name for the row this toggle decides (e.g. "Sarah Patel"). */
  label?: string;
  /** Title/tooltip for the Merge segment, entity-specific copy. */
  mergeHint?: { matched: string; none: string };
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving focus: arrow keys move between enabled segments.
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    for (let step = 1; step <= SEGMENTS.length; step++) {
      const next = (index + dir * step + SEGMENTS.length) % SEGMENTS.length;
      const seg = SEGMENTS[next];
      const segDisabled = disabled || (seg.value === 'merge' && !hasMatch);
      if (!segDisabled) {
        refs.current[next]?.focus();
        return;
      }
    }
  }

  return (
    <div
      role="group"
      aria-label={label ? `Decision for ${label}` : 'Decision'}
      className="inline-flex h-7 overflow-hidden rounded-lg border border-border bg-card"
    >
      {SEGMENTS.map((seg, i) => {
        const active = value === seg.value;
        const mergeBlocked = seg.value === 'merge' && !hasMatch;
        const segDisabled = disabled || mergeBlocked;
        const title =
          seg.value === 'merge' && mergeHint
            ? hasMatch
              ? mergeHint.matched
              : mergeHint.none
            : undefined;
        return (
          <button
            key={seg.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            aria-pressed={active}
            title={title}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onClick={() => onChange(seg.value)}
            disabled={segDisabled}
            className={cn(
              'inline-flex items-center gap-1 border-r border-border px-2.5 text-xs font-semibold last:border-r-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active && seg.value === 'skip'
                ? 'bg-foreground text-background'
                : active
                  ? 'bg-brand text-white'
                  : segDisabled
                    ? 'cursor-not-allowed bg-muted text-muted-foreground'
                    : 'bg-transparent text-foreground hover:bg-muted',
            )}
          >
            {active ? <Check className="size-3" aria-hidden /> : null}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
