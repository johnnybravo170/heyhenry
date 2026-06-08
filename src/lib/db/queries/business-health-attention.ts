/**
 * Henry attention engine for the Business Health cockpit — the money-side,
 * account-level mirror of the project Overview "Needs You" engine
 * (`project-insights.ts`).
 *
 * Rule-based v1, deterministic, no LLM in the critical path — Henry is the
 * ranking + synthesis intelligence, not a chat (decision 6790ef2b: Henry
 * surfaces things to consider, never commands). It never auto-acts: the
 * overdue-AR row drafts a chase, the owner sends it.
 *
 * V1 scope (brief §"Attention strip scope") = two money-side rules:
 *   1. AR aged >30d — the chase. Rust "Send reminders" action.
 *   2. Net cash near-term negative — unpaid bills outweigh collectible
 *      near-term AR (current + 1–30d). Deterministic from amounts, not a
 *      forecast.
 *
 * **Calm — no manufactured alarm.** When nothing's pressing this returns an
 * empty list and the strip is hidden entirely (unlike the project Overview
 * engine, which emits a calm `on_track` line). Business Health's home-base
 * read is the cockpit numbers; the strip only appears when there's something
 * to act on.
 */

import { formatCurrency } from '@/lib/pricing/calculator';
import type { BusinessHealthCockpit, OverdueInvoice } from './business-health-cockpit';

export type AttentionTone = 'danger' | 'warning';

export type AttentionItem = {
  kind: 'overdue_ar' | 'cash_negative';
  /** Lead line, plain English. */
  message: string;
  /** The "why" — supporting detail (customer names + ages, bills-vs-AR). */
  why: string;
  /** Headline amount in cents (the figure rendered rust on the right). */
  amount_cents: number;
  /** Negative amounts render with a leading minus (net-cash rule). */
  signed?: boolean;
  /** Deep link the row navigates to. */
  href: string;
  /** Primary action label. `is_send` ⇒ rust "Send reminders" CTA. */
  cta: string;
  is_send?: boolean;
  priority: number;
  tone: AttentionTone;
};

/** Compose the "why" for the overdue-AR chase from the 30d+ itemisation:
 *  "The Patel Family (47d), Lin Family (38d), MacLeod (32d)" + "+N more". */
function overdueWhy(invoices: OverdueInvoice[], more: number): string {
  const parts = invoices.map((inv) => `${inv.customer_name} (${inv.age_days}d)`);
  if (more > 0) parts.push(`+${more} more`);
  return parts.join(', ');
}

/**
 * Compute the ranked attention set from the cockpit aggregates. Pure +
 * DB-free so it's unit-testable and so the strip and the cockpit numbers
 * derive from one shared source and can't drift. Returns `[]` when nothing
 * is pressing — the strip then renders nothing.
 */
export function getBusinessHealthAttention(cockpit: BusinessHealthCockpit): AttentionItem[] {
  const items: AttentionItem[] = [];

  // 1. AR aged >30d — the chase. THE headline money-side signal.
  const overdue = cockpit.overdue_30_plus;
  if (overdue.count > 0) {
    items.push({
      kind: 'overdue_ar',
      message: `${overdue.count} ${overdue.count === 1 ? 'invoice' : 'invoices'} overdue >30d`,
      why: overdueWhy(overdue.invoices, overdue.more),
      amount_cents: overdue.total_cents,
      href: '/invoices?status=sent',
      cta: 'Send reminders',
      is_send: true,
      priority: 95,
      tone: 'danger',
    });
  }

  // 2. Net cash near-term negative — unpaid bills outweigh collectible
  //    near-term AR (current + 1–30d). Deterministic, not a forecast.
  const cash = cockpit.near_term_cash;
  if (cash.net_cents < 0 && cash.bills_due_cents > 0) {
    items.push({
      kind: 'cash_negative',
      message: 'Net cash negative near-term',
      why: `${formatCurrency(cash.bills_due_cents)} in unpaid bills against ${formatCurrency(
        cash.ar_landing_cents,
      )} of AR likely to land soon`,
      amount_cents: cash.net_cents,
      signed: true,
      href: '/business-health/bank-review',
      cta: 'Review bills',
      priority: 80,
      tone: 'warning',
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}
