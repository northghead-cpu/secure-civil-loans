create index if not exists idx_application_handoffs_lender_product_id on public.application_handoffs(lender_product_id);
create index if not exists idx_loan_results_zmw_client_id on public.loan_results(zmw_client_id);
create index if not exists idx_report_sync_state_last_synced_by on public.report_sync_state(last_synced_by);

drop index if exists public.idx_payroll_deduction_authorizations_employee_id;
drop index if exists public.idx_payroll_deduction_authorizations_employee_id_status;
