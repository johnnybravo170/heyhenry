-- Project-level overhead / non-billable cost (card #11, Charlie session
-- ops doc cd85d021).
--
-- A contractor sometimes absorbs an actual cost on a project that should
-- count toward job cost / margin but must NOT be passed to the customer
-- on a cost-plus invoice. Charlie's real case: a subcontractor's WCB
-- insurance bill — he eats it, the customer never sees it.
--
-- `is_billable = false` flags such a cost. The variance / margin rollup
-- (`get_project_variance_aggregates`) already sums ALL active
-- project_costs regardless of this flag, so a non-billable cost
-- automatically reduces margin with no further change. The cost-plus
-- FINAL invoice base (`getProjectCostBasisRollup`) filters these rows out
-- so the customer is never billed — and no markup is applied — for
-- absorbed overhead.
--
-- Additive and backward-compatible: existing rows default to TRUE
-- (billable), preserving current behavior. ALTER on an existing table,
-- so no new GRANT is required (the table's grants predate the
-- no-auto-grant opt-in).

ALTER TABLE public.project_costs
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.project_costs.is_billable IS
  'Cost-plus billing flag. TRUE (default) = passed to the customer on the cost-plus final invoice (with markup). FALSE = project overhead the contractor absorbs: still counts toward job cost / margin, but excluded from the customer invoice base. See getProjectCostBasisRollup.';
