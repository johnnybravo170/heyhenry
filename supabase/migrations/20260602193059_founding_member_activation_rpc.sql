-- 20260602193059_founding_member_activation_rpc.sql
-- Single-shot aggregator for the operator-only Founding-member activation
-- view (/admin/activation). One row per founding-member tenant describing
-- where they sit on the sacred path (lead -> estimate -> approval -> project
-- -> invoice -> payment -> QBO), how long they've been stalled, their last
-- activity, and an activation flag. Read-out, not new instrumentation: every
-- field is derived from data the sacred-path surfaces already write.
--
-- ONE round-trip, no N+1: each source table is aggregated once grouped by
-- tenant_id, then joined onto the founding-member roster.
--
-- Security: SECURITY INVOKER (default). This function reads CROSS-TENANT, so
-- it is locked to service_role only (see the REVOKE/GRANT below) and called
-- exclusively via the service-role admin client from the platform-admin-gated
-- /admin/activation page. service_role bypasses RLS, so it sees every tenant;
-- no other role can execute it. This mirrors the ai_calls admin-only posture.
--
-- Stage derivation reuses the existing sacred-path instrumentation rather than
-- reinventing it. Estimates live on TWO surfaces (some founders use the quotes
-- pipeline, others use projects.estimate_*), so each rung checks both:
--   estimate  : quotes.sent_at OR projects.estimate_sent_at
--   approval  : quotes.accepted_at OR projects.estimate_approved_at OR active project
--   project   : projects.lifecycle_stage IN ('active','complete')
--   invoice   : any invoices row
--   payment   : invoices.paid_at  (the payments table is currently unused)
--   qbo       : invoices.qbo_invoice_id
-- Arrows are lit per-milestone (may be non-contiguous); current_stage is the
-- furthest-right lit rung.

CREATE OR REPLACE FUNCTION public.get_founding_member_activation()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH fm AS (
    SELECT
      id,
      name,
      vertical,
      COALESCE(onboarding_completed_at, created_at) AS access_at
    FROM public.tenants
    WHERE founding_member = true
      AND deleted_at IS NULL
  ),
  q AS (
    SELECT
      tenant_id,
      MIN(sent_at)                       AS first_quote_sent,
      MAX(sent_at)                       AS last_quote_sent,
      MAX(accepted_at)                   AS last_quote_accepted,
      bool_or(sent_at IS NOT NULL)       AS any_sent,
      bool_or(accepted_at IS NOT NULL)   AS any_accepted
    FROM public.quotes
    WHERE deleted_at IS NULL
    GROUP BY tenant_id
  ),
  p AS (
    SELECT
      tenant_id,
      MIN(estimate_sent_at)                                       AS first_estimate_sent,
      MAX(estimate_sent_at)                                       AS last_estimate_sent,
      MAX(estimate_approved_at)                                   AS last_estimate_approved,
      MAX(created_at)                                             AS last_project_created,
      bool_or(estimate_sent_at IS NOT NULL)                       AS any_estimate_sent,
      bool_or(estimate_approved_at IS NOT NULL)                   AS any_estimate_approved,
      bool_or(lifecycle_stage IN ('active', 'complete'))          AS any_active_project
    FROM public.projects
    WHERE deleted_at IS NULL
    GROUP BY tenant_id
  ),
  inv AS (
    SELECT
      tenant_id,
      MAX(created_at)                                             AS last_invoice_created,
      MAX(sent_at)                                                AS last_invoice_sent,
      MAX(paid_at)                                                AS last_invoice_paid,
      bool_or(true)                                               AS any_invoice,
      bool_or(paid_at IS NOT NULL)                                AS any_paid,
      bool_or(qbo_invoice_id IS NOT NULL)                         AS any_qbo,
      MAX(CASE WHEN qbo_invoice_id IS NOT NULL
               THEN COALESCE(updated_at, created_at) END)         AS last_qbo
    FROM public.invoices
    WHERE deleted_at IS NULL
    GROUP BY tenant_id
  ),
  h AS (
    SELECT tenant_id, MAX(created_at) AS last_henry_at
    FROM public.henry_interactions
    GROUP BY tenant_id
  ),
  rows AS (
    SELECT
      fm.id,
      fm.name,
      fm.vertical,
      fm.access_at,
      -- Sacred-path rungs (lit arrows)
      true                                                        AS stage_lead,
      COALESCE(q.any_sent, false) OR COALESCE(p.any_estimate_sent, false)
                                                                  AS stage_estimate,
      COALESCE(q.any_accepted, false) OR COALESCE(p.any_estimate_approved, false)
        OR COALESCE(p.any_active_project, false)                  AS stage_approval,
      COALESCE(p.any_active_project, false)                       AS stage_project,
      COALESCE(inv.any_invoice, false)                            AS stage_invoice,
      COALESCE(inv.any_paid, false)                               AS stage_payment,
      COALESCE(inv.any_qbo, false)                                AS stage_qbo,
      -- Earliest estimate sent across both surfaces (LEAST ignores NULLs)
      LEAST(q.first_quote_sent, p.first_estimate_sent)            AS first_estimate_sent,
      h.last_henry_at,
      -- Last forward movement on any rung (GREATEST ignores NULLs)
      GREATEST(
        q.last_quote_sent, q.last_quote_accepted,
        p.last_estimate_sent, p.last_estimate_approved, p.last_project_created,
        inv.last_invoice_created, inv.last_invoice_sent, inv.last_invoice_paid,
        inv.last_qbo
      )                                                           AS last_movement_at
    FROM fm
    LEFT JOIN q   ON q.tenant_id   = fm.id
    LEFT JOIN p   ON p.tenant_id   = fm.id
    LEFT JOIN inv ON inv.tenant_id = fm.id
    LEFT JOIN h   ON h.tenant_id   = fm.id
  ),
  derived AS (
    SELECT
      r.*,
      -- Days since last sacred-path movement (NULL if no movement ever)
      CASE WHEN r.last_movement_at IS NULL THEN NULL
           ELSE (CURRENT_DATE - r.last_movement_at::date) END     AS days_stalled,
      -- Furthest-right lit rung
      CASE
        WHEN r.stage_qbo      THEN 'qbo'
        WHEN r.stage_payment  THEN 'payment'
        WHEN r.stage_invoice  THEN 'invoice'
        WHEN r.stage_project  THEN 'project'
        WHEN r.stage_approval THEN 'approval'
        WHEN r.stage_estimate THEN 'estimate'
        ELSE 'lead'
      END                                                         AS current_stage,
      -- Activation flag: first estimate sent within 7 days of access?
      --   green : sent within 7 days of access
      --   amber : sent but later than 7 days, OR not sent yet but still inside the 7-day window
      --   red   : not sent and the 7-day window has already passed
      CASE
        WHEN r.first_estimate_sent IS NOT NULL
             AND r.first_estimate_sent <= r.access_at + INTERVAL '7 days' THEN 'green'
        WHEN r.first_estimate_sent IS NOT NULL                              THEN 'amber'
        WHEN now() <= r.access_at + INTERVAL '7 days'                       THEN 'amber'
        ELSE 'red'
      END                                                         AS activation
    FROM rows r
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tenant_id',           id,
        'name',                name,
        'vertical',            vertical,
        'access_at',           access_at,
        'current_stage',       current_stage,
        'stages', jsonb_build_object(
          'lead',     stage_lead,
          'estimate', stage_estimate,
          'approval', stage_approval,
          'project',  stage_project,
          'invoice',  stage_invoice,
          'payment',  stage_payment,
          'qbo',      stage_qbo
        ),
        'days_stalled',        days_stalled,
        'last_movement_at',    last_movement_at,
        'first_estimate_sent', first_estimate_sent,
        'last_henry_at',       last_henry_at,
        'activation',          activation
      )
      -- Stalest first; sets up the V2 staleness alert on the same query.
      ORDER BY days_stalled DESC NULLS LAST, name ASC
    ),
    '[]'::jsonb
  )
  FROM derived;
$$;

-- Server-only: cross-tenant read surface. Strip the standing anon/authenticated
-- EXECUTE grants (ALTER DEFAULT PRIVILEGES adds them on creation) and the PUBLIC
-- grant; only service_role (the admin client) may call this.
REVOKE ALL ON FUNCTION public.get_founding_member_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_founding_member_activation() TO service_role;

COMMENT ON FUNCTION public.get_founding_member_activation() IS
  'Operator-only founding-member activation read-out for /admin/activation. One row per founding_member tenant: sacred-path stage flags, days-stalled, last activity, activation flag. SECURITY INVOKER, locked to service_role (cross-tenant). Single aggregation query, no N+1.';
