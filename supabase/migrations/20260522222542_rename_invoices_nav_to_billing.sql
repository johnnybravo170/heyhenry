-- Rename the "/invoices" sidebar entry label "Invoices" → "Billing" for the
-- GC verticals (renovation, tile). Those get the project-grouped Billing/AR
-- cockpit, where "Billing" is the accurate noun (see docs/ux/briefs/invoices.md).
-- Route stays /invoices — label-only.
--
-- Pressure-washing is intentionally excluded: it bills per job (no project/draw
-- model), keeps the flat invoice list, and keeps the "Invoices" label.
--
-- nav_items is a JSONB array on vertical_profile_packs.config; we walk it and
-- rewrite only the element whose href is "/invoices", leaving order + siblings
-- intact. Idempotent: re-running on already-renamed rows is a no-op.

update vertical_profile_packs
set config = jsonb_set(
  config,
  '{nav_items}',
  (
    select jsonb_agg(
      case
        when item->>'href' = '/invoices' then jsonb_set(item, '{label}', '"Billing"')
        else item
      end
      order by ord
    )
    from jsonb_array_elements(config->'nav_items') with ordinality as t(item, ord)
  )
)
where vertical in ('renovation', 'tile')
  and config->'nav_items' @> '[{"href":"/invoices"}]';
