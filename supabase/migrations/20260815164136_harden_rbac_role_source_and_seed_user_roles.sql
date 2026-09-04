-- Make user_roles the single source of truth for authorization checks.
--
-- The historical migration originally attempted to backfill roles from
-- public.profiles.role. That column is not part of the canonical profiles
-- schema, so replaying the migration on a fresh Supabase branch fails with
-- SQLSTATE 42703. Role membership must not be guessed from profile data.
-- Existing role assignments, when present, remain in public.user_roles.

-- Replace the legacy text helper with the user_roles-backed helper. The
-- follow-up migration 20260815164155 hardens this helper as SECURITY DEFINER
-- so user_roles RLS does not recursively invoke itself.
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
