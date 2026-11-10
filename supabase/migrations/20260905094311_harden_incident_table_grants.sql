revoke all on table public.incidents from anon;
revoke all on table public.incidents from authenticated;
grant select, update on table public.incidents to authenticated;
