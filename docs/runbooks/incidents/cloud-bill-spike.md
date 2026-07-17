# Cloud bill spike

## Trigger and triage

- Trigger on budget/burn alerts, unexpected instance growth, provider-token spend, egress, or queue fan-out.
- Attribute spend by project, service, feature, credential, region, and time; distinguish attack from defect.

## Contain

1. Engage research, LLM, geocoding, nearby, uploads, exports, and source adapters first.
2. Pause high-cost queues without purge; then disable submissions/search if burn continues.
3. Enter static mode before disabling public serving; immutable snapshots should remain available.
4. Apply reviewed BB-033 caps and revoke any abused provider credential independently.

## Recover

- Fix fan-out/retry/cache defects and reconcile queued work before canary resume.
- Restore public reads first, then essential operations, then optional workloads one at a time.
- Record avoided/actual spend and adjust alerts only with evidence.
