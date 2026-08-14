-- Restore production profile financial columns that were not captured in
-- the repository migration chain before the Phase 3 hardening migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS net_salary numeric,
  ADD COLUMN IF NOT EXISTS existing_obligations numeric;
