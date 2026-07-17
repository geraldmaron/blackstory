# Runbook: Recovery and rollback rehearsal (BB-061)

**Scope:** Quarterly dry-run proving recovery procedures under pressure without live GCP restore.  
**System of record:** Firestore (ADR-011). **Not in scope:** live production import, Cloud SQL restore.

## When to run

- **Quarterly** (minimum) with platform + security.
- After material changes to kill switches, WIF, backup retention, or publication rollback paths.
- Before major releases when RTO/RPO targets change.

## Prerequisites

- Laptop with `gcloud` (authenticated break-glass identity), `node`, and repo checkout.
- Break-glass access documented in [`infra/gcp/recovery-rehearsal/break-glass-matrix.json`](../../infra/gcp/recovery-rehearsal/break-glass-matrix.json).
- **Do not** use a suspected compromised identity (e.g. `github-deploy`) for any recovery step.

## One developer checklist

Execute in order. Record start/end UTC for each row in the findings template.

| # | Procedure | RTO target | Break-glass identity | Dry-run command |
|---|-----------|------------|----------------------|-----------------|
| 1 | Declare incident + engage containment switches | 10 min | human-platform-admin | `node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step declare-and-isolate` |
| 2 | Block malicious traffic (Cloud Armor) | 5 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/block-traffic.stub.sh` |
| 3 | Disable submissions | 10 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/disable-submissions.stub.sh` |
| 4 | Pause queues (no purge) | 15 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/pause-queues.stub.sh` |
| 5 | Revoke compromised deploy identity | 30 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/revoke-deploy-identity.stub.sh` |
| 6 | Rotate secrets | 60 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/rotate-secrets.stub.sh` |
| 7 | Active release rollback (BB-019) | 120 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/release-rollback.stub.sh` |
| 8 | Database restore (staging dry-run, BB-020) | 480 min | backup-restore-sa | `bash scripts/recovery-rehearsal/stubs/database-restore.stub.sh` |
| 9 | Rebuild public projections | 240 min | human-platform-admin | `bash scripts/recovery-rehearsal/stubs/rebuild-projections.stub.sh` |
| 10 | Restore deleted public object | 240 min | backup-restore-sa | `bash scripts/recovery-rehearsal/stubs/restore-public-object.stub.sh` |
| 11 | Record findings | 30 min | security-operator | `node scripts/recovery-rehearsal/record-findings.mjs --dry-run --validate` |

### Full rehearsal (automated timing from fixtures)

```bash
node scripts/recovery-rehearsal/run-rehearsal.mjs --dry-run
node scripts/recovery-rehearsal/record-findings.mjs --dry-run --validate
```

Writes measured times to `scripts/recovery-rehearsal/fixtures/last-rehearsal-report.json`.

## Non-compromised recovery path

Critical recovery **must not** depend on the compromised service account:

1. Assume `github-deploy` is untrusted for the drill inject.
2. Use **human-platform-admin** (IAP) for switches, Armor, credential disable, Secret Manager.
3. Use **backup@** only for export read / staging import (human-executed gcloud).
4. Publication rollback uses operator path with `publication` kill switch — not `api-internal` if tainted.

See [`break-glass-matrix.json`](../../infra/gcp/recovery-rehearsal/break-glass-matrix.json).

## Verification commands

| Check | Command | Pass criteria |
|-------|---------|---------------|
| All steps verify | `node scripts/recovery-rehearsal/run-rehearsal.mjs --dry-run` | Exit 0; `allWithinRto: true` |
| DB export metadata | `node scripts/backup-restore/verify-restore.mjs --metadata ...` | Counts + hashes match |
| Prior release manifest | `--verify-only --step active-release-rollback` | Pointer + envelope ok |
| No compromised SA in report | Inspect `last-rehearsal-report.json` | No `github-deploy` in `breakGlassIdentity` |
| Unit tests | `node --test scripts/recovery-rehearsal/*.test.mjs` | All pass |

## Findings feedback loop

1. Copy [`findings-template.md`](../../infra/gcp/recovery-rehearsal/findings-template.md) into the drill ticket.
2. Fill measured times from `last-rehearsal-report.json`.
3. File gaps as Beads; update linked runbooks/infra stubs (not live GCP from this bead).

## RTO/RPO reference

Targets align with [`infra/firebase/backup/rpo-rto.md`](../../infra/firebase/backup/rpo-rto.md) and
[`infra/gcp/recovery-rehearsal/timing-matrix.json`](../../infra/gcp/recovery-rehearsal/timing-matrix.json).

## References (link only)

- [`backup-restore.md`](./backup-restore.md) — Firestore export restore (BB-020)
- [`incident-response.md`](./incident-response.md) — kill switches and containment order (BB-035)
- [`infra/gcp/kill-switches/`](../../infra/gcp/kill-switches/)
- [`infra/gcp/armor/emergency-deny-runbook.md`](../../infra/gcp/armor/emergency-deny-runbook.md)
- [`infra/firebase/backup/`](../../infra/firebase/backup/)
- [`scripts/recovery-rehearsal/`](../scripts/recovery-rehearsal/)
