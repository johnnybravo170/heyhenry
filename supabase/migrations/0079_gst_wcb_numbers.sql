-- Add GST registration number and WCB account number to tenants.
-- Both are optional strings — not every contractor will have both.
alter table tenants
  add column if not exists gst_number text,
  add column if not exists wcb_number text;
