# ADR-018: Firebase scheduled Functions for discovery automation

- **Status:** Accepted
- **Date:** 2026-07-18
- **Bead:** `repo-lq0a` (decision); scaffold `repo-oy8t` (`functions/` / `@repo/functions-discovery`)
- **Supersedes (partial):** ADR-007 decision §2 insofar as it required **Cloud Run Jobs as the only** execution plane for research campaigns
- **Does not supersede:** ADR-001 (App Hosting = public web only), ADR-009 isolation invariants (research cannot publish; no research in public request paths), ADR-007 §7–8 (no sync untrusted fetch / no inline research on web/API)

## Context

ADR-007 chose Cloud Scheduler → Cloud Tasks → Cloud Run Jobs for all research campaigns. That remains valid for long batch work, but it blocked a Firebase-native path the product now wants: deploy schedules with the Firebase toolchain, use Firestore kill switches/run records we already shipped, and avoid waiting on a full Tasks/Jobs apply for every capped discovery run.

Meanwhile, operators asked to kill the rigid “not Firebase” reading of ADR-007 and align with current platform best practice.

## Research summary (2026)

| Option | Fit for discovery | Hard limits | Verdict |
|--------|-------------------|-------------|---------|
| **Firebase App Hosting** (`apps/web`) | None | Sized for Next.js SSR; shares `web-runtime` trust domain | **Reject** — wrong product and wrong SA (ADR-001 / ADR-009) |
| **Cloud Functions for Firebase v2 `onSchedule`** | Primary for capped, scheduled discovery | Scheduled/Task triggers: **max 1800s (30 min)**; HTTP functions: up to **60 min** | **Prefer** for roster jobs whose timeout ≤ 30 min (or chunked to fit) |
| **Cloud Scheduler → HTTP Cloud Function / Cloud Run service** | Same as above with explicit Scheduler | Scheduler attempt deadline also caps ~30 min for many setups | Acceptable |
| **Cloud Run Jobs** | Long fan-outs, multi-hour, custom containers | Up to days | **Keep** when a single campaign exceeds Functions scheduled timeout or needs Job parallelism |
| **GHA `schedule` / `workflow_dispatch`** | CI smoke + manual dry-runs | Runner minutes; not production research IAM | Keep as **dev/CI**, not sole production plane |

Google/Firebase guidance converges on: **Scheduler + Functions for periodic work that finishes in minutes; Cloud Run Jobs when the work must run to completion for a long time or needs a full container job model.** Gen2 scheduled Functions are already Cloud Scheduler under the hood ([Schedule functions](https://firebase.google.com/docs/functions/schedule-functions); [quotas](https://firebase.google.com/docs/functions/quotas)).

### Mapping our roster timeouts

| Job | Roster `timeoutSec` | Fits `onSchedule` (≤1800s)? |
|-----|---------------------|-----------------------------|
| `discovery-campaign-rss` | 900 | Yes |
| `community-obscurity-discovery` | 1800 | Yes (at the cap) |
| `discovery-campaign-web-search` | 3600 | **No** as one scheduled invocation — chunk (≤50 req already) into ≤30 min slices **or** HTTP function (60 min) / Cloud Run Job |
| `discovery-campaign-wikimedia-federal` | 3600 | Same |
| `discovery-campaign-archive-dpla` | 3600 | Same |

Fixture dry-runs and typical live injects finish in seconds–minutes; the 3600s roster values are worst-case budgets, not measured medians.

## Decision

1. **Kill** the exclusive reading of ADR-007 §2: research campaigns are **not** required to run only as Cloud Run Jobs.
2. **Prefer Firebase Cloud Functions v2** (`onSchedule` / secured HTTP) as the **default production trigger** for discovery dispatch (`dispatchDiscoveryCampaign`), deployed from a dedicated `functions/` (or `workers/research-functions`) package — **not** from `apps/web`.
3. Bind Functions to the **`research` service account** (or equivalent) with **no publish / public-projection / release IAM** (ADR-009).
4. Honor **`research-campaigns` Firestore kill switch** before work; persist optional run docs to `discoveryCampaignRuns` (already modeled).
5. **Escalate to Cloud Run Jobs** when a campaign must exceed scheduled-function limits, needs Job task parallelism, or a non-Functions container is mandatory — still research SA, still no publish.
6. **App Hosting never runs scrapers** (ADR-001 unchanged).
7. **GHA** remains fixture smoke + `workflow_dispatch` dry-run (already shipped); it does not replace Functions in production.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Run discovery inside App Hosting / Next route handlers | Collapses research into public web trust domain; violates ADR-001/009 and request-path rules |
| Keep Cloud Run Jobs as the only path | Blocks Firebase-native schedules; overkill for ≤30 min capped campaigns |
| Unbounded scheduled Functions without kill switch / budgets | Cost and abuse risk; fails product invariants |
| Third-party cron hitting public HTTP without auth | SSRF/abuse surface; prefer Scheduler OIDC → private function |

## Consequences

- Amend operator runbooks: production schedule = `firebase deploy --only functions:discovery` (plus human IAM), not “wait for Tasks/Jobs apply” for every discovery cron. Scaffold lives in `functions/` (`@repo/functions-discovery`).
- Chunk or split weekly jobs that may exceed 30 minutes; document per-job `timeoutSeconds` in function config (capped at 1800s on `onSchedule`).
- ADR-007 remains the model for **queues, outbox, and long Jobs**; this ADR only opens Firebase Functions as a first-class **scheduled discovery** executor.
- Local dry-runs stay on `discovery-dispatch` / GHA fixtures / `pnpm --filter @repo/functions-discovery start`.

## Migration triggers

- Move a job to Cloud Run Jobs when p95 runtime approaches 25 minutes or memory/CPU needs exceed comfortable Functions sizing.
- Revisit if Firebase changes scheduled-function deadlines or App Hosting gains a true isolated job runtime with separate SA (unlikely to replace Functions for this).

## Rollback considerations

- Disable Functions schedules / engage `research-campaigns` kill switch without touching App Hosting.
- Fall back to GHA `workflow_dispatch` + operator CLI dry-runs.
- Cloud Run Job path remains available for long campaigns.
