# api-public deploy (Vercel)

The public versioned API runs on Vercel and reads released data from Supabase Postgres.
The [service inventory](../security/service-surfaces.md) distinguishes deployed services from
optional infrastructure definitions.

## Why Vercel, and why its own origin

**Its own origin, not `blackstory.app/v1`.** A mobile client cannot be force-upgraded — an
installed build keeps calling whatever it shipped against. That needs a versioned contract with a
stability guarantee, which `/v1` plus `openapi/public-v1.openapi.yaml` already is. The web app's
routes (`/search/api`, `/explore/api`, `/locate/api`) are internal to the page that calls them and
change shape freely on any deploy, because the JavaScript that calls them deploys at the same
moment. Pointing an un-upgradeable client at those couples a release you cannot take back to
routes designed to be changed. A separate origin also keeps an anonymous read API outside the web
app's cookie scope, where `__Host-` CSRF cookies and the request-integrity guard live.

**Vercel, not Supabase Edge Functions.** `apps/web` (including its `/admin` console) already establishes the pattern in this
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

## Deployment and credentials

The `blackstory-api` project has Root Directory `apps/api-public`, uses Node 24, and is linked
to this repository. The web/admin project is `blackstory`; there is no separate deployed admin
application. Both projects use `main` for Production. Git pushes can build and activate deployments
independently of GitHub Actions. `scripts/vercel-ignore-build.sh` skips irrelevant changes.

Use the installed Vercel CLI with the project's linked directory. It consumes its existing
credential without extracting a token into shell arguments or printing secret values:

```bash
vercel inspect api.blackstory.app --format=json
vercel env list production --cwd apps/api-public
vercel api /v9/projects/blackstory-api
```

Project API responses can include environment metadata. Filter output to the fields needed for
the check; never print environment values. Feed secret updates through stdin. Environment changes
require a new deployment before they affect the running service.

Production uses `PUBLIC_DATA_SOURCE=postgres` and its own `DATABASE_URL`. The staging Preview
uses `PUBLIC_DATA_SOURCE=seed` and has no database credential. A Preview may instead use an isolated
database, but must never receive Production credentials. Do not copy the web's local production
connection into Preview. Removing a variable does not change older immutable deployments.

The custom domain is `api.blackstory.app`. Its Cloudflare CNAME is DNS-only. Deployment protection
is `all_except_custom_domains`: the custom domain is publicly readable, while direct Vercel
deployment URLs require SSO. Keep that boundary when deploying or rehearsing maintenance.

## Verify and cut over

`/v1/health` verifies process health. `/v1/bootstrap`, a known entity, map and search responses
verify the data contract. In explicit seed mode, verify an empty catalog and no application
Postgres session. In Production, compare the active release and real catalog against the frozen
baseline; an HTTP 200 alone does not establish database access or complete data.

The API is a read-only surface, but it must be coordinated with the web and database for an
incompatible schema change. Set Production to seed mode and redeploy the recorded old revision
before the write freeze. Restore the Postgres mode only after the matching new revision and
schema pass the checks in [production release](production-release.md). Do not enable schedules
or dispatch deployment workflows to substitute for that procedure.

The optional GCP ingress configuration is not a live Vercel control plane. Inspect current
provider deployments and account settings rather than treating an infrastructure file as proof.

## Known difference from a long-lived host

Rate limiting is in-memory per instance (`createInMemoryRateLimitStore`). On one long-lived server
that is one shared counter. On serverless it is one counter per warm instance, so the effective
limit multiplies by instance count. It still bounds a single caller against a single instance and
Vercel's platform protections sit in front, but it is not the global limit the code reads like.
If these limits are load-bearing for abuse protection rather than politeness, they need a shared
store. Tracked separately.
