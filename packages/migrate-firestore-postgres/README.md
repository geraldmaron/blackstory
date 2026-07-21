/**
 * Runbook: Firestore (black-book-efaaf) → Supabase Postgres (blackstory-app).
 *
 * Does NOT cut over app traffic. Does NOT delete Firestore. Blobs stay in GCS.
 *
 * Mapping: docs/data/postgres-schema.md
 * Package: packages/migrate-firestore-postgres
 */

# Firestore → Postgres migration runbook

## Prerequisites

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

## Census

```bash
APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  pnpm --filter @repo/migrate-firestore-postgres census
```

## Dry-run (read + map, no writes)

```bash
APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
  GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
  pnpm --filter @repo/migrate-firestore-postgres migrate -- --dry-run
```

## Migrate one collection

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

## Verify (SQL)

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

## Idempotency

Upserts use natural text primary keys (`ON CONFLICT DO UPDATE`). Re-running is safe.
Research history/checklist rows are replaced per migrated case on apply.

## Deferred (large)

`acsTractProfiles`, `opportunityAtlasTracts`, `ucrAgencies`, `hateCrimeCountyYears`,
`holcAreas`, `censusCountyDecades`, `acsCountyProfiles`, `ucrStateParticipation`,
`entityEmbeddings`, `entityRelationships` — use `--collection=` after tooling is proven.
