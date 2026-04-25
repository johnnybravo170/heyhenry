-- 0122_project_phases.sql
-- Slice 1 of the Customer Portal & Home Record build.
--
-- One row per (project, phase) where phase is a homeowner-facing milestone
-- on the simplified roadmap (Demo → Framing → Drywall → …). NOT a Gantt.
-- Operator advances / regresses the current phase from the Portal tab on
-- the project detail page; the public /portal/<slug> page renders the
-- same data as a horizontal "you are here" rail above the updates feed.
--
-- The seed list ships a generic-residential-reno default. Later verticals
-- (roofing, fencing, pressure-washing) get their own seeds in follow-up
-- migrations; the trigger short-circuits if a project somehow already has
-- phase rows when it's inserted (e.g. cloned project).

CREATE TABLE IF NOT EXISTS public.project_phases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL,

  status        TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'in_progress', 'complete')),

  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project
  ON public.project_phases (project_id, display_order);

CREATE INDEX IF NOT EXISTS idx_project_phases_tenant
  ON public.project_phases (tenant_id);

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- Owner / admin / member full CRUD on their tenant's rows. Workers fall
-- through; the public portal route uses the service-role admin client and
-- doesn't go through these policies.
CREATE POLICY project_phases_tenant_all ON public.project_phases
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = public.project_phases.tenant_id
        AND tm.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = public.project_phases.tenant_id
        AND tm.role IN ('owner', 'admin', 'member')
    )
  );

-- Auto-seed default phases on project insert.
--
-- Phase set is the simplified residential-reno roadmap from the spec:
--   Planning / selections → Demo → Framing → Rough-in → Inspection
--   → Drywall → Cabinets / fixtures → Finishes → Punch list
--   → Final walkthrough → Done
--
-- The first phase ('Planning & selections') is marked in_progress at
-- insert because every new project starts there. Operators can advance,
-- regress, rename, or delete phases per project — the seed is just a
-- starting point.
CREATE OR REPLACE FUNCTION public.seed_project_phases_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotency guard: if rows already exist for this project (cloned
  -- project, manual seed, replay), do nothing.
  IF EXISTS (
    SELECT 1 FROM public.project_phases WHERE project_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_phases
    (tenant_id, project_id, name, display_order, status, started_at)
  VALUES
    (NEW.tenant_id, NEW.id, 'Planning & selections',  1, 'in_progress', NOW()),
    (NEW.tenant_id, NEW.id, 'Demo',                   2, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Framing',                3, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Rough-in',               4, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Inspection',             5, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Drywall',                6, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Cabinets & fixtures',    7, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Finishes',               8, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Punch list',             9, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Final walkthrough',     10, 'upcoming',    NULL),
    (NEW.tenant_id, NEW.id, 'Done',                  11, 'upcoming',    NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_seed_phases ON public.projects;
CREATE TRIGGER trg_projects_seed_phases
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_project_phases_on_insert();

-- Backfill: every existing project gets the default phase set, with the
-- first phase set in_progress. Existing data has no phase concept yet so
-- there's nothing to lose.
INSERT INTO public.project_phases (tenant_id, project_id, name, display_order, status, started_at)
SELECT p.tenant_id, p.id, v.name, v.display_order, v.status, v.started_at
FROM public.projects p
CROSS JOIN (
  VALUES
    ('Planning & selections',  1, 'in_progress', NOW()),
    ('Demo',                   2, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Framing',                3, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Rough-in',               4, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Inspection',             5, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Drywall',                6, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Cabinets & fixtures',    7, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Finishes',               8, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Punch list',             9, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Final walkthrough',     10, 'upcoming',    NULL::TIMESTAMPTZ),
    ('Done',                  11, 'upcoming',    NULL::TIMESTAMPTZ)
) AS v(name, display_order, status, started_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_phases pp WHERE pp.project_id = p.id
);

COMMENT ON TABLE public.project_phases IS
  'Homeowner-facing milestone roadmap (NOT a Gantt). One row per (project, phase) seeded by trigger on project insert. Used by /portal/<slug> for the public phase rail and by the project detail Portal tab for operator advance/regress.';
