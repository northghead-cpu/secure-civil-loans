# Recorded migration history

The active `supabase/migrations` directory follows the 174 versions observed on
Marketplace production on 2026-11-10. No production ledger row was inserted,
updated or deleted by this reconciliation.

- 149 active files contain the SQL stored in the production migration ledger.
- 25 older ledger rows have null statements. Their existing repository SQL is
  retained explicitly; missing SQL is not invented.
- All 223 original files are retained byte-for-byte in `archive/2026-11-10`.
  This includes all 49 versions absent from the production ledger.
- `reconciliation.json` records canonical and archived SHA-256 hashes, SQL
  provenance and exact-match candidates. No customer records or credentials
  are included.

The archive is outside the CLI migration discovery directory. Never execute it
against production: historical variants can overwrite newer security controls,
and some contain obsolete demo cleanup operations. Keeping their bytes does
not declare them applied.

The read-only CI check rejects malformed or duplicate versions, missing recorded
versions, out-of-order historical SQL, modified canonical SQL and changed or
missing archived files. A genuinely new migration with a later version remains
pending normally. When applying a new migration, keep the repository version
aligned with the version actually recorded by Supabase; do not repair history
by deleting rows or resetting a database.

The deleted PR20 preview is not recreated. This change verifies history matching,
source preservation and isolated SQL/security regressions; it does not claim a
fresh hosted reset/replay or a paid preview deployment passed. A clean-room
bootstrap needs separate validation because some legacy SQL was never recorded
by the provider. Keep the historical bootstrap sources in the archive.
