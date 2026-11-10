# Marketplace PR 20: Migration history reconciliation

Reconciled against the November 10, 2026 production baseline.

Preserve every current migration file and its full SQL. The historical preview repair includes placeholders and alternate timestamp names that have since been reconciled. Do not replace implemented migrations with no-op placeholders, remove migration files or rerun historical repairs against production. Existing database replay regressions remain the validation boundary.

The original branch history is retained through a merge commit. This resolution adds this note and keeps the current implementation; it does not apply production database changes or delete customer records, documents or audit history.

## November 10 follow-up

The merged PR closed its ephemeral preview automatically. Production has 174
recorded migrations, all with 14-digit versions; its ledger was not modified.
Three repository SQL bodies were token-compared with their recorded production
statements and moved unchanged to the matching canonical versions. This removes
two short versions and one duplicate version. Comment-only aliases cover the
other recorded versions missing from Git. Existing SQL implementations remain
intact. The fixture contains metadata and source hashes, not customer records.

The read-only CI check detects malformed/duplicate versions, missing observed
production records and changed canonicalized SQL. Repository migrations absent
from the production ledger remain explicitly unrecorded: this change does not
mark them applied, execute historical SQL, reset a database or recreate a paid
preview. A hosted preview rerun is still required to validate its complete
deployment flow. No failed historical check is relabelled as successful.
