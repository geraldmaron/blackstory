# research-node (Node discovery worker)

Node-side packaging for scheduled discovery campaign dispatch. The worker is a thin entry that
reads `DISCOVERY_*` environment variables and calls `dispatchDiscoveryCampaign` from `@repo/config`
(or `packages/config/src/scheduled-jobs/discovery-dispatcher.ts` until the export lands).

Discovery jobs produce **private candidates only** and must **never publish**.

## Entry points

| Surface | Command |
|---|---|
| Corsair systemd / manual | `scripts/run-scheduled-searxng-discovery.sh` (preferred production path) |
| Cloud Run Job (legacy packaging) | `workers/research-node/src/main.ts` (Docker `CMD`) |
| GitHub Actions | `.github/workflows/discovery-campaigns.yml` |
| Local / CI CLI | `node --conditions development --import tsx packages/config/src/scheduled-jobs/discovery-dispatcher-cli.ts --job <id> --mode fixture` |
| Operator CLI (preferred once wired) | `node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch --job <id> --mode fixture` |

Run CLI commands from the **monorepo root** after `pnpm install --frozen-lockfile`.

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `OPS_DATA_SOURCE` | yes (live) | — | Must be `postgres`; Firestore dispatch is retired |
| `DATABASE_URL` | yes (live) | — | Scoped server-only URL |
| `DISCOVERY_JOB_ID` | yes | — | Roster id, e.g. `community-obscurity-discovery` |
| `DISCOVERY_MODE` | no | `fixture` | `fixture` or `live` |
| `DISCOVERY_KILL_SWITCH` | no | `disengaged` | `engaged` skips dispatch; production reads `bb_ops.kill_switches` |
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

**Live production cadences** (hourly RSS, weekly federal/archive, daily web search, etc.) run on
**Corsair systemd** (`docs/runbooks/discovery-campaign-automation.md`), not Cloud Scheduler →
Firestore. The retired Cloud Functions scheduler package is a tombstone only.

## Docker / Cloud Run Job

Build from repo root:

```bash
docker build -f workers/research-node/Dockerfile -t blackstory-research-node .
```

Run locally (requires `dispatchDiscoveryCampaign` to exist):

```bash
docker run --rm \
  -e OPS_DATA_SOURCE=postgres \
  -e DATABASE_URL=postgresql://example.invalid/postgres \
  -e DISCOVERY_JOB_ID=community-obscurity-discovery \
  -e DISCOVERY_MODE=fixture \
  -e DISCOVERY_KILL_SWITCH=disengaged \
  blackstory-research-node
```

Production checklist:

- Run `operator-cli preflight` before live dispatch; fail closed when ledger tables are missing.
- Resolve kill switches from **`bb_ops.kill_switches`**, not Firestore.
- Set `DISCOVERY_MODE=live` only on approved production hosts.
- Never grant publication or public-write scopes to this worker.

## Local example

```bash
pnpm install --frozen-lockfile
OPS_DATA_SOURCE=postgres \
DATABASE_URL=postgresql://example.invalid/postgres \
DISCOVERY_JOB_ID=community-obscurity-discovery \
DISCOVERY_MODE=fixture \
DISCOVERY_KILL_SWITCH=disengaged \
node --conditions development --import tsx workers/research-node/src/main.ts
```
