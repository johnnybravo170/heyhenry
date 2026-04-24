-- Capture vendor GST/HST business number (BN) on expense + bill rows.
--
-- CRA requires any registered-for-GST vendor to show their BN on an
-- invoice over $30 if the buyer wants to claim the Input Tax Credit.
-- Without it, the ITC can be disallowed — which is the #1 "clean up
-- before filing" task bookkeepers do.
--
-- We capture it via receipt OCR (next migration step) and show a
-- warning on the GST remittance report for bills over $30 with tax >
-- 0 but no BN on file. Stored as free text — BN format is fairly
-- strict (9 digits + 4-char program + 4-digit reference like
-- "123456789 RT0001") but we don't want to reject valid variants
-- ("123456789", "123456789RT0001", "123 456 789 RT0001").

BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN vendor_gst_number TEXT;

ALTER TABLE public.project_bills
  ADD COLUMN vendor_gst_number TEXT;

COMMENT ON COLUMN public.expenses.vendor_gst_number IS
  'Vendor GST/HST registration number (BN), free-text. Required by CRA on invoices over $30 to claim ITC.';
COMMENT ON COLUMN public.project_bills.vendor_gst_number IS
  'Vendor GST/HST registration number (BN), free-text. Required by CRA on invoices over $30 to claim ITC.';

COMMIT;
