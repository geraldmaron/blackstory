# Disable public beta / return to static read-only

**Goal:** Stop dynamic public beta quickly without redeploying product code. Immutable public corpus snapshots remain available.

## Fast path (Vercel env — ~minutes)

1. Open Vercel dashboard → project `blackstory` → Settings → Environment Variables.
2. Set **`PUBLIC_READ_API_DISABLED=1`** on **Production** (and Preview if testing).
3. **Redeploy** Production — existing deployments keep the prior env snapshot until redeployed.
4. Verify: public pages show the degraded/snapshot banner (`apps/web/src/lib/runtime-hardening/degraded-mode.ts`).

This disables dynamic public read APIs while static entity snapshots and trust copy remain served.

## Containment path (kill switches — operator control plane)

Engage switches in **containment order** (see `packages/config/src/kill-switches.ts`):

1. `corrections-submissions` — stop intake
2. `search` — stop dynamic search
3. `geocoding` / `nearby-location` — stop location expansion
4. **`public-static-mode`** — force read-only serving from immutable release snapshots

Firestore documents: `killSwitches/{id}` (see `infra/gcp/kill-switches/README.md`).

When `public-static-mode` is engaged, dynamic workloads are denied with reason `static-read-only`; the immutable corpus stays online.

## Rollback of disable

1. Clear `PUBLIC_READ_API_DISABLED` (set to `0`) after threat is contained.
2. Redeploy Production on Vercel.
3. Disengage `public-static-mode` and other switches in reverse containment order.
4. Run post-enable health checks (`infra/github/release-pipeline/health-check-dry-run.mjs`).

## Config keys asserted at launch

| Control | Key | Location |
|---------|-----|----------|
| Vercel env | `PUBLIC_READ_API_DISABLED` | Vercel project env (Production) |
| Kill switch | `public-static-mode` | `packages/config/src/kill-switches.ts` |

Machine gate `beta-disable-path-ready` verifies these keys and this runbook exist before beta GO.

## Related runbooks

- [Incident response](../runbooks/incident-response.md)
- [DDoS / bot flood](../runbooks/incidents/ddos-bot-flood.md)
- [Production release](../runbooks/production-release.md)
