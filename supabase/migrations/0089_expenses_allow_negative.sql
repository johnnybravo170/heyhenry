-- Allow negative expense amounts for credits and returns.
--
-- Before: amount_cents > 0 (disbursements only).
-- After:  amount_cents != 0 (disbursements OR credits/returns).
--
-- Zero is still rejected — that's almost always a data-entry mistake.
-- The UI enforces positive-only on the worker-facing form; credits are an
-- owner-side concept (supplier refunds, corrections).

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_amount_cents_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_amount_cents_check CHECK (amount_cents <> 0);
