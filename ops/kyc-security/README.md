# Marketplace malware scanning and independently encrypted recovery

This worker targets only Marketplace project `zdpeaxkormwjrgllwalq`. It does
not read Handshake. The implementation and tests are ready; a scanner host,
private backup account and recovery-key custody have NOT been provisioned.
No live KYC scan, object backup or real restore is claimed by the tests.

## Data flow

1. On an approved, privately operated host, update a supported, fully patched
   ClamAV engine/signature database. The worker checks definition age and runs
   both a harmless clean probe and the standard benign EICAR detection test
   before requesting any borrower bytes. Missing/stale definitions fail closed.
2. A revocable, worker-only token pages the exact object IDs/versions through a
   Marketplace-only Edge gateway. The Supabase service key stays inside Supabase;
   it is NOT supplied to the scanner host. The token cannot call arbitrary SQL,
   Auth administration or unrelated buckets. Browser-origin calls are rejected.
   Each object is downloaded with authentication and no-store, bounded to 10 MiB.
   It is scanned in a private temporary directory, then that temporary copy is
   removed. Raw documents never enter a public scanning/upload service.
3. A service-only RPC records verdict and SHA-256 only if the source version is
   still current. Positive or unreadable files are quarantined by RLS, retained
   in place, and included in the encrypted evidence backup. No source delete,
   rename, move or overwrite API is used. Scan/error verdicts cannot be submitted
   by borrowers or ordinary staff. Audit rows contain object IDs, not paths.
4. Each object gets an independent random AES-256-GCM key/nonce. Its key is
   wrapped with the separate RSA-OAEP-SHA256 recovery public key (minimum RSA
   3072). Both the object and its source-path manifest are encrypted before
   leaving the worker. The worker refuses private recovery keys in the public
   key setting. Use an independently held, encrypted private key for recovery.
5. The private S3-compatible destination (for example a private R2 bucket) gets
   only opaque random keys and encrypted bytes. Conditional writes prevent
   overwrites. The worker reads each ciphertext back and checks SHA-256 before
   returning a success receipt. This proves encrypted readback, not recovery.
6. The separate recovery command decrypts bytes from that actual destination
   using the offline private key and compares original size/SHA-256. It verifies
   recovery in memory and writes no plaintext to production or disk. Automatic
   reinsertion into Marketplace is intentionally excluded from recovery checks.

Keep the receipt's manifest SHA-256 in a protected location independent of the
backup bucket. Public-key encryption alone does not authenticate its creator;
the protected receipt prevents manifest replacement. Do not publish receipts,
service credentials, account keys, PEM files or recovery passphrases in Git.

## Configuration still required

Use an approved host/region for transient plaintext processing; this can be an
approved temporary private worker while the final Lusaka VPS is pending. Do not
run real KYC jobs on an unapproved public/shared CI runner. Install Node 24+ and
ClamAV with freshclam updates and enough memory for the current signatures.
The worker creates no cloud account, bucket, billable resource or credential.

Create a private S3-compatible bucket with public domains/access disabled and
provider versioning/retention protection as available. Use a backup-only key
scoped to GetObject/PutObject in that bucket, without delete or public-ACL rights.
Keep the recovery private key outside both Supabase and the backup host/account.
Configure credentials directly through your protected secret store, not chat.

Required worker environment:

| Variable                           | Value                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `MARKETPLACE_STORAGE_WORKER_TOKEN` | Revocable worker-only random token; never expose to browser or PR jobs |
| `KYC_BACKUP_S3_ENDPOINT`           | Approved HTTPS S3 endpoint origin, without path/query/credentials      |
| `KYC_BACKUP_BUCKET`                | Independently private destination bucket                               |
| `KYC_BACKUP_REGION`                | `auto` for R2, provider region for AWS S3                              |
| `KYC_BACKUP_ACCESS_KEY_ID`         | Scoped backup key ID                                                   |
| `KYC_BACKUP_SECRET_ACCESS_KEY`     | Scoped backup key secret                                               |
| `KYC_BACKUP_PUBLIC_KEY_FILE`       | RSA recovery public PEM file; private PEM is refused                   |
| `CLAMAV_DATABASE_DIR`              | Optional custom signature directory                                    |

Generate a cryptographically random 32-byte base64url token inside your protected
secret store. Configure that same value as `MARKETPLACE_KYC_WORKER_TOKEN` in
Marketplace Supabase Edge secrets and `MARKETPLACE_STORAGE_WORKER_TOKEN` on the
worker. The gateway is disabled while its secret is missing. Do not use an Auth
JWT, a Supabase service key, or a human password as this token. Do not paste it
into chat. Rotating the gateway token revokes worker access without rotating
Marketplace's application credentials.

On a separate, trusted recovery machine, generate and retain an encrypted RSA
4096 private key with `openssl genpkey -algorithm RSA -aes-256-cbc -pkeyopt
rsa_keygen_bits:4096 -out /secure/recovery.pem`, then export its public part with
`openssl pkey -in /secure/recovery.pem -pubout -out /secure/recovery-public.pem`.
These commands prompt for the passphrase; do not put it on a command line. Only
copy the public part to the worker. Keep the encrypted private key backed up in
your independent key vault; an unreadable/lost private key makes recovery fail.

## Deployment and activation

Install reviewed dependencies with `npm ci --ignore-scripts` in this directory.
`npm test` uses synthetic bytes, an in-memory destination and stub verdicts;
it does not stand in for a real ClamAV engine or a real offsite restore.

Apply the additive scan/quarantine migration before invoking the worker. The
default `require_clean_scan=false` preserves access to existing, never-scanned
files. It DOES NOT describe them as malware-free. Once a scan row exists, only
a clean result for the exact current version permits normal access. Infected,
error and changed-after-scan objects are blocked without deleting evidence.

Positive findings for a digest remain quarantined even if a later report says
clean; delayed older evidence is rejected. Do not treat a worker's latest clean
report as permission to bypass a retained positive finding. The server audit
distinguishes the reported verdict from the applied quarantine verdict. A safe
replacement version with different bytes must be verified, or the retained
finding must go through a separate administrator investigation.

Run `npm run backup` on the approved host. Save its opaque JSON receipt securely.
Exit status 2 means infected/error evidence was retained and encrypted, not that
the files were safe. Exit 1 means failure; no successful recovery is asserted.
Before relying on the backup, run `npm run verify-restore` on the recovery host
with the same private destination access plus:

- `KYC_RECOVERY_PRIVATE_KEY_FILE`: protected PEM file with permissions 0600.
- `KYC_RECOVERY_KEY_PASSPHRASE`: passphrase delivered via protected secret store.
- `KYC_BACKUP_RUN_ID` and `KYC_BACKUP_MANIFEST_SHA256`: the trusted receipt values.

The recovery process does not need the Marketplace worker token. Verify
that the recovered object count covers the source snapshot (currently 75 KYC
objects; new uploads may increase it). Test an isolated real restore before
enabling strict clean-scan reads. Record the actual receipt/evidence privately.

Only after a current full scan, a real restore verification and monitoring are
working should an administrator enable strict mode:
`update private.marketplace_storage_scan_config set require_clean_scan=true;`
Then new uploads remain unreadable until the worker scans their current version.
Do not enable this while the worker is absent; it would block the pilot's files.

The supplied systemd service/timer are deployment templates, NOT active jobs.
Install them on the approved host with a dedicated `riverbanc-kyc` user, code
under `/opt/riverbanc-kyc`, and a root-owned 0600 environment file at
`/etc/riverbanc-kyc/worker.env`. Configure freshclam independently. Receipts append
under a private state directory; replicate them to your protected evidence store.
Enable the timer only after first-run and recovery checks pass. Its optional
cadence is six hours in Africa/Lusaka time. Failures must be monitored by the
operator; this patch does not configure notifications or send messages.

Each run currently makes a full encrypted snapshot, not an incremental backup.
Estimate storage/egress costs before enabling a cadence for a larger pilot.
No retention deletion is scheduled. Review the timer and credentials at the
November VPS handover; never remove the only proven recovery copy first.
