create or replace trigger financial_profile_changed after update of employee_number,kyc_status,account_status on public.profiles
 for each row execute function private.enqueue_financial_analysis();
