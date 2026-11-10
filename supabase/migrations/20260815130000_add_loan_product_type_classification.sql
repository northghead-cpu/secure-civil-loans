alter table public.bank_products add column if not exists product_type text;

update public.bank_products
set product_type = 'loan_bank'
where product_type is null;

alter table public.bank_products alter column product_type set default 'loan_bank';
alter table public.bank_products alter column product_type set not null;
alter table public.bank_products drop constraint if exists bank_products_product_type_check;
alter table public.bank_products add constraint bank_products_product_type_check check (product_type in ('loan_bank','loan_microfinance','salary_advance_microfinance'));

create index if not exists idx_bank_products_product_type on public.bank_products(product_type);
