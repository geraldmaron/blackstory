# api-public deploy (Vercel)

Replaces `api-public-cloud-run.md`. That runbook documented an unverified deploy to a platform
this project has left: `docs/data/firebase-wind-down.md` records Cloud Run, Cloud Functions,
Scheduler and App Hosting all deliberately deleted between 2026-07-22 and 2026-08-15, and
`gcloud run services list` on `black-book-efaaf` is empty by design.

## Why Vercel, and why its own origin

**Its own origin, not `blackstory.app/v1`.** A mobile client cannot be force-upgraded — an
installed build keeps calling whatever it shipped against. That needs a versioned contract with a
stability guarantee, which `/v1` plus `openapi/public-v1.openapi.yaml` already is. The web app's
routes (`/search/api`, `/explore/api`, `/locate/api`) are internal to the page that calls them and
change shape freely on any deploy, because the JavaScript that calls them deploys at the same
moment. Pointing an un-upgradeable client at those couples a release you cannot take back to
routes designed to be changed. A separate origin also keeps an anonymous read API outside the web
app's cookie scope, where `__Host-` CSRF cookies and the request-integrity guard live.

**Vercel, not Supabase Edge Functions.** `apps/admin` already establishes the pattern in this
repo: a separate Vercel project per app, chosen there for credential isolation. Same platform,
same deploy-from-git, same certificate automation, one bill. Edge Functions would mean rewriting a
`node:http` server for Deno and abandoning the 123 tests that cover it, for no gain.

**Not reimplementing it inside `apps/web`.** `apps/api-public` already carries rate limits, search
and vector-search guardrails, SSRF protection, enumeration indistinguishability, redaction and
kill switches. Rebuilding that as Next routes is a regression risk with no upside.

## How it is wired

| Piece | Where |
| --- | --- |
| Function entrypoint | `apps/api-public/api/index.ts` — one function, `vercel.json` rewrites all paths to it |
| Shared request handler | `createPublicApiRequestHandler` in `src/http/server.ts` |
| Long-lived listener | `src/main.ts`, still the entrypoint for local dev and any host owning a port |
| Static output | `public/openapi.yaml`, copied from `openapi/public-v1.openapi.yaml` at build |
| Build skip | `scripts/vercel-ignore-build.sh api-public` |

`api/index.ts` imports from `../dist`, not `../src`. The package's `tsconfig.json` scopes itself to
`src/**`, so a file in `api/` falls outside it and Vercel's bundler would re-typecheck the whole
source tree under its own defaults — which reports errors `pnpm typecheck` does not. Consuming
built output keeps one compiler in charge of types.

Both hosts share one handler so neither can drift; `src/http/request-handler.test.ts` asserts they
answer identically.

## Verified 2026-09-10

- `vercel build` from `apps/api-public` completes clean, no type errors.
- The bundle traces every workspace dependency: `@repo/security`, `@repo/ops-data`, `@repo/domain`,
  `@repo/config`, `@repo/public-contracts`, `@repo/schemas`, and `pg`.
- Driving the built bundle at `.vercel/output/functions/api/index.func/api/index.js` directly:
  `GET /v1/health` → 200 with the real service payload, `GET /v1/nope` → structured 404 with a
  request id.
- Project `blackstory-api` exists under `geraldmarons-projects`, with the build, install and
  output settings above already applied.
- `vercel git connect` against this repository succeeds and `vercel git disconnect` reverses it,
  so step 2 below is a proven command rather than a guess. It is left disconnected on purpose.

## Deploys happen on push, once one setting is right

Like `blackstory` and `blackstory-admin`, this deploys through Vercel's Git integration: push to
`main` builds production, push to `staging` builds a preview, and
`scripts/vercel-ignore-build.sh api-public` skips the build when the diff cannot reach it. No
workflow and no CLI deploy is involved — the CLI deploys in this repo's history were verification
only.

That flow depends on **Root Directory = `apps/api-public`**. `vercel.json` uses `cd ../..` to reach
the workspace root, and Vercel only starts there when Root Directory says so. It is also where
Vercel looks for `vercel.json` and for the `api/` function directory at all, so with the default
Root Directory of `.` the config is never read, the function is never found, and the install step
walks out of the checkout with `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`.

Root Directory is the one thing here with no CLI or config surface — not in `vercel.json`, not in
`vercel project`, dashboard or REST API only. Git is deliberately left **disconnected** until it is
set, because a connected project with the wrong root fails on every push to both branches.

### Step 1 — set Root Directory (dashboard, once)

Vercel → `blackstory-api` → Settings → Build & Deployment → Root Directory → `apps/api-public`.
Confirm Production Branch is `main`.

### Step 2 — connect git (one command)

```bash
cd apps/api-public && vercel git connect https://github.com/geraldmaron/blackstory --yes
```

Pass the URL explicitly: run from a subdirectory, the CLI does not find the repository on its own
and reports "No local Git repository found".

### Step 3 — environment variables

Set on Production, and on Preview if previews should read real data:

- `PUBLIC_DATA_SOURCE=postgres`
- `DATABASE_URL` — the read credential, not admin's write-capable one.

Without these the API boots and serves an empty in-memory catalog rather than failing, so check
`/v1/bootstrap` returns real data. `/v1/health` returning 200 proves nothing about the database.

### Step 4 — domain

Vercel → Settings → Domains → add `api.blackstory.app`, then add the `CNAME` Vercel asks for at
Cloudflare, **DNS-only (grey cloud)**, not proxied.

Deployment protection needs no change: `ssoProtection` is `all_except_custom_domains`, so
`api.blackstory.app` is anonymous while the `*.vercel.app` URLs stay behind SSO. A 302 to a Vercel
login on a `.vercel.app` preview is that working, not a fault.

### Not a step: the ingress matrix

`infra/gcp/armor/ingress-matrix.json` still names `api.blackbook.app` and `submit.blackbook.app`.
It governs Cloud Armor, which fronts nothing here. Fold it into the GCP wind-down rather than
repointing it at a live host.

## Known difference from a long-lived host

Rate limiting is in-memory per instance (`createInMemoryRateLimitStore`). On one long-lived server
that is one shared counter. On serverless it is one counter per warm instance, so the effective
limit multiplies by instance count. It still bounds a single caller against a single instance and
Vercel's platform protections sit in front, but it is not the global limit the code reads like.
If these limits are load-bearing for abuse protection rather than politeness, they need a shared
store. Tracked separately.
