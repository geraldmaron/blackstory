# Scheduled-job Cloud Scheduler mirror (BB-084)

Declarative Cloud Scheduler mirror of the scheduled-job registry. **Not applied** to live GCP —
apply via Terraform or `gcloud scheduler jobs create` after human review, per
[ADR-007](../../../docs/adr/ADR-007-background-workflow-model.md) (Cloud Scheduler -> Cloud
Tasks -> Cloud Run Jobs/workers).

| Artifact | Role |
|----------|------|
| [`scheduled-jobs.json`](./scheduled-jobs.json) | Machine-readable Cloud Scheduler job list: cadence, budget, timeout, idempotency scheme, kill switch, target worker |
| [`scheduled-jobs.schema.json`](./scheduled-jobs.schema.json) | JSON Schema for the job list |
| [`scheduled-jobs.test.mjs`](./scheduled-jobs.test.mjs) | Acceptance checks for the job list's invariants |

## Authoritative source

[`packages/config/src/scheduled-jobs/roster.ts`](../../../packages/config/src/scheduled-jobs/roster.ts)
is authoritative. This JSON is the Cloud-Scheduler-facing declarative projection of the same
registry, kept in sync by hand — the same convention `cost-controls-matrix.json` (BB-033) already
uses for `packages/security/src/resource-controls.ts`.

## Real vs stub

`rosterStatus: "real"` entries are wired to already-shipped, tested job bodies under
[`packages/config/src/scheduled-jobs/jobs/`](../../../packages/config/src/scheduled-jobs/jobs)
(and, for the Python-side research worker, `workers/research/src/black_book_research/
scheduled_jobs.py`). `rosterStatus: "stub"` entries have a reviewed schedule, budget, and kill
switch, but the target function does not exist yet — `implementationOwnerBead` says which bead
owns building it.

## Invariants this file cannot violate

- No job's `targetWorker.package` is outside `research` / `publication` / `security` (ADR-007:
  worker code lives only in those three packages).
- Only `citation-link-health-sweep` (BB-083) and `release-coupled-rebuild` (BB-070) declare any
  `publicEffect` other than `"none"` — the only two automatic public-facing effects this whole
  framework allows, both mechanical and reversible, each with its own kill switch.
- `environment` is always `blackbook-internal` (the BB-078/ADR-012 project name), never a numeric
  GCP project id.

## Validate

```bash
node --test infra/gcp/scheduler/scheduled-jobs.test.mjs
pnpm --filter @blap/config test
pnpm --filter @blap/config typecheck
```
