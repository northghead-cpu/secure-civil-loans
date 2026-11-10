drop policy if exists "Admins can do everything" on public.risk_flags;
create policy "Admins can do everything" on public.risk_flags for all to authenticated using ((((select auth.jwt()) ->> 'role'::text) = 'admin'::text));
