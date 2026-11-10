-- Make user_roles the single source of truth for authorization checks.
insert into public.user_roles (user_id, role)
select p.user_id, p.role::public.app_role
from public.profiles p
where p.role in ('admin','user','super_admin','super_user','compliance_team','data_entry_team')
on conflict (user_id, role) do nothing;

-- Replace the legacy text helper that read the mutable profiles.role column.
create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = required_role
  );
$$;

revoke update (role) on public.profiles from anon, authenticated;

drop policy if exists "audit_admin_only" on public.audit_logs;
create policy "audit_admin_only" on public.audit_logs
for select to authenticated
using (public.has_role('admin') or public.has_role('super_admin') or public.has_role('compliance_team'));

drop policy if exists "audit_insert_admin_only" on public.audit_logs;
create policy "audit_insert_admin_only" on public.audit_logs
for insert to authenticated
with check (public.has_role('admin') or public.has_role('super_admin'));

drop policy if exists "bank_admin_only_insert" on public.bank_products;
create policy "bank_admin_only_insert" on public.bank_products
for insert to authenticated
with check (public.has_role('admin') or public.has_role('super_admin'));

drop policy if exists "bank_admin_only_select" on public.bank_products;
create policy "bank_admin_only_select" on public.bank_products
for select to authenticated
using (public.has_role('admin') or public.has_role('super_admin'));

drop policy if exists "loan_update_admin" on public.loan_applications;
create policy "loan_update_admin" on public.loan_applications
for update to authenticated
using (public.has_role('admin') or public.has_role('super_admin') or public.has_role('compliance_team'))
with check (public.has_role('admin') or public.has_role('super_admin') or public.has_role('compliance_team'));

drop policy if exists "notifications_insert_system" on public.notifications;
create policy "notifications_insert_system" on public.notifications
for insert to authenticated
with check (public.has_role('admin') or public.has_role('super_admin'));

drop policy if exists "roles_admin_only" on public.user_roles;
create policy "roles_admin_only" on public.user_roles
for select to authenticated
using (public.has_role('admin') or public.has_role('super_admin'));

drop policy if exists "roles_admin_write" on public.user_roles;
create policy "roles_admin_write" on public.user_roles
for update to authenticated
using (public.has_role('super_admin') or (public.has_role('admin') and role not in ('super_admin'::public.app_role, 'admin'::public.app_role)))
with check (public.has_role('super_admin') or (public.has_role('admin') and role not in ('super_admin'::public.app_role, 'admin'::public.app_role)));
