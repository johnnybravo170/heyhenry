-- 20260522170008_ar_tax_aware_business_health.sql
-- Fix the Business Health RPC to compute invoice totals the same way the
-- app does (src/lib/invoices/totals.ts `invoiceTotalCents`).
--
-- The RPC summed `amount_cents + tax_cents` unconditionally for both
-- `revenue_ytd` and `ar_outstanding`. That is wrong two ways:
--   1. tax_inclusive invoices: amount_cents IS the total, so adding tax_cents
--      DOUBLE-COUNTS the embedded GST. Business Health overcounted AR and
--      revenue vs. the Dashboard (which already uses invoiceTotalCents).
--   2. tax_exclusive invoices: the additive line_items breakdown was ignored
--      entirely, so estimate-derived drafts (amount_cents=0, full breakdown in
--      line_items) were undercounted to just their tax.
--
-- This migration introduces a SQL `invoice_total_cents(...)` mirroring the TS
-- primitive exactly, and points the revenue + ar CTEs at it. The ap /
-- owner_pay / expenses_out CTEs are preserved verbatim from the current RPC
-- definition (20260512152549, which reads the unified project_costs table) —
-- ONLY the two invoice aggregates change here.

-- Canonical tax-aware invoice total (mirror of invoiceTotalCents)
CREATE OR REPLACE FUNCTION public.invoice_total_cents(
  p_amount_cents  INT,
  p_tax_cents     INT,
  p_tax_inclusive BOOLEAN,
  p_line_items    JSONB
)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_tax_inclusive, FALSE)
      -- tax_inclusive: amount_cents already IS the customer total.
      THEN COALESCE(p_amount_cents, 0)::BIGINT
    ELSE
      -- tax_exclusive: amount + additive line items + tax.
      COALESCE(p_amount_cents, 0)::BIGINT
      + COALESCE(
          (
            SELECT SUM(COALESCE((li ->> 'total_cents')::BIGINT, 0))
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(p_line_items) = 'array'
                   THEN p_line_items ELSE '[]'::JSONB END
            ) AS li
          ),
          0
        )
      + COALESCE(p_tax_cents, 0)::BIGINT
  END;
$$;

COMMENT ON FUNCTION public.invoice_total_cents(INT, INT, BOOLEAN, JSONB) IS
  'Canonical tax-aware invoice total in cents. Mirror of invoiceTotalCents in src/lib/invoices/totals.ts: tax_inclusive => amount_cents; otherwise amount_cents + sum(line_items.total_cents) + tax_cents. Keep the two in lockstep.';

-- Rebuild the Business Health aggregator. Body matches 20260512152549
-- (project_costs-backed ap/expenses_out); only revenue + ar are changed to
-- route through public.invoice_total_cents().
CREATE OR REPLACE FUNCTION public.get_business_health_metrics(p_year INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH
    fy AS (
      SELECT
        COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT) AS year
    ),
    fy_range AS (
      SELECT
        MAKE_DATE((SELECT year FROM fy), 1, 1)  AS start_date,
        MAKE_DATE((SELECT year FROM fy), 12, 31) AS end_date
    ),
    revenue AS (
      SELECT COALESCE(SUM(
        public.invoice_total_cents(amount_cents, tax_cents, tax_inclusive, line_items)
      ), 0)::BIGINT AS total_cents
      FROM public.invoices
      WHERE status = 'paid'
        AND deleted_at IS NULL
        AND paid_at >= (SELECT start_date FROM fy_range)
        AND paid_at <  (SELECT end_date FROM fy_range) + INTERVAL '1 day'
    ),
    ar AS (
      SELECT
        COALESCE(SUM(
          public.invoice_total_cents(amount_cents, tax_cents, tax_inclusive, line_items)
        ), 0)::BIGINT                                      AS total_cents,
        COUNT(*)::INT                                       AS count,
        MIN(COALESCE(sent_at, created_at))                  AS oldest_at
      FROM public.invoices
      WHERE status = 'sent'
        AND paid_at IS NULL
        AND deleted_at IS NULL
    ),
    ap AS (
      SELECT
        COALESCE(SUM(amount_cents), 0)::BIGINT AS total_cents,
        COUNT(*)::INT                          AS count
      FROM public.project_costs
      WHERE source_type = 'vendor_bill'
        AND payment_status = 'unpaid'
        AND status = 'active'
    ),
    owner_pay AS (
      SELECT
        COALESCE(SUM(by_type_total), 0)::BIGINT AS total_cents,
        COALESCE(
          jsonb_object_agg(draw_type, by_type_total) FILTER (WHERE draw_type IS NOT NULL),
          '{}'::jsonb
        ) AS by_type
      FROM (
        SELECT
          draw_type,
          SUM(amount_cents)::BIGINT AS by_type_total
        FROM public.owner_draws
        WHERE paid_at >= (SELECT start_date FROM fy_range)
          AND paid_at <= (SELECT end_date FROM fy_range)
        GROUP BY draw_type
      ) t
    ),
    expenses_out AS (
      SELECT COALESCE(SUM(amount_cents), 0)::BIGINT AS total_cents
      FROM public.project_costs
      WHERE source_type = 'receipt'
        AND status = 'active'
        AND cost_date >= (SELECT start_date FROM fy_range)
        AND cost_date <= (SELECT end_date FROM fy_range)
    )
  SELECT jsonb_build_object(
    'year',               (SELECT year FROM fy),
    'fy_start',           (SELECT start_date FROM fy_range),
    'fy_end',             (SELECT end_date FROM fy_range),
    'revenue_ytd_cents',  (SELECT total_cents FROM revenue),
    'ar_outstanding', jsonb_build_object(
      'total_cents', (SELECT total_cents FROM ar),
      'count',       (SELECT count       FROM ar),
      'oldest_at',   (SELECT oldest_at   FROM ar)
    ),
    'ap_outstanding', jsonb_build_object(
      'total_cents', (SELECT total_cents FROM ap),
      'count',       (SELECT count       FROM ap)
    ),
    'owner_pay_ytd', jsonb_build_object(
      'total_cents', (SELECT total_cents FROM owner_pay),
      'by_type',     (SELECT by_type     FROM owner_pay)
    ),
    'outflows_ytd_cents',
      (SELECT total_cents FROM expenses_out)
      + (SELECT total_cents FROM owner_pay),
    'net_cash_flow_ytd_cents',
      (SELECT total_cents FROM revenue)
      - ((SELECT total_cents FROM expenses_out) + (SELECT total_cents FROM owner_pay))
  );
$$;

REVOKE ALL ON FUNCTION public.get_business_health_metrics(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_health_metrics(INT) TO authenticated;

COMMENT ON FUNCTION public.get_business_health_metrics(INT) IS
  'Aggregates the 5 cards on /business-health (revenue, AR, AP, owner pay, net cash flow) in a single round-trip. Revenue + AR use public.invoice_total_cents() so they match the app tax-aware invoiceTotalCents. Reads cost data from unified project_costs (legacy tables dropped in PR #200).';
