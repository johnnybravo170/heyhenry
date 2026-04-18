-- Add approval_code column so customers can accept/decline quotes without auth.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approval_code TEXT UNIQUE;
