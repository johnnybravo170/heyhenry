-- 20260608162120_supply_install_category.sql
-- Card #9: add a "Supply & install" (all-in materials + labour) cost-line
-- category as a peer to material / labour / sub / equipment / overhead.
-- Internal value: 'supply_install'. Forward-only / additive: drop + re-add the
-- named CHECK constraint on both tables with the new value list.
-- ALTERs existing tables only (no new table) so no new GRANT is required.

ALTER TABLE materials_catalog
  DROP CONSTRAINT materials_catalog_category_check,
  ADD CONSTRAINT materials_catalog_category_check
    CHECK (category IN ('material','labour','sub','equipment','overhead','supply_install'));

ALTER TABLE project_cost_lines
  DROP CONSTRAINT project_cost_lines_category_check,
  ADD CONSTRAINT project_cost_lines_category_check
    CHECK (category IN ('material','labour','sub','equipment','overhead','supply_install'));
