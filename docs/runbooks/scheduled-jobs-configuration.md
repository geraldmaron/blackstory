# Scheduled jobs configuration

BlackStory scheduled jobs share one authoritative registry. Cloud Scheduler JSON, systemd timers,
and operator runbooks are projections of that registry — not independent sources of truth.

## Single source of truth

**Authoritative file:** [`packages/config/src/scheduled-jobs/roster.ts`](../../packages/config/src/scheduled-jobs/roster.ts)

Each entry defines:

| Field | Purpose |
|---|---|
| `id` | Stable job identifier used in run records, kill switches, and dispatch |
| `cadence.cronExpression` | UTC cron schedule |
| `cadence.humanReadable` | Operator-facing label |
| `budget` | Per-run cap (`requests`, `candidates`, `claims`, etc.) |
| `timeoutSec` | Maximum wall-clock time |
| `idempotencyKeyScheme` | Replay protection template |
| `killSwitchId` | Fail-closed gate (see below) |
| `targetWorker` | Research worker package + function |
| `publicEffect` | Allowed automatic public writes (`none` for almost all jobs) |
| `rosterStatus` | `real` (handler exists) or `stub` (schedule declared, handler pending) |

Import the registry from `@repo/config/scheduled-jobs`:

```typescript
import {
  DEFAULT_SCHEDULED_JOBS,
  scheduledJobKillSwitchId,
  requireScheduledJob,
} from '@repo/config/scheduled-jobs';
```

Job bodies (pure policy layers) live under
[`packages/config/src/scheduled-jobs/jobs/`](../../packages/config/src/scheduled-jobs/jobs/).

## Adding or changing a schedule

1. **Edit `roster.ts`** — add or update the job entry with cadence, budget, kill switch, and
   target worker.
2. **Add a job body** (if `rosterStatus: 'real'`) — implement `run*Job` in
   `jobs/<name>.ts` and export from [`index.ts`](../../packages/config/src/scheduled-jobs/index.ts).
3. **Mirror to GCP JSON** — copy the same fields into
   [`infra/gcp/scheduler/scheduled-jobs.json`](../../infra/gcp/scheduler/scheduled-jobs.json).
   Keep `killSwitchId`, cron, budget, and `targetWorker` in sync by hand (same convention as
   cost-controls matrix mirroring).
4. **Wire the runner** — see “Live runners” below. Declaring a schedule does not execute it.
5. **Add tests** — roster invariants (`roster.test.ts`) and job-body unit tests under `jobs/`.
6. **Document** — add or update a runbook under `docs/runbooks/` when operators need run steps.

### Cron changes

Use valid five-field cron expressions. Validate with `isValidCronExpression` from
`@repo/config/scheduled-jobs`. Document the human-readable cadence in both `roster.ts` and the
GCP mirror.

### Budget changes

`budget.maxPerRun` is enforced by health evaluation (`evaluateJobBudget`) and should align with
the job body’s actual I/O (e.g. URL checks, candidate counts). Raise budgets only with an
operator note in the runbook.

## GCP Scheduler mirror

[`infra/gcp/scheduler/scheduled-jobs.json`](../../infra/gcp/scheduler/scheduled-jobs.json) is a
**declarative projection** for future Terraform / `gcloud scheduler jobs create` apply. It is not
live until a human applies it per ADR-007 (Cloud Scheduler → Cloud Tasks → Cloud Run Jobs).

When editing:

- Insert new jobs in the same order as `roster.ts` when practical.
- Set `policyPackageRef` unchanged — it points back to `roster.ts`.
- Use `rosterStatus: "real"` only when the target worker function exists.

## Live runners today

| Runner | Jobs covered | Notes |
|---|---|---|
| Corsair systemd + SearXNG | Discovery campaign jobs (`discovery-campaign-*`) | [`discovery-campaign-automation.md`](./discovery-campaign-automation.md) |
| Research worker (Python) | Dataset refresh, adapter pipelines | Must implement `targetWorker.function` |
| Manual / operator CLI | Ad-hoc dispatch, drills | Backup verification, restore drill |

Most roster entries beyond Corsair discovery **do not yet have production cron wiring**. A
`rosterStatus: 'real'` TypeScript job body can exist while the Cloud Scheduler entry remains
design-only in GCP JSON.

Do **not** use Supabase `pg_cron` for these jobs. Scheduling belongs in the config registry and
external orchestration (GCP Scheduler, systemd), not in Postgres.

## Kill switches

Every job has a `killSwitchId`. Non-discovery jobs mint ids via:

```typescript
scheduledJobKillSwitchId('your-job-id');
// → source-adapter-your-job-id
```

Discovery campaigns reuse the shared `research-campaigns` switch.

Evaluation is fail-closed: missing or engaged switches deny dispatch. Operators toggle state in
`bb_ops.kill_switches` (see [`discovery-campaign-automation.md`](./discovery-campaign-automation.md)).

## Public effects

Only two automatic public effects are allowed platform-wide:

- `link-repair-archived-copy` (citation link-health sweep)
- `release-coupled-rebuild`

All other jobs, including banned-books refresh and external dataset checks, use `publicEffect:
'none'`. Outputs are private proposals, reports, or flags for human review.

## Related runbooks

- [Banned books refresh](./banned-books-refresh.md)
- [Discovery campaign automation](./discovery-campaign-automation.md)
- [`infra/gcp/scheduler/README.md`](../../infra/gcp/scheduler/README.md)
