'use client';

/**
 * Henry "possible duplicates" banner for the Contacts list — a calm,
 * dismissible heads-up (NOT a danger alarm): peach rust-soft fill, ✦ Henry
 * label, a one-line read of what looks duplicated, and a "Review →" link that
 * filters the list to just the duplicate clusters (`?dupes=1`).
 *
 * Detection lives in `findDuplicateContacts` (shared name / email / phone).
 * Dismissal is client-side + keyed by the duplicate signature, so dismissing
 * sticks until the set of duplicates actually changes (then Henry pipes up
 * again). Generic heads-up chrome per the design system — white/peach, never
 * a red fill.
 */

import { Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type ContactKind, contactKindLabels } from '@/lib/validators/customer';

const DISMISS_KEY = 'henryos:contacts:dupes-dismissed';

function kindLabel(kind: string): string {
  return contactKindLabels[kind as ContactKind] ?? kind;
}

export function ContactsDuplicateBanner({
  totalGroups,
  sampleName,
  sampleKinds,
  signature,
}: {
  totalGroups: number;
  /** First cluster's representative name (for the single-duplicate copy). */
  sampleName: string;
  /** First cluster's distinct kinds (for "appears as both a Lead and a Vendor"). */
  sampleKinds: string[];
  /** Stable signature of the duplicate set — re-shows if it changes after dismiss. */
  signature: string;
}) {
  // Default hidden until we've confirmed it wasn't already dismissed for this
  // exact signature (avoids a flash on every load).
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(DISMISS_KEY) === signature);
    } catch {
      setHidden(false);
    }
  }, [signature]);

  if (hidden || totalGroups === 0) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // ignore (private window, etc.)
    }
    setHidden(true);
  }

  const distinctKinds = sampleKinds.filter((k, i) => sampleKinds.indexOf(k) === i);
  const detail =
    totalGroups === 1 && distinctKinds.length >= 2
      ? `${sampleName} appears as a ${kindLabel(distinctKinds[0])} and a ${kindLabel(distinctKinds[1])}.`
      : totalGroups === 1
        ? `${sampleName} appears more than once.`
        : null;

  return (
    <section
      role="status"
      className="flex items-center gap-3 rounded-xl border border-brand/25 border-l-[3px] border-l-brand bg-[#FEF0E3] px-4 py-2.5"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-card text-brand">
        <Sparkles className="size-3.5" aria-hidden />
      </span>
      <p className="flex-1 text-sm text-foreground">
        <span className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
          Henry
        </span>
        spotted{' '}
        <strong className="font-semibold">
          {totalGroups} possible duplicate{totalGroups === 1 ? '' : 's'}
        </strong>
        {detail ? <> — {detail}</> : null}
      </p>
      <Link
        href="/contacts?dupes=1"
        className="shrink-0 text-sm font-medium text-brand hover:underline"
      >
        Review →
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss duplicates notice"
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </section>
  );
}
