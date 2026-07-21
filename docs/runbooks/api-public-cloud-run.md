# api-public Cloud Run deploy (Postgres SoR)

Production reads use Supabase Postgres `bb_public.*` — same env vocabulary as `apps/web`
**Firebase App Hosting** (web/admin host is unchanged by this runbook; do not tear down
App Hosting or Storage while following these steps).

## Required env (Cloud Run)

| Variable | Value |
|----------|--------|
| `PUBLIC_DATA_SOURCE` | `postgres` |
| `DATABASE_URL` | Secret Manager reference (scoped `role_public_read` pooler URL) |
| `DATABASE_SSL` | `1` (Supabase pooler) |
| `NODE_ENV` | `production` |
| `CLIENT_ATTESTATION_MODE` | `enforce` (production); `monitor` for staged rollout |

Mobile clients send `X-BlackStory-Client: mobile/<semver>; api=<major>`. Firebase App Check is **not** required after the ADR-020 cutover.

## Local smoke

```bash
cd apps/api-public
run-with-dev-secrets -- env \
  PUBLIC_DATA_SOURCE=postgres \
  DATABASE_URL='postgresql://…' \
  DATABASE_SSL=1 \
  CLIENT_ATTESTATION_MODE=monitor \
  pnpm dev
```

```bash
curl -sS 'http://127.0.0.1:8080/v1/health' | jq .
curl -sS -H 'X-BlackStory-Client: mobile/1.0.0; api=1' 'http://127.0.0.1:8080/v1/bootstrap' | jq .
```

## Legacy Firestore path

Explicit opt-in only: `PUBLIC_DATA_SOURCE=firestore` + Firebase ADC/break-glass. Retained for migration rollback tests — not a production default.

## Kill switch

`PUBLIC_READ_API_DISABLED=1` forces empty in-memory adapter (upstream unavailable).
