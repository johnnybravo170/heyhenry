/**
 * Henry attention strip for the Business Health cockpit — the money-side,
 * account-level mirror of the project Overview "Needs You" strip.
 *
 * Action-first: each row leads with the thing to do (overdue AR → "Send
 * reminders" in rust; net-cash-negative → "Review bills"). Rust `✦` marks
 * the Henry-authored ranking. The engine (`getBusinessHealthAttention`) is
 * deterministic and returns `[]` when nothing's pressing — so this renders
 * nothing in the calm + empty states (no manufactured alarm).
 *
 * Server component — pure display off the precomputed attention set. Matches
 * the OD `.attention` / `.attention-row` recipe (rust-soft fill, rust left
 * rule, dashed row separators).
 */

import { ArrowRight, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/ui/money';
import type { AttentionItem } from '@/lib/db/queries/business-health-attention';

export function BusinessHealthAttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label={`Henry — ${items.length} ${items.length === 1 ? 'thing' : 'things'} money-side`}
      className="overflow-hidden rounded-xl border border-brand/20 border-l-[3px] border-l-brand bg-[#FEF0E3]"
    >
      {/* Head — rust ✦ eyebrow + count. */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5 sm:px-[18px]">
        <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-card text-brand">
          <Sparkles className="size-3" aria-hidden />
        </span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
          Henry
        </span>
        <span className="ml-auto font-mono text-[11px] text-brand/80">
          {items.length} {items.length === 1 ? 'thing' : 'things'} money-side
        </span>
      </div>

      {items.map((item) => (
        <AttentionRow key={item.kind} item={item} />
      ))}
    </section>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <div className="grid grid-cols-[16px_1fr_auto] items-center gap-3 border-t border-dashed border-brand/20 px-4 py-3 sm:grid-cols-[16px_1fr_auto_auto] sm:px-[18px]">
      <span aria-hidden className="mx-auto size-1.5 rounded-full bg-brand" />

      <div className="min-w-0 text-sm text-foreground">
        <span className="font-medium">{item.message}</span>{' '}
        <span className="text-muted-foreground">· {item.why}</span>
      </div>

      <span className="text-right text-base font-bold tabular-nums text-brand">
        {item.signed && item.amount_cents < 0 ? '−' : ''}
        <Money cents={Math.abs(item.amount_cents)} className="text-brand" />
      </span>

      {item.is_send ? (
        <Link
          href={item.href}
          className="col-span-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-brand px-3 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand/90 sm:col-span-1"
        >
          <Send className="size-3.5" aria-hidden />
          {item.cta}
        </Link>
      ) : (
        <Link
          href={item.href}
          className="col-span-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted sm:col-span-1"
        >
          {item.cta}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
