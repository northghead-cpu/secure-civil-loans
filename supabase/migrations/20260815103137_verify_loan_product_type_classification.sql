do $$
declare
  v_bank uuid;
  v_micro uuid;
  v_salary uuid;
  v_bank_type text;
  v_micro_type text;
  v_salary_type text;
  v_invalid_rejected boolean := false;
begin
  insert into public.bank_products (bank_name, product_type, interest_rate, min_amount, max_amount, max_term_months, processing_days, active)
  values ('__E2E_BANK__', 'loan_bank', 10, 1000, 100000, 60, 1, true) returning id into v_bank;
  insert into public.bank_products (bank_name, product_type, interest_rate, min_amount, max_amount, max_term_months, processing_days, active)
  values ('__E2E_MICRO__', 'loan_microfinance', 12, 1000, 50000, 12, 1, true) returning id into v_micro;
  insert into public.bank_products (bank_name, product_type, interest_rate, min_amount, max_amount, max_term_months, processing_days, active)
  values ('__E2E_SALARY__', 'salary_advance_microfinance', 15, 500, 20000, 3, 0, true) returning id into v_salary;

  select product_type into v_bank_type from public.bank_products where id = v_bank;
  select product_type into v_micro_type from public.bank_products where id = v_micro;
  select product_type into v_salary_type from public.bank_products where id = v_salary;

  begin
    insert into public.bank_products (bank_name, product_type, interest_rate, min_amount, max_amount, max_term_months, processing_days, active)
    values ('__E2E_INVALID__', 'invalid_type', 10, 1000, 10000, 12, 1, true);
  exception when check_violation then
    v_invalid_rejected := true;
  end;

  if v_bank_type <> 'loan_bank' or v_micro_type <> 'loan_microfinance' or v_salary_type <> 'salary_advance_microfinance' or not v_invalid_rejected then
    raise exception 'Loan product classification verification failed';
  end if;

  raise notice 'E2E classification verified: bank=%, microfinance=%, salary_advance=%, invalid_rejected=%', v_bank_type, v_micro_type, v_salary_type, v_invalid_rejected;

  delete from public.bank_products where id in (v_bank, v_micro, v_salary);
end;
$$;
