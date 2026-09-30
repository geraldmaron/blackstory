# Cost and resource exhaustion controls

**Status:** Policy matrices and evaluators are in-repo. Vercel/Cloudflare/Supabase provider limits and billing controls require provider verification; optional GCP budgets, queues, and jobs are not provisioned by this repository.
**Depends on:** the shared Vercel `apps/web` deployment, [optional ingress / Cloud Armor design](./ingress-armor.md), and [rate limits](./rate-limits.md)
**Threats:** [T-01](./threat-model.md#t-01-volumetric-and-application-layer-denial-of-service), [T-13](./threat-model.md#t-13-database-exhaustion-and-connection-starvation), [T-14](./threat-model.md#t-14-cloud-bill-exhaustion)

## Objective

Ensure a traffic spike, retry storm, or budget burn cannot scale every service without bound. Optional research workloads stop before public historical serving. All evaluators **fail closed** when limits are exceeded or policy is unknown.

## Control layers

| Layer | Scope | Implementation |
|-------|-------|----------------|
| Application runtime scaling | Provider and service concurrency limits | `DEFAULT_SERVICE_SCALING_LIMITS` is a policy evaluator; Vercel limits require provider configuration and are not asserted here |
| Optional GCP queues | Rate, concurrency, depth, retries | `DEFAULT_CLOUD_TASKS_POLICIES`; no live Cloud Tasks deployment is asserted |
| Optional GCP jobs | CPU, memory, duration, retries | `DEFAULT_CLOUD_RUN_JOB_POLICIES`; no live Cloud Run Jobs deployment is asserted |
| Database | Connections, statement/lock timeouts | `DEFAULT_DATABASE_LIMITS` |
| Daily budgets | Geocoder, model, OCR, source fetch, research | `DEFAULT_DAILY_BUDGETS` |
| Billing alerts | Threshold → automated response | `DEFAULT_BILLING_ALERTS` |
| Soft shutdown | Tier ordering under pressure | `DEFAULT_SOFT_SHUTDOWN_POLICY` |
| Circuit breaker | Fail closed on repeated failures | `evaluateCircuitBreaker` |

## Workload tiers

| Tier | Examples | Shutdown priority |
|------|----------|-------------------|
| `public_serving` | web, api-public | **Preserved** — never auto-disabled |
| `essential_ops` | submissions, internal, publication jobs | Second |
| `optional_research` | research campaigns, URL fetch | **First** |

`autoDisablePublicCorpus` is hard-coded `false`. Full read-only mode requires an explicit operator choice.

## Build-time spend (Vercel)

Every control above governs **runtime** resource exhaustion. The Aug 2026 invoice showed that is
only half the surface: of $234.41 on Vercel, **$64.68 was Build CPU Minutes** (12d 23h, list price
before volume discount — see the team-wide breakdown below for the billed figure) — the
second-largest line, and one no evaluator in this document can see. Build spend is not a traffic
spike; it scales with commit velocity, and this repo ran 437 commits in Aug 2026.

**Control:** [`scripts/vercel-ignore-build.sh`](../../scripts/vercel-ignore-build.sh), wired as
`ignoreCommand` in `apps/web/vercel.json` and `apps/api-public/vercel.json`. It skips a build when
no changed file can reach that project's deployed bundle. (Historically also wired in
the retired separate admin Vercel project before the shared `/admin` surface folded into
`apps/web` on 2026-09-11.)

### Team-wide cost attribution (corrected, 2026-09-12)

The original version of this analysis (and the bead that tracked it, `repo-46hn`) scoped the Aug
2026 invoice to two Vercel projects. The team `geralddagher-site/geraldmarons-projects` actually
bills across six. Per-project **deploy counts** from `/v6/deployments` cap at 100 and can't settle
that; per-project **billed cost** can, via the Vercel CLI's usage API:

```bash
vercel usage --from 2026-07-25 --to 2026-08-24 --group-by project --format json
```

(`2026-07-25` matches the invoice window this doc and `repo-46hn` cite. In this window the CLI's
`pricingQuantity` — list cost before volume discount — for team-wide Build CPU Minutes is $65.07,
which is what the $64.68 above and the `vercel-ignore-build.sh` header comment actually measured;
`billedCost`, the post-discount figure below, is lower.)

| Project | Billed cost | Share |
|---------|-------------|-------|
| `blackstory` | $188.59 | 79.9% |
| `blackstory-admin` (retired 2026-09-11, decommission pending — `docs/decisions-carryover.md`) | $21.53 | 9.1% |
| Unattributed (Pro plan base fee) | $20.00 | 8.5% |
| `geralddagher-site` | $5.64 | 2.4% |
| `phs-reunion` | $0.34 | 0.1% |
| `qtscorner-site` | $0.02 | <0.1% |
| `the-administration` | $0 | 0% |

Team total in this window: $236.12 billed, against the $234.41 invoice figure this doc and the
bead cite — the ~$1.71 gap is the UTC/LA-midnight query window not landing exactly on the
provider's own billing-cycle cutoff, not a data error. `blackstory-api` (joined the team's
deploying set 2026-09-10, `repo-rvf54`) has no Aug-2026 usage; it postdates this window.

This settles `repo-46hn`'s three open items:

1. **`geralddagher-site` is 2.4% of team spend, not "a comparable share of Build CPU Minutes to
   blackstory"** as the bead originally worried. The deploy-count read (100+, API-capped)
   overstated it — deploy count and Build CPU Minutes don't move together for a project whose
   builds are small ($5.36 of $47.29 team-wide Build CPU, billed). Current data does not justify
   extending `vercel-ignore-build.sh`'s `ignoreCommand` to it; revisit if its spend grows
   materially.
2. **Fast Origin Transfer and Fluid Active CPU are concentrated on `blackstory`**: $80.86 of the
   team's $80.88 Fast Origin Transfer (99.97%) and $52.85 of $52.95 Fluid Active CPU (99.8%).
   Crediting the Aug-22 atlas split's reduction in these two lines to `blackstory` alone is
   correct; no other project's traffic dilutes it.
3. **`blackstory-admin`'s $21.53 is almost entirely Build CPU Minutes** ($21.53 of its $21.53
   total — everything else on that project rounds to zero), consistent with a dormant app
   rebuilding on every push with no serving traffic, not active use. Its Vercel project is
   retired (`docs/decisions-carryover.md`); decommission needs an operator with dashboard access.

Measured against Aug 2026 history (per commit), when admin was still a separate Vercel project:
**60% of commits skippable for web, 78% for admin**.
Realized saving depends on push granularity — the rule is evaluated per *deployment*, so a push
batching one relevant commit with twenty irrelevant ones still builds. A day-batched simulation
skips only 2 of 21 days. Actual behavior sits between those bounds.

The script **fails open**: every uncertain branch builds. A needless build costs cents; a wrongly
skipped build means production silently does not get the fix and nothing reports it.

## Cloudflare edge cache posture

`blackstory.app` is **Cloudflare-proxied** (orange cloud) in front of Vercel, on the **Free**
plan. Zone `653abe0dbd1b10d22411306cb1f645be`. The cutover runbook's DNS row said gray cloud /
DNS-only until 2026-08-24; that was stale, and it mattered — gray cloud would make every rule
below a no-op.

**Cache rule** (ruleset `fbba310d91a3483f88cc5686b25684e1`, phase `http_request_cache_settings`):
`/`, `/library`, `/memorial`, excluding requests carrying the `rsc` header, are edge-cached for
one hour with `browser_ttl: respect_origin` and `status_code_ttl` `200-226 -> 3600`,
`300-526 -> 0`.

The final rule bypasses shared caching when the request carries the `bs_maint_bypass` cookie,
the `x-maintenance-bypass` header, or the `maintenance_bypass` query parameter. This prevents
an operator's successful maintenance response from entering the anonymous cache. Purge the
zone after enabling the wall, then verify anonymous maintenance both before and after an
operator request. A Vercel redeploy does not invalidate Cloudflare's existing HTML cache.

Three constraints that are not obvious and cost a live incident on 2026-08-24 when they were
missed:

1. **`browser_ttl` must be set explicitly.** Omit it and the zone's Browser Cache TTL applies.
   That default was `14400`, so the first version of this rule answered `/` with
   `cache-control: max-age=14400` while the site was serving a maintenance **503** — pinning that
   503 in every visitor's own browser for four hours, where no CDN purge can reach it. The zone
   setting is now `0` (Respect Existing Headers), so the origin's `Cache-Control` governs.
2. **`300-526 -> 0` is mandatory, not tidiness.** Without it the maintenance 503 caches at the
   edge and outlives the wall.
3. **Do NOT add a custom cache key here.** "Ignore query string" *is* available on Free (only
   per-parameter include/exclude is Enterprise), so it is tempting. It was wrong when `/` still
   rendered Atlas filters: collapsing `state`/`era`/`kind` would have served one state's page to
   everyone. `/` is now the Door and ignores facet query; leftover `?state=` 308s to the bare
   path. The faceted long tail lives on `/explore`. `/atlas/catalog` and `/sitemap.xml` are
   separate origins that must not be cache-busted by junk query. `cache_by_device_type` is off
   for the same reason in reverse — it splits each entry three ways for a site that serves no
   device-specific HTML.

A second rule, `Cache HTML at edge`, is present but **disabled**: its expression was an empty
wildcard (`http.request.full_uri wildcard r""`), zone-wide and unreviewed. Left in place rather
than deleted so its intent can be recovered before someone re-creates it.

**Verified on live 200s, 2026-08-25**, after the maintenance wall came down:

| Probe | Result |
|-------|--------|
| `/` repeat requests | `cf-cache-status: HIT`, `age` climbing — repeat front-door hits never reach Vercel |
| `/?state=AL` | 308 to `/` — Door has no facet query; junk keys must not fork the HTML cache |
| `/` with `rsc: 1` | `DYNAMIC` — the bypass holds, RSC and HTML never share an entry |
| `/atlas/catalog` | `x-vercel-cache: MISS` then `HIT`, `HIT` with rising `age` |

Two things that settle long-standing questions:

**Vercel DOES honor a route handler's `s-maxage`** (`repo-27nn`). The whole 2026-08-22 shell/catalog
split rested on that premise and it had never been tested, because a dynamic *page* has its header
overwritten with `no-store`. A route handler keeps its own. Confirmed.

**The payload is gone.** `/` is now **33.6 KB gzipped** (372 KB raw), against the ~15–17 MB RSC
payload that was, by itself, the July–August Vercel bill. `/atlas/catalog` carries the 949 KB
(gzipped) catalog and is CDN-cached. The Door must not re-embed that catalog as `catalogFeatures`
on the client; spotlight `pin-N` is resolved on the server.

**Origin cost pass, 2026-09-01.** Named AI-training crawlers (`GPTBot`, `ClaudeBot`, …) get a
cached 403 on `/explore`, `/atlas/catalog`, `/sitemap.xml`, and the search/refine/geocode APIs.
Googlebot is not denied. `/sitemap.xml` is a route handler with `s-maxage` so crawler polling
does not rebuild the URL list on every hit. Search/locate/explore refine stay rate-limited via
`@repo/security`. `autoDisablePublicCorpus` stays false.

Note the browser still receives `private, no-cache, no-store` on `/` while Cloudflare serves a
`HIT`. That is the intended split: `override_origin` caches at the edge, the origin's header passes
downstream untouched, so no visitor caches a dynamic page locally.

### Second rule: request-rendered document surfaces (inert; redesigned 2026-09-22)

**Measured 2026-09-22 (morning): this rule cached nothing; converted the same day, see the
operator step below.** `curl -I` on live paths at the time: `/entity/*` and
`/stories/*` answer `cf-cache-status: BYPASS`; `/place/*` (3,690 sitemap URLs), `/invention/*`,
`/lives`, `/rooms`, `/about`, `/records` and `/explore` answer `DYNAMIC` because no rule matches
them. Only `/` and `/memorial` hit. The root layout is `force-dynamic` for the nonce CSP, so every
document answers `private, no-cache, no-store`, and `edge_ttl: respect_origin` honors that. The
2026-09-19 reconciliation that introduced `respect_origin` reasoned from Next's rendering mode
and never probed the header. Every one of 4,200+ record pages is still served from a Vercel
function on every request, human or crawler; current-period usage implies ~4.8M invocations in
four weeks against ~1.8k analytics pageviews, so the origin load is almost entirely crawlers,
and it becomes human load on announcement. Tracked as `repo-ogo3j.3`.

Override-origin caching of a request-rendered document IS nonce-safe: the cached `/` carries a
CSP header whose nonce matches the two `nonce=""` attributes in its own HTML, because the edge
stores header and body together. The 2026-09-19 failure (framework scripts without a nonce) was
Next *static prerendering*, which cannot know a nonce at build time; edge caching of a rendered
response is a different thing and does not have that problem.

#### Target design: three layers, one policy

| Layer | Scope | TTL | Set by |
|---|---|---|---|
| Cloudflare rule 1 (live) | `/`, `/library`, `/memorial` | 1 h edge, browser respects origin | zone cache rule, `override_origin` |
| Cloudflare rule 2 (operator, pending) | every rendered public surface below | 1 h edge, browser respects origin | zone cache rule, **must become `override_origin`** |
| Vercel CDN (in code, pending deploy) | every rendered public surface | 5 min fresh, 1 h stale-while-revalidate | `Vercel-CDN-Cache-Control` from `apps/web/src/proxy.ts` |

The Vercel layer exists because a `Cache-Control` from `next.config.mjs` loses to Next's own
`no-store` on a dynamic page (measured 2026-08-09), while `Vercel-CDN-Cache-Control` is consumed
by Vercel alone, outranks `Cache-Control` in its cache, and is never forwarded. It is attached
only to a GET/HEAD for a path the surface registry (`apps/web/src/lib/nav/surface-classes.ts`)
classifies as a rendered surface, never to an endpoint, `/admin` or a correction receipt. RSC
payloads carry it as well: Next strips the `rsc` header before the proxy runs, so they cannot be
told apart there, and the page's `Vary: rsc, next-router-state-tree, …` makes Vercel key the
entry on those request headers, which keeps an RSC navigation and the HTML document in separate
entries. Cloudflare Free cannot vary on headers, which is why its rules exclude `rsc` instead. The dead `bs-stand` cookie the proxy used to set on
`/place/*` responses was removed in the same change: Vercel does not cache a response that
carries `Set-Cookie`, nothing read the cookie, and Cloudflare's handling of `Set-Cookie` under an
override rule is ambiguous enough not to rely on.

**Observed 2026-09-22 after the production deploy (`f0c51506`): NOT honored.** With Cloudflare
bypassed (rule 4's `x-maintenance-bypass` header), three consecutive requests for an entity
page, two for a place page and two for `/explore?state=GA` all answered `x-vercel-cache: MISS`;
`/design-system`, which no Cloudflare rule covers, did the same without any bypass. Vercel's
cacheability list ("no `private`, `no-cache` or `no-store` in `Cache-Control`") wins over the
targeted header on a Next dynamic page. The header is inert and costs nothing; Cloudflare is the
only document cache. Follow-up `repo-ogo3j.11`: remove the header, or implement Vercel's own
recipe for this case (a middleware self-fetch that re-stamps the nonce on cached HTML).

Verified in the same probe: `x-vercel-id: iad1::pdx1::…` on function-rendered responses from
both projects (the `pdx1` pin is live); `/v1/map` answers `x-vercel-cache: HIT` with `age: 1` on
the second request, 0.86 s instead of 6.9 s.

**Artifact egress, corrected 2026-09-22 15:00 UTC.** The production runtime log for the new
fetcher reads `release artifact downloaded in 483–1616ms { encoding: 'br' }` for every first
load by the `pdx1` instances, while Supabase `edge_logs` records `content_length: 17665068` and
`8310554` for those same requests. So that log field reports the object's identity size on a
CDN cache hit even when the body was served brotli-compressed, and the old fetches (undici
negotiates brotli by default) were very likely compressed as well. The "54 GB/day" in
`repo-ogo3j.2` is therefore an upper bound in identity bytes; actual transfer was probably
5–8× smaller and the Supabase line was a few dollars a month, not tens. The conditional-GET
refresh still retires it: a 304 carries no body at all. The decisive check is `status = 304`
rows in `edge_logs` from the `pdx1` addresses once their first 30-minute refresh comes due.
**Observed 15:22:55–15:22:58 UTC:** instance `44.250.211.113` (first load 14:47) revalidated
both `search-index.json` and `entities.json` with `304`, no body. New instances still make one
compressed first load each (`200`), which is the remaining, instance-count-bound cost.

#### Operator step: convert rule 2 — DONE 2026-09-22 (dashboard, operator session)

Rule 1 in the zone's cache-rule order (id `8e9ff2ff1aac42008fa3536bdd73ba3e`, renamed "HTML edge
cache - record and reading surfaces (override origin, 2026-09-22)") now carries the expression
below with `override_origin`, default 1 h, status-code TTL 200-226 → 1 h and 300-526 → no cache,
browser TTL respect origin, cache key untouched. Live probe two minutes after save, second
request of each pair: `/entity/*`, `/place/*`, `/stories/*`, `/invention/*`, `/about`,
`/records`, `/lives`, `/explore?state=GA` and `/explore?state=AL` all `MISS` → `HIT` (and the two
Explore bodies differ); `/entity/*` with `rsc: 1` stays `DYNAMIC` with a `text/x-component` body;
`/corrections/status/*` stays `DYNAMIC`; `/atlas/catalog` unchanged (Vercel `HIT`); `/` still
`HIT`. The steps are kept for the next zone that needs them.


1. `GET /zones/653abe0dbd1b10d22411306cb1f645be/rulesets/fbba310d91a3483f88cc5686b25684e1` and
   copy rule 1's `action_parameters` verbatim (`cache: true`, `edge_ttl.mode: override_origin`,
   default 3600, `status_code_ttl` 200-226 → 3600 and 300-526 → 0, `browser_ttl.mode:
   respect_origin`). Rule 1 is the proven shape; do not retype it.
2. `PATCH .../rulesets/{ruleset}/rules/{rule-2-id}` with those `action_parameters` and this
   expression (keep the existing `rsc` exclusion and the maintenance bypass rule ordering):

   ```
   (http.request.method eq "GET") and not any(http.request.headers.names[*] == "rsc") and (
     http.request.uri.path eq "/explore" or http.request.uri.path eq "/rooms" or
     http.request.uri.path eq "/records" or http.request.uri.path eq "/about" or
     http.request.uri.path eq "/faq" or http.request.uri.path eq "/methodology" or
     http.request.uri.path eq "/sources" or http.request.uri.path eq "/errata" or
     http.request.uri.path eq "/data" or http.request.uri.path eq "/lives" or
     http.request.uri.path eq "/stories" or http.request.uri.path eq "/books" or
     http.request.uri.path eq "/law" or http.request.uri.path eq "/submit" or
     http.request.uri.path eq "/privacy" or http.request.uri.path eq "/terms" or
     http.request.uri.path eq "/support" or
     starts_with(http.request.uri.path, "/entity/") or
     starts_with(http.request.uri.path, "/place/") or
     starts_with(http.request.uri.path, "/invention/") or
     starts_with(http.request.uri.path, "/stories/") or
     starts_with(http.request.uri.path, "/books/") or
     starts_with(http.request.uri.path, "/law/") or
     starts_with(http.request.uri.path, "/lives/")
   )
   ```

   `/explore` keeps its query string in the cache key (the default); do NOT add "ignore query
   string" here, one state's Atlas would be served to everyone. `/corrections/*` stays out.
3. Add a third rule for the JSON endpoints that already send `public` cache headers so repeat
   fetches stop counting as Vercel data transfer: `/atlas/catalog`, `/atlas/photos`,
   `/door/photos`, `/sitemap.xml`, `/errata/feed.json`, `/errata/feed.xml`, `edge_ttl:
   respect_origin` (they say 300–3600 s themselves).

#### Control: purge after an in-place correction

A correction written to `published.*` under the same release id reaches Vercel's cache within
five minutes on its own (`s-maxage=300`) but stays in Cloudflare for up to an hour. After the
catalog republish in `CLAUDE.md` ("Republishing the CDN catalog after a published write"),
purge the zone; Free supports purge-everything and single-URL purge only:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/653abe0dbd1b10d22411306cb1f645be/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Maintenance mode has the same shape: enabling the wall does not evict cached 200s from either
layer. Purge the zone (already in the maintenance runbook) and Vercel's CDN (Project → Settings →
Caching → Purge, or redeploy) if the wall must be immediate.

#### Post-deploy probe table (run twice per row; second answer is the one that matters)

| path | expect |
|---|---|
| `/entity/<id>` | `cf-cache-status: HIT` (observed 2026-09-22); Vercel layer stays `MISS`, see above |
| `/place/<slug>` | same, and no `set-cookie` (observed) |
| `/explore?state=GA` | `HIT`, and `/explore?state=AL` a different body (observed) |
| `/entity/<id>` with `rsc: 1` | Cloudflare `DYNAMIC`; Vercel may `HIT` on its own Vary-keyed entry, and the body must be `text/x-component`, never the HTML |
| `/corrections/status/<code>` | no `Vercel-CDN-Cache-Control` reaches Vercel; `MISS` |
| `/admin/login` | `MISS` |

## Crawler and cache-busting controls (2026-09-29, repo-4wb0e)

Measured over 23 h: 128,601 of ~192k eyeball requests were Cloudflare misses, and `/records`
(46,876) and `/explore` (34,147) were most of them. Named crawlers (Amzn-SearchBot, SemrushBot,
Claude-SearchBot) plus what looks like one scraper rotating nine Chrome UA strings. Each miss is an
origin render, and origin load drives Fluid instance churn, which drives the ~25 MB per-instance
catalog download (6,824 full loads that day).

| Layer | Control | Where |
|---|---|---|
| Edge canonicalization | `/records` now normalizes like `/explore`: unknown keys, bad facet values (topic vocabulary, `state` postal, `evidence` A–C, slug shape, `page` ≤ 1000, `q` ≤ 120) 308 to one canonical URL. Explore's free-value keys (`theme`, `tone`, `near`, `find`, `selected`, `edge`, `decade`, ...) are shape-checked the same way. | `proxy.ts`, `lib/records/records-query.ts`, `lib/map-experience/url-state.ts` |
| Crawl policy | `robots.txt` keeps the general crawler off filter combinations (`/records?*&`, `/records?q=`, `/explore?`) and disallows SEO-tool crawlers entirely. Bare pages, single-facet `/records` and pagination stay crawlable. | `app/robots.ts`, `lib/traffic-class/agent-lists.ts` |
| Named-crawler deny | Uncached 403 on `/explore`, `/records`, catalog, sitemap and the APIs for AI crawlers (training and, since 2026-09-30, answer/search fetchers) and SEO-tool crawlers. The 403 is `private, no-store`: the CDN keys on URL, so a shared-cacheable 403 could reach readers. | `lib/traffic-class/edge-deny.ts` |
| Per-IP burst | Cloudflare rate-limit rule (below). **Operator step pending:** add `or http.request.uri.path in {"/records" "/explore"}` to its expression. 60 requests / 10 s per IP is far above any reader. | Cloudflare dashboard |

Not yet closed: the origin accepts requests that bypass Cloudflare (`--resolve blackstory.app:443:76.76.21.21`
answers 200), so a scraper that skips DNS skips the rate limit and cache (`repo-4wb0e.4`).

## Cloudflare zone security posture (blackstory.app)

Audited and hardened 2026-08-25. Zone `653abe0dbd1b10d22411306cb1f645be`, Free plan.

| Setting | Was | Now | Why |
|---------|-----|-----|-----|
| `min_tls_version` | `1.0` | **`1.2`** | TLS 1.0/1.1 are deprecated and disallowed under PCI-DSS. Verified after the change: a TLS 1.1 handshake is refused, 1.2 succeeds. |
| `always_use_https` | `off` | **`on`** | Cloudflare now 301s `http://` to `https://` at the edge. Verified. |
| `ssl` | `full` | **`strict`** | `full` does not validate the origin certificate. Precondition verified BEFORE flipping, because `strict` against an invalid origin cert is a total outage (526): probed `76.76.21.21` directly with `--resolve` and got `ssl_verify_result=0`, i.e. Vercel presents a valid cert for this hostname. |
| `browser_cache_ttl` | `14400` | **`0`** | See the cache section above — this was the cause of the 2026-08-24 cached-503 incident. |

**HSTS is deliberately NOT set at Cloudflare** and should stay that way. The app already sends
`Strict-Transport-Security: max-age=63072000` from its own security headers
(`apps/web/src/lib/web-security/`), which is the right layer: it stays with the app across hosts
and is reviewable in the repo. Cloudflare's zone HSTS toggle reads `enabled: false`; that is not a
gap, and switching it on would create a second, invisible source of truth for the same header.

**Not changed, deliberately.** `geralddagher.com` and `bengalsreunion.com` are on the same account
and still carry `min_tls_version: 1.0` and `browser_cache_ttl: 14400` (and `bengalsreunion.com`
has `always_use_https: off`). They are separate properties with origins that have not been
verified here, and `ssl: strict` in particular is an outage if the origin cert does not validate.
Audit them on their own terms before copying this posture across.

## Bot traffic at the edge

Owner decision 2026-09-30: search engines, link-preview fetchers and archivers are welcome; AI
crawlers (training **and** answer/search fetchers), SEO-tool crawlers, scanners and scripted
clients are not. robots.txt and `/ai.txt` ask; the Cloudflare WAF custom rules enforce, before the
cache, so a refused request never reaches Vercel (the app's own 403 in `apps/web/src/proxy.ts`
still costs an invocation).

| Rule (`ref`) | Action | Matches |
|---|---|---|
| `bs_bot_ai_crawlers` | Block | every token in `AI_TRAINING_USER_AGENTS` (`apps/web/src/lib/traffic-class/agent-lists.ts`) |
| `bs_bot_seo_crawlers` | Block | every token in `SEO_TOOL_USER_AGENTS` (same file): Semrush, Ahrefs, MJ12, DotBot, BLEX, DataForSEO, Seekport, Serpstat, Barkrowler, MegaIndex |
| `bs_bot_scanner_paths` | Block | `/.git*`, `/.env*`, `/wp-*`, `*.php`, `/phpmyadmin`, `/cgi-bin` |
| `bs_bot_crawl_trap` | Managed challenge | `/records` or `/explore` with `&` in the query, not a verified bot |
| `bs_bot_scripted_clients` | Managed challenge | python-requests, Go-http-client, scrapy, headless browsers, empty UA; not `/api/*`, the maintenance bypass, or verified bots (`curl` deliberately allowed) |

Plus Cloudflare's **AI bot policies** (Security Settings → Configure AI bot policies), which
replaced the single "Block AI bots" toggle on 2026-09-15: **Training** and **Agent** are blocked
on all pages; **Search** stays allowed on purpose, because since Cloudflare's July 2026 taxonomy it
covers conventional search engines (Googlebot, Bingbot) as well as AI search, so blocking it would
take the site out of search. The AI search crawlers we refuse (OAI-SearchBot, PerplexityBot,
Claude-SearchBot, Amzn-SearchBot) are blocked by name in `bs_bot_ai_crawlers` instead. Bot Fight
Mode is left off. Where the two AI lists disagreed (repo-4wb0e kept Claude-SearchBot and
Amzn-SearchBot on cached record pages), the owner chose the more restrictive list (2026-09-30).

All five custom rules use the Free plan's five.

Applied 2026-09-30 with a token scoped to this zone only (Zone WAF: Edit, Bot Management: Edit;
1Password "Cloudflare API · BlackStory bot rules (blackstory.app)"). Verified the same day from a
residential IP: GPTBot, AhrefsBot, Amzn-SearchBot, Claude-SearchBot and Claude-User get 403 on
`/about`; `/.git/config` gets 403; `python-requests` and an empty user agent are challenged; a
browser user agent gets 200 on `/`, `/about` and single-parameter `/records`; a two-parameter
`/records` URL is challenged and a real browser clears it without interaction; Slackbot gets 200;
`/api/*` is not challenged. A spoofed `Googlebot/2.1` from a non-Google IP still gets 200, since
nothing here targets it. robots.txt and `/ai.txt` only list the newer agents once this list is
deployed; the edge enforces them already. Apply or re-apply (idempotent, dry run by default) with
`scripts/cloudflare-bot-rules.mts`; after editing the agent list, re-run it so the edge matches
robots.txt. Watch Security → Events for a day after any change: Free has no log-only action.

`api.blackstory.app` is not proxied by Cloudflare, so none of this covers it (`repo-ogo3j.7`), and
neither does traffic that reaches Vercel directly (`repo-4wb0e.4`, see "Origin lock" below). If
`api.blackstory.app` is ever proxied, exempt it from `bs_bot_scripted_clients` first: that rule
only exempts `/api/*` paths, and the Android app's default user agent is `okhttp`.

### Origin lock (repo-4wb0e.4)

Vercel serves every domain it hosts from one anycast address, so `Host: blackstory.app` sent to
`76.76.21.21` skips every rule above. Measured 2026-09-30: GPTBot gets `/about` 200 there (403
through Cloudflare), and `python-requests` gets a two-parameter `/records` 200 (challenged through
Cloudflare); `www` behaves the same.

**Design.** Cloudflare stamps a secret request header on every request it proxies (Transform Rule
`bs_origin_auth`, header `x-bs-origin-auth`); a Vercel firewall custom rule (`bs-origin-auth`)
matches requests to `blackstory.app` or `www.blackstory.app` whose header is missing or matches no
accepted secret. Vercel does not bill WAF-denied traffic (no CDN requests or data transfer), so
bypass traffic stops costing anything. `blackstory-admin.vercel.app` is deliberately out of scope:
it is how staff reach `/admin` and never passes through Cloudflare. Both halves are code:
`scripts/origin-lock.mts` (idempotent; dry run by default; `--verify` probes both networks and
proves which one answered).

**Why this and not something stronger.** Cloudflare rates header validation "moderately secure";
its "very secure" options do not fit a Vercel origin (no `cloudflared` on Vercel, no
Authenticated Origin Pulls on Vercel, and JWT validation would mean middleware on every request,
the invocation this is meant to avoid). An allowlist of Cloudflare IP ranges is weaker: anyone can
point their own Cloudflare zone at Vercel with our hostname. The secret is a cost control, not
authentication; nothing sensitive may rely on it. It lives in 1Password (`BlackStory origin auth
header`, fields `password` = current and `previous`) and is never printed; the script shows
sha256 fingerprints.

**Rollout.** `--apply --mode=log` first, then watch what the rule matches (Vercel dashboard,
Firewall) for real traffic before `--apply --mode=deny`. A deny apply refuses to run unless
Cloudflare already sends an accepted secret, and rolls itself back to log if a normal request
through Cloudflare stops returning 200. Rollback by hand: `--apply --mode=log`, or disable the
rule in the Vercel dashboard (Firewall, Custom rules).

**Rotation, with no gap.** In 1Password copy `password` into `previous` and generate a new
`password` (48+ characters, letters and digits); `--apply --mode=deny` (Vercel accepts both before
Cloudflare switches to the new value); once it has propagated, clear `previous` and apply again.
Rotate if the value may have leaked, and when anyone with Vercel or Cloudflare access leaves.

**Single edge, later.** Vercel recommends against any reverse proxy in front of it (it blinds the
Vercel firewall and bot detection and adds latency); with no proxy there is no origin to bypass.
The data from 2026-09-30: Cloudflare served 1.93M requests in the eight days to 2026-09-30, only
11.5% from cache (8% of bytes), and September's Vercel bill had $0 of CDN requests and data
transfer (Flat Rate CDN covers them) against $107 billed overall, the largest lines being build
CPU ($33.80), function CPU ($22.63), observability events ($12.03) and origin transfer ($11.84).
So Cloudflare's cache saves roughly nothing today; its value is the free rules and rate limit,
which Vercel's firewall can take over (custom rules free, rate limiting usage-billed). The move is
a DNS decision for the owner (`repo-4wb0e.7`). The admin alias is a second, smaller bypass
(`repo-4wb0e.8`).

## Platform spend backstop

Optional GCP billing budgets do not cover Vercel or Supabase, where the Aug 2026 spend
actually landed. Two gaps remain **operator-only** (dashboard, not code):

| Gap | Control | Issue |
|-----|---------|-------|
| No hard cap on Vercel on-demand spend | Spend Management → amount + pause-on-threshold | `repo-n7jq` |
| Supabase compute billed on 3 active projects | Two of the three are not BlackStory — see [foreign Supabase projects](../operations/foreign-supabase-projects.md). Their fate is an owner call, not this backlog's. | — |

The precedent for why a cap matters is recorded in
[`packages/ops-data/scripts/check-public-read-egress.ts`](../../packages/ops-data/scripts/check-public-read-egress.ts):
a catalog-read regression ran for 20 days and ~253GB of egress because nothing was watching, and
was found by hand after the bill.

## Package layout

| Path | Role |
|------|------|
| [`packages/security/src/resource-controls.ts`](../../packages/security/src/resource-controls.ts) | Policy matrices, evaluators, abusive-traffic simulation |
| [`packages/security/src/resource-controls.test.ts`](../../packages/security/src/resource-controls.test.ts) | Unit tests |
| [`infra/gcp/cost-controls/`](../../infra/gcp/cost-controls/) | Optional declarative GCP stubs + conditional hard-stop runbook |

## Related controls

- **Shared `/admin` runtime:** staff authorization is in the Vercel-hosted `apps/web` deployment; any provider scaling or spend cap must be checked in Vercel, not inferred from the optional GCP policy matrix.
- **Endpoint quotas:** [Rate limits](./rate-limits.md) describes the policy math and remaining deployment checks.

## Retry policy

All queues and jobs use capped exponential backoff:

```
delay = min(initialBackoffMs × multiplier^(attempt-1), maxBackoffMs)
```

`isRetryBudgetExhausted` fails closed when `attempt >= maxAttempts`.

## Budget automated responses

| Response | Effect |
|----------|--------|
| `alert_only` | Notify only |
| `throttle_optional` | Reduce optional workload dispatch rate |
| `pause_research` | Pause research queues and jobs |
| `disable_geocoder` | Reject new geocode requests |
| `disable_model` | Block LLM calls (future ) |
| `disable_source_fetch` | Pause URL/source fetch workers |

## Manual hard-stop

Conditional GCP procedure, only if those resources are actually provisioned: [`infra/gcp/cost-controls/hard-stop-runbook.md`](../../infra/gcp/cost-controls/hard-stop-runbook.md). Current Vercel/Cloudflare/Supabase incidents require provider-specific controls.

## Validation

```bash
pnpm --filter @repo/security test
node --test infra/gcp/cost-controls/cost-controls.test.mjs
```

## Acceptance mapping

| Criterion | Evidence |
|-----------|----------|
| Traffic spike cannot scale without bound | `assertAllServicesBounded`, `evaluateScalingCap`, matrix `services[].maxInstances` |
| Capped exponential backoff retries | `computeRetryDelay`, `assertRetryPoliciesBounded` |
| Optional research stops before public serving | `evaluateSoftShutdown`, `assertShutdownOrdering` |
| Budget alerts + automated responses | `evaluateDailyBudget`, `billingAlerts` in matrix |
| Abusive traffic simulation | `simulateAbusiveTrafficPattern` tests |

## Follow-on

- : Cost anomaly dashboards and alerts
- : Kill switches wired to automated responses
- : Load/abuse/cost integration tests against staging
