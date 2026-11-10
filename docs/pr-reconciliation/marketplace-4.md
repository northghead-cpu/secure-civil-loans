# Marketplace PR 4: KYC path hardening

Reconciled against the November 10, 2026 production baseline.

The former AdminPortal was replaced by the current admin handoff and legacy application views. Keep the filename allowlist in src/pages/admin/LegacyApplications.tsx and authenticated no-store reads in src/lib/privateStorageDocuments.ts. Do not restore the removed legacy portal or hour-long signed URLs. Preserve the current dependency lockfiles and audit gate without advisory exceptions.

The original branch history is retained through a merge commit. This resolution adds this note and keeps the current implementation; it does not apply production database changes or delete customer records, documents or audit history.
