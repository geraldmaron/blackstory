# research-node (Node discovery worker)

Node-side packaging for scheduled discovery campaign dispatch. The worker is a thin Cloud Run
Job entry that reads `DISCOVERY_*` environment variables and calls
`dispatchDiscoveryCampaign` from `@repo/config` (or
`packages/config/src/scheduled-jobs/discovery-dispatcher.ts` until the export lands).

Discovery jobs produce **private candidates only** and must **never publish**.

## Entry points

| Surface | Command |
|---|---|
| Cloud Run Job | `workers/research-node/src/main.ts` (Docker `CMD`) |
| GitHub Actions | `.github/workflows/discovery-campaigns.yml` |
| Local / CI CLI | `node --conditions development --import tsx packages/config/src/scheduled-jobs/discovery-dispatcher-cli.ts --job <id> --mode fixture` |
| Operator CLI (preferred once wired) | `node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch --job <id> --mode fixture` |

Run CLI commands from the **monorepo root** after `pnpm install --frozen-lockfile`.

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DISCOVERY_JOB_ID` | yes | — | Roster id, e.g. `community-obscurity-discovery` |
| `DISCOVERY_MODE` | no | `fixture` | `fixture` or `live` |
| `DISCOVERY_KILL_SWITCH` | no | `disengaged` | `engaged` skips dispatch; production should read Firestore |
| `DISCOVERY_JOB_RUN_ID` | no | — | Optional run correlation id |
| `DISCOVERY_NOW_ISO` | no | — | Optional clock override for tests |

Exit codes: `0` on `status: success`; `1` on `skipped_kill_switch`, `error`, or thrown failure.

## Supported job ids

- `discovery-campaign-rss`
- `discovery-campaign-wikimedia-federal`
- `discovery-campaign-archive-dpla`
- `discovery-campaign-web-search`
- `community-obscurity-discovery`

## GitHub Actions

Workflow **Discovery campaigns** (`.github/workflows/discovery-campaigns.yml`):

- **workflow_dispatch** — choose any roster job and `fixture` or `live` mode.
- **schedule** — Sundays 10:15 UTC, `community-obscurity-discovery` in **fixture** mode only
  (safe smoke; no live network).

**Live production cadences** (hourly RSS, weekly federal/archive, daily web search, etc.) stay
on **GCP Cloud Scheduler → Cloud Run Job**, not GitHub schedule triggers.

## Docker / Cloud Run Job

Build from repo root:

```bash
docker build -f workers/research-node/Dockerfile -t blackstory-research-node .
```

Run locally (requires `dispatchDiscoveryCampaign` to exist):

```bash
docker run --rm \
  -e DISCOVERY_JOB_ID=community-obscurity-discovery \
  -e DISCOVERY_MODE=fixture \
  -e DISCOVERY_KILL_SWITCH=disengaged \
  blackstory-research-node
```

Production checklist:

- Run as the **research@** service account (Firestore + campaign budgets).
- Resolve kill switches from **Firestore**, not the `DISCOVERY_KILL_SWITCH` env default.
- Set `DISCOVERY_MODE=live` only on Scheduler-triggered production jobs.
- Never grant publication or public-write scopes to this worker.

## Local example

```bash
pnpm install --frozen-lockfile
DISCOVERY_JOB_ID=community-obscurity-discovery \
DISCOVERY_MODE=fixture \
DISCOVERY_KILL_SWITCH=disengaged \
node --conditions development --import tsx workers/research-node/src/main.ts
```
