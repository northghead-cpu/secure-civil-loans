alter table public.bank_products drop constraint if exists bank_products_product_type_check;
alter table public.bank_products add constraint bank_products_product_type_check check (product_type in ('salary_advance','microfinance_loan','bank_loan'));
