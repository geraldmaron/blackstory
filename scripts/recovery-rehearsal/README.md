# Recovery rehearsal scripts (BB-061)

Dry-run recovery and rollback rehearsal. **No live GCP restore** — simulates timing from fixtures and validates break-glass paths.

## Commands

```bash
# Unit tests
node --test scripts/recovery-rehearsal/*.test.mjs

# Full dry-run rehearsal + timing report
node scripts/recovery-rehearsal/run-rehearsal.mjs --dry-run

# Single step verification
node scripts/recovery-rehearsal/run-rehearsal.mjs --verify-only --step database-restore

# Findings draft from last report
node scripts/recovery-rehearsal/record-findings.mjs --dry-run --validate

# Procedure stubs (print-only)
bash scripts/recovery-rehearsal/stubs/block-traffic.stub.sh
bash scripts/recovery-rehearsal/stubs/database-restore.stub.sh
```

## Artifacts

| Path | Purpose |
|------|---------|
| `run-rehearsal.mjs` | Main runner; writes `fixtures/last-rehearsal-report.json` |
| `record-findings.mjs` | Renders findings markdown from timing report |
| `lib/rehearsal.mjs` | Verification + timing aggregation |
| `fixtures/rehearsal-scenario.json` | Drill inject + simulated durations |
| `stubs/*.stub.sh` | Print-only human commands per procedure |

## Related docs

- [`docs/runbooks/recovery-rollback-rehearsal.md`](../../docs/runbooks/recovery-rollback-rehearsal.md)
- [`infra/gcp/recovery-rehearsal/`](../../infra/gcp/recovery-rehearsal/)
