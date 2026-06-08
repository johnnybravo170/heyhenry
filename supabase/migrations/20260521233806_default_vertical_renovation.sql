-- Default new tenants to the Renovation GC vertical.
--
-- HeyHenry's core focus is the General Contractor (renovation) vertical;
-- the pressure_washing pack was the original seed and left the column
-- default pointing at it. Signup already passes p_vertical='renovation'
-- explicitly, so this only affects insert paths that omit the vertical —
-- but the default should reflect the product's actual focus.
--
-- Existing tenants are unaffected (their vertical is already set).

alter table tenants alter column vertical set default 'renovation';
