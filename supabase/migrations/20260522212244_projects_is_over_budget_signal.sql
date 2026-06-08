-- "Needs attention" / over-budget quick-filter for the Projects list.
--
-- Cost burn (cost incurred / estimated revenue) is computed PER ROW at request
-- time by listProjectProgress (src/lib/db/queries/cost-lines.ts), not stored on
-- `projects`. Filtering or sorting on it across a paginated result set would
-- mean computing burn for EVERY matching project on every request — which
-- defeats server-side pagination at 10k projects.
--
-- So we denormalize a single cheap boolean signal, `projects.is_over_budget`,
-- maintained by triggers on the three tables the signal depends on:
--   - project_cost_lines.line_price_cents      → estimated revenue
--   - project_costs (active)                   → actual cost incurred
--   - project_budget_categories.estimate_cents → per-category envelopes
-- The filter then becomes a `WHERE is_over_budget` against a partial index —
-- O(matches), not O(all projects).
--
-- Definition ("needs attention") is the union of two over-budget conditions:
--   (1) PROJECT-LEVEL: round(active cost / estimated revenue * 100) > 100, and
--   (2) CATEGORY-LEVEL: ANY budget category whose active cost exceeds its
--       envelope — round(category active cost / envelope * 100) > 100.
-- Condition (2) is what makes "needs attention" useful: a project can be well
-- under budget overall (70%) yet be bleeding on one trade (Framing 113%) — that
-- is exactly the job a GC wants surfaced before the whole project blows.
--
-- The Projects-list row badge reads this same column (single source of truth),
-- so the filter and the visible "⚠ over budget" badge can never disagree. We
-- round before comparing (vs a bare `cost > envelope`) to match how the % burn
-- is displayed — otherwise burn in (100%, 100.5%] would filter in / round to
-- 100% on screen.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_over_budget boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.is_over_budget IS
  'Denormalized "needs attention" signal: project-level burn > 100% OR any budget category over its envelope. Maintained by triggers on project_cost_lines + project_costs + project_budget_categories. Single source of truth for the Projects-list filter AND the row''s "⚠ over budget" badge.';

-- Partial index sized to the filter: tenant-scoped, live, over-budget only.
-- Over-budget is the minority case, so this index stays small at scale.
CREATE INDEX IF NOT EXISTS idx_projects_over_budget
  ON public.projects (tenant_id)
  WHERE is_over_budget AND deleted_at IS NULL;

-- Recompute is_over_budget for a set of affected project ids. Shared by the
-- per-table triggers below and the initial backfill. SECURITY DEFINER so the
-- denorm write isn't blocked by the writer's RLS scope on `projects` (e.g. a
-- bookkeeper who can enter a cost but whose projects-update policy differs);
-- the affected ids are always same-tenant as the rows that triggered it.
CREATE OR REPLACE FUNCTION public.refresh_projects_over_budget(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.projects p
  SET is_over_budget = sub.over
  FROM (
    SELECT
      pj.id,
      -- (1) project-level burn > 100%
      (
        COALESCE(est.total, 0) > 0
        AND round((COALESCE(act.total, 0)::numeric / est.total) * 100) > 100
      )
      -- (2) any budget category over its envelope
      OR COALESCE(cat.any_over, false)
        AS over
    FROM public.projects pj
    LEFT JOIN (
      SELECT project_id, SUM(line_price_cents) AS total
      FROM public.project_cost_lines
      WHERE project_id = ANY(p_ids)
      GROUP BY project_id
    ) est ON est.project_id = pj.id
    LEFT JOIN (
      SELECT
        project_id,
        SUM(
          CASE WHEN source_type = 'vendor_bill'
               THEN COALESCE(pre_tax_amount_cents, amount_cents)
               ELSE amount_cents END
        ) AS total
      FROM public.project_costs
      WHERE project_id = ANY(p_ids) AND status = 'active'
      GROUP BY project_id
    ) act ON act.project_id = pj.id
    LEFT JOIN (
      -- Per-category actual vs envelope; bool_or → "any category over".
      SELECT
        bc.project_id,
        bool_or(
          bc.estimate_cents > 0
          AND round((COALESCE(cc.total, 0)::numeric / bc.estimate_cents) * 100) > 100
        ) AS any_over
      FROM public.project_budget_categories bc
      LEFT JOIN (
        SELECT
          budget_category_id,
          SUM(
            CASE WHEN source_type = 'vendor_bill'
                 THEN COALESCE(pre_tax_amount_cents, amount_cents)
                 ELSE amount_cents END
          ) AS total
        FROM public.project_costs
        WHERE project_id = ANY(p_ids)
          AND status = 'active'
          AND budget_category_id IS NOT NULL
        GROUP BY budget_category_id
      ) cc ON cc.budget_category_id = bc.id
      WHERE bc.project_id = ANY(p_ids)
      GROUP BY bc.project_id
    ) cat ON cat.project_id = pj.id
    WHERE pj.id = ANY(p_ids)
  ) sub
  WHERE p.id = sub.id
    AND p.is_over_budget IS DISTINCT FROM sub.over;  -- skip no-op writes
END;
$$;

-- Statement-level trigger functions using transition tables so a bulk insert
-- (e.g. an import batch dropping many costs on one project) recomputes each
-- affected project ONCE per statement, not once per row. Postgres only allows
-- a transition-table trigger to bind a single event, hence the split.

CREATE OR REPLACE FUNCTION public.trg_over_budget_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_projects_over_budget(
    (SELECT array_agg(DISTINCT project_id) FROM new_rows WHERE project_id IS NOT NULL)
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_over_budget_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_projects_over_budget(
    (SELECT array_agg(DISTINCT project_id) FROM old_rows WHERE project_id IS NOT NULL)
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_over_budget_after_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_projects_over_budget(
    (SELECT array_agg(DISTINCT pid) FROM (
       SELECT project_id AS pid FROM new_rows WHERE project_id IS NOT NULL
       UNION
       SELECT project_id      FROM old_rows WHERE project_id IS NOT NULL
     ) s)
  );
  RETURN NULL;
END;
$$;

-- project_cost_lines drives estimated revenue.
CREATE TRIGGER trg_cost_lines_over_budget_ins
  AFTER INSERT ON public.project_cost_lines
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_insert();
CREATE TRIGGER trg_cost_lines_over_budget_upd
  AFTER UPDATE ON public.project_cost_lines
  REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_update();
CREATE TRIGGER trg_cost_lines_over_budget_del
  AFTER DELETE ON public.project_cost_lines
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_delete();

-- project_costs drives actual cost incurred.
CREATE TRIGGER trg_costs_over_budget_ins
  AFTER INSERT ON public.project_costs
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_insert();
CREATE TRIGGER trg_costs_over_budget_upd
  AFTER UPDATE ON public.project_costs
  REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_update();
CREATE TRIGGER trg_costs_over_budget_del
  AFTER DELETE ON public.project_costs
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_delete();

-- project_budget_categories drives per-category envelopes (changing an
-- envelope can flip a category over/under without any cost write).
CREATE TRIGGER trg_budget_cats_over_budget_ins
  AFTER INSERT ON public.project_budget_categories
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_insert();
CREATE TRIGGER trg_budget_cats_over_budget_upd
  AFTER UPDATE ON public.project_budget_categories
  REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_update();
CREATE TRIGGER trg_budget_cats_over_budget_del
  AFTER DELETE ON public.project_budget_categories
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_over_budget_after_delete();

-- Backfill every existing project in one pass.
SELECT public.refresh_projects_over_budget(
  (SELECT array_agg(id) FROM public.projects)
);
