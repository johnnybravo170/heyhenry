/**
 * Pure render of the customer-facing estimate. Shared between the public
 * `/estimate/[code]` page and the authed `/projects/[id]/estimate/preview`
 * page so both show the exact same thing.
 */

import { Fragment } from 'react';
import { Money } from '@/components/ui/money';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import type { StatusTone } from '@/lib/ui/status-tokens';
import type { CustomerViewMode } from '@/lib/validators/project-customer-view';
import { type CustomerDocTotalsRow, CustomerDocument } from './customer-document';
import { EstimatePhotoLightbox } from './estimate-photo-lightbox';

export type EstimateRenderLine = {
  id: string;
  label: string;
  notes: string | null;
  qty: number;
  unit: string;
  unit_price_cents: number;
  line_price_cents: number;
  category: string;
  /**
   * Budget category this line belongs to. Used for grouping on the customer-facing
   * estimate. Lines without a category group under "Other".
   */
  budget_category_id?: string | null;
  budget_category_name?: string | null;
  budget_category_section?: string | null;
  budget_category_order?: number;
  /** Optional description for the category. Rendered as subtext under the category header. */
  budget_category_description?: string | null;
  /** Signed URLs to any photos attached to this line. */
  photo_urls?: string[];
};

export type EstimateRenderProps = {
  businessName: string;
  /** Signed URL to the tenant's logo image, or null. */
  logoUrl: string | null;
  customerName: string;
  customerAddress?: string | null;
  projectName: string;
  description: string | null;
  /** Management fee decimal (e.g. 0.12 for 12%). */
  managementFeeRate: number;
  /** GST decimal (e.g. 0.05 for 5%). Set to 0 to hide the GST row. */
  gstRate: number;
  /**
   * Optional label override for the tax row (e.g. "HST 13%", "GST 5% + PST 7%").
   * If set, replaces the auto-computed "GST (X%)" label — use when the
   * tenant's province has HST or a non-standard breakdown.
   */
  taxLabel?: string;
  /** Optional quote date to show in the header. ISO string. */
  quoteDate?: string | null;
  /** IANA timezone for the contractor (e.g. 'America/Vancouver'). */
  timezone?: string | null;
  lines: EstimateRenderLine[];
  status: 'draft' | 'pending_approval' | 'approved' | 'declined';
  approvedByName?: string | null;
  approvedAt?: string | null;
  declinedReason?: string | null;
  gstNumber?: string | null;
  wcbNumber?: string | null;
  /** Free-form terms / notes. Rendered below the total, above the tax/WCB footer. */
  termsText?: string | null;
  /**
   * Document framing: 'estimate' (default, ballpark) or 'quote' (fixed-price,
   * binding). Only affects the heading / status copy on the customer-facing page.
   */
  documentType?: 'estimate' | 'quote';
  /**
   * How much of the cost breakdown the customer sees. Defaults to 'detailed'
   * (the current behaviour — section → category → lines). The other three
   * modes collapse upward:
   *   lump_sum   — one headline total + optional scope summary
   *   sections   — section rows only
   *   categories — section + category rows; lines not shown
   *   detailed   — full section → category → lines disclosure (default)
   */
  customerViewMode?: CustomerViewMode;
  /** Optional project-level scope summary, used in lump_sum mode as the body
   *  under the headline total. Markdown rendered via RichTextDisplay. */
  customerSummaryMd?: string | null;
  /** Tenant-level override for the grand-total row label (default "Total"). */
  totalLabel?: string;
};

function formatDate(iso: string | null | undefined, tz: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'long',
    timeZone: tz ?? 'America/Vancouver',
  }).format(d);
}

/**
 * Group lines by category (budget_category_id) and then by section.
 *
 * Customer view layout:
 *   - Section header: prominent (sm-base text, bold, distinct bar) so
 *     the operator's chosen divisions are obvious at a glance.
 *   - Category (Detailed mode): native <details>, open by default so
 *     every cost line is visible — that's the point of the "Detailed"
 *     rung. The summary row shows the category name + the sum of its
 *     line prices; a customer can collapse a category to scan, and the
 *     expanded body carries individual line items, descriptions, and
 *     photos. (The terser "Categories" rung shows name + total only.)
 *   - Print stylesheet at the bottom forces every <details> open
 *     when the page is printed/saved-as-PDF, so the printed
 *     estimate is always complete.
 *
 * Layout uses a CSS grid (`grid-cols-[1fr_auto]`) instead of a
 * <table> so the disclosure widget can wrap each category cleanly
 * without fighting <table> semantics.
 */
/** Aggregate cost lines into the section → category → lines tree shape
 *  used by every render mode below. Pure helper, no JSX. */
function groupLines(lines: EstimateRenderLine[]) {
  type Category = {
    key: string;
    categoryName: string;
    description: string | null;
    order: number;
    section: string | null;
    lines: EstimateRenderLine[];
  };
  type Section = {
    key: string;
    section: string | null;
    order: number;
    categories: Category[];
  };
  const byCategory = new Map<string, Category>();
  for (const l of lines) {
    const key = l.budget_category_id ?? '__none__';
    const g = byCategory.get(key) ?? {
      key,
      section: l.budget_category_section ?? null,
      categoryName: l.budget_category_name ?? 'Other',
      description: l.budget_category_description ?? null,
      order: l.budget_category_order ?? Number.MAX_SAFE_INTEGER,
      lines: [],
    };
    g.lines.push(l);
    byCategory.set(key, g);
  }
  const bySection = new Map<string, Section>();
  for (const b of byCategory.values()) {
    const sKey = b.section ?? '__none__';
    const s = bySection.get(sKey) ?? {
      key: sKey,
      section: b.section,
      order: b.order,
      categories: [],
    };
    s.categories.push(b);
    s.order = Math.min(s.order, b.order);
    bySection.set(sKey, s);
  }
  return Array.from(bySection.values())
    .map((s) => ({ ...s, categories: s.categories.sort((a, b) => a.order - b.order) }))
    .sort((a, b) => a.order - b.order);
}

/** Lump-sum view — one headline total with optional scope summary. */
function renderLumpSum(
  total: number,
  projectName: string,
  customerSummaryMd: string | null | undefined,
) {
  const summary = customerSummaryMd?.trim();
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 bg-foreground/5 px-4 py-3 text-sm">
        <div className="font-medium">Project work — {projectName}</div>
        <Money cents={total} />
      </div>
      {summary ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          <RichTextDisplay markdown={summary} />
        </div>
      ) : null}
    </div>
  );
}

/** Sections view — one row per section with the section subtotal.
 *  Lines and categories collapsed into the parent section. */
function renderSections(lines: EstimateRenderLine[]) {
  const sections = groupLines(lines);
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b bg-muted/50 px-4 py-2 text-sm font-medium">
        <div>Section</div>
        <div className="text-right">Total</div>
      </div>
      {sections.map((sec) => {
        const sectionTotal = sec.categories.reduce(
          (s, c) => s + c.lines.reduce((ss, l) => ss + l.line_price_cents, 0),
          0,
        );
        return (
          <div
            key={sec.key}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b px-4 py-3 last:border-0"
          >
            <span className="font-medium">{sec.section ?? 'Other work'}</span>
            <Money cents={sectionTotal} />
          </div>
        );
      })}
    </div>
  );
}

/** Categories view — section bands with one row per category and its
 *  subtotal. Lines themselves are not shown. */
function renderCategories(lines: EstimateRenderLine[]) {
  const sections = groupLines(lines);
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b bg-muted/50 px-4 py-2 text-sm font-medium">
        <div>Item</div>
        <div className="text-right">Total</div>
      </div>
      {sections.map((sec) => (
        <Fragment key={sec.key}>
          {sec.section ? (
            <div className="border-b bg-foreground/5 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-foreground">
              {sec.section}
            </div>
          ) : null}
          {sec.categories.map((g) => {
            const categoryTotal = g.lines.reduce((s, l) => s + l.line_price_cents, 0);
            return (
              <div
                key={g.key}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b px-4 py-3 last:border-0"
              >
                {/* One row per category — name + total only. Descriptions and
                 *  cost lines live in the "Detailed" mode so this stays the
                 *  terser rung on the ladder (Categories < Detailed). */}
                <span className="font-medium">{g.categoryName}</span>
                <Money cents={categoryTotal} />
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** Detailed view — section → category disclosures → lines. Current
 *  behaviour preserved. */
function renderDetailed(lines: EstimateRenderLine[]) {
  const sections = groupLines(lines);

  return (
    <>
      {/* Print: force every <details> open so PDF / paper output is
       *  complete even though the on-screen default is collapsed. */}
      <style>{`
        @media print {
          .estimate-categories details > *:not(summary) {
            display: block !important;
          }
          .estimate-categories details summary::-webkit-details-marker {
            display: none;
          }
          .estimate-categories details .estimate-chevron {
            display: none;
          }
        }
      `}</style>
      <div className="estimate-categories overflow-hidden rounded-md border">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b bg-muted/50 px-4 py-2 text-sm font-medium">
          <div>Item</div>
          <div className="text-right">Total</div>
        </div>
        {sections.map((sec) => (
          <Fragment key={sec.key}>
            {sec.section ? (
              <div className="border-b bg-foreground/5 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-foreground">
                {sec.section}
              </div>
            ) : null}
            {sec.categories.map((g) => {
              const categoryTotal = g.lines.reduce((s, l) => s + l.line_price_cents, 0);
              return (
                // Open by default so "Detailed" actually shows every cost line
                // (the rung's whole point). Operators/clients can still collapse
                // a category; print forces all open via the stylesheet above.
                <details
                  key={g.key}
                  open
                  className="group border-b last:border-0 [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-baseline gap-x-3 px-4 py-3 hover:bg-muted/30">
                    <div className="flex items-baseline gap-2">
                      <span
                        aria-hidden
                        className="estimate-chevron inline-block w-3 text-muted-foreground transition-transform group-open:rotate-90"
                      >
                        ›
                      </span>
                      <span className="font-medium">{g.categoryName}</span>
                      <span className="text-xs text-muted-foreground">
                        {g.lines.length} {g.lines.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <Money cents={categoryTotal} />
                  </summary>
                  <div className="bg-muted/10 px-4 pb-3 pt-1">
                    {g.description?.trim() ? (
                      <p className="mb-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {g.description.trim()}
                      </p>
                    ) : null}
                    <div className="divide-y divide-dashed">
                      {g.lines.map((l) => {
                        const hasDetail = !!l.notes || (l.photo_urls && l.photo_urls.length > 0);
                        return (
                          <div
                            key={l.id}
                            className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 py-2"
                          >
                            <div>
                              <p className="text-sm">{l.label}</p>
                              {hasDetail ? (
                                <div className="mt-1 space-y-1">
                                  {l.notes ? (
                                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                                      {l.notes}
                                    </p>
                                  ) : null}
                                  {l.photo_urls && l.photo_urls.length > 0 ? (
                                    <EstimatePhotoLightbox urls={l.photo_urls} />
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <Money cents={l.line_price_cents} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </Fragment>
        ))}
      </div>
    </>
  );
}

export function EstimateRender({
  businessName,
  logoUrl,
  customerName,
  customerAddress,
  projectName,
  description,
  managementFeeRate,
  gstRate,
  taxLabel,
  quoteDate,
  timezone,
  lines,
  status,
  approvedByName,
  approvedAt,
  declinedReason,
  gstNumber,
  wcbNumber,
  termsText,
  documentType = 'estimate',
  customerViewMode = 'detailed',
  customerSummaryMd,
  totalLabel,
}: EstimateRenderProps) {
  const docLabel = documentType === 'quote' ? 'Quote' : 'Estimate';
  const subtotal = lines.reduce((s, l) => s + l.line_price_cents, 0);
  const mgmtFee = Math.round(subtotal * managementFeeRate);
  const beforeTax = subtotal + mgmtFee;
  const gst = Math.round(beforeTax * gstRate);
  const total = beforeTax + gst;
  // Lump-sum mode collapses the breakdown to one row at the pre-tax
  // total (subtotal + mgmt fee). Other modes use the section/category
  // grouping helpers below.
  const lumpSumTotal = subtotal + mgmtFee;

  const dateLabel =
    formatDate(quoteDate, timezone) ?? formatDate(new Date().toISOString(), timezone);

  // Status chip — drive the shell chip from the estimate lifecycle. The
  // detailed approved/declined/draft *banner* stays in the body (it carries
  // who/when/why); the chip is the at-a-glance state.
  const statusChip: { label: string; tone: StatusTone } | null =
    status === 'approved'
      ? { label: 'Approved', tone: 'success' }
      : status === 'declined'
        ? { label: 'Declined', tone: 'danger' }
        : status === 'draft'
          ? { label: 'Draft', tone: 'neutral' }
          : { label: 'Pending', tone: 'warning' };

  // Totals rows for the shell's unifying block. Lump-sum collapses to the
  // single headline row in the body, so it passes no breakdown rows.
  const totalsRows: CustomerDocTotalsRow[] = [];
  if (customerViewMode !== 'lump_sum') {
    totalsRows.push({ label: 'Subtotal', cents: subtotal });
    if (mgmtFee > 0) {
      totalsRows.push({
        label: `Management fee (${Math.round(managementFeeRate * 100)}%)`,
        cents: mgmtFee,
      });
    }
  }
  if (gst > 0) {
    totalsRows.push({
      label: taxLabel ?? `GST (${(gstRate * 100).toFixed(gstRate * 100 < 1 ? 2 : 0)}%)`,
      cents: gst,
    });
  }
  // Lump-sum mode shows only its single-line body total; suppress the
  // shell totals block (it would otherwise show just "Total" twice).
  const totals =
    customerViewMode === 'lump_sum' && totalsRows.length === 0
      ? null
      : { rows: totalsRows, totalCents: total, totalLabel };

  return (
    <CustomerDocument
      logoUrl={logoUrl}
      businessName={businessName}
      docEyebrow={docLabel}
      docDate={dateLabel}
      status={statusChip}
      customerName={customerName}
      customerAddress={customerAddress ?? null}
      projectName={projectName}
      totals={totals}
      termsText={termsText ?? null}
      gstNumber={gstNumber ?? null}
      wcbNumber={wcbNumber ?? null}
    >
      {status === 'approved' && approvedByName && approvedAt ? (
        <div className="mb-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Approved by {approvedByName} on {formatDate(approvedAt, timezone)}.
        </div>
      ) : null}
      {status === 'declined' ? (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          This {docLabel.toLowerCase()} was declined.
          {declinedReason ? ` Reason: ${declinedReason}` : ''}
        </div>
      ) : null}
      {status === 'draft' ? (
        <div className="mb-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This {docLabel.toLowerCase()} is not yet published.
        </div>
      ) : null}

      {description ? (
        <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}

      {customerViewMode === 'lump_sum'
        ? renderLumpSum(lumpSumTotal, projectName, customerSummaryMd)
        : customerViewMode === 'sections'
          ? renderSections(lines)
          : customerViewMode === 'categories'
            ? renderCategories(lines)
            : renderDetailed(lines)}
    </CustomerDocument>
  );
}
