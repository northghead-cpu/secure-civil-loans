create table if not exists public.reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  name text not null,
  description text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  frequency text not null check (frequency in ('on_demand','scheduled')),
  enabled boolean not null default true,
  pii_safe boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running','succeeded','failed')) default 'running',
  checks_run integer not null default 0,
  violations_found integer not null default 0,
  initiated_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.reconciliation_runs(id) on delete cascade,
  check_id uuid not null references public.reconciliation_checks(id),
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null check (status in ('open','acknowledged','resolved','false_positive')) default 'open',
  entity_type text,
  entity_id text,
  finding_code text not null,
  summary text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create index if not exists reconciliation_findings_run_idx on public.reconciliation_findings(run_id);
create index if not exists reconciliation_findings_status_idx on public.reconciliation_findings(status, severity);
create index if not exists reconciliation_findings_entity_idx on public.reconciliation_findings(entity_type, entity_id);

alter table public.reconciliation_checks enable row level security;
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_findings enable row level security;

insert into public.reconciliation_checks (check_key,name,description,severity,frequency,pii_safe)
values
('member_application_identity','Member/Application identity consistency','Compares authoritative member identity fields with application identity fields.','high','scheduled',true),
('application_underwriting_consistency','Application/Underwriting consistency','Ensures underwriting records correspond to the correct application/member and financial inputs remain consistent.','high','scheduled',true),
('handoff_product_consistency','Handoff/Product consistency','Validates selected lender product, amount, term, rate and authorization state.','high','scheduled',true),
('subscription_state_consistency','Subscription state consistency','Validates subscription authorization lifecycle timestamps and status.','medium','scheduled',true),
('payroll_authorization_consistency','Payroll authorization consistency','Validates payroll authorization lifecycle and authorization evidence.','high','scheduled',true),
('payout_state_consistency','Payout state consistency','Validates payout lifecycle dates, processor state and lender relationship.','high','scheduled',true),
('orphan_record_detection','Orphan record detection','Detects records that reference missing parent entities.','critical','scheduled',true),
('duplicate_business_key_detection','Duplicate business-key detection','Detects duplicate records across defined business identifiers.','high','scheduled',true),
('stale_workflow_detection','Stale workflow detection','Detects workflow records remaining in active states beyond the defined threshold.','medium','scheduled',true)
on conflict (check_key) do update set name=excluded.name,description=excluded.description,severity=excluded.severity,frequency=excluded.frequency,pii_safe=excluded.pii_safe,updated_at=now();

revoke all on public.reconciliation_checks, public.reconciliation_runs, public.reconciliation_findings from anon, authenticated;
grant select on public.reconciliation_checks to authenticated;
