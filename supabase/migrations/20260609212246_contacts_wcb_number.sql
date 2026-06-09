-- Add WCB/WSIB account number to contacts (subcontractor compliance).
--
-- wcb_number: BC WorkSafeBC / WCB / WSIB account number for a sub-trade.
-- Needed for clearance letters and T5018 compliance. Auto-validity-check
-- against WorkSafeBC's clearance API is deferred (needs research); for now
-- this stores the number for manual verification workflows.
--
-- Additive + nullable; contacts already has its grants.

ALTER TABLE public.contacts
  ADD COLUMN wcb_number TEXT;
