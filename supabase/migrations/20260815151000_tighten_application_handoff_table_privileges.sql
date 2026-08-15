revoke all on public.application_handoffs from anon, authenticated;
grant select, update on public.application_handoffs to authenticated;
drop policy if exists "Admins can update application handoffs" on public.application_handoffs;
create policy "Admins can update application handoffs"
  on public.application_handoffs for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'compliance_team'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'compliance_team'));