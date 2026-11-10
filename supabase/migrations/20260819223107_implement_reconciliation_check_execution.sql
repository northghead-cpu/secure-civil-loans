create or replace function public.run_reconciliation()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_run uuid;
  v_checks integer := 0;
  v_violations integer := 0;
  v_check record;
  v_count bigint;
  v_started timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'super_admin'::app_role)) then raise exception 'Admin access required'; end if;

  insert into reconciliation_runs(status,initiated_by) values ('running',auth.uid()) returning id into v_run;

  for v_check in select * from reconciliation_checks where enabled order by check_key loop
    v_checks := v_checks + 1;
    v_count := 0;
    if v_check.check_key='orphan_record_detection' then
      select count(*) into v_count from loan_applications l left join profiles p on p.user_id=l.user_id where p.user_id is null;
    elsif v_check.check_key='duplicate_business_key_detection' then
      select count(*) into v_count from (select user_id from profiles group by user_id having count(*)>1) x;
    elsif v_check.check_key='member_application_identity' then
      select count(*) into v_count from profiles p join loan_applications a on a.user_id=p.user_id where (p.nrc_number is not null and a.nrc_number is not null and upper(trim(p.nrc_number))<>upper(trim(a.nrc_number))) or (p.employer is not null and a.employer is not null and lower(trim(p.employer))<>lower(trim(a.employer))) or (p.employee_number is not null and a.employee_number is not null and trim(p.employee_number)<>trim(a.employee_number));
    elsif v_check.check_key='application_underwriting_consistency' then
      select count(*) into v_count from loan_results r join underwriting_queue u on u.zmw_client_id=r.zmw_client_id where r.user_id is distinct from u.user_id;
    elsif v_check.check_key='handoff_product_consistency' then
      select count(*) into v_count from application_handoffs h join bank_products b on b.id=h.lender_product_id where (h.requested_amount is not null and b.min_amount is not null and h.requested_amount<b.min_amount) or (h.requested_amount is not null and b.max_amount is not null and h.requested_amount>b.max_amount) or (h.term_months is not null and b.max_term_months is not null and h.term_months>b.max_term_months);
    elsif v_check.check_key='subscription_state_consistency' then
      select count(*) into v_count from subscription_authorizations where (status in ('active','authorized') and revoked_at is not null) or (status='revoked' and revoked_at is null);
    elsif v_check.check_key='payroll_authorization_consistency' then
      select count(*) into v_count from payroll_deduction_authorizations where (status in ('active','authorized') and (signed_at is null or signature_name is null)) or (status='revoked' and revoked_at is null);
    elsif v_check.check_key='payout_state_consistency' then
      select count(*) into v_count from payouts where (status='paid' and paid_date is null) or (status<>'paid' and paid_date is not null);
    elsif v_check.check_key='stale_workflow_detection' then
      select count(*) into v_count from loan_applications where status in ('pending','pending_verification','under_review') and created_at < now()-interval '30 days';
    end if;
    if v_count>0 then
      v_violations := v_violations + v_count;
      insert into reconciliation_findings(run_id,check_id,severity,finding_code,summary)
      values(v_run,v_check.id,v_check.severity,v_check.check_key,format('%s violation(s) detected by reconciliation check %s',v_count,v_check.check_key));
    end if;
  end loop;

  update reconciliation_runs set checks_run=v_checks,violations_found=v_violations,status='succeeded',completed_at=now() where id=v_run;
  return v_run;
exception when others then
  if v_run is not null then update reconciliation_runs set status='failed',completed_at=now() where id=v_run; end if;
  raise;
end;
$$;
