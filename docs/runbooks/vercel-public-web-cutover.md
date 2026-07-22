<!--
  Operator runbook for cutting public apps/web from Firebase App Hosting to Vercel.
  Prep-only until DNS flip is explicitly approved.
-->

# Runbook: Vercel public-web cutover

**Bead:** `repo-gm3w`  
**ADR:** [ADR-027](../adr/ADR-027-vercel-public-web-hosting.md)  
**Project:** Vercel `geraldmarons-projects/blackstory` (`prj_AJYcJozo2XqLfBXItGxHV5SQP06h`)  
**Root Directory:** `apps/web`

## Current state (pre-hard-cut)

| Item | Value |
|------|--------|
| Preview / default alias | `https://blackstory-geraldmarons-projects.vercel.app` |
| Git production branch | `main` (Git connected) |
| Production DNS (`blackstory.app`) | **Still App Hosting — do not flip until checklist below** |
| Dual-run | App Hosting `apphosting*.yaml` retained; Next uses `standalone` only when `VERCEL` is unset |

## Agent / MCP

- Cursor MCP endpoint: `https://mcp.vercel.com` (server id `user-vercel` after OAuth)
- Prefer MCP `list_deployments` / `get_deployment_build_logs` / `get_runtime_logs` for diagnosis
- CLI fallback: `vercel` (linked via `.vercel/project.json`, gitignored)

## Preview validation (required before hard cut)

1. Deploy Preview from a linked branch or `vercel` (non-`--prod`) from a clean tree with current `apps/web` config.
2. Confirm:
   - Homepage renders (not empty seed-only dig)
   - `/explore` shows live catalog (~1k+ records when `PUBLIC_DATA_SOURCE=postgres`)
   - `/search?q=obama` returns results (no browser `ERR_TOO_MANY_REDIRECTS`)
   - Security headers still present
   - No App Hosting-only assumptions in runtime logs
3. Soak Preview for at least one owner review session.

### Deployment Protection / Authentication

If Vercel Authentication (or share-link protection) is on for Preview, SSO returns with `_vercel_share=…`. Edge query normalization **must preserve** `_vercel_*` handshake params on redirects (see `apps/web/src/lib/runtime-hardening/query-normalization.ts`). Stripping them 308s to a bare URL and re-triggers SSO → `ERR_TOO_MANY_REDIRECTS` (often described by users as “too many requests”). Share tokens stay out of CDN cache keys.

**Evidence matrix (2026-07-22 probe, no secrets):**

| Surface | Backend | Deployment Protection | `/search?q=obama` | `?_vercel_share=` behavior | Loop? |
|--------|---------|----------------------|-------------------|----------------------------|-------|
| Preview branch alias `…-69ebd1-….vercel.app` | Vercel Preview (`5ea25768`+) | Auth on → SSO | **200** after share auth (Barack Obama) | Preserved by fix | **Fixed** (was SSO↔308 strip) |
| Preview deployment `blackstory-le31w9fbq-…` | Same commit | Auth on | Same | Same | **Fixed** |
| Vercel Production `blackstory-….vercel.app` / `blackstory-5x9edrjgc-…` | Vercel Production (`main` / `e1c1f415`) | **Off** (direct 200) | **200**, 1 result | Still **308 strips** share (fix not on `main`) | **No** (Auth off; strip is inert) |
| `https://blackstory.app` | **App Hosting** (`server: envoy`, `via: google`) — not Vercel yet | N/A | **200**, 1 result | **308 strips** share | **No** |
| `https://www.blackstory.app` | No DNS A/CNAME | N/A | curl fail | N/A | N/A |

Do **not** enable Production Deployment Protection until `isPlatformPassthroughQueryKey` is on the Production deployment. Cloudflare SSL was not in these chains (Vercel or Google/envoy only).

## Environment variables

Set on the Vercel project (Preview + Production unless noted):

| Key | Notes |
|-----|--------|
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_SITE_URL` | Preview: `*.vercel.app` alias; Production: `https://blackstory.app` |
| `PUBLIC_DATA_SOURCE` | `postgres` |
| `PUBLIC_READ_API_DISABLED` | `0` (or `1` to force degraded mode) |
| `REQUEST_INTEGRITY_MODE` | `enforce` |
| `DATABASE_SSL` | `1` |
| `DATABASE_URL` | Sensitive; **Supabase session pooler** (IPv4). Direct `db.<ref>.supabase.co` is IPv6-only and fails on Vercel (`ENOTFOUND`). For `blackstory-app` use `aws-1-us-west-2.pooler.supabase.com:5432` with user `postgres.<ref>`, `sslmode=require`, `uselibpqcompat=true`. Decode the DB password once if the source URL was already percent-encoded (passwords containing `%`/`@` break when double-encoded). |
| `SENTRY_DSN` | Optional; App Hosting Secret Manager name `web-production-sentry-dsn` exists, but `apps/web` has no Sentry client wired yet — **omit on Vercel** until observability lands |
| `SUBMISSION_PRIVACY_PEPPER` | Required for production `POST /submit` and corrections IP hashing; not needed for public catalog reads. **Set 2026-07-22** (see below). |

### Secrets checklist (names only)

| Name | Preview | Production | Notes |
|------|---------|------------|-------|
| `DATABASE_URL` | required (sensitive) | required (sensitive) | Session pooler only |
| `DATABASE_SSL` | required | required | `1` |
| `PUBLIC_DATA_SOURCE` | required | required | `postgres` |
| `PUBLIC_READ_API_DISABLED` | required | required | `0` for live reads |
| `REQUEST_INTEGRITY_MODE` | required | required | `enforce` |
| `NEXT_PUBLIC_APP_ENV` | required | required | `production` |
| `NEXT_PUBLIC_SITE_URL` | required (preview URL) | required (`https://blackstory.app`) | Separate per target |
| `SENTRY_DSN` | omit for now | omit for now | GCP SM `web-production-sentry-dsn` exists; not wired in `apps/web` |
| `SUBMISSION_PRIVACY_PEPPER` | set (sensitive) | set (sensitive) | 1Password + Vercel; never commit value |
| `NEXT_PUBLIC_ADMIN_ORIGIN` | optional | optional | Footer admin link only |
| `NEXT_PUBLIC_FIREBASE_*` | not required for Vercel public reads | not required | App Hosting legacy; public dig uses Postgres |

### `SUBMISSION_PRIVACY_PEPPER` (set 2026-07-22)

Dedicated pepper is live for Vercel Preview and Production (sensitive). Value is **not** in git.

| Source | Status |
|--------|--------|
| 1Password (Private vault) | Item `BlackStory submission privacy pepper` — fields `credential` / `SUBMISSION_PRIVACY_PEPPER` |
| Vercel project env | Present Preview + Production as Encrypted/sensitive |
| `OPERATOR_CLI_PRIVACY_PEPPER` | Separate 1Password item — **do not reuse** for submissions |
| GCP Secret Manager | Not mirrored (optional if App Hosting rollback still needs submit) |

After any env change, **redeploy** Preview/Production — existing deployments keep the prior env snapshot. Smoke submit/corrections on Preview when ready: confirm no `SUBMISSION_PRIVACY_PEPPER must be set in production` runtime error. Public catalog / Explore reads do not need this pepper; DNS cutover remains owner-gated separately.

Update without printing secrets:

```bash
# Preview: omit git branch to apply to all Preview branches (CLI may prompt otherwise)
vercel env add DATABASE_URL preview --value "$DATABASE_URL" --yes
vercel env add DATABASE_URL production --value "$DATABASE_URL" --yes
# Or POST to Vercel API v10 with type=sensitive, target=["preview"|"production"]
vercel redeploy <preview-deployment-url>
```

## Hard cut (explicit owner approval only)

1. Freeze App Hosting production promotes (`deploy-production.yml` / promote scripts) for the cut window.
2. Promote a known-good Vercel Preview → Production (`vercel promote <url>` or dashboard).
3. Attach custom domains in Vercel: `blackstory.app` + `www` (or apex-only per DNS plan).
4. Lower DNS TTLs ahead of time; switch records to Vercel’s targets.
5. Verify production URL + Explore catalog + TLS.
6. Keep App Hosting backend idle (do not delete) for rollback soak (suggested ≥48h).
7. After soak: document App Hosting wind-down; update README architecture table.

## Rollback

1. Repoint DNS to prior App Hosting / Firebase Hosting records.
2. Re-enable App Hosting promote for the last known-good SHA.
3. Leave the Vercel project intact for log forensics.

## Do not

- Host `apps/admin` on this Vercel project (IAP boundary — ADR-001 / ADR-005).
- Enable unattended production deploys on every `main` push without amending ADR-006 / ADR-027.
- Delete App Hosting configs or Secret Manager secrets during the soak window.
- Put bead ids or secrets in user-facing copy.
