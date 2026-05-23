/**
 * <CustomerDocument> — the one branded wrapper every customer-facing money
 * document renders inside: Estimate · Change Order · Invoice/Pay.
 *
 * This is the GC's letterhead, NOT HeyHenry operator chrome — the brand on
 * the page is the contractor's (signed logo + business name); HeyHenry is a
 * quiet "Powered by HeyHenry" footer. Henry is invisible on customer
 * surfaces. Hard boundary: price-only — never unit_cost / markup / supplier
 * cost / margin renders here.
 *
 * Promoted out of the old `estimate-render.tsx` (the only prior reusable
 * customer render). The Estimate adopts it now; the Change Order public
 * `/approve` page and the Invoice pay surface adopt the SAME shell so all
 * three read as one company. Keep it doc-agnostic — no estimate-isms.
 *
 * What the shell owns (identical across docs):
 *   - branded header (logo|name + business meta · doc eyebrow/number/date · status chip)
 *   - "Prepared for {client}" + project block
 *   - body slot (the doc's own content)
 *   - the TOTALS block — Subtotal → Management fee → province-aware GST/HST → Total
 *   - footer — GST# · WCB# · "Powered by HeyHenry"
 *   - action-zone slot (Approve / Pay) — the one thing to do
 *
 * Money routes through <Money>; dates are pre-formatted by the caller in the
 * tenant tz (this is a client-agnostic render — no tz logic here). Status
 * tone comes from `status-tokens.ts` (no ad-hoc amber).
 *
 * PATTERNS.md §28.
 */

import type { ReactNode } from 'react';
import { Money } from '@/components/ui/money';
import { type StatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';

export type CustomerDocStatus = {
  /** Short text label, e.g. "Pending", "Due now", "Paid", "Void", "Expired". */
  label: string;
  /** Drives the chip color — reuse the canonical status tokens. */
  tone: StatusTone;
};

/** One row in the unifying totals block. Money is always cents. */
export type CustomerDocTotalsRow = {
  label: string;
  cents: number;
  /** Small uppercase meta to the right of the label (e.g. "BC · on top"). */
  meta?: string;
  /** Render +/- and tint (used for change-order deltas). */
  signed?: boolean;
};

export type CustomerDocumentProps = {
  /** Signed URL to the GC's logo (private photos bucket), or null → text name. */
  logoUrl: string | null;
  /** GC business name. Doubles as the logo's alt text. */
  businessName: string;
  /** Optional business meta line under the name (address · phone). */
  businessMeta?: string | null;

  /** Small uppercase eyebrow: "Estimate", "Change order", "Draw · invoice". */
  docEyebrow: string;
  /** Human doc number, e.g. "INV-2406-031". Omit to hide the row. */
  docNumber?: string | null;
  /** Pre-formatted date string in the tenant tz, e.g. "Sent May 22, 2026". */
  docDate?: string | null;
  status?: CustomerDocStatus | null;

  /** "Prepared for" / "Billed to" — the recipient. */
  preparedForLabel?: string;
  customerName: string;
  customerAddress?: string | null;
  /** Right column of the recipient grid — usually the project. */
  projectLabel?: string;
  projectName?: string | null;
  projectMeta?: string | null;

  /** The document body — line items, scope, CO diff, etc. */
  children: ReactNode;

  /**
   * The unifying totals block. Pass the rows in display order (Subtotal,
   * Management fee, tax, …); the Total row is rendered separately and
   * emphasized. Omit entirely to hide the block (rare).
   */
  totals?: {
    rows: CustomerDocTotalsRow[];
    totalLabel?: string;
    totalCents: number;
  } | null;

  /** Free-form terms / notes, rendered between body and footer. */
  termsText?: string | null;

  gstNumber?: string | null;
  wcbNumber?: string | null;
  /** Extra footer reg note, e.g. "Payable in CAD". */
  footerNote?: string | null;

  /** The action zone — Approve form / Pay options. Rendered after the footer. */
  actionZone?: ReactNode;
};

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-xs font-medium uppercase tracking-wider text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

function StatusChip({ status }: { status: CustomerDocStatus }) {
  const Icon = statusToneIcon[status.tone];
  return (
    <span
      className={cn(
        'mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        statusToneClass[status.tone],
      )}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {status.label}
    </span>
  );
}

export function CustomerDocument({
  logoUrl,
  businessName,
  businessMeta,
  docEyebrow,
  docNumber,
  docDate,
  status,
  preparedForLabel = 'Prepared for',
  customerName,
  customerAddress,
  projectLabel = 'Project',
  projectName,
  projectMeta,
  children,
  totals,
  termsText,
  gstNumber,
  wcbNumber,
  footerNote,
  actionZone,
}: CustomerDocumentProps) {
  const regParts = [
    gstNumber ? { k: 'GST', v: gstNumber } : null,
    wcbNumber ? { k: 'WCB', v: wcbNumber } : null,
    footerNote ? { k: '', v: footerNote } : null,
  ].filter((p): p is { k: string; v: string } => Boolean(p));

  return (
    <>
      {/* Branded letterhead */}
      <header className="mb-8 flex items-start justify-between gap-6 border-b pb-6">
        <div className="flex min-w-0 items-start gap-3">
          {logoUrl ? (
            // biome-ignore lint/performance/noImgElement: signed URLs don't flow through next/image
            <img
              src={logoUrl}
              alt={businessName}
              className="h-12 w-auto max-w-[240px] object-contain"
            />
          ) : (
            <p className="truncate text-base font-semibold">{businessName}</p>
          )}
          {logoUrl && businessMeta ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{businessName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{businessMeta}</p>
            </div>
          ) : null}
          {!logoUrl && businessMeta ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{businessMeta}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <Eyebrow>{docEyebrow}</Eyebrow>
          {docNumber ? (
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{docNumber}</p>
          ) : null}
          {docDate ? <p className="mt-0.5 text-sm text-muted-foreground">{docDate}</p> : null}
          {status ? <StatusChip status={status} /> : null}
        </div>
      </header>

      {/* Recipient + project block */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <Eyebrow>{preparedForLabel}</Eyebrow>
          <p className="mt-1 text-sm font-medium">{customerName}</p>
          {customerAddress ? (
            <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
              {customerAddress}
            </p>
          ) : null}
        </div>
        {projectName ? (
          <div>
            <Eyebrow>{projectLabel}</Eyebrow>
            <p className="mt-1 text-sm font-medium">{projectName}</p>
            {projectMeta ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{projectMeta}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Doc body */}
      {children}

      {/* Unifying totals block */}
      {totals ? (
        <div className="mt-4 space-y-1 text-sm">
          {totals.rows.map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-muted-foreground">
                {row.label}
                {row.meta ? (
                  <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground/70">
                    {row.meta}
                  </span>
                ) : null}
              </span>
              <Money cents={row.cents} signed={row.signed} />
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>{totals.totalLabel ?? 'Total'}</span>
            <Money cents={totals.totalCents} emphasis signed={totals.rows.some((r) => r.signed)} />
          </div>
        </div>
      ) : null}

      {/* Terms / notes */}
      {termsText?.trim() ? (
        <section className="mt-6 border-t pt-4">
          <Eyebrow className="mb-2">Terms &amp; notes</Eyebrow>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {termsText.trim()}
          </p>
        </section>
      ) : null}

      {/* Action zone — the one thing to do */}
      {actionZone}

      {/* Footer — GST# · WCB# · Powered by HeyHenry */}
      <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        {regParts.length > 0 ? (
          <div className="flex flex-wrap gap-3.5 font-mono">
            {regParts.map((p) => (
              <span key={`${p.k}-${p.v}`}>
                {p.k ? `${p.k} ` : ''}
                {p.k ? <span className="font-semibold text-foreground/80">{p.v}</span> : p.v}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground/70">
          Powered by <span className="font-semibold text-muted-foreground">HeyHenry</span>
        </span>
      </footer>
    </>
  );
}
