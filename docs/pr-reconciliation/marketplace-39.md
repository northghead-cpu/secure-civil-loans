# Role-loading branch reconciliation

The current-main fix in PR73 handles query errors, rejected promises, session changes and stale responses without altering the role matrix. Retain that implementation and carry this branch's role-loading regression tests so both historical fixes are reconciled.

The current role/capability matrix and all database and KYC protections are retained.
