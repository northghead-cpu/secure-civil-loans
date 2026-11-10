# Marketplace to Handshake KYC package preparation

This is the document-delivery bridge, separate from the deferred Cloudflare
backup work. Existing Marketplace documents stay in their private bucket.
Only a reviewed, borrower-authorized, lender-specific package is staged into
Handshake's existing private `pilot-kyc-packages` bucket. No public signed URL,
raw PII in referral messages, VPS or new paid service is introduced.

## Flow

1. Borrower completes Marketplace KYC and specifically authorizes the selected
   lender handoff. The profile must remain active, verified, and consented to
   lender sharing. Referral remains a minimal reference-only transfer.
2. Staff dispatch the referral in Handshake. The lender records pre-approval
   and requests KYC. Staff with an active first-party MFA session select
   **Prepare verified KYC package**. The browser supplies only request ID;
   the database resolves the exact lender/reference and locks a two-minute
   preparation lease. Neither borrowers nor lenders can prepare a package.
3. Handshake signs a domain-separated, timestamped request to Marketplace.
   The Marketplace source binds the lender slug to its configured lender map
   and the borrower to that lender's accepted handoff. Replayed preparation
   nonces, wrong lenders and incomplete/unreviewed inventories are refused.
4. Each of the six authoritative documents must have VALID review status and
   real clean scan evidence for its exact current Storage version and bytes,
   with definitions no older than 48 hours. Hashes are checked after reading.
   PENDING, infected, failed, stale or unscanned documents block preparation.
   Storage ownership, sharing consent and the source fingerprint are rechecked.
5. A server-generated, path-free ZIP contains six fixed-name documents,
   borrower-details.json and manifest.json. Original path names never become
   archive names. The ZIP is bounded to 25 MiB; original document bytes total
   at most 20 MiB. A response HMAC binds request, attempt, archive hash and
   source fingerprint. Handshake verifies signature/hash and rechecks staff
   authorization before and after storing the ZIP without overwrite.
6. Binding the package does not authorize its release or enable the provider.
   Riverbanc compliance records release authorization separately. The existing
   lender tenant/MFA/session checks, single-use grant, ten-minute maximum,
   revocation, audit receipts and November cutoff remain in force.
7. For bridge packages, the existing download endpoint additionally rechecks
   live Marketplace consent, review, exact object versions and clean evidence
   before and after fetching package bytes. A changed source blocks delivery.
   Legacy manually bound package behavior is preserved.

The new verification_basis distinguishes `clean_source_documents` from an
`archive_scan`. The service creates a STORE-only ZIP from clean source bytes;
it does not claim an additional antivirus run over the generated ZIP. The
legacy scanned_sha256 column remains a content-binding field for compatibility.
Audit records identify source evidence explicitly and contain hashes/IDs, not PII.

## Deployment and operational gates

- Apply additive source and receiver migrations before their Edge Functions.
- Deploy Marketplace `kyc-package-export` with own HMAC authentication
  (`verify_jwt=false`); no anonymous or browser request may read data.
- Deploy Handshake `prepare-kyc-package` with JWT verification enabled.
- Update `pilot-kyc-download` with live source checks and publish the new staff
  preparation button. Lender download controls do not mint public bearer URLs.
- Existing integration secrets are reused without exposing them: Marketplace
  `RIVERBANC_HANDSHAKE_HMAC_SECRET`/`RIVERBANC_HANDSHAKE_TENANT_MAP`, Handshake
  `RIVERBANC_MARKETPLACE_HMAC_SECRET`. The protocol is domain-separated from
  referral signatures; no service-role credential crosses between projects.
- Keep `private.pilot_kyc_config.enabled=false` until real scan verification
  and real recovery evidence are available. Do not populate fake references.
  No real file can be described as clean from synthetic tests.

At implementation time there are 75 Marketplace files and zero actual scan
records. The source therefore fails closed for live packages. Recovery setup
was paused by the owner. This bridge cannot truthfully be called operational
for lender downloads until those gates are resolved and a real authorized
end-to-end download is verified. It is not a substitute for that work.

## Validation

Source handler/protocol tests cover signature/lender isolation, changed bytes,
consent fingerprint changes, audit failure, safe archive names and source checks.
Fourteen isolated PostgreSQL source checks exercise actual migration functions.
Receiver tests cover staff authorization, response forgery, staff revocation and
live source checks. Thirteen new Handshake SQL checks replay with all existing
authorization suites; the existing 24 download SQL checks and 12 handler tests
continue to cover grant expiry, tenant isolation and single-use behavior.
An independent Python ZIP reader verifies archive CRC and recovered bytes.
Database fixtures and in-memory streams contain synthetic data only; no lender
or borrower is impersonated and no live package release is authorized by tests.
