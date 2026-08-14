# api-public Cloud Run deploy (Postgres SoR)

> **2026-08-14 correction:** this file's deploy mechanism is **unverified, not just undocumented**
> — `apps/api-public` has no `Dockerfile`, no `cloudbuild.yaml`, and no build config anywhere in
> the repo, and `.github/workflows/deploy-production.yml` only echoes a `[DRY-RUN]` line for this
> surface. Whether `gcloud builds submit apps/api-public` (as written below) actually produces a
> working image via buildpacks, whether api-public is deployed some other way outside this repo,
> or whether it has never been deployed to production at all is a genuine open question this pass
> could not answer — treat the "Deploy" section below as unverified until confirmed. Separately,
> the **"Legacy Firestore path" section near the bottom of this file is flatly wrong, not just
> stale**: `apps/api-public/src/http/README.md` confirms the Firestore read path
> (`firestore-data-access.ts`, `firestore-read-budget.ts`, `emulator-harness.ts`, and the
> `PUBLIC_DATA_SOURCE=firestore` branch) was fully removed in `repo-348e.3` — setting
> `PUBLIC_DATA_SOURCE=firestore` today does nothing, there is no fallback, silent or explicit.

Production reads use Supabase Postgres `bb_public.*` — same env vocabulary as `apps/web`.
**Firebase App Hosting** (web/admin host) and **Firebase Storage** stay in place; this runbook
only covers the `@repo/api-public` Cloud Run service.

## Architecture

| Layer | Role |
|-------|------|
| Cloud Run `@repo/api-public` | Bounded `/v1` read API (this runbook) |
| Supabase Postgres `bb_public.*` | System of record for published corpus reads |
| Firebase Storage / Hosting CDN | Release artifacts (search index, map GeoJSON, PMTiles) |
| Secret Manager | `DATABASE_URL` (scoped `role_public_read` pooler URL) |

Mobile clients call HTTPS only — no DB secrets in the binary. Client attestation uses
`X-BlackStory-Client: mobile/<semver>; api=<major>` (ADR-020); Firebase App Check is not required
on this surface after the Postgres cutover.

## Required env (Cloud Run)

| Variable | Value |
|----------|--------|
| `PUBLIC_DATA_SOURCE` | `postgres` |
| `DATABASE_URL` | Secret Manager reference (scoped `role_public_read` pooler URL) |
| `DATABASE_SSL` | `1` (Supabase pooler) |
| `NODE_ENV` | `production` |
| `CLIENT_ATTESTATION_MODE` | `enforce` (production); `monitor` for staged rollout |

Optional operator controls:

| Variable | Role |
|----------|------|
| `PUBLIC_READ_API_DISABLED=1` | Kill-switch — serves empty in-memory adapter |
| `CLIENT_ATTESTATION_MODE=monitor` | Log-only attestation during staged rollout |

## Deploy (human operator — requires GCP project access)

These steps assume the container image is built from `apps/api-public` via the repo's standard
Cloud Run pipeline (same service account posture as other `@repo/*` surfaces — see ADR-001).

```bash
# From repo root after merging to the release branch
gcloud config set project black-book-efaaf

# Build + push (replace TAG with the git SHA being deployed)
gcloud builds submit apps/api-public \
  --tag "gcr.io/black-book-efaaf/api-public:TAG"

# Deploy / update the service (env vars reference Secret Manager — never inline DATABASE_URL)
gcloud run deploy api-public \
  --image "gcr.io/black-book-efaaf/api-public:TAG" \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "PUBLIC_DATA_SOURCE=postgres,DATABASE_SSL=1,NODE_ENV=production,CLIENT_ATTESTATION_MODE=enforce" \
  --set-secrets "DATABASE_URL=projects/black-book-efaaf/secrets/api-public-database-url:latest"
```

Post-deploy smoke (from any machine with network access):

```bash
BASE="https://api-public-<hash>-uc.a.run.app"   # or mapped custom domain

curl -sS "${BASE}/v1/health" | jq .
curl -sS -H 'X-BlackStory-Client: mobile/1.0.0; api=1' "${BASE}/v1/bootstrap" | jq .
curl -sS -H 'X-BlackStory-Client: mobile/1.0.0; api=1' \
  "${BASE}/v1/search?q=dunbar" | jq '.totalMatched'
```

Rollback: redeploy the previous image tag (`gcloud run services update-traffic api-public --to-revisions=…`)
or flip `PUBLIC_READ_API_DISABLED=1` if upstream Postgres is unhealthy.

## Local smoke

**Option 1 — `DATABASE_URL` in 1Password:**

```bash
cd apps/api-public
run-with-dev-secrets env \
  PUBLIC_DATA_SOURCE=postgres \
  DATABASE_SSL=1 \
  CLIENT_ATTESTATION_MODE=monitor \
  pnpm dev
```

**Option 2 — `DATABASE_URL` in `apps/web/.env.local`:**

```bash
cd apps/api-public
set -a
source ../web/.env.local
set +a
env PUBLIC_DATA_SOURCE=postgres DATABASE_SSL=1 CLIENT_ATTESTATION_MODE=monitor pnpm dev
```

```bash
curl -sS 'http://127.0.0.1:8080/v1/health' | jq .
curl -sS -H 'X-BlackStory-Client: mobile/1.0.0; api=1' 'http://127.0.0.1:8080/v1/bootstrap' | jq .
```

## Contract artifacts (MOB-004 evidence)

| Artifact | Path |
|----------|------|
| OpenAPI v1 wire contract | `apps/api-public/openapi/public-v1.openapi.yaml` |
| Redacted response examples | `apps/api-public/fixtures/redacted-response-examples/` |
| Read budget / cost report | `apps/api-public/src/http/read-budget.md` |
| Handler README | `apps/api-public/src/http/README.md` |

CI validates examples against `@repo/public-contracts` in `openapi-artifact.test.ts`.

## Legacy Firestore path (removed)

`PUBLIC_DATA_SOURCE=firestore` no longer does anything — the Firestore read path was fully
removed in `repo-348e.3` (see `apps/api-public/src/http/README.md`). Postgres is the only data
source this service supports.

## Kill switch

`PUBLIC_READ_API_DISABLED=1` forces empty in-memory adapter (upstream unavailable posture).
