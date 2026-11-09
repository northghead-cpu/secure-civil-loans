-- Riverbanc means the Marketplace (zdpeaxkormwjrgllwalq). No Handshake changes.
-- Restrictive policies only: existing permissive policies still decide which
-- operations are allowed. No tables, objects or business rows are deleted.
create function private.marketplace_document_session_active()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and not (coalesce(auth.jwt(),'{}'::jsonb) ? 'client_id')
    and coalesce(auth.jwt()->>'is_anonymous','false')='false'
    and private.is_account_active()
    and (not private.is_privileged_role(auth.uid()) or coalesce(auth.jwt()->>'aal','')='aal2')
    and exists (
      select 1 from auth.sessions s
      where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
        and (s.not_after is null or s.not_after>now()) and s.oauth_client_id is null
    );
$$;
revoke all on function private.marketplace_document_session_active() from public,anon;
grant execute on function private.marketplace_document_session_active() to authenticated;

create policy marketplace_sensitive_storage_no_anonymous
on storage.objects as restrictive for all to anon
using(bucket_id not in ('kyc-documents','payslips','payment-receipts'))
with check(bucket_id not in ('kyc-documents','payslips','payment-receipts'));

create policy marketplace_sensitive_storage_current_session
on storage.objects as restrictive for all to authenticated
using(bucket_id not in ('kyc-documents','payslips','payment-receipts') or (select private.marketplace_document_session_active()))
with check(bucket_id not in ('kyc-documents','payslips','payment-receipts') or (select private.marketplace_document_session_active()));

-- A future broad SELECT policy cannot silently expose another borrower's files.
-- This policy adds no new access, including to the otherwise ungranted payslips bucket.
create policy marketplace_sensitive_storage_read_scope
on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('kyc-documents','payslips','payment-receipts')
  or split_part(name,'/',1)=(select auth.uid())::text
  or (
    coalesce(auth.jwt()->>'aal','')='aal2'
    and (
      private.has_role(auth.uid(),'admin'::public.app_role)
      or private.has_role(auth.uid(),'super_admin'::public.app_role)
      or private.has_role(auth.uid(),'super_user'::public.app_role)
      or private.has_role(auth.uid(),'compliance_team'::public.app_role)
      or (bucket_id in ('kyc-documents','payslips') and private.has_role(auth.uid(),'data_entry_team'::public.app_role))
    )
  )
);

-- The upload Edge Function checks this before and after parsing a document.
-- Its service-role write must not bypass logout/session revocation checks.
create or replace function public.require_document_upload_session()
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform private.require_interactive_session();
  if not private.marketplace_document_session_active() then
    raise exception 'Current first-party document session required' using errcode='42501';
  end if;
end $$;
revoke all on function public.require_document_upload_session() from public,anon;
grant execute on function public.require_document_upload_session() to authenticated;
