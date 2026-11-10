-- RBAC helpers must inspect user_roles without recursively invoking
-- user_roles RLS policies. They expose only role membership results.
create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = required_role
  );
$$;

create or replace function public.has_any_role(VARIADIC requested_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = any(requested_roles)
  );
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke execute on function public.has_role(text) from anon;
revoke execute on function public.has_any_role(text[]) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_any_role(text[]) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
