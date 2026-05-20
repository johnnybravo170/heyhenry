-- Per-project GST display mode for draws (milestone invoices).
--
-- Background: draws were originally hard-coded GST-inclusive — the operator
-- typed the all-in total and GST was backed out (incl. $X GST). Some GCs
-- (Charlie / Trio) want GST shown ON TOP instead (subtotal + GST). Rather
-- than flip a global rule, the mode is now selectable.
--
-- Resolution order at draw-creation time:
--   project.draw_gst_mode  ??  tenant_prefs.invoicing.drawGstMode  ??  'inclusive'
--
-- NULL here means "inherit the tenant default", and the tenant default itself
-- defaults to 'inclusive' — so every existing project and tenant keeps the
-- exact behavior it has today. New behavior is strictly opt-in.
--
-- Storage of the resolved choice stays per-invoice on invoices.tax_inclusive
-- (already exists); this column only controls what new draws inherit. Existing
-- invoices are never retroactively changed.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS draw_gst_mode text
    CHECK (draw_gst_mode IN ('inclusive', 'on_top'));

COMMENT ON COLUMN public.projects.draw_gst_mode IS
  'GST display mode for this project''s draws: inclusive (GST embedded in total) or on_top (GST added to subtotal). NULL = inherit tenant default (tenant_prefs.invoicing.drawGstMode), which itself defaults to inclusive.';
