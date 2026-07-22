# Agent local env (enrichment / OpenRouter / Postgres OPS)

Do **not** store OpenRouter, Census, or database credentials in Firebase, Firestore, or client bundles.
Use gitignored local files only.

| File | Purpose |
|---|---|
| `apps/web/.env.local` | Mac dev default: `DATABASE_URL`, `OPENROUTER_API_KEY`, `CENSUS_API_KEY`, optional `DATABASE_SSL` |

`.gitignore` already covers `.env.*` (except `.env.example` / `.env.1password`).

## One-time local setup (1Password)

When signed in to 1Password CLI, seed keys into the gitignored env file (never commit `.env.local`):

```bash
cd /path/to/blackstory-mobile
# OPENROUTER — if not already present
printf 'OPENROUTER_API_KEY=%s\n' "$(op read 'op://Private/OpenRouter/credential')" >> apps/web/.env.local
# Census Data API — Phase 1 ACS ingest + demographics adapters
printf 'CENSUS_API_KEY=%s\n' "$(op read 'op://Private/USCensus/credential')" >> apps/web/.env.local
```

If a key already exists, edit in place instead of appending duplicates.

## Headless agent invocation

```bash
cd /path/to/blackstory-mobile
set -a && source apps/web/.env.local && set +a
export OPS_DATA_SOURCE=postgres
export RESEARCH_PROFILE_ID=black-history
export RESEARCH_PROFILE_VERSION=1.0.0
export RESEARCH_SCHEMA_VERSION=1.0.0
node --conditions development --import tsx packages/operator-cli/src/bin.ts enrichment-run …
```

Or use the wrapper (same env file):

```bash
packages/firebase/scripts/run-enrichment-with-local-env.sh …
```

Override path: `LOCAL_ENV_FILE=/path/to/.env.local`.

## Verify (no secret output)

```bash
set -a && source apps/web/.env.local && set +a
test -n "$OPENROUTER_API_KEY" && test -n "$DATABASE_URL" && echo ok
test -n "$CENSUS_API_KEY" && echo census-ok
```

Optional 1Password path when signed in: `run-with-dev-secrets bash -c 'test -n "$OPENROUTER_API_KEY" && echo ok'`.
Corsair overnight jobs continue to use `~/.config/blackstory/enrichment.env` (see overnight runbook).

## Phase 1 ACS ingest

`packages/firebase/scripts/ingest-phase1-acs.ts` reads `CENSUS_API_KEY` from env or `apps/web/.env.local`
(see `.env.example`). It does **not** call 1Password itself — source the env file first.

```bash
set -a && source apps/web/.env.local && set +a
export DATABASE_SSL=1

# Dry-run (default)
node --conditions development --import tsx packages/firebase/scripts/ingest-phase1-acs.ts

# Apply
DRY_RUN=0 INGEST_PHASE1_ACS_APPLY=1 node --conditions development --import tsx \
  packages/firebase/scripts/ingest-phase1-acs.ts

# Rebuild coverage snapshot for /data
DRY_RUN=0 BUILD_PHASE1_COVERAGE_APPLY=1 node --conditions development --import tsx \
  packages/firebase/scripts/build-phase1-indicator-coverage-snapshot.ts
```

Requires jurisdictions loaded first (`load-reference-jurisdictions.ts`; see `docs/runbooks/load-reference-jurisdictions.md`).
