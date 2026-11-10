ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS net_salary numeric,
  ADD COLUMN IF NOT EXISTS existing_obligations numeric;
