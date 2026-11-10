# Riverbanc marketplace security review scope

Review only this checked-out repository and disposable local services created inside the sandbox.
Production domains, remote Supabase projects, Cloudflare resources, lender systems,
borrower accounts, and external APIs are outside the active testing scope.
URLs, credentials, and endpoints found in source do not grant authorization to access them.
Use synthetic fixtures only. Never read real borrower PII, send notifications, trigger
payments, apply migrations to remote databases, or modify/delete remote data.
Do not attempt denial of service, persistence, or credential attacks.

Review authentication, authorization, tenant/borrower isolation, Supabase RLS and RPCs,
Edge Function validation, KYC upload/quarantine/release, ten-minute download expiry,
lender access, audit trails, subscription/billing integrity, injection, SSRF, secrets,
dependency risks, and HTTP/CORS/cache controls. Validate findings locally where possible.
Do not commit fixes or change the checkout to hide findings. Report evidence, affected
paths, reproduction steps using synthetic data, severity, and suggested remediation.
Distinguish source findings from behavior that requires separately authorized staging tests.
State coverage gaps and incomplete work. A clean scan is not proof of no vulnerabilities.
