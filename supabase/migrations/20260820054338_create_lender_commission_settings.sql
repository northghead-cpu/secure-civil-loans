create table if not exists public.lender_commission_settings (
  id uuid primary key default gen_random_uuid(),
  lender_name text not null,
  rate numeric(8,4) not null default 0 check (rate >= 0 and rate <= 100),
  flat_fee_zmw numeric(14,2) not null default 0 check (flat_fee_zmw >= 0),
  model text not null default 'Percentage Only' check (model in ('Percentage Only','Flat Fee Only','Per Disbursement','Hybrid')),
  active boolean not null default true,
  effective_from date,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lender_name)
);

alter table public.lender_commission_settings enable row level security;

create policy lender_commission_settings_admin_read on public.lender_commission_settings
for select to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::app_role)) or (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

create policy lender_commission_settings_super_admin_write on public.lender_commission_settings
for all to authenticated
using ((select private.has_role((select auth.uid()), 'super_admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));

create index if not exists idx_lender_commission_settings_lender on public.lender_commission_settings(lender_name);
