# Runbook: maintenance mode (public web)

**Scope:** `apps/web` on Vercel — parking the whole public surface behind an edge-served 503 so
that neither a Vercel function nor Supabase is touched by public traffic.
**Not in scope:** `apps/api-public` (a separate Node service with its own deploy and its own
Supabase reads), `apps/admin`, and the `apps/mobile` client that calls `api-public`. Walling the
web app does **not** stop those. See "What this does not cover" below.

## What it does

With `MAINTENANCE_MODE` on, `apps/web/src/proxy.ts` answers every request at the edge, before
Next routes it:

- No route is matched, so no serverless function boots.
- No React tree renders, so no `bb_public` query runs.
- The response is a self-contained HTML page — inline CSS, no script, no font request. The only
  other request the browser makes is the brand lockup from `/public/brand`, which Vercel serves
  from static storage.

`/robots.txt` and `/sitemap.xml` are walled too, on purpose. A site-wide 503 is the signal that
tells a crawler to stop and come back later; serving a 200 maintenance page at every URL invites
it to reindex the archive as a maintenance notice instead.

`Retry-After` is sent on every 503, defaulting to one day.

## Turning it on

1. Set on the **Production** environment in the Vercel project:
   - `MAINTENANCE_MODE=1`
   - `MAINTENANCE_BYPASS_TOKEN=<a long random string>` — generate with
     `openssl rand -hex 24`, store it in 1Password, share it with the team from there.
   - Optionally `MAINTENANCE_RETRY_AFTER_SECONDS` and `MAINTENANCE_MESSAGE`.
2. **Redeploy.** This is not optional and there is no way around it. These variables are read
   inside the edge bundle, and Next inlines non-public env vars into that bundle at build time,
   so a dashboard change alone changes nothing.
3. Verify from a browser with no bypass cookie:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://<site>/
   ```

   Expect `503`. Check `/robots.txt` and one entity URL too.

Leave the variables **unset on Preview**, so a preview build is never accidentally walled. Note
that a Preview deployment is not a substitute for the bypass on this project: `DATABASE_URL` is
scoped to Production only, so Preview has no data plane and serves an empty catalog whether the
wall is up or not. The bypass below is the way to look at the real site while Production is
parked.

## Turning it off

Set `MAINTENANCE_MODE=0` (or delete it) on Production and redeploy. The flag fails open — only
`1`, `true`, `on`, or `enabled` raise the wall, so a typo or a missing variable leaves the site
up rather than darking it.

Deleting `MAINTENANCE_BYPASS_TOKEN` at the same time invalidates every outstanding bypass cookie.

## Bypass (you and the team)

Redeem the token once per browser:

```
https://<site>/?maintenance_bypass=<token>
```

The edge swaps it for an HttpOnly cookie valid for 30 days and redirects to the same URL without
the parameter, so the token does not linger in the address bar, in a `Referer`, or in a pasted
link. After that the whole site works normally in that browser, including the map.

For scripts and uptime checks that cannot hold a cookie, send the header instead:

```bash
curl -H 'x-maintenance-bypass: <token>' https://<site>/
```

**Rotating:** change `MAINTENANCE_BYPASS_TOKEN` and redeploy. Existing cookies stop matching
immediately and everyone redeems the new link.

**The token is a shared secret.** Its only power is viewing a parked site, but it is still worth
keeping in 1Password rather than in a chat thread.

## Local QA

`.claude/launch.json` is gitignored, so each person adds their own entry. Add this alongside the
existing `web` configuration and start it with `preview_start {name: "web-maintenance"}`:

```json
{
  "name": "web-maintenance",
  "runtimeExecutable": "env",
  "runtimeArgs": [
    "MAINTENANCE_MODE=1",
    "MAINTENANCE_BYPASS_TOKEN=local-dev-bypass-token",
    "pnpm",
    "run",
    "dev:web"
  ],
  "port": 3048
}
```

Next's dev server does **not** hot-reload the proxy bundle. After editing anything under
`src/lib/maintenance/` or `src/proxy.ts`, restart the server or you will be looking at the
previous build and believe your change did nothing.

## What this does not cover

- **`apps/api-public`.** It reads Supabase directly and deploys separately; the web wall does not
  touch it. If mobile traffic or a public API consumer is part of the cost you are trying to cut,
  that service needs its own stop, and the kill switches in `packages/config/src/kill-switches.ts`
  (`public-static-mode`, `search`) are the existing lever there.
- **Anything that writes.** Scheduled jobs, ingestion, and enrichment runs are unaffected. Stop
  those through their own kill switches.
- **The Supabase project itself.** The wall removes read traffic; it does not pause the database,
  and idle-project billing continues.

## Design notes

- The wall's flag fails **open**, unlike the kill switches in `@repo/config`, which fail closed.
  Those stop a workload, where the expensive mistake is running something you meant to stop. This
  one stops the entire public surface, where the expensive mistake runs the other way.
- The 503 is sent `no-store` with `Vary: Cookie` rather than being CDN-cached. A cached 503 would
  eventually be served to an operator holding a valid bypass, and the saving would be small: the
  expensive part of a request here is the function render and the database round trip, and neither
  happens either way.
- `proxy.ts`'s `config.matcher` had to widen to every path so the wall can answer any URL. A
  matcher cannot be computed from `process.env` — Next requires it to be statically analyzable —
  so the old, narrower security/normalization surface is enforced at runtime by
  `isSecurityNormalizedPath` instead, and is asserted unchanged by
  `src/lib/maintenance/maintenance.test.ts`.
