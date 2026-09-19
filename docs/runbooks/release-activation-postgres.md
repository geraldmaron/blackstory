# Postgres release activation

Supabase Postgres is the system of record. Research does not activate releases.

## Architecture

| Layer | Role |
|-------|------|
| `@repo/domain` `generateReleaseArtifacts` | Deterministic artifact + bootstrap manifest generation |
| `@repo/data-access` `createPoolPostgresReleaseStore` | Immutable rows in `published.materialized_snapshots` + CAS pointer |
| `published.active_release` | Public read pointer (`apps/api-public`, `apps/web`) |
| `publication.releases.signed_manifest` | Mobile bootstrap manifest + manifest hash |
| Configured public object storage `public/releases/{id}/…` | Large artifact blobs (map GeoJSON, search index) — upload separately |

## Garbage collection policy (owner-confirmed)

`collectGarbage` / `collectGarbageAsync` retain **exactly**:

1. The **active** release
2. The **immediately-previous** release (one-deep rollback target)
3. Any ids passed via `GcOptions.retain` (pinned known-good releases)

Deeper history requires explicit pins or reviewed object lifecycle rules — not automatic GC.
This one-deep policy is intentional for launch (repo-hi8c / MOB-005).

## Operator flow (service_role)

Requires `DATABASE_URL` with publication/admin privileges (never ship to mobile clients).

Publication workers call `@repo/data-access`:

1. `generateReleaseArtifacts` (`@repo/domain`) from release-scoped Postgres projections
2. `activateReleaseAsync(store, generated)` where `store = createPoolPostgresReleaseStore(pool)`
3. Upload sealed JSON blobs to configured public object storage at paths declared in the bootstrap manifest (`public/releases/{releaseId}/…`)

A dedicated publication CLI script is **not yet wired** — ops use the tested library surface above from
admin/worker code paths. Object upload and delivery require separate runtime verification.

Verify uploaded artifact hashes, public permissions and cache headers before activation. A fixture
or database pointer change does not prove object delivery. No deployment or storage mutation is
performed merely by reading this runbook.

## Canonical convergence monitoring (repo-8yk8)

`.github/workflows/canonical-convergence-monitor.yml` dry-runs `backfill-canonical.ts --json`
and fails (alerting watchers) if any hard-fail verification counter is nonzero, or warns if a
convergence backlog (`missing_planned_claims`/`missing_planned_relationships`) is building up
unapplied. It does **not** run `--apply` itself — every hosted write against `canonical`
should go through a human-reviewed dry-run first.

Activated 2026-08-04: `HOSTED_DATABASE_URL` repo secret set (Settings → Secrets and variables →
Actions) to the same connection string `apps/web/.env.local` uses locally — read access to
`published`/`canonical` is sufficient, this workflow never writes. The twice-daily schedule
(`0 6,18 * * *`) was turned off on 2026-09-16 after it sat red on
`claims_without_evidence_link=5` (with a 2599-claim unapplied backlog) and emailed watchers
without anyone running `--apply`. Re-enable the cron only after a human `--apply` has cleared
the hard-fail counters. Until then: `gh workflow enable "Canonical Convergence Monitor"` and
`workflow_dispatch`, or run the CLI locally. If the secret is ever rotated or removed, the job
fails closed with a clear message rather than reporting a false green.

## Rollback drill

Call `rollbackToAsync(store, priorReleaseId)` from ops code with the same pool-backed store.
Re-validates every artifact hash before flipping `published.active_release`.

## Evidence

Committed under `packages/domain/fixtures/release-evidence/`:

- Two manifest samples (`rel_mob005_a`, `rel_mob005_b`)
- Size report (raw + gzip bytes per artifact kind)
- Activation + rollback log
- Failure-injection results (corrupted artifact rejection, GC one-deep)

Regenerate after intentional contract changes:

```bash
UPDATE_RELEASE_EVIDENCE=1 pnpm --filter @repo/domain test src/publication/release-evidence.test.ts
```

## Tests

```bash
pnpm --filter @repo/domain test src/publication/release-activation.test.ts
pnpm --filter @repo/data-access test
```

## Deferred (MOB-021 / owner console)

- Live Supabase integration test against `materialized_snapshots` (requires CI Postgres)
- Object upload wiring in the publication worker
- CDN `Cache-Control: immutable` verification on artifact URLs
- Physical device bootstrap sync trace
