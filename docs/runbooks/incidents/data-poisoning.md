# Data poisoning

## Trigger and triage

- Trigger on provenance anomalies, coordinated submissions, confidence jumps, adapter-volume drift, or moderator reports.
- Identify affected sources, captures, claims, entities, campaigns, and releases; preserve original evidence.

## Contain

1. Engage `corrections-submissions`, affected source-adapter switches, `research-campaigns`, and `publication`.
2. Pause relevant queues without purge and quarantine the suspected lineage.
3. If poison reached public output, roll back to the last verified BB-019 release.

## Recover

- Demote or retract tainted claims through audited domain operations; never silently rewrite history.
- Replay only from verified evidence into preview, compare release manifests, and require human approval.
- Add the poisoning pattern to regression/evaluation fixtures before canary re-enable.
