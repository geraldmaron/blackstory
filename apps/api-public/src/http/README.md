# Public HTTP API

`server.ts` adapts Node HTTP requests to the injected handlers in `handlers.ts`. `compose.ts`
wires Postgres public readers, client-version policy, query bounds, rate limiting, kill switches
and optional vector search. The API reads released projections under `published`; it cannot
publish research proposals.

## Run locally

Set `PUBLIC_DATA_SOURCE=postgres` and a server-only `DATABASE_URL` (or `APP_DATABASE_URL`).
Set `DATABASE_SSL=1` for a remote TLS database. Then run `pnpm dev` in `apps/api-public`.
Explicit `seed` or `fixtures` mode supplies an empty in-memory boundary for tests. It is not a
production catalog or a recovery fallback. Keep database credentials outside client bundles.

## Request controls

Direct callers send `X-BlackStory-Client: <platform>/<version>; api=1`. The shared policy in
`@repo/security/client-attestation` checks protocol shape; this header is forgeable and grants
neither authenticated identity nor additional quota. `CLIENT_ATTESTATION_MODE` defaults to
`enforce` in production and `monitor` otherwise. Web mutation routes also enforce same-origin
request integrity. Staff authentication uses Supabase Auth and database authorization separately.

`rate-limits.ts` and `@repo/security` apply anonymous caller quotas. Query, body, bounding-box and
result-count limits constrain work before expensive reads. The default store is process-local;
its per-instance quota is not a distributed global ceiling. `RATE_LIMIT_DISABLED=1` is a local
test escape, not a production abuse-control strategy.

Vector search is wired only when `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` is present. It uses the
Postgres embedding store and its own bounded query policy. Similarity is a retrieval signal;
public responses must not present it as an evidenced relationship.

## Verification

`pnpm test` runs the route, composition, projection, redaction, SSRF, enumeration, search,
rate-limit and public-contract tests. `read-budget.md` describes what cost claims are supported.
The request path, release-cache behavior and denied access need live local API checks when their
wiring changes; fixture assertions do not prove production database connectivity.
