create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'profile role is managed by user_roles and cannot be changed through profiles';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
before update on public.profiles
for each row
execute function public.prevent_profile_role_change();
