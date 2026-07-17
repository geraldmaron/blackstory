# Recovery rehearsal infrastructure (BB-061)

Design-only checklists and timing matrices for quarterly recovery/rollback drills. **No live GCP
restore** — pair with [`scripts/recovery-rehearsal/`](../../../scripts/recovery-rehearsal/) dry-run
scripts.

## Artifacts

| File | Purpose |
|------|---------|
| [`checklist.json`](./checklist.json) | Ordered one-developer steps with dry-run commands |
| [`timing-matrix.json`](./timing-matrix.json) | RTO/RPO targets aligned with BB-020 |
| [`break-glass-matrix.json`](./break-glass-matrix.json) | Non-compromised recovery identities |
| [`findings-template.md`](./findings-template.md) | Post-drill feedback into runbooks |

## Related docs (link only — do not duplicate)

- [`docs/runbooks/recovery-rollback-rehearsal.md`](../../../docs/runbooks/recovery-rollback-rehearsal.md)
- [`docs/runbooks/backup-restore.md`](../../../docs/runbooks/backup-restore.md)
- [`docs/runbooks/incident-response.md`](../../../docs/runbooks/incident-response.md)
- [`infra/gcp/kill-switches/`](../kill-switches/)
- [`infra/gcp/armor/emergency-deny-runbook.md`](../armor/emergency-deny-runbook.md)
- [`infra/firebase/backup/`](../../firebase/backup/)

## Validation

```bash
node --test scripts/recovery-rehearsal/*.test.mjs
node scripts/recovery-rehearsal/run-rehearsal.mjs --dry-run
```
