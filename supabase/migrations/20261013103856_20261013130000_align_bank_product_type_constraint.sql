-- Align the live constraint with the canonical product classifications used by the admin form and Compare page.
-- Preserve the existing allowed classifications and all RLS/MFA policies.
alter table public.bank_products drop constraint if exists bank_products_product_type_check;
alter table public.bank_products add constraint bank_products_product_type_check check (product_type in ('loan_bank', 'loan_microfinance', 'salary_advance_microfinance'));
create index if not exists idx_bank_products_product_type on public.bank_products(product_type);
