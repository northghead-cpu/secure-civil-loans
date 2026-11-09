# Free-tier managed backup path — prepared, not active

Marketplace only. No VPS, paid container, public scanner or third-party malware
upload is used. This path backs up documents independently of the deferred
ClamAV worker. It never records a clean scan or changes quarantine settings.

## Components

- `supabase/functions/marketplace-backup-source`: separately authenticated
  source that returns IDs/versions for a bounded page and RSA/AES envelopes.
  Encryption happens within Supabase. Source paths and SHA-256 are encrypted
  with the bytes. A separate backup token cannot report scans or fetch raw KYC.
- `worker.mjs`: cron-only consumer, HTTP always 404, R2 binding only to
  `riverbanc-marketplace-kyc-backup`. One envelope per invocation; conditional
  lease/checkpoint writes, conditional create-only object writes, ciphertext
  readback verification, three retry attempts per object, terminal failure on
  exhaustion. No source or backup deletion. No R2 public domains required.
- `recovery-setup.html`: local, network-disabled WebCrypto RSA-4096 key setup.
  Downloads a public PEM and a private PKCS8 encrypted with AES-256-GCM,
  PBKDF2-SHA256 at 600,000 iterations and a user-chosen passphrase. No key is
  automatically uploaded or saved in either provider. Retain both downloads
  and the passphrase separately. Only the public PEM is needed for activation.
- `recover.mjs`: independently verifies ciphertext receipt, decrypts actual
  envelopes and checks source version, original length and SHA-256 in memory.
  `loadBrowserRecoveryKey` loads the encrypted local recovery kit.

## Bounded pilot, not unlimited free storage

Fail if the snapshot is empty, reaches 100 objects, exceeds 4 MiB original bytes,
or an individual original exceeds 2 MiB. Today's 75 objects total 702,586 bytes.
Only one daily run may progress; completed and failed days do not restart.
The consumer is hard-stopped after November 30, 2026 Africa/Lusaka time. This
stops backup work, not customer access. No retained document is deleted.
At these caps the planned encrypted storage and operation counts are far below
R2's free allowance. However allowances are account-wide and R2 itself permits
overage billing: review other account usage before activation. These application
limits cannot prohibit unrelated workloads from generating provider charges.
Supabase also shares project egress and Edge invocation quotas with the app.

## Activation gates still open

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
6. Only then enable `BACKUP_ENABLED=true` and a single `*/5 * * * *` cron.
   Current 75-file snapshots take roughly six hours and fifteen minutes. Check
   daily completion/failure receipts. No alerts or outbound messages are sent
   by this code. Free log retention is limited; retain evidence independently.

The existing backup gateway is unchanged. Its service key stays inside Supabase.
The new source requires its own token and public key and returns 503 without
either. No live KYC has been exported by this implementation. No cron is active.
Malware scanning remains deferred; structural PDF/image validation is not AV.

Run `node --test ops/kyc-security/managed/source.test.mjs` for synthetic tests,
including the actual browser setup script and its encrypted recovery format.
