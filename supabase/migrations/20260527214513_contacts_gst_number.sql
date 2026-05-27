-- Add a GST/HST number to contacts (vendors / sub-trades — and any contact).
--
-- Today GST numbers live on the tenant's own profile (tenants.gst_number),
-- per-bill (bills.vendor_gst_number), and per worker (worker_profiles.
-- gst_number). A sub-trade you got a quote from is a `contacts` row
-- (kind='sub') with nowhere to record their number — this adds it.
--
-- Additive + nullable; `contacts` already carries its grants (renamed from
-- `customers`), so adding a column needs no new GRANT.

alter table contacts add column gst_number text;
