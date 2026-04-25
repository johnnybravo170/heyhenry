-- 0132_phase_sets_per_vertical.sql
-- Polish on Slice 1 — per-vertical phase sets.
--
-- The original 0122_project_phases.sql seeded a residential-reno
-- default for every project. Now that pressure_washing tenants exist
-- (and roofing / fence / tile are in the works), the seed trigger
-- picks a phase set based on tenants.vertical.
--
-- Sets (immutable per tenant, operator can rename / advance per
-- project):
--   renovation         — full reno roadmap (existing 11 steps)
--   pressure_washing   — Planning → Inspection → Wash → Detail → Walkthrough → Done
--   roofing            — Planning → Tear-off → Sheathing → Underlayment →
--                        Shingles → Flashing → Cleanup → Inspection → Done
--   fence              — Planning → Demo old → Posts → Panels → Gate → Walkthrough → Done
--   tile               — Planning → Demo → Waterproofing → Tile → Grout → Cleanup → Done
--   <fallback>         — Planning → In progress → Walkthrough → Done
--
-- The first phase is set in_progress at insert (matches the original
-- behaviour for renovation). Idempotent: skips entirely if rows
-- already exist for the project.

CREATE OR REPLACE FUNCTION public.seed_project_phases_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vertical TEXT;
  v_phases TEXT[];
  v_idx INTEGER;
BEGIN
  -- Idempotency guard.
  IF EXISTS (SELECT 1 FROM public.project_phases WHERE project_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT vertical INTO v_vertical FROM public.tenants WHERE id = NEW.tenant_id;

  v_phases := CASE COALESCE(v_vertical, '')
    WHEN 'renovation' THEN ARRAY[
      'Planning & selections',
      'Demo',
      'Framing',
      'Rough-in',
      'Inspection',
      'Drywall',
      'Cabinets & fixtures',
      'Finishes',
      'Punch list',
      'Final walkthrough',
      'Done'
    ]
    WHEN 'pressure_washing' THEN ARRAY[
      'Scheduled',
      'Pre-clean inspection',
      'Pressure wash',
      'Detail spots',
      'Final walkthrough',
      'Done'
    ]
    WHEN 'roofing' THEN ARRAY[
      'Planning & materials',
      'Tear-off',
      'Sheathing repair',
      'Underlayment',
      'Shingles',
      'Flashing & ventilation',
      'Cleanup',
      'Final inspection',
      'Done'
    ]
    WHEN 'fence' THEN ARRAY[
      'Planning & materials',
      'Demo old fence',
      'Set posts',
      'Install panels',
      'Gate & hardware',
      'Final walkthrough',
      'Done'
    ]
    WHEN 'tile' THEN ARRAY[
      'Planning & selections',
      'Demo',
      'Waterproofing',
      'Tile',
      'Grout & seal',
      'Cleanup',
      'Done'
    ]
    ELSE ARRAY[
      'Planning',
      'In progress',
      'Final walkthrough',
      'Done'
    ]
  END;

  FOR v_idx IN 1..array_length(v_phases, 1) LOOP
    INSERT INTO public.project_phases
      (tenant_id, project_id, name, display_order, status, started_at)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      v_phases[v_idx],
      v_idx,
      CASE WHEN v_idx = 1 THEN 'in_progress' ELSE 'upcoming' END,
      CASE WHEN v_idx = 1 THEN NOW() ELSE NULL END
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- The trigger from 0122 still binds to this function name; no DROP /
-- CREATE TRIGGER needed. CREATE OR REPLACE FUNCTION above swaps the
-- implementation in place.

COMMENT ON FUNCTION public.seed_project_phases_on_insert() IS
  'Seeds project_phases on project insert with a per-vertical phase set (renovation / pressure_washing / roofing / fence / tile / fallback).';
