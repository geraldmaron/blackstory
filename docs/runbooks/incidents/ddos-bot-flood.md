# DDoS or bot flood

## Trigger and triage

- Trigger on sustained QPS, cache-miss, 429/5xx, queue-depth, or cost burn anomalies.
- Confirm affected routes, regions, fingerprints, and whether origin saturation or data integrity is at risk.

## Contain

1. Engage research campaigns, LLM, geocoding, nearby, uploads, exports, and affected adapters.
2. Engage `corrections-submissions` and `search` if pressure persists.
3. Apply reviewed  edge rules and pause affected queues without purging.
4. If origins remain unsafe, engage `public-static-mode`; keep immutable release snapshots online.

## Recover

- Tighten quotas/cache policy, remove only verified abusive blocks, and canary dynamic reads before writes.
- Confirm backlog age, billing burn, error rate, and public snapshot health before full resume.
- Preserve request samples with credentials and personal data redacted.
