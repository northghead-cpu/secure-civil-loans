-- Incident Center is an authenticated admin surface only.
-- Keep the database grant boundary aligned with the RLS boundary.
revoke all on table public.incidents from anon;
revoke all on table public.incidents from authenticated;
grant select, update on table public.incidents to authenticated;
