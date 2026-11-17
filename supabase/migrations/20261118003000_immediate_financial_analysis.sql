-- pg_net delivers after commit; the existing cron remains the retry/recovery path.
alter table private.financial_analysis_jobs
 add column if not exists wake_transaction bigint,
 add column if not exists wake_request_id bigint,
 add column if not exists last_wake_error text;
create or replace function private.wake_financial_analysis() returns trigger
language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint; transaction_id bigint:=txid_current();
begin
 -- Several document rows in one intake transaction need only one wake-up.
 if new.wake_transaction=transaction_id then return new;end if;
 begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='riverbanc_cron_secret';
  if secret is null or length(secret)<24 then raise exception 'AUTOMATION_SECRET_MISSING';end if;
  select net.http_post(
   url:='https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/analyse-financial-documents',
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),
   body:=jsonb_build_object('user_id',new.user_id),timeout_milliseconds:=60000)
   into request_id;
  update private.financial_analysis_jobs set wake_transaction=transaction_id,
   wake_request_id=request_id,last_wake_error=null where user_id=new.user_id;
 exception when others then
  -- Never expose HTTP credentials/errors or roll back a customer's upload.
  update private.financial_analysis_jobs set wake_transaction=transaction_id,
   last_wake_error='IMMEDIATE_WAKE_FAILED' where user_id=new.user_id;
 end;
 return new;
end $$;
revoke all on function private.wake_financial_analysis() from public,anon,authenticated;
create or replace trigger financial_analysis_immediate_wake
 after insert or update of generation on private.financial_analysis_jobs
 for each row execute function private.wake_financial_analysis();

-- Staff see only the derived summary, never private parser text or bank references.
create or replace function public.get_financial_analysis_preview(_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.financial_analysis_jobs;
begin
 perform private.require_interactive_session();
 if not coalesce(private.has_role('admin') or private.has_role('super_admin'),false) then
  raise insufficient_privilege;
 end if;
 select * into j from private.financial_analysis_jobs where user_id=_user_id;
 if not found then return jsonb_build_object('state','not_started');end if;
 return jsonb_build_object(
  'state',j.state,'generation',j.generation,'completedAt',j.completed_at,
  'current',j.state='done' and j.result->>'sourceGeneration'=j.generation::text,
  'retryPending',j.last_error is not null,
  'assessment',case when j.state='done' and j.result->>'sourceGeneration'=j.generation::text then
   jsonb_build_object(
    'gross',j.result->'gross','net',j.result->'net',
    'payrollDebt',j.result->'payrollDebt',
    'externalDebtLowerBound',j.result->'externalDebtLowerBound',
    'estimatedMonthlyExpenses',j.result->'estimatedMonthlyExpenses',
    'documentDebtRatioPercent',j.result->'documentDebtRatioPercent',
    'extractionQualityPercent',j.result->'extractionQualityPercent',
    'documentReviewPending',j.result->'documentReviewPending',
    'issues',j.result->'issues')
  else null end);
end $$;
revoke all on function public.get_financial_analysis_preview(uuid) from public,anon;
grant execute on function public.get_financial_analysis_preview(uuid) to authenticated;
