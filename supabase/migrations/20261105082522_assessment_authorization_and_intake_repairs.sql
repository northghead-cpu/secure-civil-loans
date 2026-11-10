set local lock_timeout = '5s';
set local statement_timeout = '60s';
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
   execute format('drop policy if exists %I on %I.%I','interactive_'||lower(cmd),t.schemaname,t.tablename);
   execute format('create policy %I on %I.%I as restrictive for %s to authenticated %s','interactive_'||lower(cmd),t.schemaname,t.tablename,cmd,clause);
  end loop;
 end loop;
end $$;
drop policy if exists staff_storage_mfa on storage.objects;
create policy staff_storage_mfa on storage.objects as restrictive for all to authenticated
using (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2')
with check (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2');
do $$ declare t text; begin
 foreach t in array array['support_cases','support_messages','support_case_events'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop policy if exists support_staff_mfa on public.%I',t);
   execute format($policy$create policy support_staff_mfa on public.%I as restrictive for all to authenticated using (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2') with check (not private.is_privileged_role((select auth.uid())) or coalesce((select auth.jwt()->>'aal'),'')='aal2')$policy$,t);
  end if;
 end loop;
end $$;
drop policy if exists profiles_update_authority on public.profiles;
create policy profiles_update_authority on public.profiles as restrictive for update to authenticated
using (user_id=(select auth.uid()) or private.has_role('admin') or private.has_role('super_admin'))
with check (user_id=(select auth.uid()) or private.has_role('admin') or private.has_role('super_admin'));
drop policy if exists roles_active_writer on public.user_roles;
create policy roles_active_writer on public.user_roles as restrictive for all to authenticated
using (user_id=(select auth.uid()) or (select private.is_account_active()))
with check ((select private.is_account_active()));
-- UPDATE/DELETE of own role also requires an active account; keep SELECT bootstrap intact.
drop policy if exists roles_active_update on public.user_roles;
create policy roles_active_update on public.user_roles as restrictive for update to authenticated
using ((select private.is_account_active())) with check ((select private.is_account_active()));
drop policy if exists roles_active_delete on public.user_roles;
create policy roles_active_delete on public.user_roles as restrictive for delete to authenticated
using ((select private.is_account_active()));

-- Notifications are produced by checked server workflows, never browser inserts.
revoke insert,delete on public.notifications from anon,authenticated;
drop policy if exists notifications_server_insert on public.notifications;
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
  if position('PERFORM private.require_interactive_session();' in definition)>0 then continue; end if;
  guarded:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n PERFORM private.require_interactive_session();','i');
  if guarded=definition then raise exception 'Guard insertion failed: %',f.signature; end if;
  execute guarded;
 end loop;
end $guard$;

-- Every profile mutation invalidates any outstanding reviewer snapshot. The
-- column is server-owned (no client column grant); historical evidence is retained.
alter table public.profiles add column if not exists kyc_review_revision uuid not null default gen_random_uuid();
create or replace function private.bump_kyc_review_revision() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 new.kyc_review_revision:=gen_random_uuid(); return new;
end $$;
revoke all on function private.bump_kyc_review_revision() from public,anon,authenticated;
drop trigger if exists zz_kyc_review_revision on public.profiles;
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

-- RB-05: serialize each user's nonce/quota decision across Edge isolates.
-- There is no client-controlled quota, time window or function whitelist.
create or replace function public.consume_edge_request(p_user_id uuid,p_function_name text,p_nonce text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_limit integer; v_now timestamptz; v_count integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege using message='SERVICE_ROLE_REQUIRED'; end if;
 v_limit:=case p_function_name when 'process-loan' then 20 when 'crb-proxy' then 10 when 'sheets-export' then 5 when 'upload-kyc-document' then 20 end;
 if v_limit is null or p_user_id is null or p_nonce is null or p_nonce !~ '^[A-Za-z0-9._-]{16,128}$' then
  raise exception using errcode='22023',message='INVALID_EDGE_REQUEST';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_function_name,0));
 v_now:=clock_timestamp();
 -- Only short-lived guard metadata is pruned; no business/audit data.
 delete from public.edge_request_log where user_id=p_user_id and function_name=p_function_name and created_at<v_now-interval '5 minutes';
 if exists(select 1 from public.edge_request_log where user_id=p_user_id and function_name=p_function_name and nonce=p_nonce) then
  return jsonb_build_object('allowed',false,'replay',true);
 end if;
 select count(*) into v_count from public.edge_request_log where user_id=p_user_id and function_name=p_function_name and created_at>=v_now-interval '60 seconds';
 if v_count>=v_limit then return jsonb_build_object('allowed',false,'replay',false); end if;
 insert into public.edge_request_log(user_id,function_name,nonce,created_at) values(p_user_id,p_function_name,p_nonce,v_now);
 return jsonb_build_object('allowed',true,'replay',false);
end $$;
revoke all on function public.consume_edge_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_edge_request(uuid,text,text) to service_role;

-- RB-11: callers cannot choose actor, action, role, target or audit payload.
create or replace function public.record_personal_export_prepared() returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 perform private.require_interactive_session();
 perform pg_advisory_xact_lock(hashtextextended('personal-export:'||v_user::text,0));
 if (select count(*) from public.audit_logs where user_id=v_user and action_performed='personal_data_export_prepared' and created_at>clock_timestamp()-interval '60 seconds')>=5 then
  raise exception using errcode='54000',message='Export preparation limit reached; try again shortly';
 end if;
 insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
 values(v_user,case when private.is_privileged_role(v_user) then 'staff' else 'borrower' end,'personal_data_export_prepared',v_user::text,'profiles','{"artifact":"personal_data_json"}'::jsonb);
end $$;
revoke all on function public.record_personal_export_prepared() from public,anon;
grant execute on function public.record_personal_export_prepared() to authenticated;

-- RB-13: this table is a lender commission register, not borrower payouts.
-- Preserve a fail-closed guard instead of silently disabling payroll consent.
-- Settlement remains unavailable until a separate, reviewed workflow exists.
create or replace function public.require_payroll_authorization_for_payout() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('processing','disbursed','sent','paid') then
  raise exception using errcode='55000',message='Commission settlement workflow is not configured; this register cannot disburse borrower funds';
 end if;
 return new;
end $$;
revoke insert,update,delete on public.payouts from anon,authenticated;
-- The trigger can be invoked by PostgreSQL without API execution privileges.
revoke all on function public.require_payroll_authorization_for_payout() from public,anon,authenticated;

-- RB-10: only the authenticated, validating intake may create/replace KYC
-- objects. Reads/deletes still use the existing owner and staff policies.
drop policy if exists kyc_validated_intake_insert on storage.objects;
create policy kyc_validated_intake_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'kyc-documents');
drop policy if exists kyc_validated_intake_update on storage.objects;
create policy kyc_validated_intake_update on storage.objects as restrictive for update to authenticated
using (bucket_id<>'kyc-documents') with check (bucket_id<>'kyc-documents');
create or replace function public.require_document_upload_session() returns void
language sql security invoker set search_path='' as $$ select private.require_interactive_session(); $$;
revoke all on function public.require_document_upload_session() from public,anon;
grant execute on function public.require_document_upload_session() to authenticated;
