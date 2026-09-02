/**
 * Postgres canonical-release validation + one-time historical Firestore migration tooling.
 *
 * The canonical-convergence / canonical-release-gate / pg-writer / backfill-canonical modules
 * are ongoing Postgres-only utilities: no live Firestore connection, no firebase-admin import.
 * They read/write bb_* tables directly, including kind_detail fields that originated from the
 * one-time Firestore export below but are now plain Postgres data.
 *
 * migrate.ts / firestore-read.ts / cli/migrate.ts / cli/census.ts / catalog.ts / mappers/*
 * are the historical, one-time Firestore(black-book-efaaf) → Supabase Postgres (blackstory-app)
 * export path. They import firebase-admin/firestore and @repo/firebase and make live Firestore
 * calls. That migration ran once; this code is kept for reference/rerun-if-needed, not exercised
 * in normal operation.
 *
 * Mapping: docs/data/postgres-schema.md
 * Package: packages/migrate-firestore-postgres
 */

# migrate-firestore-postgres

## Ongoing: Postgres canonical-release validation

These modules make **no live Firestore calls** — they operate entirely against Postgres
(`bb_canonical.*`, `bb_public.*`) via direct `pg` connections:

- `src/canonical-release-gate.ts` — validates a candidate canonical entity/claim/location
  row set before it's allowed into a release (shape, required fields, taxonomy). Actively
  tested (`canonical-release-gate.test.ts`). Today, the only working (if ad hoc, untracked)
  entity-promotion path exercises this same pattern by hand — see repo-348e.6's notes on why a
  formal `promote-entity` verb was NOT added to `packages/operator-cli` (it would violate
  that package's tested proposer/approver separation, `promotion-boundary.test.ts`) and is
  still an open design decision.
- `src/canonical-convergence.ts` — reconciles `bb_public.active_release` back into the
  normalized canonical/evidence ledger; exposes `stableId`/`stableJson` helpers reused by
  the gate and by CLI tooling. Actively tested (`canonical-convergence.test.ts`).
- `src/pg-writer.ts` — generic upsert helper for private `bb_*` schemas (direct connection,
  not PostgREST). Used by both the convergence CLI and (historically) the Firestore migrate path.
- `src/cli/backfill-canonical.ts` — CLI wrapper around `canonical-convergence.ts`; reconciles
  the active Supabase public release into canonical/evidence tables. Pure Postgres, dry-run by
  default, requires `--apply --confirm-hosted-write=canonical-convergence` to write.

```bash
pnpm --filter @repo/migrate-firestore-postgres backfill-canonical -- --dry-run
```

## Historical (one-time): Firestore → Postgres export

The rest of this package (`migrate.ts`, `firestore-read.ts`, `cli/migrate.ts`, `cli/census.ts`,
`catalog.ts`, `mappers/index.ts`) is the one-time Firestore export that seeded `bb_*` tables. It
requires a live Firestore connection (`firebase-admin/firestore`, `@repo/firebase`,
`APP_FIREBASE_ALLOW_PRODUCTION=1`) and ADC/gcloud auth against `black-book-efaaf`. It is not part
of any ongoing workflow — kept for reference in case a collection needs re-export before Firebase
is fully decommissioned (see `docs/data/firebase-wind-down.md`). Do not treat this as evidence the
package has a live Firestore dependency in normal operation: the ongoing utilities above do not
import `firebase-admin` at all.

### Prerequisites

- ADC / gcloud auth for project `black-book-efaaf`
- Direct Postgres URL for `blackstory-app` (`DATABASE_URL` or `SUPABASE_DB_URL`)
  - PostgREST only exposes `public`, `bb_public`, `bb_submissions` — private `bb_*`
    schemas require a direct connection (service role SQL / pooler), not anon REST
- Production Firebase break-glass: `APP_FIREBASE_ALLOW_PRODUCTION=1`

Secrets stay in 1Password. Prefer a gitignored env with `op://` **item-id** refs
(titles with colons break `op run`):

```bash
# .env.migrate.local (gitignored) — refs only, no plaintext secrets
# DATABASE_URL=op://Private/<item-id>/<database-url-field>
op run --env-file=./.env.migrate.local --   env APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf   GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf   pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --high-value
```

### Census

```bash
APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  pnpm --filter @repo/migrate-firestore-postgres census
```

### Dry-run (read + map, no writes)

```bash
APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  pnpm --filter @repo/migrate-firestore-postgres migrate -- --dry-run
```

### Migrate one collection

```bash
# dry-run
pnpm --filter @repo/migrate-firestore-postgres migrate -- --dry-run --collection=researchCases

# apply (requires DATABASE_URL)
pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --collection=policy
```

High-value collection names: `policy`, `policyVersions`, `killSwitches`,
`publicationReleases`, `publicMeta`, `evidenceSources`, `sourceItems`,
`sourceCaptures`, `retrievalEvents`, `researchCases`, `censusNationalDecades`,
`censusStateDecades`, `publicSearchIndex`, `publicReleases`, `auditEvents`,
`outboxMessages`, `idempotencyKeys`, `submissionInbox`, `adminStoryPacketReviews`.

### Verify (SQL)

```sql
SELECT 'bb_ops.policy_active' AS t, count(*) FROM bb_ops.policy_active
UNION ALL SELECT 'bb_publication.releases', count(*) FROM bb_publication.releases
UNION ALL SELECT 'bb_public.active_release', count(*) FROM bb_public.active_release
UNION ALL SELECT 'bb_evidence.evidence_sources', count(*) FROM bb_evidence.evidence_sources
UNION ALL SELECT 'bb_research.cases', count(*) FROM bb_research.cases
UNION ALL SELECT 'bb_reference.census_national_decades', count(*) FROM bb_reference.census_national_decades
UNION ALL SELECT 'bb_public.search_index', count(*) FROM bb_public.search_index
UNION ALL SELECT 'bb_public.release_entities', count(*) FROM bb_public.release_entities;
```

Compare counts to the census JSON lines for the same Firestore collections.

### Idempotency

Upserts use natural text primary keys (`ON CONFLICT DO UPDATE`). Re-running is safe.
Research history/checklist rows are replaced per migrated case on apply.

### Deferred (large)

Use `--large` or `--collection=` for:

`acsTractProfiles`, `opportunityAtlasTracts`, `ucrAgencies`, `hateCrimeCountyYears`,
`holcAreas`, `censusCountyDecades`, `acsCountyProfiles`, `ucrStateParticipation`,
`entityEmbeddings`, `entityRelationships`, `publicReleaseGraph`.

```bash
op run --env-file=./.env.migrate.local -- \
  env APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --large
```

Skip remigrating high-value collections that already match census unless re-sync is required.

### Blobs

**Leftover blob note:** public media is now Supabase Storage on `blackstory-app`. GCS /
Firebase Storage remain dual-serve leftovers. Postgres stores metadata refs.
See `docs/data/firebase-wind-down.md` for owner console shutoff (no irreversible delete by agents).

### Cutover (public reads)

```bash
PUBLIC_DATA_SOURCE=postgres
DATABASE_URL=op://Private/<item-id>/…   # direct Postgres; never NEXT_PUBLIC_*
# DATABASE_SSL=1  # optional; supabase hosts auto-enable ssl
```

Treat migrated `bb_*` tables as SoR. Firestore admin/ops paths are leftover, not a current write target.
