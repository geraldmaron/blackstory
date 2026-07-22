# Agent local env (enrichment / OpenRouter / Postgres OPS)

Do **not** store OpenRouter or database credentials in Firebase, Firestore, or client bundles.
Use gitignored local files only.

| File | Purpose |
|---|---|
| `apps/web/.env.local` | Mac dev default: `DATABASE_URL`, `OPENROUTER_API_KEY`, optional `DATABASE_SSL` |

`.gitignore` already covers `.env.*` (except `.env.example` / `.env.1password`).

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
```

Optional 1Password path when signed in: `run-with-dev-secrets bash -c 'test -n "$OPENROUTER_API_KEY" && echo ok'`.
Corsair overnight jobs continue to use `~/.config/blackstory/enrichment.env` (see overnight runbook).
