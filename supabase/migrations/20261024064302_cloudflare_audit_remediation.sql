-- Additive security guards; no tables, customer rows or evidence are deleted.
create or replace function private.is_interactive_session() returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and not (coalesce(auth.jwt(),'{}'::jsonb) ? 'client_id');
$$;
revoke all on function private.is_interactive_session() from public,anon;
grant execute on function private.is_interactive_session() to authenticated;

create or replace function private.require_interactive_session() returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_interactive_session() then raise exception 'Interactive first-party session required' using errcode='42501'; end if;
 if not private.is_account_active() then raise exception 'Active account required' using errcode='42501'; end if;
 if private.is_privileged_role(auth.uid()) and coalesce(auth.jwt()->>'aal','')<>'aal2' then
  raise exception 'MFA required' using errcode='42501';
 end if;
end;
$$;
revoke all on function private.require_interactive_session() from public,anon;
grant execute on function private.require_interactive_session() to authenticated;

-- RLS guards are restrictive: older permissive policies cannot bypass them.
-- OAuth/MCP grants read access only; OIDC scopes do not restrict database mutations.
do $$ declare t record; cmd text; clause text; begin
 for t in select schemaname,tablename from pg_tables where schemaname='public' or (schemaname='storage' and tablename='objects') loop
  foreach cmd in array array['INSERT','UPDATE','DELETE'] loop
   clause:=case cmd when 'INSERT' then 'with check ((select private.is_interactive_session()))'
    when 'DELETE' then 'using ((select private.is_interactive_session()))'
    else 'using ((select private.is_interactive_session())) with check ((select private.is_interactive_session()))' end;
   execute format('create policy %I on %I.%I as restrictive for %s to authenticated %s','interactive_'||lower(cmd),t.schemaname,t.tablename,cmd,clause);
  end loop;
 end loop;
end $$;
create policy staff_storage_mfa on storage.objects as restrictive for all to authenticated
using (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2')
with check (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2');
do $$ declare t text; begin
 foreach t in array array['support_cases','support_messages','support_case_events'] loop
  if to_regclass('public.'||t) is not null then
   execute format($policy$create policy support_staff_mfa on public.%I as restrictive for all to authenticated using (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2') with check (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2')$policy$,t);
  end if;
 end loop;
end $$;
create policy profiles_update_authority on public.profiles as restrictive for update to authenticated
using (user_id=(select auth.uid()) or private.has_role('admin') or private.has_role('super_admin'))
with check (user_id=(select auth.uid()) or private.has_role('admin') or private.has_role('super_admin'));
create policy roles_active_writer on public.user_roles as restrictive for all to authenticated
using (user_id=(select auth.uid()) or (select private.is_account_active()))
with check ((select private.is_account_active()));
-- UPDATE/DELETE of own role also requires an active account; keep SELECT bootstrap intact.
create policy roles_active_update on public.user_roles as restrictive for update to authenticated
using ((select private.is_account_active())) with check ((select private.is_account_active()));
create policy roles_active_delete on public.user_roles as restrictive for delete to authenticated
using ((select private.is_account_active()));

-- Notifications are produced by checked server workflows, never browser inserts.
revoke insert,delete on public.notifications from anon,authenticated;
create policy notifications_server_insert on public.notifications as restrictive for insert to authenticated with check (false);

-- Definers bypass RLS, so guard the final trusted entry points as well. Preserve
-- their exact deployed business logic, signatures, owners and ACLs. Fail closed
-- if a reviewed function changes language/body shape rather than silently skip it.
do $guard$ declare f record; definition text; guarded text; begin
 for f in select p.oid,p.oid::regprocedure as signature,l.lanname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where p.prosecdef and ((n.nspname='public' and p.proname in
   ('authorize_application_handoff','authorize_riverbanc_subscription','create_support_case','reply_support_case','update_support_case','reconcile_riverbanc_subscription_payroll','reconcile_riverbanc_monthly_payroll_deduction'))
   or (n.nspname='private' and p.proname in ('submit_kyc_verification','review_kyc_verification','advance_application_handoff','authorize_application_handoff_internal')))
 loop
  if f.lanname<>'plpgsql' then raise exception 'Unexpected function language: %',f.signature; end if;
  definition:=pg_get_functiondef(f.oid);
  guarded:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n PERFORM private.require_interactive_session();','i');
  if guarded=definition then raise exception 'Guard insertion failed: %',f.signature; end if;
  execute guarded;
 end loop;
end $guard$;

-- Every profile mutation invalidates any outstanding reviewer snapshot. The
-- column is server-owned (no client column grant); historical evidence is retained.
alter table public.profiles add column kyc_review_revision uuid not null default gen_random_uuid();
create or replace function private.bump_kyc_review_revision() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 new.kyc_review_revision:=gen_random_uuid(); return new;
end $$;
revoke all on function private.bump_kyc_review_revision() from public,anon,authenticated;
create trigger zz_kyc_review_revision before update on public.profiles for each row
execute function private.bump_kyc_review_revision();

create or replace function private.review_kyc_verification(_user_id uuid,_status text,_reason text,_expected_revision uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 perform private.require_interactive_session();
 if not (private.has_role('admin') or private.has_role('super_admin')) then raise exception 'Authorized MFA staff required'; end if;
 select * into strict p from public.profiles where user_id=_user_id for update;
 if _expected_revision is null or p.kyc_review_revision<>_expected_revision or p.kyc_status<>'IN_REVIEW' then
  raise exception 'KYC submission changed; refresh the evidence before reviewing';
 end if;
 perform private.review_kyc_verification(_user_id,_status,_reason);
end;
$$;
revoke all on function private.review_kyc_verification(uuid,text,text,uuid) from public,anon;
grant execute on function private.review_kyc_verification(uuid,text,text,uuid) to authenticated;
create or replace function public.review_kyc_verification(_user_id uuid,_status text,_reason text,_expected_revision uuid) returns void
language sql security invoker set search_path='' as $$ select private.review_kyc_verification(_user_id,_status,_reason,_expected_revision); $$;
revoke all on function public.review_kyc_verification(uuid,text,text,uuid) from public,anon;
grant execute on function public.review_kyc_verification(uuid,text,text,uuid) to authenticated;
-- Keep old signatures for dependency compatibility, but remove unbound API access.
revoke all on function public.review_kyc_verification(uuid,text,text) from public,anon,authenticated;
revoke all on function private.review_kyc_verification(uuid,text,text) from public,anon,authenticated;
