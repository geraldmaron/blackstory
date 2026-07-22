<!--
  Operator runbook for cutting public apps/web from Firebase App Hosting to Vercel.
  Hard-cut DNS flip completed 2026-07-22; soak closed; public web App Hosting retired in-repo.
-->

# Runbook: Vercel public-web cutover

**ADR:** [ADR-027](../adr/ADR-027-vercel-public-web-hosting.md)  
**Project:** Vercel `geraldmarons-projects/blackstory` (`prj_AJYcJozo2XqLfBXItGxHV5SQP06h`)  
**Root Directory:** `apps/web`

## Current state (2026-07-22 — complete)

| Item | Value |
|------|--------|
| Preview / default alias | `https://blackstory-geraldmarons-projects.vercel.app` |
| Git production branch | `main` at `bd1b1c08` (includes `5ea25768` `_vercel_*` preserve) |
| Production deploy | `dpl_ERR5rbReMAdUkrA3uscmYQZ9BCN6` READY |
| Vercel domains | `blackstory.app` + `www.blackstory.app` attached; `misconfigured=false`; Production public |
| Production DNS | **Vercel** — apex `A 76.76.21.21`; `www` `CNAME cname.vercel-dns.com` (DNS-only / grey cloud; Cloudflare NS retained) |
| Live probe (post-flip) | `server: Vercel` (not App Hosting `envoy` / `via: google`); `/explore/api` `totalMatched=1338` `degraded=false`; `/history/api` `1340`; `/search?q=obama` 200 with Barack Obama; sample entity 200 |
| Soak | **Closed** — Vercel is sole public web host |
| Owner wind-down | **Done 2026-07-22** — `black-book-web-production` and `black-book-web-staging` deleted; only `black-book-admin-production` remains |

### DNS records in effect (re-confirm via Vercel domain API before any future change)

Live Vercel recommendation at flip time (owner applied):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` / `blackstory.app` | `76.76.21.21` | DNS only |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only |

Older dual-A / project-hash CNAME targets may still resolve on Vercel’s edge but are **not** what Production is using now. Preserve MX/TXT. Optional agent unblock: Cloudflare Zone DNS Edit token as `CLOUDFLARE_API_TOKEN` in 1Password.

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

**Query-param order:** Do **not** 308 solely to alphabetize allowlisted keys. The `/search` GET form submits `q&kind&status&era`; a reorder-only Location can equal the request on Vercel/Next middleware and loop (`ERR_TOO_MANY_REDIRECTS`). Cache keys may still sort; redirects only when keys/values/path actually change (tracking strip, unknown keys, value canonicalization, trailing slash).

**Evidence matrix (2026-07-22 probe, no secrets):**

| Surface | Backend | Deployment Protection | `/search?q=obama` | `?_vercel_share=` behavior | Loop? |
|--------|---------|----------------------|-------------------|----------------------------|-------|
| Preview branch alias `…-69ebd1-….vercel.app` | Vercel Preview (`5ea25768`+) | Auth on → SSO | **200** after share auth (Barack Obama) | Preserved by fix | **Fixed** (was SSO↔308 strip) |
| Preview deployment `blackstory-le31w9fbq-…` | Same commit | Auth on | Same | Same | **Fixed** |
| Vercel Production `blackstory-….vercel.app` / `blackstory-5x9edrjgc-…` | Vercel Production (`main` / `e1c1f415`) | **Off** (direct 200) | **200**, 1 result | Still **308 strips** share (fix not on `main`) | **No** (Auth off; strip is inert) |
| `https://blackstory.app` | **Vercel Production** (`server: Vercel`) after DNS GO | Off | **200**, Barack Obama | Share strip inert (Auth off) | **No** |
| `https://www.blackstory.app` | **Vercel** (`CNAME cname.vercel-dns.com`, `server: Vercel`) | Off | **200** (via public DNS; some local resolvers lag briefly) | N/A | **No** |

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
| `SENTRY_DSN` | Optional; not wired in `apps/web` yet — **omit on Vercel** until observability lands |
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
| `SENTRY_DSN` | omit for now | omit for now | Not wired in `apps/web` |
| `SUBMISSION_PRIVACY_PEPPER` | set (sensitive) | set (sensitive) | 1Password + Vercel; never commit value |
| `NEXT_PUBLIC_ADMIN_ORIGIN` | optional | optional | Footer admin link only |
| `NEXT_PUBLIC_FIREBASE_*` | not required for Vercel public reads | not required | Public dig uses Postgres |

### `SUBMISSION_PRIVACY_PEPPER` (set 2026-07-22)

Dedicated pepper is live for Vercel Preview and Production (sensitive). Value is **not** in git.

| Source | Status |
|--------|--------|
| 1Password (Private vault) | Item `BlackStory submission privacy pepper` — fields `credential` / `SUBMISSION_PRIVACY_PEPPER` |
| Vercel project env | Present Preview + Production as Encrypted/sensitive |
| `OPERATOR_CLI_PRIVACY_PEPPER` | Separate 1Password item — **do not reuse** for submissions |

After any env change, **redeploy** Preview/Production — existing deployments keep the prior env snapshot. Smoke submit/corrections on Preview when ready: confirm no `SUBMISSION_PRIVACY_PEPPER must be set in production` runtime error. Public catalog / Explore reads do not need this pepper.

Update without printing secrets:

```bash
# Preview: omit git branch to apply to all Preview branches (CLI may prompt otherwise)
vercel env add DATABASE_URL preview --value "$DATABASE_URL" --yes
vercel env add DATABASE_URL production --value "$DATABASE_URL" --yes
# Or POST to Vercel API v10 with type=sensitive, target=["preview"|"production"]
vercel redeploy <preview-deployment-url>
```

## Hard cut (completed 2026-07-22)

Owner flipped Cloudflare DNS to Vercel (apex A + www CNAME, DNS-only). Post-flip verification: Vercel `misconfigured=false`; catalog `/explore/api` `totalMatched=1338`; Obama search + sample entity OK.

**Soak closed:** Vercel is the sole public web host. Public web App Hosting configs are removed from the repo. Firebase backends `black-book-web-production` and `black-book-web-staging` were deleted 2026-07-22 (admin App Hosting remains).

## Rollback

1. **Vercel promote/redeploy** the prior known-good Production deployment SHA (dashboard or `vercel promote <deployment-url>`).
2. Do **not** repoint DNS to App Hosting — public web backends are wind-down targets, not rollback.
3. Leave the Vercel project intact for log forensics.

## Do not

- Host `apps/admin` on this Vercel project (IAP boundary — ADR-001 / ADR-005).
- Enable unattended production deploys on every `main` push without amending ADR-006 / ADR-027.
- Recreate public web App Hosting configs in-repo.
- Put secrets in user-facing copy.
