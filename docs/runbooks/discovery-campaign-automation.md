# Discovery campaign automation

Firebase-first control plane for roster discovery jobs. Scrapers do **not** run on App Hosting
(ADR-001 / ADR-009). Per **ADR-018**, production schedules prefer **Firebase Functions v2
`onSchedule`** (research SA); Cloud Run Jobs remain for long/heavy batch. Automation layers:

1. **Dispatcher** (`@repo/config` `dispatchDiscoveryCampaign`) — roster gate + `research-campaigns` kill switch
2. **Firestore** — `killSwitches/research-campaigns` + optional `discoveryCampaignRuns/{runId}`
3. **Firebase Functions v2** — preferred production cron (`functions/` / `@repo/functions-discovery`)
4. **GHA** — `workflow_dispatch` + weekly **fixture** smoke for community obscurity (dev/CI)
5. **Cloud Run Job** (`workers/research-node`) — escalate when a run may exceed ~30 minutes

Live network fetch is still “download then inject” for RSS/ABS/IA/DPLA/Brave JSON. Wikimedia+federal automation uses committed fixtures until live clients ship.

## Local / CI fixture dispatch

```bash
cd ~/Developer/Projects/blackstory

# Prefer operator-cli
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch \
  --job community-obscurity-discovery --mode fixture

# Or config CLI
node --conditions development --import tsx \
  packages/config/src/scheduled-jobs/discovery-dispatcher-cli.ts \
  --job discovery-campaign-wikimedia-federal --mode fixture

# Kill switch engagé skips work
DISCOVERY_KILL_SWITCH=engaged node --conditions development --import tsx \
  packages/config/src/scheduled-jobs/discovery-dispatcher-cli.ts \
  --job discovery-campaign-rss --mode fixture
```

Job ids: `community-obscurity-discovery`, `discovery-campaign-rss`,
`discovery-campaign-wikimedia-federal`, `discovery-campaign-archive-dpla`,
`discovery-campaign-web-search`.

## Live mode (capped, injected files)

| Job | Env |
|-----|-----|
| community-obscurity / rss | `DISCOVERY_FEED_XML=/path/to/feed.xml` |
| archive-dpla | `DISCOVERY_IA_JSON=…` and/or `DISCOVERY_DPLA_JSON=…` |
| web-search | `DISCOVERY_BRAVE_JSON=…` **and** `DISCOVERY_STORAGE_TERMS_CONFIRMED=true` (only after written Brave storage-rights) |
| wikimedia-federal | fixture fan-out only (no live clients yet) |

Example ABS live:

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
curl -fsSL -A "$UA" 'https://theamericanblackstory.com/feed/' -o /tmp/abs-feed.xml
DISCOVERY_FEED_XML=/tmp/abs-feed.xml \
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch \
  --job community-obscurity-discovery --mode live
```

## GitHub Actions

Workflow: `.github/workflows/discovery-campaigns.yml`

- **Manual:** Actions → Discovery campaigns → Run workflow (pick job + fixture|live)
- **Weekly:** Sundays 10:15 UTC — `community-obscurity-discovery` **fixture only**

GHA sets `DISCOVERY_KILL_SWITCH=disengaged` for the runner. Production should read Firestore.

## Firebase kill switch

Collection: `killSwitches/research-campaigns`

| `enabled` | Meaning |
|-----------|---------|
| `true` | Engaged — dispatcher skips campaigns |
| `false` | Disengaged — campaigns may run |
| **missing** | Fail-closed **deny** (treat as engaged) |

Materialize the doc in each environment so operators can explicitly disengage:

```text
killSwitches/research-campaigns
  id: research-campaigns
  enabled: false
  reason: "Allow discovery automation"
  updatedAt: <ISO>
```

Optional run persistence: `discoveryCampaignRuns/{runId}` (`publicEffect: none` only). See `infra/firebase/FIRESTORE_MODEL.md`.

## Production schedule (Firebase Functions — preferred)

Per **ADR-018**, production discovery crons deploy as Cloud Functions for Firebase v2
(`onSchedule`) from `functions/` (package `@repo/functions-discovery`).

App Hosting does **not** host these functions. Each roster job has a scheduled export;
timeouts are capped at **1800s**. Escalate to Cloud Run Jobs when a single run needs longer.

```bash
pnpm --filter @repo/functions-discovery test
pnpm --filter @repo/functions-discovery build
# Human apply (research SA; kill switch doc materialised):
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy \
  --only functions:discovery \
  --config firebase.discovery.json \
  --project <project-id>
```

Local fixture invoke: `DISCOVERY_JOB_ID=discovery-campaign-rss pnpm --filter @repo/functions-discovery start`

Until Functions are deployed in GCP: use GHA `workflow_dispatch` + operator `discovery-dispatch`.

### Deployed (2026-07-18)

Project `black-book-efaaf`, codebase `discovery`, region `us-central1` — all five scheduled
functions created.

| Control | State |
|---------|--------|
| `killSwitches/research-campaigns` | Materialized with **`enabled: false`** (schedules may run) |
| `DISCOVERY_MODE` | Default **fixture** |
| Artifact Registry cleanup | **7-day** policy on `gcf-artifacts` / `us-central1` |
| Runtime SA | Still App Engine default until `research@black-book-efaaf.iam.gserviceaccount.com` exists and is bound via `DISCOVERY_RESEARCH_SA` + redeploy (`gcloud auth login` required for SA create) |

Pause schedules anytime: set `killSwitches/research-campaigns.enabled` to `true`.

## Cloud Run Job (human apply) — long campaigns

Prefer **Firebase Functions v2 `onSchedule`** for capped discovery (ADR-018). Use `workers/research-node` Cloud Run Jobs when a single run may exceed **30 minutes** or needs Job parallelism.

Image build from `workers/research-node/Dockerfile`. Env:

- `DISCOVERY_JOB_ID` (required)
- `DISCOVERY_MODE` = `fixture` \| `live` (default fixture)
- `DISCOVERY_KILL_SWITCH` = `engaged` \| `disengaged` (prefer Firestore in prod)
- Optional payload paths as above

Identity: `research@` SA — no publish IAM (ADR-009).

### Scheduler apply (not automatic)

`infra/gcp/scheduler/scheduled-jobs.json` remains `"status": "design"` until a human apply:

1. Confirm kill switch doc exists and is disengaged when intended
2. Build/push research-node image
3. Create Cloud Run Job with env + SA
4. Create Cloud Scheduler jobs matching roster crons → invoke Run Job / Tasks
5. Pause with `research-campaigns` kill switch or Cloud Tasks queue pause (hard-stop runbook)

Do **not** put discovery on App Hosting.

## Caps

Roster budgets still apply (RSS 100, wikimedia/archive 500, web-search 50 requests). Dispatcher passes through job wrappers.
