'use client';

/**
 * Vendor quotes section on the project Costs tab. Lists existing quotes
 * grouped by status, with accept/reject/delete affordances and the
 * create-new form.
 *
 * Accept button requires the allocation invariant (sum === total); the
 * server action re-checks and returns an error if they drift. If no
 * categories exist on the project yet, the "New vendor quote" button shows
 * a gentle "create a category first" hint rather than erroring later.
 */

import { ChevronRight, FileStack } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ReceiptPreviewButton } from '@/components/features/expenses/receipt-preview-button';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import type { SubQuoteRow } from '@/lib/db/queries/project-sub-quotes';

export type SubQuoteItem = SubQuoteRow & {
  attachment_signed_url: string | null;
  attachment_mime_hint: 'image' | 'pdf' | null;
};

import { type StatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import {
  acceptSubQuoteAction,
  deleteSubQuoteAction,
  rejectSubQuoteAction,
} from '@/server/actions/sub-quotes';
import { SubQuoteForm } from './sub-quote-form';
import { SubQuoteUploadButton } from './sub-quote-upload-button';

type Category = { id: string; name: string; section: 'interior' | 'exterior' | 'general' };

const STATUS_LABEL: Record<SubQuoteRow['status'], string> = {
  pending_review: 'Pending review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  superseded: 'Superseded',
};

// Map onto the canonical tone tokens so vendor-quote pills read the same
// color as every other status badge. OD: pending → warn (amber),
// accepted → ok (emerald); the terminal states are muted.
const STATUS_TONE: Record<SubQuoteRow['status'], StatusTone> = {
  pending_review: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  superseded: 'neutral',
};

// OD `.pill`: text-only mono, 10px/700, uppercase, 4px radius, soft fill,
// no border, no leading icon. Matches CostStatusBadge on the cost ledger.
const PILL =
  'inline-flex items-center whitespace-nowrap rounded border-transparent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Format date-only `YYYY-MM-DD` as "May 19". Parses parts directly — no
 *  Date/tz, so a date-only value never shifts across timezones. */
function fmtShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${SHORT_MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}

export function SubQuotesSection({
  projectId,
  subQuotes,
  categories,
}: {
  projectId: string;
  subQuotes: SubQuoteItem[];
  categories: Category[];
}) {
  const [showForm, setShowForm] = useState(false);

  const acceptedTotal = subQuotes
    .filter((q) => q.status === 'accepted')
    .reduce((s, q) => s + q.total_cents, 0);
  const pendingTotal = subQuotes
    .filter((q) => q.status === 'pending_review')
    .reduce((s, q) => s + q.total_cents, 0);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* OD .quote-metric: "$X committed · $Y pending review" — committed
            in ink, pending tinted warn. */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <span>
            <Money cents={acceptedTotal} className="font-bold text-foreground" /> committed
          </span>
          {pendingTotal > 0 ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>
                <Money cents={pendingTotal} className="font-bold text-amber-700" /> pending review
              </span>
            </>
          ) : null}
        </div>
        {!showForm && (
          <div className="flex items-center gap-2">
            <SubQuoteUploadButton projectId={projectId} categories={categories} />
            <span className="hidden font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:inline">
              Henry reads &amp; pre-fills
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              disabled={categories.length === 0}
              title={
                categories.length === 0 ? 'Create at least one budget category first.' : undefined
              }
            >
              + New vendor quote
            </Button>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="mb-4">
          <SubQuoteForm
            projectId={projectId}
            categories={categories}
            onDone={() => setShowForm(false)}
          />
        </div>
      ) : null}

      {subQuotes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileStack className="size-6 text-muted-foreground" />
          </div>
          <div className="max-w-md space-y-1">
            <p className="font-medium">No vendor quotes yet.</p>
            <p className="text-sm text-muted-foreground">
              Vendor quotes are quotes you&apos;ve received from trades or suppliers for parts of
              this project. Logging them gives you a live view of what you&apos;ve committed so your
              cost control stays accurate.
            </p>
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Create at least one budget category above, then come back here.
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <SubQuoteUploadButton projectId={projectId} categories={categories} />
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                + Add manually
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {subQuotes.map((q) => (
            <SubQuoteRowView key={q.id} quote={q} projectId={projectId} categories={categories} />
          ))}
        </div>
      )}
    </section>
  );
}

function SubQuoteRowView({
  quote,
  projectId,
  categories,
}: {
  quote: SubQuoteItem;
  projectId: string;
  categories: Category[];
}) {
  const [expanded, setExpanded] = useState(quote.status === 'pending_review');
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const allocatedSum = quote.allocations.reduce((s, a) => s + a.allocated_cents, 0);
  const balanced = allocatedSum === quote.total_cents && quote.total_cents > 0;

  function handleAccept() {
    if (!balanced) {
      toast.error('Allocations must equal the quote total before accepting.');
      return;
    }
    startTransition(async () => {
      const result = await acceptSubQuoteAction({
        subQuoteId: quote.id,
        projectId,
        replaceExisting: 'auto',
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Vendor quote accepted.');
    });
  }

  function handleReject() {
    if (!confirm('Reject this vendor quote?')) return;
    startTransition(async () => {
      const result = await rejectSubQuoteAction({ subQuoteId: quote.id, projectId });
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDelete() {
    if (!confirm('Delete this vendor quote permanently?')) return;
    startTransition(async () => {
      const result = await deleteSubQuoteAction({ subQuoteId: quote.id, projectId });
      if (!result.ok) toast.error(result.error);
    });
  }

  const isPending = quote.status === 'pending_review';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card',
        // OD: pending cards get a rust... actually warn left accent + tinted head.
        isPending && 'border-l-2 border-l-amber-400',
      )}
    >
      <div
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3.5',
          isPending ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-[#FFFCF7]',
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronRight
            className={cn(
              'size-4 flex-shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold tracking-[-0.005em]">{quote.vendor_name}</span>
              {quote.scope_description ? (
                <span className="truncate text-sm font-medium text-muted-foreground">
                  — {quote.scope_description}
                </span>
              ) : null}
            </div>
          </div>
          <span className={cn(PILL, statusToneClass[STATUS_TONE[quote.status]])}>
            {STATUS_LABEL[quote.status]}
          </span>
          {quote.quote_date ? (
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
              {fmtShortDate(quote.quote_date)}
            </span>
          ) : null}
          <Money cents={quote.total_cents} className="text-base font-bold" />
        </button>
        {quote.attachment_signed_url ? (
          <ReceiptPreviewButton
            url={quote.attachment_signed_url}
            mimeHint={quote.attachment_mime_hint}
            vendor={quote.vendor_name}
          />
        ) : null}
      </div>

      {expanded && editing ? (
        <div className="border-t px-4 py-4 pl-12">
          <SubQuoteForm
            projectId={projectId}
            categories={categories}
            editingQuoteId={quote.id}
            initialValues={{
              vendor_name: quote.vendor_name,
              vendor_email: quote.vendor_email ?? '',
              vendor_phone: quote.vendor_phone ?? '',
              total_cents: quote.total_cents,
              scope_description: quote.scope_description ?? '',
              notes: quote.notes ?? '',
              quote_date: quote.quote_date ?? '',
              valid_until: quote.valid_until ?? '',
              allocations: quote.allocations.map((a) => ({
                budget_category_id: a.budget_category_id,
                allocated_cents: a.allocated_cents,
                notes: a.notes ?? undefined,
              })),
            }}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : null}

      {expanded && !editing ? (
        <div className="flex flex-col gap-4 border-t px-4 py-4 pl-12 text-sm">
          {/* Category allocations */}
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Category allocations
            </div>
            {quote.allocations.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                No allocations yet. Edit to assign this quote to categories.
              </p>
            ) : (
              quote.allocations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-[#FBF6EC] px-3 py-2 text-[13px]"
                >
                  <span
                    className={cn(
                      'min-w-0 truncate font-medium',
                      a.budget_category_name ? 'text-foreground' : 'italic text-amber-700',
                    )}
                  >
                    {a.budget_category_name ?? 'needs a category'}
                  </span>
                  <Money cents={a.allocated_cents} className="font-semibold" />
                </div>
              ))
            )}
          </div>

          {/* Allocation tally — balanced (emerald) vs imbalanced (amber) */}
          {quote.allocations.length > 0 ? (
            <div
              className={cn(
                'inline-flex items-center gap-2 self-start rounded-lg border px-3 py-1.5 text-[13px]',
                balanced
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              <span>Allocated</span>
              <Money cents={allocatedSum} className="font-bold" />
              <span>of</span>
              <Money cents={quote.total_cents} className="font-bold" />
              <span>— {balanced ? 'balanced' : 'unbalanced'}</span>
            </div>
          ) : null}

          {/* Actions — Accept is the rust primary; rest are ghost-line */}
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
            {isPending ? (
              <>
                <Button
                  size="sm"
                  onClick={handleAccept}
                  disabled={pending || !balanced}
                  title={balanced ? undefined : 'Balance allocations first.'}
                  className="bg-brand text-white hover:bg-brand/90 border-brand"
                >
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={handleReject} disabled={pending}>
                  Reject
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={pending}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
            >
              Delete
            </Button>
            {isPending ? (
              <span
                className={cn(
                  'ml-auto font-mono text-[11px] uppercase tracking-wide',
                  balanced ? 'text-emerald-700' : 'text-amber-700',
                )}
              >
                {balanced ? '✓ balanced — Accept enabled' : 'Balance allocations to accept'}
              </span>
            ) : null}
          </div>

          {quote.notes ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Notes:</span> {quote.notes}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
