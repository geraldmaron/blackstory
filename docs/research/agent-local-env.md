# Agent local env (enrichment / OpenRouter / Postgres OPS)

Do **not** store OpenRouter, Census, or database credentials in Firebase, Firestore, or client bundles.
Prefer process injection from the existing secret manager; gitignored local files remain a compatibility path.

| File | Purpose |
|---|---|
| `apps/web/.env.local` | Mac dev default: `DATABASE_URL`, `OPENROUTER_API_KEY`, `CENSUS_API_KEY`, optional `DATABASE_SSL` |

`.gitignore` already covers `.env.*` (except `.env.example` / `.env.1password`).

## Credential setup

Follow the machine's canonical `~/Developer/Guides/Secrets-1Password.md`. Resolve the existing
provider, account and purpose before changing a consumer. Use stable vault/item/field IDs and
process injection through the existing `run-with-dev-secrets` launcher. Do not export values
into transcripts, arguments or scratch files. Do not create another secret loader or rotate
credentials to normalize names.

Session research uses the harness's search and document tools; it does not require a search
provider or model API key. The authenticated management service supplies database access.
Optional local CLI adapters require the credentials for the operations they actually perform.
An optional hosted adapter has separate requirements documented in
[management operations](research-operations.md#account-owned-management-work).

Existing gitignored `apps/web/.env.local` files are a compatibility path, not the recommended
way to provision new credentials. They have not been removed or rotated. The existing wrapper
`packages/ops-data/scripts/run-enrichment-with-local-env.sh` reads that file and runs only
`enrichment-run`; it is not a generic session research launcher. `LOCAL_ENV_FILE` can select an
existing compatibility file. Never print its contents or assume its database role is suitable
for every operation.

## Verify injection without revealing values

```bash
run-with-dev-secrets node -e 'process.exit(process.env.INTERNET_ARCHIVE_ACCESS_KEY && process.env.INTERNET_ARCHIVE_SECRET_KEY ? 0 : 1)'
```

A missing variable requires inspecting reference metadata and the intended consumer. The
shared launcher does not guarantee that it carries BlackStory database or model credentials.
Do not infer success from a reference file's existence.

For `capture-backfill --wayback`, reuse the existing Internet Archive reference pair through
that launcher. Without it, Save Page Now reports `skipped_no_credentials`; local capture can
still run. Preservation and retention permissions remain source-specific.

Explicit headless runs use the same supplied environment as CLI runs. No host or schedule is
assumed. Use the pinned profile in the execution plan, not a copied profile-version example.

## Phase 1 ACS ingest

`packages/ops-data/scripts/ingest-phase1-acs.ts` reads `CENSUS_API_KEY` from env or `apps/web/.env.local`
(see `.env.example`). It does **not** call 1Password itself — source the env file first.

**County bound (default):** 12 high Black-population states — AL, CA, FL, GA, IL, LA, MD, MS, NC, NY, SC, TX
(FIPS `01,06,12,13,17,22,24,28,36,37,45,48`). Override with `PHASE1_ACS_COUNTY_STATES`. State
unemployment covers all states plus Puerto Rico (`state:72` in jurisdictions seed).

```bash
set -a && source apps/web/.env.local && set +a
export DATABASE_SSL=1

# Dry-run (default)
node --conditions development --import tsx packages/ops-data/scripts/ingest-phase1-acs.ts

# Apply
DRY_RUN=0 INGEST_PHASE1_ACS_APPLY=1 node --conditions development --import tsx \
  packages/ops-data/scripts/ingest-phase1-acs.ts

# Rebuild coverage snapshot for /data
DRY_RUN=0 BUILD_PHASE1_COVERAGE_APPLY=1 node --conditions development --import tsx \
  packages/ops-data/scripts/build-phase1-indicator-coverage-snapshot.ts
```

Requires jurisdictions loaded first (`load-reference-jurisdictions.ts`; see `docs/runbooks/load-reference-jurisdictions.md`).
