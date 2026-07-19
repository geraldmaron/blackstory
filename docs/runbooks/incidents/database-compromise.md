# Database compromise

## Trigger and triage

- Trigger on unauthorized Firestore reads/writes, rules/IAM changes, bulk mutation, or audit-log gaps.
- Identify collections, principals, operations, and time range; preserve Cloud Audit Logs and exports.

## Contain

1. Engage `publication`, submissions, research, exports, uploads, and queue processing.
2. Enter `public-static-mode` so immutable snapshots remain readable without canonical access.
3. Revoke affected Firestore identities/bindings independently and block further canonical mutation.

## Recover

- Roll public output back with  when sufficient; use [`../backup-restore.md`](../backup-restore.md) PITR/export recovery for canonical corruption.
- Restore into an isolated database first, verify counts/hashes and release manifests, then perform a controlled migration.
- Rotate reachable credentials, repair rules/IAM, and canary read-only access before writes.
