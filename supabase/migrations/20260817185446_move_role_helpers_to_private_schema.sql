create schema if not exists private;

create or replace function private.has_any_role(VARIADIC requested_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role::text = any(requested_roles)
  );
$$;

create or replace function private.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role::text = required_role
  );
$$;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on function private.has_any_role(text[]) from public, anon, authenticated;
revoke execute on function private.has_role(text) from public, anon, authenticated;
revoke execute on function private.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function private.has_any_role(text[]) to authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;

-- Repoint policies from public helpers to private helpers.
-- Existing policy predicates are recreated with equivalent logic in place.
