# Firebase Functions discovery schedules (ADR-018)

Scheduled Cloud Functions for Firebase v2 that call `dispatchDiscoveryCampaign`.
Research identity only — **never** publish; **never** deploy onto App Hosting.

Web-search defaults to **SearXNG** (fixture bundled; live via `SEARXNG_BASE_URL` on a
Tailscale peer). GCP Functions cannot reach Corsair Tailscale without a VPN — keep
`DISCOVERY_MODE=fixture` in production until that exists; use the Mac launchd agent
(`scripts/com.blackstory.discovery-web-search.plist`) for live daily SearXNG runs.

## Local

```bash
# From monorepo root
pnpm install
pnpm --filter @repo/functions-discovery test
pnpm --filter @repo/functions-discovery typecheck
pnpm --filter @repo/functions-discovery build

# Fixture invoke (kill switch disengaged via env)
DISCOVERY_JOB_ID=discovery-campaign-rss \
  pnpm --filter @repo/functions-discovery start

# Web-search fixture (SearXNG)
DISCOVERY_JOB_ID=discovery-campaign-web-search \
  pnpm --filter @repo/functions-discovery start

# Live SearXNG (Corsair Tailscale — same entry as onSchedule)
SEARXNG_BASE_URL=http://100.119.72.84:8888 \
DISCOVERY_MODE=live \
DISCOVERY_STORAGE_TERMS_CONFIRMED=true \
DISCOVERY_JOB_ID=discovery-campaign-web-search \
  pnpm --filter @repo/functions-discovery start

# Or the scheduled wrapper:
./scripts/run-scheduled-searxng-discovery.sh
```

## Deploy (human apply)

1. Materialize `killSwitches/research-campaigns` with `enabled: false` when runs are intended.
2. Bind research SA (no publish IAM): set `DISCOVERY_RESEARCH_SA=research@PROJECT.iam.gserviceaccount.com`.
3. Keep `DISCOVERY_MODE=fixture` until live inject paths are ready (or Tailscale/VPN to SearXNG).
4. Build + deploy:

```bash
pnpm --filter @repo/functions-discovery build
FIREBASE_CLI_DISABLE_UPDATE_CHECK=true firebase deploy \
  --only functions:discovery \
  --config firebase.discovery.json \
  --project <project-id>
```

Roster jobs with `timeoutSec` 3600 are capped at **1800s** on `onSchedule`. Escalate to
Cloud Run Jobs (`workers/research-node`) or chunked HTTP when a single run needs longer.

## Schedules

| Export | Job id | Cron (UTC) |
|--------|--------|------------|
| `discoveryCampaignRss` | `discovery-campaign-rss` | `0 * * * *` |
| `communityObscurityDiscovery` | `community-obscurity-discovery` | `0 10 * * 0` |
| `discoveryCampaignWikimediaFederal` | `discovery-campaign-wikimedia-federal` | `0 6 * * 1` |
| `discoveryCampaignArchiveDpla` | `discovery-campaign-archive-dpla` | `0 7 * * 2` |
| `discoveryCampaignWebSearch` | `discovery-campaign-web-search` | `30 8 * * *` |

Live SearXNG daily (Mac Tailscale peer): install
`scripts/com.blackstory.discovery-web-search.plist` into `~/Library/LaunchAgents/`.

See `docs/runbooks/discovery-campaign-automation.md` and ADR-018.
