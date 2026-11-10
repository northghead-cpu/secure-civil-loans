# Marketplace PR 5: Admin KYC path hardening

Reconciled against the November 10, 2026 production baseline.

The current UsersApplications view composes HandoffQueue and LegacyApplications. Filename allowlisting, traversal rejection, cleared document state and listing-error handling live in src/pages/admin/LegacyApplications.tsx. Preserve its authenticated private document reads instead of restoring the draft's signed-URL implementation.

The original branch history is retained through a merge commit. This resolution adds this note and keeps the current implementation; it does not apply production database changes or delete customer records, documents or audit history.
