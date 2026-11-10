# Marketplace PR 11: Admin route capability guards

Reconciled against the November 10, 2026 production baseline.

Current src/App.tsx wraps sensitive routes with ProtectedAdminRoute capability checks and AdminMfaGate. Preserve those boundaries, the current ROLE_PERMISSIONS matrix, account-status checks and recovery-session handling. The draft's older ProtectedRoute and role matrix would regress newer protections.

The original branch history is retained through a merge commit. This resolution adds this note and keeps the current implementation; it does not apply production database changes or delete customer records, documents or audit history.
