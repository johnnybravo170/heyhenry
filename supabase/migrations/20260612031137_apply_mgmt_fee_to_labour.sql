-- Apply management fee to labour: tenant default + per-project override.
--
-- Card: "[FEATURE] Labour billed at charge rate (always) + mgmt-fee-on-labour toggle"
-- voc-charlie-2026-06-11, voc-jvd-2026-06-11, voc-mike-2026-06-11
--
-- Industry context: AIA A102 / CCDC 3 default is actual-cost + fee, but AIA §7.2.5
-- explicitly sanctions "agreed rates in lieu of actual costs." JVD's model (margin baked
-- into charge rate, no fee on labour) is standard residential practice. Mike + Charlie
-- both apply the fee on top of their charge rates. Neither is wrong — the flag makes
-- the operator's intent explicit rather than hard-coding one model.

-- Tenant-level default. true = fee base includes labour (Mike, Charlie).
-- false = fee base = materials/bills only; labour is billed flat at charge rate (JVD).
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS apply_mgmt_fee_to_labour BOOLEAN NOT NULL DEFAULT TRUE;

-- Per-project override. NULL inherits the tenant default.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS apply_mgmt_fee_to_labour BOOLEAN;

-- NOTE: JVD's tenant should be set to false via Settings > Project defaults after deploy.
-- All existing tenants inherit true (matches current behaviour — fee applied to everything).
