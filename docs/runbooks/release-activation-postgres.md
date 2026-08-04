# Release activation — Postgres SoR (MOB-005)

Publication workers activate immutable mobile bootstrap + map/content artifacts through the
Postgres system of record after ADR-020 cutover. Firestore `createFirestoreReleaseStore` remains
an explicit opt-in rollback path only — do not dual-write canonical truth to both stores.

## Architecture

| Layer | Role |
|-------|------|
| `@repo/domain` `generateReleaseArtifacts` | Deterministic artifact + bootstrap manifest generation |
| `@repo/data-access` `createPoolPostgresReleaseStore` | Immutable rows in `bb_public.materialized_snapshots` + CAS pointer |
| `bb_public.active_release` | Public read pointer (`apps/api-public`, `apps/web`) |
| `bb_publication.releases.signed_manifest` | Mobile bootstrap manifest + manifest hash |
| GCS / Firebase Storage `public/releases/{id}/…` | Large artifact blobs (map GeoJSON, search index) — upload separately |

## Garbage collection policy (owner-confirmed)

`collectGarbage` / `collectGarbageAsync` retain **exactly**:

1. The **active** release
2. The **immediately-previous** release (one-deep rollback target)
3. Any ids passed via `GcOptions.retain` (pinned known-good releases)

Deeper history requires explicit pins or GCS object lifecycle rules — not automatic GC.
This one-deep policy is intentional for launch (repo-hi8c / MOB-005).

## Operator flow (service_role)

Requires `DATABASE_URL` with publication/admin privileges (never ship to mobile clients).

Publication workers call `@repo/data-access`:

1. `generateReleaseArtifacts` (`@repo/domain`) from release-scoped Postgres projections
2. `activateReleaseAsync(store, generated)` where `store = createPoolPostgresReleaseStore(pool)`
3. Upload sealed JSON blobs to GCS at paths declared in the bootstrap manifest (`public/releases/{releaseId}/…`)

A dedicated publication CLI script is **not yet wired** — ops use the tested library surface above from
admin/worker code paths. GCS upload remains a human/CI step until the publication worker bead lands.

Human steps that agents **cannot** apply:

- Upload sealed artifact JSON to `black-book-efaaf-public-media` at `public/releases/{releaseId}/…`
- CDN cache purge / cache-header verification (deferred to MOB-021 launch gate)
- Firebase emulator-backed integration (deferred — unit tests use injectable memory backend)

## Canonical convergence monitoring (repo-8yk8)

`.github/workflows/canonical-convergence-monitor.yml` dry-runs `backfill-canonical.ts --json`
on a timer and fails (alerting watchers) if any hard-fail verification counter is nonzero, or
warns if a convergence backlog (`missing_planned_claims`/`missing_planned_relationships`) is
building up unapplied. It does **not** run `--apply` itself — every hosted write against
`bb_canonical` should go through a human-reviewed dry-run first.

To activate it: add a `HOSTED_DATABASE_URL` repo secret (Settings → Secrets and variables →
Actions) holding the real Supabase connection string — read access to `bb_public`/`bb_canonical`
is sufficient, this workflow never writes. Then uncomment the `schedule:` trigger in the
workflow file. Until the secret exists, the job fails closed with a clear message rather than
reporting a false green, and `workflow_dispatch` still works for a manual check.

## Rollback drill

Call `rollbackToAsync(store, priorReleaseId)` from ops code with the same pool-backed store.
Re-validates every artifact hash before flipping `bb_public.active_release`.

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
- GCS upload wiring in publication worker CLI
- CDN `Cache-Control: immutable` verification on artifact URLs
- Physical device bootstrap sync trace
