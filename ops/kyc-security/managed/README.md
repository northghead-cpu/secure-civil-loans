# Free-tier managed daily backup path

Marketplace only. No VPS, paid container, public scanner or third-party malware
upload is used. This path backs up documents independently of the deferred
ClamAV worker. It never records a clean scan or changes quarantine settings.

## Components

- `supabase/functions/marketplace-backup-source`: separately authenticated
  source that returns IDs/versions for a bounded page and RSA/AES envelopes.
  Encryption happens within Supabase. Source paths and SHA-256 are encrypted
  with the bytes. A separate backup token cannot report scans or fetch raw KYC.
- `worker.mjs`: once-daily consumer, HTTP always 404, private R2 binding only.
  One bounded snapshot is encrypted inside Supabase with four concurrent
  source readers. RSA-OAEP/SHA-256 uses Web Crypto for Edge/Node interoperability.
  Conditional lease/checkpoint and create-only snapshot writes prevent
  overwrites. Ciphertext readback is checked; it is not a recovery test.
  No source or backup deletion and no public R2 domain is required.
- `recovery-setup.html`: local, network-disabled WebCrypto RSA-4096 key setup.
  Downloads a public PEM and a private PKCS8 encrypted with AES-256-GCM,
  PBKDF2-SHA256 at 600,000 iterations and a user-chosen passphrase. No key is
  automatically uploaded or saved in either provider. Retain both downloads
  and the passphrase separately. Only the public PEM is needed for activation.
- `recover.mjs`: independently verifies ciphertext receipt, decrypts actual
  envelopes and checks source version, original length and SHA-256 in memory.
  `loadBrowserRecoveryKey` loads the encrypted local recovery kit.

## Bounded pilot, not unlimited free storage

Fail if the snapshot is empty, reaches 100 objects, exceeds 8 MiB original bytes,
or an individual original exceeds 2 MiB. The November 25 inventory had 84 objects totaling 5,062,230 bytes.
Encrypted responses are limited to 16 MiB. Only one daily run may progress; completed and failed days do not restart.
The consumer is hard-stopped after December 31, 2026 Africa/Lusaka time. This
stops backup work, not customer access. No retained document is deleted.
At these caps the planned encrypted storage and operation counts are far below
R2's free allowance. However allowances are account-wide and R2 itself permits
overage billing: review other account usage before activation. These application
limits cannot prohibit unrelated workloads from generating provider charges.
Supabase also shares project egress and Edge invocation quotas with the app.

## Activation and verification

1. Owner generates and securely retains the recovery kit locally and supplies
   only `riverbanc-recovery-public.pem`. Independently back up the encrypted
   private kit and passphrase. Do not store those in chat, Git or the providers.
2. Configure a random dedicated 32-byte base64url secret in Supabase as
   `MARKETPLACE_BACKUP_SOURCE_TOKEN`, and as `SOURCE_TOKEN` on the consumer.
   Configure Supabase `MARKETPLACE_BACKUP_PUBLIC_KEY` with the public PEM.
   Never reuse the scanner token, human credentials or Supabase service key.
3. Deploy source and consumer; retain the exact reviewed code. Consumer has
   R2 binding `BACKUPS`; `BACKUP_ENABLED` stays false during smoke checks.
   Workers logs/traces must redact all credentials, payloads and source paths.
4. Verify wrong-token/browser-origin/anonymous rejection and a synthetic hosted
   encryption/write/readback/recovery round trip. Free Worker CPU is 10 ms;
   test actual execution before scheduling. No CPU quota upgrade is authorized.
5. Perform the initial full source backup. Retain the final receipt/checkpoint
   SHA independently of R2. User's trusted recovery computer decrypts actual
   downloaded envelopes and verifies every original hash. Do not mark a run
   restore-verified from ciphertext readback or fixture tests.
6. Only then enable `BACKUP_ENABLED=true` and one daily cron during the
   remaining backup window. Do not use a minute/checkpoint schedule. Check
   daily completion/failure receipts. No alerts or outbound messages are sent
   by this code. Free log retention is limited; retain evidence independently.

The existing backup gateway is unchanged. Its service key stays inside Supabase.
The new source requires its own token and public key and returns 503 without
either. An authorized initial snapshot of 75 objects (702,586 original bytes) was
retrieved from private R2 and independently recovered on November 10, 2026.
Every source version, original size and SHA-256 passed. The first Edge runtime
OAEP compatibility issue was corrected under a new object key; the earlier
object is retained. Keep the actual signed-in owner recovery receipt outside R2.
A scheduled run remains `restore_verified=false` until independently tested.
Malware scanning remains deferred; structural PDF/image validation is not AV.

Run `node --test ops/kyc-security/managed/source.test.mjs` for synthetic tests,
including the actual browser setup script and its encrypted recovery format.

## Incremental mode

Deploy the source first. The source keeps the existing snapshot operation and adds
an authenticated cursor operation that returns up to eight IDs, versions and sizes.
Enable the new Worker route only by setting `BACKUP_MODE=incremental`. Each
invocation advances one checkpointed page. A short-interval trigger is required
during a crawl, and completed runs return without requesting another inventory
until the next Lusaka day. Keep the existing pilot cutoff and review account-wide
R2 and Supabase quota before scheduling the incremental Worker.

Objects are encrypted at source, written with create-only conditions and keyed
by recovery key, object ID and version. A repeated crawl transfers only new
versions. An interrupted run resumes from its last committed page. Version
changes or unreadable files never advance the affected page. If the recovery key
changes during a run, reinitialize the checkpoint under a new prefix or move the
prior checkpoint to a retained archive before restarting the crawl.

The run receipt references hash-linked pages in private R2. Use
`verifyIncrementalReceipt` on the trusted recovery computer with the existing
private key and an authenticated R2 read adapter. The verifier checks every
page, record, original file hash, file count and aggregate size in memory.
Retain the trusted receipt independently. This is a version-checked crawl over
the current object inventory, with a creation-time cutoff. It does not lock
production uploads and is not point-in-time recovery for PostgreSQL.
