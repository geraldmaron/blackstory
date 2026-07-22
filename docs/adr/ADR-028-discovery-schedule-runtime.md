# ADR-028: Discovery schedule runtime (Corsair systemd + Postgres)

- **Status:** Accepted
- **Date:** 2026-07-22
- **Supersedes:** [ADR-018](./ADR-018-firebase-scheduled-functions-discovery.md) for capped discovery schedules
- **Depends on:** ADR-007, ADR-009, ADR-020
- **Does not supersede:** ADR-007 Cloud Tasks / Cloud Run Jobs model for long batch when applied

## Context

ADR-018 preferred Firebase Cloud Functions v2 `onSchedule` for capped discovery campaigns,
with Firestore kill switches and run records. After the Supabase SoR cutover (ADR-020), live
discovery already runs against Postgres research/ops tables. Operator practice settled on a
**Corsair host systemd** schedule rather than deploying Functions as the production plane.
Keeping ADR-018 “Accepted” left implementers aiming at a retired runtime.

## Decision

1. **Production capped discovery dispatch** runs on the **Corsair operator host** via **systemd
   timers/services**, invoking the operator CLI / research workers against **Postgres** (kill
   switches and campaign state in `bb_ops` / research schemas).
2. **Firebase scheduled Functions** (`functions/` / `@repo/functions-discovery`) are **retired
   as the live discovery plane**. Keep the package as a tombstone; do not wire new production
   schedules to it.
3. **Research cannot publish** remains binding (ADR-009): discovery credentials have no release
   activation or public-projection write path.
4. **Long / multi-hour campaigns** still escalate to **Cloud Run Jobs / Tasks** when that
   infrastructure is applied (ADR-007), not to App Hosting or the public web process.
5. **GitHub Actions** remains fixture smoke and manual dry-run only, not the sole production
   discovery plane.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Keep Functions as default production trigger | Conflicts with live Corsair + Postgres operations and wind-down |
| Move discovery onto App Hosting or Vercel cron | Wrong trust domain; shares public web surface (ADR-001 / ADR-009) |
| Require Cloud Run Jobs for every capped cron | Overkill for short roster jobs already proven on Corsair |

## Consequences

- Runbooks and architecture docs describe Corsair + Postgres as live discovery.
- Kill-switch and run-ledger work targets Postgres, not Firestore.
- ADR-018 remains in the index as historical context only.

## Reversibility

Two-way door: a future ADR could reintroduce a cloud scheduler (Functions or Cloud Scheduler
→ HTTP) if operator-host scheduling becomes unacceptable, provided research isolation and
Postgres SoR stay intact.
