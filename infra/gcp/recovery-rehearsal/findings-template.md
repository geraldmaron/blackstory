# Recovery rehearsal findings (BB-061)

Copy this template into the drill ticket after each rehearsal. Feed gaps back into runbooks and
infrastructure stubs — do not store secret values or raw malicious payloads.

## Drill metadata

| Field | Value |
|-------|-------|
| Date (UTC) | |
| Operator | |
| Scenario inject | |
| Compromised identity (simulated) | |
| Break-glass identity used | |
| Rehearsal mode | dry-run / staging |

## Measured recovery times

| Procedure | RTO target (min) | Measured (min) | Pass | Notes |
|-----------|------------------|----------------|------|-------|
| Block malicious traffic | 5 | | | |
| Disable submissions | 10 | | | |
| Pause queues | 15 | | | |
| Revoke deploy identity | 30 | | | |
| Rotate secrets | 60 | | | |
| Active release rollback | 120 | | | |
| Database restore (staging) | 480 | | | |
| Rebuild public projections | 240 | | | |
| Restore deleted public object | 240 | | | |

## Non-compromised path verification

- [ ] Recovery did **not** require `github-deploy` or other suspected compromised SA
- [ ] Human break-glass / `backup@` path documented and exercised
- [ ] Kill switches engaged before credential revocation where applicable

## Gaps and runbook updates

| Gap ID | Severity | Affected runbook / infra | Proposed change | Bead |
|--------|----------|--------------------------|-----------------|------|
| | | | | |

## Sign-off

- [ ] Platform operator reviewed measured times vs [`timing-matrix.json`](./timing-matrix.json)
- [ ] Security lead reviewed credential path
- [ ] Findings filed; repeat required if any critical step failed
