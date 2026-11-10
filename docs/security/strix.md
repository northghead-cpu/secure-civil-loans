# Strix security reviews

Strix 1.7.0 is installed by `.github/workflows/strix-security.yml` on a GitHub-hosted
Ubuntu runner with Docker. It is separate from application dependencies and deployment.
The release archive is checked against its published SHA-256; workflow actions are pinned.
Existing dependency audits and security regression tests remain necessary.

## Activate

In repository Settings → Secrets and variables → Actions:

- Variable `STRIX_ENABLED`: `true` only after selecting and authorizing an AI provider.
- Variable `STRIX_LLM`: the provider/model identifier supported by Strix.
- Optional variable `STRIX_LLM_API_BASE`: a compatible provider base URL.
- Secret `STRIX_LLM_API_KEY`: the provider API key.
- Secret `STRIX_REPORT_PASSWORD`: at least 32 cryptographically random characters;
  keep a copy in your password manager so you can decrypt evidence.

Never paste API keys or the report password into source, PRs, logs, or chat.
The AI provider receives source context during scans; select an acceptable provider.
The open-source CLI is free, but provider usage and GitHub Actions can incur costs.
No paid service is provisioned by this change. Scans stay skipped until explicit opt-in.
A skipped job is not a security pass; do not make this an enforced merge check until
configuration and a successful full scan have been verified.

## Coverage and gating

Same-repository, non-draft PRs trigger a quick review using Strix's automatic diff scope.
Fork PRs are excluded because they cannot safely receive provider secrets. No
`pull_request_target` event or write-capable checkout token is used.
Use Actions → Strix security review → Run workflow on main for a deep, full-source scan.
There is no automatic schedule. Existing CI continues running independently.

Every reported severity fails the scan; errors also fail. Runs are limited to 45 minutes,
100 turns per agent and a best-effort USD 1 model budget. The budget may overshoot and
is not a billing guarantee: set provider-side limits. Budget stops or missing/incomplete
run records fail rather than passing. These limits can leave substantial coverage gaps.

The scope file permits source review and disposable local validation only. It grants
no access to production, borrower data or connected services. Instructions are an
agent control, not a network firewall; never supply production credentials.
Live and authenticated staging penetration tests need a separate scoped setup.

## Read the evidence

This repository is public. Raw findings, console transcripts and reports are never
printed or uploaded unencrypted. Download the seven-day encrypted artifact from the run,
then decrypt locally (OpenSSL prompts for the saved report password):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 \
  -in strix-report.enc -out strix-evidence.tar.gz
tar -xzf strix-evidence.tar.gz
```

Review `strix_runs/*/penetration_test_report.md`, `vulnerabilities.json`, and the console
log. Empty evidence can mean setup failed before scanning. Treat evidence as sensitive;
keep it private and do not commit it. Retention is seven days; download needed evidence
before expiry. Rotate the encryption password if exposed.

After activation, run a full scan, review findings, remediate in a separate PR, and scan
again. Branch protection is not changed by this PR. No scanner guarantees discovery of
all vulnerabilities or establishes production security on its own.
