'use client';

/**
 * BR-7 — bank review queue. The slice where 50 manual "mark paid" clicks
 * become one bulk-confirm. Default-hides unmatched transactions.
 *
 * The matcher is ✦ Henry's leverage here, but it's **deterministic** — a
 * scoring rubric (Amount 50 · Date 30 · Payee 20), not a model. Henry
 * *proposes* and pre-checks high-confidence matches; it **never auto-confirms**.
 * Money state (invoice/bill → paid) flips only on a human click through the
 * AlertDialog gate.
 *
 * Each row:
 *   - Top match shown inline with a confidence-band badge (status-tokens + glyph).
 *   - "How Henry matched" disclosure (the rubric breakdown) for trust.
 *   - "Other candidates" dropdown for the alternates (when present).
 *   - Bulk checkbox; high-confidence rows pre-checked (never auto-confirmed).
 *   - Reject button ("not an invoice — it's a transfer/fee/etc").
 */

import { Check, HelpCircle, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import {
  type ConfidenceLevel,
  confidenceLabel,
  confidenceTone,
  explainMatch,
} from '@/lib/bank-recon/confidence-band';
import type { MatchCandidate } from '@/lib/bank-recon/matcher';
import { formatDate } from '@/lib/date/format';
import type { BankReviewRow } from '@/lib/db/queries/bank-review-queue';
import { formatCurrency } from '@/lib/pricing/calculator';
import { statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { confirmBankMatchesAction, rejectBankMatchesAction } from '@/server/actions/bank-confirm';
import { runAutoMatchAction } from '@/server/actions/bank-match';

const KIND_LABEL: Record<MatchCandidate['kind'], string> = {
  invoice: 'invoice',
  expense: 'expense',
  bill: 'bill',
};

type PendingDialog =
  | { kind: 'confirm'; summary: ConfirmSummary }
  | { kind: 'reject'; count: number }
  | null;

type ConfirmSummary = { invoices: number; bills: number; expenses: number; total: number };

export function BankReviewQueue({
  initialRows,
  counts,
  statements,
  filters,
}: {
  initialRows: BankReviewRow[];
  counts: {
    suggested_high: number;
    suggested_medium: number;
    suggested_low: number;
    unmatched: number;
    confirmed: number;
    rejected: number;
  };
  statements: Array<{ id: string; source_label: string; uploaded_at: string }>;
  filters: { statement_id?: string; include_unmatched: boolean };
}) {
  const tz = useTenantTimezone();
  const [rows, setRows] = useState(initialRows);
  // Per-row picked candidate index (0 = best, default).
  const [picks, setPicks] = useState<Record<string, number>>({});
  // Pre-check high-confidence rows; medium/low default off. Pre-checking is
  // NOT auto-confirming — money flips only when the human clicks Confirm.
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const r of initialRows) {
      if (r.match_confidence === 'high') init[r.id] = true;
    }
    return init;
  });
  const [working, startWork] = useTransition();
  const [rematching, startRematch] = useTransition();
  const [dialog, setDialog] = useState<PendingDialog>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const checkedIds = Object.entries(checked)
    .filter(([, v]) => v)
    .map(([k]) => k);

  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = {};
    for (const r of rows) {
      if (r.match_status === 'suggested') next[r.id] = value;
    }
    setChecked(next);
  }

  /** Tally the per-kind outcome of the current selection for the dialog summary. */
  function summarizeSelection(): ConfirmSummary {
    const sum: ConfirmSummary = { invoices: 0, bills: 0, expenses: 0, total: 0 };
    for (const id of checkedIds) {
      const row = rows.find((r) => r.id === id);
      const candidate = row?.match_candidates[picks[id] ?? 0];
      if (!candidate) continue;
      sum.total++;
      if (candidate.kind === 'invoice') sum.invoices++;
      else if (candidate.kind === 'bill') sum.bills++;
      else sum.expenses++;
    }
    return sum;
  }

  function openConfirm() {
    if (checkedIds.length === 0) {
      toast.error('Pick at least one match.');
      return;
    }
    setDialog({ kind: 'confirm', summary: summarizeSelection() });
  }

  function openReject() {
    if (checkedIds.length === 0) {
      toast.error('Pick at least one transaction.');
      return;
    }
    setDialog({ kind: 'reject', count: checkedIds.length });
  }

  function doConfirm() {
    const matches = checkedIds.map((id) => ({
      bank_tx_id: id,
      candidate_index: picks[id] ?? 0,
    }));
    setDialog(null);
    startWork(async () => {
      const res = await confirmBankMatchesAction(matches);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const parts: string[] = [];
      if (res.invoices_paid > 0)
        parts.push(`${res.invoices_paid} invoice${res.invoices_paid === 1 ? '' : 's'} paid`);
      if (res.bills_paid > 0)
        parts.push(`${res.bills_paid} bill${res.bills_paid === 1 ? '' : 's'} paid`);
      if (res.expenses_linked > 0)
        parts.push(`${res.expenses_linked} expense${res.expenses_linked === 1 ? '' : 's'} linked`);
      toast.success(parts.length > 0 ? parts.join(' · ') : `${res.confirmed} confirmed`);
      // Drop the confirmed rows from local state for instant feedback.
      setRows((prev) => prev.filter((r) => !checkedIds.includes(r.id)));
      setChecked({});
    });
  }

  function doReject() {
    const ids = [...checkedIds];
    setDialog(null);
    startWork(async () => {
      const res = await rejectBankMatchesAction(ids);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.rejected} marked as not-an-invoice`);
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setChecked({});
    });
  }

  function rejectOne(id: string) {
    startWork(async () => {
      const res = await rejectBankMatchesAction([id]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    });
  }

  function rerunMatching() {
    startRematch(async () => {
      const res = await runAutoMatchAction({ statement_id: filters.statement_id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.matched > 0
          ? `Re-scored ${res.scanned} unmatched · ${res.matched} new match${res.matched === 1 ? '' : 'es'}`
          : `Re-scored ${res.scanned} unmatched · no new matches yet`,
      );
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Review queue</CardTitle>
            <div className="flex items-center gap-2">
              <CountSummary counts={counts} include_unmatched={filters.include_unmatched} />
              <Button
                size="sm"
                variant="ghost"
                onClick={rerunMatching}
                disabled={rematching || working}
                title="Re-score still-unmatched lines after entering invoices the matcher missed"
              >
                {rematching ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                <span className="ml-1">Re-run matching</span>
              </Button>
            </div>
          </div>
          <FilterBar statements={statements} filters={filters} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filters.statement_id
                ? 'Nothing to review for this statement. All matches confirmed or skipped.'
                : 'Nothing waiting. Import a bank statement to see suggested matches here.'}
            </p>
          ) : (
            <>
              <BulkBar
                checkedCount={checkedIds.length}
                totalCount={rows.filter((r) => r.match_status === 'suggested').length}
                working={working}
                onToggleAll={toggleAll}
                onConfirm={openConfirm}
                onReject={openReject}
              />
              <ul className="flex flex-col divide-y">
                {rows.map((row) => (
                  <ReviewRow
                    key={row.id}
                    row={row}
                    tz={tz}
                    picked={picks[row.id] ?? 0}
                    onPick={(i) => setPicks((prev) => ({ ...prev, [row.id]: i }))}
                    checked={!!checked[row.id]}
                    onCheck={(v) => setChecked((prev) => ({ ...prev, [row.id]: v }))}
                    onReject={() => rejectOne(row.id)}
                    disabled={working}
                  />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmRejectDialog
        dialog={dialog}
        onCancel={() => setDialog(null)}
        onConfirm={doConfirm}
        onReject={doReject}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// AlertDialog — the money-state gate (replaces window.confirm)
// ---------------------------------------------------------------------------

function ConfirmRejectDialog({
  dialog,
  onCancel,
  onConfirm,
  onReject,
}: {
  dialog: PendingDialog;
  onCancel: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const isConfirm = dialog?.kind === 'confirm';
  return (
    <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isConfirm ? 'Confirm matches and mark paid?' : 'Mark as not an invoice?'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {isConfirm && dialog ? (
              <div className="space-y-2 text-sm">
                <p>
                  <strong className="tabular-nums">{dialog.summary.total}</strong> match
                  {dialog.summary.total === 1 ? '' : 'es'} →{' '}
                  {summaryParts(dialog.summary).join(' · ')}.
                </p>
                <p className="text-muted-foreground">
                  Invoices and bills flip to <strong>paid</strong>; expenses get linked for audit.
                  QuickBooks stays your book of record — this only marks the paid pile paid.
                </p>
              </div>
            ) : dialog?.kind === 'reject' ? (
              <span>
                Mark <strong className="tabular-nums">{dialog.count}</strong> transaction
                {dialog.count === 1 ? '' : 's'} as not-an-invoice? They stay for audit but won't
                re-suggest.
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={isConfirm ? onConfirm : onReject}>
            {isConfirm ? 'Confirm + mark paid' : 'Mark not an invoice'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function summaryParts(s: ConfirmSummary): string[] {
  const parts: string[] = [];
  if (s.invoices > 0) parts.push(`${s.invoices} invoice${s.invoices === 1 ? '' : 's'} paid`);
  if (s.bills > 0) parts.push(`${s.bills} bill${s.bills === 1 ? '' : 's'} paid`);
  if (s.expenses > 0) parts.push(`${s.expenses} expense${s.expenses === 1 ? '' : 's'} linked`);
  return parts.length > 0 ? parts : ['nothing selected'];
}

// ---------------------------------------------------------------------------
// Header bits
// ---------------------------------------------------------------------------

function CountSummary({
  counts,
  include_unmatched,
}: {
  counts: {
    suggested_high: number;
    suggested_medium: number;
    suggested_low: number;
    unmatched: number;
    confirmed: number;
    rejected: number;
  };
  include_unmatched: boolean;
}) {
  const suggested = counts.suggested_high + counts.suggested_medium + counts.suggested_low;
  return (
    <div className="text-xs text-muted-foreground">
      <strong className="tabular-nums text-foreground">{suggested}</strong> to review
      {suggested > 0 ? (
        <span className="text-muted-foreground">
          {' '}
          ({counts.suggested_high} high · {counts.suggested_medium} medium · {counts.suggested_low}{' '}
          low)
        </span>
      ) : null}
      {counts.unmatched > 0 && !include_unmatched ? (
        <>
          {' · '}
          {counts.unmatched} unmatched (those belong in QBO)
        </>
      ) : null}
      {counts.confirmed > 0 ? (
        <>
          {' · '}
          {counts.confirmed} done
        </>
      ) : null}
    </div>
  );
}

function FilterBar({
  statements,
  filters,
}: {
  statements: Array<{ id: string; source_label: string }>;
  filters: { statement_id?: string; include_unmatched: boolean };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Select
        value={filters.statement_id ?? 'all'}
        onValueChange={(v) => {
          const url = new URL(window.location.href);
          if (v === 'all') url.searchParams.delete('statement');
          else url.searchParams.set('statement', v);
          window.location.href = url.toString();
        }}
      >
        <SelectTrigger className="h-11 w-auto min-w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statements</SelectItem>
          {statements.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.source_label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="inline-flex min-h-11 items-center gap-1.5">
        <input
          type="checkbox"
          className="size-4"
          checked={filters.include_unmatched}
          onChange={(e) => {
            const url = new URL(window.location.href);
            if (e.target.checked) url.searchParams.set('include_unmatched', '1');
            else url.searchParams.delete('include_unmatched');
            window.location.href = url.toString();
          }}
        />
        Show unmatched
      </label>
    </div>
  );
}

function BulkBar({
  checkedCount,
  totalCount,
  working,
  onToggleAll,
  onConfirm,
  onReject,
}: {
  checkedCount: number;
  totalCount: number;
  working: boolean;
  onToggleAll: (v: boolean) => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const allChecked = checkedCount > 0 && checkedCount === totalCount;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <label className="inline-flex min-h-11 items-center gap-1.5">
        <input
          type="checkbox"
          className="size-4"
          checked={allChecked}
          onChange={(e) => onToggleAll(e.target.checked)}
          disabled={working}
        />
        {checkedCount > 0 ? `${checkedCount} selected` : 'Select all'}
      </label>
      <div className="flex-1" />
      <Button size="sm" onClick={onConfirm} disabled={working || checkedCount === 0}>
        {working ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        <span className="ml-1">Confirm + mark paid</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={onReject} disabled={working || checkedCount === 0}>
        <X className="size-4" />
        <span className="ml-1">Not an invoice</span>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ReviewRow({
  row,
  tz,
  picked,
  onPick,
  checked,
  onCheck,
  onReject,
  disabled,
}: {
  row: BankReviewRow;
  tz: string;
  picked: number;
  onPick: (i: number) => void;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const candidate = row.match_candidates[picked];
  const otherCandidates = row.match_candidates.slice(0, 3).filter((_, i) => i !== picked);
  const isOutflow = row.amount_cents < 0;

  return (
    <li
      className={cn(
        'grid grid-cols-[auto_110px_1fr_auto_auto] items-center gap-3 py-3 text-sm',
        disabled && 'opacity-60',
      )}
    >
      {row.match_status === 'suggested' ? (
        <input
          type="checkbox"
          className="size-4"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          disabled={disabled}
          aria-label="Select for bulk action"
        />
      ) : (
        <div className="size-4" />
      )}

      <div className="flex flex-col text-xs">
        <span className="font-medium tabular-nums text-foreground">
          {formatDate(row.posted_at, { timezone: tz, style: 'short' })}
        </span>
        <span className="text-muted-foreground">{row.statement_label}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium" title={row.description}>
          {row.description}
        </span>
        {candidate ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <ConfidenceBand confidence={candidate.confidence} />
            <span className="text-muted-foreground">
              {/* Direction glyph carries in/out meaning — never colour-only. */}
              <span aria-hidden>{isOutflow ? '→ ' : '← '}</span>
              {KIND_LABEL[candidate.kind]} · {candidate.label} ·{' '}
              {formatCurrency(candidate.amount_cents)} ·{' '}
              {formatDate(candidate.tx_date, { timezone: tz, style: 'short' })}
            </span>
            <HowHenryMatched row={row} candidate={candidate} />
            {otherCandidates.length > 0 ? (
              <CandidateSwitcher
                candidates={row.match_candidates}
                picked={picked}
                onPick={onPick}
              />
            ) : null}
          </div>
        ) : (
          <span className="text-xs italic text-muted-foreground">
            Unmatched · transfer / fee / interest? Reject to skip.
          </span>
        )}
      </div>

      <span className="inline-flex items-center gap-1 font-semibold">
        <span aria-hidden className="text-muted-foreground">
          {isOutflow ? '→' : '←'}
        </span>
        <span className="sr-only">{isOutflow ? 'Money out' : 'Money in'}</span>
        <Money cents={Math.abs(row.amount_cents)} />
      </span>

      <Button size="sm" variant="ghost" onClick={onReject} disabled={disabled} aria-label="Reject">
        <X className="size-3.5" />
      </Button>
    </li>
  );
}

/**
 * Confidence-band badge — status-tokens soft pair + tone glyph (never
 * colour-only). high→success, medium→warning, low→hold.
 */
function ConfidenceBand({ confidence }: { confidence: ConfidenceLevel }) {
  const tone = confidenceTone[confidence];
  const Icon = statusToneIcon[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
        statusToneClass[tone],
      )}
    >
      <Icon className="size-3" aria-hidden />
      {confidenceLabel[confidence]}
    </span>
  );
}

/**
 * "How Henry matched" — the deterministic rubric, surfaced. Makes a
 * pre-checked high-confidence match trustworthy enough to bulk-confirm.
 */
function HowHenryMatched({ row, candidate }: { row: BankReviewRow; candidate: MatchCandidate }) {
  const explanation = explainMatch(
    { posted_at: row.posted_at, amount_cents: row.amount_cents, description: row.description },
    candidate,
    candidate.label,
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded text-[11px] text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="size-3" aria-hidden />
          How Henry matched
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs" align="start">
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="size-3.5 text-brand" aria-hidden />
          <span className="text-foreground">Henry · how it matched</span>
        </div>
        <p className="mb-2 text-muted-foreground">
          Deterministic scoring — a rubric, not a guess. Henry proposes; you confirm.
        </p>
        <ul className="flex flex-col gap-1.5">
          {explanation.lines.map((line) => (
            <li key={line.label} className="flex items-baseline justify-between gap-2">
              <span>
                <strong className="text-foreground">{line.label}</strong>{' '}
                <span className="text-muted-foreground">— {line.detail}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {line.points}/{line.max}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t pt-2">
          <span className="font-medium">{confidenceLabel[explanation.band]}</span>
          <span className="tabular-nums text-muted-foreground">{explanation.total}/100</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CandidateSwitcher({
  candidates,
  picked,
  onPick,
}: {
  candidates: MatchCandidate[];
  picked: number;
  onPick: (i: number) => void;
}) {
  return (
    <Select value={String(picked)} onValueChange={(v) => onPick(Number(v))}>
      <SelectTrigger className="inline-flex h-11 w-auto px-2 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {candidates.slice(0, 3).map((c, i) => (
          <SelectItem key={`${c.kind}-${c.id}`} value={String(i)}>
            {c.label} · {formatCurrency(c.amount_cents)} ({confidenceLabel[c.confidence]})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
