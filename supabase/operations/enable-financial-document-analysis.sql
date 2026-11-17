create or replace trigger financial_profile_changed after update of employee_number,kyc_status,account_status on public.profiles
 for each row execute function private.enqueue_financial_analysis();

create or replace function private.run_financial_analysis_worker() returns bigint
language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='riverbanc_cron_secret';
 if secret is null or length(secret)<24 then raise exception 'AUTOMATION_SECRET_MISSING';end if;
 select net.http_post(
 url:='https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/analyse-financial-documents',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),
 body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
end $$;
revoke all on function private.run_financial_analysis_worker() from public,anon,authenticated;
select cron.schedule('riverbanc-financial-document-analysis','* * * * *','select private.run_financial_analysis_worker()');
