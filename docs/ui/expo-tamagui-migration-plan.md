# Expo web + Tamagui migration: audit, visual pass, cost and SEO risk

Status: plan only, no code changed. Date: 2026-10-16. Decision recorded: web moves to Expo web
(React Native Web) with Tamagui, sharing one design system with the Expo mobile app.

Verdict: **accepted with controls.** The move is feasible, but not as a big-bang rewrite. Two
gates (below) must pass before any surface migrates.

## 1. Audit: what exists today

Observed this session in the repo and on the running dev server (:3048).

| Area | Web (`apps/web`) | Mobile (`apps/mobile`) |
|---|---|---|
| Framework | Next.js 16, App Router, SSR | Expo 57, RN 0.86, Expo Router |
| Styling | 72 plain CSS files, 27,207 lines | `StyleSheet.create` in 81 files |
| Component kit | `packages/ui` (DOM + CSS) | `apps/mobile/src/ui` (own kit, own `tokens/`) |
| Workspace | pnpm workspace | **excluded** from workspace, own npm lockfile |
| Tamagui | none | none |
| Routes | 63 pages, 64 route handlers | file routes under `src/app` |

Two parallel design systems exist (web tokens in `packages/ui/src/tokens` + `tokens.css`, mobile
tokens in `apps/mobile/src/ui/tokens`). Unifying them is the real win.

### Token health (web CSS)

Better than expected. The CSS is already token-driven, so the token *values* port cleanly.

| Measure | Count | Read |
|---|---|---|
| `var(--…)` uses | 6,148 | Strong token adoption |
| Custom properties defined | 96 | Reasonable surface |
| Raw hex literals | 159 (20 distinct) | Leaks; top: `#6d675f` (31), `#d7d0c4` (26), `#8e4f2a` (21) |
| Raw `px` literals | 1,230 (139 distinct) | **Main drift.** 2px, 1px, 44px, 16px dominate; 3px/5px are off-grid |
| Radii | `--ds-radius-sm/md/full` dominate | Fine; 16 `0`, 15 `50%`, 11 `2px` one-offs |
| Fonts | 4 token families (mono 260, sans 137, display 96, editorial 73) | Clean |
| Breakpoints | at least 10 distinct (819px, 48rem, 47.9375rem, 40rem, 68rem, 64rem, 56rem, 560px…) | **Inconsistent**, mixes px/rem and 819 vs 768 |
| Inline `style={{}}` in TSX | 139 | Needs token routing |
| Largest CSS files | room-kit 2,854; shell 2,473; lives 1,840; reading-room 1,668; explore 1,481; door-home 1,319; record-room 1,139 | These seven are most of the migration effort |

## 2. Visual pass (375px mobile viewport, dark theme, dev server)

Routes checked: `/`, `/records`, `/stories`, `/about`, `/law`, `/data`. Desktop home screenshot
also taken. Overall look is cohesive and on-brand. No horizontal overflow on any route checked.

Findings:

1. **Shell search input is 26px tall** on every route (target 44px). Systemic, one fix.
2. **Header home link is 32px wide**; inline "Rooms" link is 39x27. Below 44px target.
3. **15 to 19 distinct font sizes per page**, including off-scale 10.5, 12.5, 13.5 and 18.0625px.
   The type ramp is not enforced.
4. **`/data` has 25 undersized interactive targets** (worst route checked).
5. Home (`/`) and `/explore` ship **no `<h1>` in server HTML** (door/map surfaces). Other routes
   have exactly one.
6. Next dev indicator overlaps the bottom tab bar. Dev-only, ignore.

Not yet done: light theme, tablet width, remaining ~50 routes, iOS Simulator pass, contrast
re-check. These belong in the automated suite (section 5), not more manual clicking.

## 3. SEO baseline (server HTML, must not regress)

Every checked page returns 200 with server-rendered `<title>`, canonical and `og:title`. `/methodology`
carries JSON-LD (4 blocks). Other routes had 0 JSON-LD in the checked set. `/search` returned a
redirect. Also present: `sitemap.xml`, `robots.ts`, `manifest.webmanifest`, 52 files exporting
metadata, 3 emitting JSON-LD. Timings from the dev server are not meaningful and are not used.

## 4. Migration cost and risk

### What Next.js is doing that Expo web must replace

| Dependency | Evidence | Expo web answer | Risk |
|---|---|---|---|
| Per-request CSP nonce, security headers | `src/proxy.ts` generates a nonce per request | Expo Router server output has middleware and header config (per Expo docs); static output only gets fixed headers | **High.** Nonce-per-request needs `output: "server"` |
| Maintenance gate, admin auth gate, AI-crawler deny | same `proxy.ts` | Middleware (server output) | High |
| DB-backed rendering | 29 app files touch data-access / postgres / `server-only` | Expo API routes or server rendering; no `server-only` guarantee | High, security-sensitive |
| Per-document edge caching | proxy sets CDN cache headers; Cloudflare + Vercel purge runbook | Different hosting target (EAS Hosting or custom), runbook rewrite | High |
| Metadata / JSON-LD | 52 `metadata` exports | `expo-router/head` per page | Medium, mechanical but wide |
| Next APIs | `next/link` 94, `next/navigation` 47, `next/server` 16, `next/cache` 6, `next/image` 2, `next/font` 2 | Expo Router `Link`/hooks, Expo image/fonts | Medium, mechanical |
| Client/server split | 102 `use client` files of 367 TSX | Everything becomes universal RN components | Medium |
| Map | MapLibre GL JS on web vs MapLibre Native on mobile | Platform-split `.web.tsx` / `.native.tsx` map components | High, protected experience |
| Admin surfaces | `/admin`, design-system management | Should stay off the public migration; a separate lane | Decide separately |

Stack constraint: Vercel + Supabase is the project stack (memory), and Vercel build budget is
nearly spent, so any hosting move needs its own decision.

### Tamagui on Metro

Per Tamagui docs, Metro is supported through `@tamagui/metro-plugin` reading `tamagui.build.ts`,
and the compiler can emit static CSS. Whether the optimizing compiler gives full extraction on
Expo web under our SDK 57 / RN 0.86 pins is **unverified**; the spike must measure it.

### Cost estimate (relative, not hours)

| Phase | Size | Notes |
|---|---|---|
| A. Unify workspace and tokens into Tamagui config | S-M | Fold mobile into the workspace; one token source |
| B. Shared component kit (Button, Card, Notice, Dialog, Timeline, DataTable, shell header…) | M | 27 DOM components in `packages/ui` plus 30+ mobile ones to merge |
| C. Server layer on Expo (middleware, API routes, headers, caching) | L | The largest risk, not styling |
| D. Surface migration (63 pages, 72 CSS files) | XL | By surface, seven big CSS files first |
| E. Map and protected experiences | L | Memorial, evidence honesty, precision rules override aesthetics |
| F. Cutover, redirects, SEO parity, hosting runbook | M | Must be proven on a staging domain first |

## 5. Test mechanism (proposal)

One suite, three layers, all runnable locally and in `scripts/ci-local.sh`:

1. **Token lint:** fail on raw hex, raw px outside a token file, off-scale font size, and
   unapproved breakpoint. Allowlist the 159 hex and 1,230 px today, then ratchet down.
2. **Visual regression:** Playwright screenshots of a fixed route list at 375 / 768 / 1280, light and dark.
   iOS Simulator screenshots for the same screens on mobile. Baselines checked in per surface.
3. **Rules checks on the rendered page:** tap targets at least 44px, one `<h1>`, no horizontal overflow,
   contrast from existing `contrast.test.ts`, axe-core accessibility.

Plus an **SEO parity test**: for every public URL, compare server HTML (title, canonical, og, JSON-LD,
`<h1>`, status, headers) between Next today and Expo after. This is the gate for cutover.

## 6. Design standards (draft, to confirm in step 3)

| Parameter | Proposed rule |
|---|---|
| Color | Semantic roles only (`background`, `surface`, `text`, `muted`, `accent`, `border`, `focus`) resolved by theme; no hex in components. Values come from `brand-palette.ts`. |
| Spacing | The existing `--ds-space-*` scale (`packages/ui/src/tokens/spacing.ts`, 4px rhythm). Literals other than 0, 1px, 2px are lint violations. |
| Type | The existing `--ds-text-*` ramp (display-hero to micro). Literal `font-size` is a lint violation. Four families stay. |
| Radius | none, sm 8, md 16, lg 28, full (existing). |
| Elevation | Flat; hairline borders (existing rule, keep). |
| Targets | 44px minimum for every interactive element. |
| Breakpoints | The existing `grid.breakpoints`: 40, 48, 64, 80rem (640, 768, 1024, 1280px), as Tamagui media tokens. Retire 819px, 560px, 56rem, 68rem. |
| Alignment | One content max-width per surface class and a shared gutter token. |
| Components | Shared kit only; a surface may not define a one-off button, card or input. |

## 7. Codex usage

Per `COORDINATION.md`: Claude leads and writes briefs; Codex implements well-specified,
worktree-isolated surface migrations (pattern A), and cross-reviews Claude's token and kit work
(pattern B). Each brief names files, forbids git and `bd`, and is reviewed by `git diff` before
acceptance. No fan-out beyond one delegate at a time without your say.

## 8. Gates and first steps

**Challenge.** Strongest failure mode: the server layer (section 4C) cannot reach parity and the
team ends up with a half-migrated site and two hosting stacks. Best alternative: keep Next for
the public web and share Tamagui tokens/components (the option you declined). Because that
alternative stays available, the first work is a reversible spike.

- **Gate 1, spike (reversible):** one public route (`/faq` or `/methodology`) on Expo Router web
  with Tamagui, on a throwaway branch. Pass if: server HTML matches the SEO parity list,
  per-request CSP nonce works, compiler extraction works on SDK 57, bundle and TTFB are no worse.
- **Gate 2, hosting decision:** pick the Expo server host (EAS Hosting or other) and cache/purge
  model. Needs you; it affects cost and the Vercel stack.

Next steps if approved: (1) add the token lint and Playwright visual suite against the current
site, to lock a baseline before anything moves; (2) run the Gate 1 spike; (3) fix the shell
tap-target and type-ramp findings in current CSS so the baseline starts clean.

## 9. Baseline suite (built 2026-10-16)

- `pnpm lint:tokens` (`scripts/lint-design-tokens.mjs`, wired into `pnpm validate`): ratchet over
  CSS. Baseline `scripts/design-token-baseline.json`: hex 151, spacing 365, font-size 541,
  breakpoint 90. Counts can only fall; `--update` refuses to raise them.
- `pnpm test:visual` (`packages/testing/src/visual`, Playwright 1.64.1, installed Chrome): 10 routes
  x 3 viewports x 2 themes = 60 screenshots plus 60 rule checks (overflow, title, canonical,
  og:title, at most one h1, 44px target ratchet). Two consecutive runs on the live catalog passed
  120/120. A deliberate CSS change failed the screenshot check.
- Limits: above-the-fold only; map canvases masked; baselines are macOS (platform-suffixed) and not
  yet a CI lane; data is the live published catalog, so a catalog change can move a screenshot.

## 10. Gate 1 spike results (Expo SDK 57 + Tamagui 2.7.7, `/methodology` slice)

Source in [`spikes/expo-web-methodology`](./spikes/expo-web-methodology/README.md) (reproduce steps there). Port of the page shell and real methodology copy. Observed in Chrome against `expo serve` on 2026-10-16.

| Check | Result |
|---|---|
| Server HTML: title, canonical, og:title, one h1, lang | **Pass** (static prerender at build) |
| JSON-LD | **Pass after a fix**: `<script type="application/ld+json">{json}</script>` as a child; `dangerouslySetInnerHTML` is dropped by `expo-router/head` |
| Per-request CSP nonce | **Fail.** Middleware (flag `unstable_useServerMiddleware` in SDK 57) can set a fresh nonce header per request, but the HTML is prerendered, so no script carries it. Browser blocked the hydration bundle and the page rendered dead. |
| Hash-based CSP instead | **Pass**: `script-src 'self' 'sha256-<hash of the one inline script>'` hydrated cleanly. Whether this is acceptable versus today's nonce policy is a security decision, not something this spike settled. |
| Response headers / cache-control from middleware | Pass |
| Per-request SSR with data loaders | Per the Expo docs (docs.expo.dev/router/web/server-rendering) it is `unstable_useServerRendering` in SDK 55-57 and stable in SDK 58. Not tested here, and not tested for nonce injection. |
| Tamagui compiler extraction | **Fail as configured.** Compiler runs only with `@tamagui/babel-plugin` and then breaks server HTML; no size benefit either. Size is driven by theme config and import path (see measurement below). |
| Bundle and TTFB vs Next | **Measured**, but the comparison is a floor (see table below). TTFB not comparable. |

### Production measurement, `/methodology` (2026-10-16, same script, `spikes/expo-web-methodology/weigh.mjs`)

Next: `next build --webpack` then `next start`, as built from this repo. Expo: `expo export` then
`expo serve`. Sizes are bytes in the first load for the one page. **Not like for like:** the Next
page includes the real site shell and 1,077 lines of methodology content; the Expo page is the
heading plus three cards with no shell, so the Expo figures are a floor, not a forecast.

| First load | Next (prod) | Expo as first built | Expo, best working variant |
|---|---|---|---|
| HTML document, gz | 50 KB | 36 KB | 14 KB |
| Inline CSS, gz | 0 KB (11 CSS files, 40 KB gz) | 34 KB (all themes) | 12 KB |
| JS, gz | 272 KB (23 chunks) | 505 KB (1 bundle) | 379 KB (1 bundle) |
| Total, gz / brotli | 376 / 305 KB | 541 / 400 KB | 393 / 301 KB |
| TTFB median (local) | 12.5 ms (dynamic render, `ƒ`) | 2.1 ms (static file) | 2.2 ms (static file) |

What moved the Expo numbers, each measured by rebuilding:

- **Config, not compiler, drives CSS.** `@tamagui/config/v5` emits every theme and color token:
  457 KB inline CSS. Two themes plus brand tokens: 52 KB. Cuts HTML from 459 KB to 54 KB.
- **Import path drives JS.** The umbrella `tamagui` import: 517 KB gz. `@tamagui/stacks` + `@tamagui/text`
  only: 387 KB gz. Expo Router + React Native Web with no Tamagui at all: 292 KB gz, which is already
  more than the whole Next JS for this page.
- **Extraction (Tamagui compiler on Metro) is not usable as configured.** `@tamagui/metro-plugin`
  only records options and registers `.css`; on its own it extracts nothing. Adding
  `@tamagui/babel-plugin` runs the compiler and flattens elements, and bundle size did not change,
  but the server HTML body came out empty (Suspense error marker, no h1, no content). With the plugin
  removed or `disableExtraction: true`, server HTML is complete. Cause not isolated (unverified):
  could be this version pair or our config. Extraction is therefore off in the best variant.
- **TTFB is not comparable.** Next renders on demand against the database; Expo served a prerendered file.
  `/methodology` is dynamic (`ƒ`) in the Next build despite `revalidate = 3600`, because of the proxy.

Unverified, needs a test before it matters: Expo web ships one entry bundle for all routes
("web bundles (1)"), so each added surface may grow first load unless route-level async loading is
enabled. Next splits per route.

Version risk (dates from the npm registry): Tamagui 3.0.0 shipped 2026-10-10 and has had 18 patch releases in six days (3.0.18 on
2026-10-16). The spike pinned 2.7.7 (2026-08-15). A 2.x to 3.x move during the migration is likely.

### Shell + data-backed route port (`/records`), same day

Ported the header and phone tab bar and the real `/records` page-1 model (100 rows, 43 pages, exported
from `loadRecordsIndex` with the live catalog; the JSON is gitignored). Source and parity gaps:
`spikes/expo-web-methodology/README.md`. Not ported: no-JS GET forms and `<details>` facets (an
acceptance criterion of the real page), fonts, icons, the Rooms sheet, the palette, map glyphs.

| First load, gz (br) | Next prod | Expo, async routes |
|---|---|---|
| `/records` | 367 KB (304) | 414 KB (322) |
| `/methodology` | 376 KB (305) | 398 KB (311) |
| `/records` HTML | 39 KB gz (388 KB raw) | 32 KB gz (294 KB raw) |
| `/records` JS | 272 KB in 23 chunks | 380 KB in 5 chunks |
| `/records` median TTFB, local | 44.8 ms (dynamic render) | 2.4 ms (prerendered) |

So after the shell and a 100-row data route, Expo is about 13% heavier gzipped (6% brotli) than Next on
`/records` and about 6% heavier on `/methodology`. Adding the shell and the route cost only about 1 KB
of JS; the gap is the fixed React Native Web + Expo Router floor, not app code. Next's page also
carries 41 KB gz of external CSS that Expo inlines (13 KB gz), so the real gap is in JS.

**One bundle for all routes: yes by default, and it matters.** Default export produced one entry
bundle (`web bundles (1)`). Adding a route that imports `maplibre-gl` (the version `apps/web` pins)
grew that one bundle from 380 KB to 663 KB gz, and every route, including `/methodology`, would have
downloaded it. Setting `asyncRoutes: { web: true }` in the `expo-router` plugin splits per route (7
files): the map code moved to a 274 KB gz `explore` chunk that `/methodology` and `/records` do not
load, and server HTML stayed complete (h1 present, no error marker). The default must be changed on
day one.

**Data loaders and CSP.** Loaders need `unstable_useServerDataLoaders` in SDK 57. The loader embeds
its data as an inline executable script (`globalThis.__EXPO_ROUTER_LOADER_DATA__ = ...`, 75 KB on
`/records`) whose hash differs per page. The single-hash CSP that hydrated `/methodology` blocked it on
`/records` (`loaderData` undefined; the page still hydrated and showed 100 rows, so the client
recovered some other way, which I did not trace). A hash-based CSP would need a hash per prerendered
page computed after export. Per-request SSR (`unstable_useServerRendering`) is still untested, so
the nonce question is still open.

### Per-request CSP nonce with `unstable_useServerRendering` (SDK 57), same day

Question: can Expo inject a per-request nonce, including into the loader data script? Source and the
patch: `spikes/expo-web-methodology` (README, `+html.tsx`, `patch-render.py`). Target policy is the
site's current shape, `script-src 'self' 'nonce-X' 'strict-dynamic'` (`csp.ts`; `style-src` already allows
inline styles, so Tamagui and RN Web styles are not a CSP problem).

| Step | Result |
|---|---|
| Per-request SSR on SDK 57 | **Works.** Output is a server renderer (`_expo/server/render.js`), no prerendered HTML; loaders receive the request. |
| Nonce header per request, using only supported APIs | **Works.** `+html.tsx` runs per request, so it can make a nonce and call `setResponseHeaders`. |
| Nonce on Expo's 5 external `<script>` tags | **Works** (clone `nonce` onto `bodyNodes`/`headNodes`). |
| Nonce on the 3 inline scripts (hydrate flag + loader data, React streaming runtime) | **Does not work with supported APIs.** Expo calls `renderToReadableStream({progressiveChunkSize, bootstrapScriptContent, signal, onError})` with no `nonce`; React emits those scripts without one. Browser blocked them. |
| Same, with a post-export patch that passes `nonce` to React (`patch-render.py`, AsyncLocalStorage shared with `+html.tsx`) | **Works.** All 8 scripts, including the 77 KB loader data script, carried the request's nonce. Under the real policy shape, `/records` hydrated, loader data was an object, no loader refetch, 100 rows, one h1, client navigation to `/methodology` loaded its route chunk under `strict-dynamic`, and no CSP errors for the current nonce appeared. 200 concurrent requests: 200 distinct nonces, every script carried only its own request's nonce. |

Costs and caveats:

- **The inline-script fix is a patch to a compiled Expo bundle**, not an API. It asserts two anchor
  strings and breaks loudly on an Expo upgrade; it needs re-doing per SDK or an upstream change. SDK 58
  makes server rendering stable but I did not test whether it adds a nonce option.
- **`asyncRoutes` and SSR interact badly.** With both on, the route body arrives as a streamed
  `<div hidden id="S:0">` segment revealed by an inline script; the first paint holds a fallback, and the
  hydrated DOM kept an orphaned hidden copy (200 row anchors, two h1). With SSR and `asyncRoutes` off, content is in the
  initial shell, no hidden segments, one h1, clean hydration. So the per-route splitting that fixed
  bundle size (section above) costs crawlable first-shell content under SSR. Not resolved.
- **Hash-based CSP is no longer the only path**, but the nonce path rests on the patch above.

Gate 1 verdict: **not passed; needs validation.** SEO head, JSON-LD and hydration are achievable.
Open blockers: (1) nonce CSP: achievable under SDK 57 SSR only with a post-export patch of Expo's renderer; (2) Tamagui extraction
breaks server HTML as configured, so size must come from a trimmed config and slim imports, which land
at parity with Next for a bare page but not yet for a real one; (3) per-route splitting needs `asyncRoutes`, which under SSR streams content into a hidden segment; (4) loader data needs per-page CSP
hashes. Measured gap on a shell-plus-data route: about +13% gz vs Next, from the framework floor.

## 11. Decision (2026-10-16): proceed with Expo web, on SDK 58

The owner chose to replace Next.js with Expo web now. The go/no-go review recommended staging through
Tamagui on Next; that was set aside by the owner, so this section records the decision and the controls
that make it safer. Epic: `repo-v0lfu`.

**Re-run on SDK 58** (released 2026-09-29; `expo@58.0.13`, `expo-router@58.0.22`, React 19.3, RN 0.88).
SDK 58 removes most of the blockers found on 57:

| Blocker on SDK 57 | On SDK 58 |
|---|---|
| Three `unstable_` flags for middleware, loaders, server rendering | None needed; stable |
| Per-route splitting only with `asyncRoutes`, and then content streamed into a hidden segment | Route chunks by default; renderer sends one chunk (`progressiveChunkSize` max), no hidden segment |
| Nonce needed a patch to the compiled renderer | **No patch.** An owned server entry wraps the supported `expo-server/adapter/http` and adds the nonce to scripts, styles and script preloads. 200 concurrent requests: 200 distinct nonces, no cross-request nonce. |
| `expo-router/head` tags in server HTML | Changed: `<Head>` only updates after hydration. Use the route `generateMetadata` (title, description, `alternates.canonical`, `openGraph`, robots). JSON-LD goes in the page tree. |
| Weight | `/records`: 418 KB gz (br 325 KB) vs Next 367 KB (br 304 KB), about +14%; unchanged from SDK 57. Median TTFB 23.7 ms with per-request SSR. |

`expo-server` ships adapters for EAS Hosting, Node/Express, Vercel, Netlify, workerd (Cloudflare) and Bun, so
the hosting decision (`repo-34xfk`) is a choice among supported targets, and Vercel stays possible.

**Controls on the decision**

1. Single cutover after parity gates; Next stays deployable until a soak ends (`repo-3ix4m`).
2. Gates that block cutover: SEO HTML parity for every public URL (`repo-r54nc`), visual parity (`repo-djqss`),
   token lint at or below baseline, no-JS parity for crawlable rooms (`repo-3db6c`), nonce on every response.
3. Tamagui pinned at 2.7.7 with extraction off; slim `@tamagui/*` imports; two-theme config from brand tokens.
4. Protected experiences override aesthetics (memorial, evidence honesty, precision).
5. Mobile stays on SDK 57 for now; moving it to 58 is part of unifying the design package.

**Findings while scaffolding `apps/site` (new, not in the earlier spikes)**

- Tamagui 2 uses `render="header"`. `tag="header"` (used in the earlier spikes) renders a `<div tag="header">`, so
  those spikes had no real landmarks. The served tests now assert `<header>` and `<nav>`.
- Style props (alignItems, padding, maxWidth) do not type check under Expo's tsconfig, even with the stock Tamagui
  config, on TypeScript 5.9 and 6.0. Runtime is fine. Tracked as a bug in the epic.
- `expo install --fix` inside a directory covered by `apps/*` rewrote the root `pnpm-lock.yaml` (9,270 lines).
  `apps/site` is now excluded from the workspace (`!apps/site`), as `apps/mobile` is.

## 12. Server-layer parity (2026-10-16, `repo-doplj`)

`apps/web/src/proxy.ts` and its collaborators are ported to `apps/site/server/edge/*.cjs` behind
`server/entry.cjs`, in the same order: maintenance wall, AI/SEO-crawler deny, staff gate, pass-through; then
security headers with the request nonce, the nonce on every tag, and the CDN cache header.

| Piece | Port | Checked by |
|---|---|---|
| Maintenance wall, bypass cookie/param/header, 503 page | `maintenance.cjs` | 7 unit tests, 3 served tests, parity |
| AI and SEO-tool crawler deny | `traffic.cjs` + `agent-lists.json` | 4 unit tests, 1 served test, parity |
| Staff gate (Supabase session, staff role) | `staff-gate.cjs` | 7 unit tests, 2 served tests, parity |
| CSP and the 8 global headers | `security-headers.cjs` | 4 unit tests, 1 served test, parity |
| Public-document CDN cache | `surfaces.cjs`, `pipeline.cjs` | 2 unit tests, 2 served tests, parity |

**Drift guard.** `apps/web/src/lib/site-edge-parity.test.ts` imports the originals and the ports and asserts
equal output over tables of user agents, paths, env settings, CSP options and roles. Mutating the port (a header
value, an agent-list entry, a retry-after cap) made 4 of its 6 tests fail; restoring it returned all 6 to green.
It is deleted with `apps/web`.

**One intended difference.** The static build output the wall and the staff gate exempt is `/_expo/static`, where
Next's was `/_next/static` and `/_next/image`. Both directions are asserted.

**Not ported yet (filed under the epic):** `/explore` canonicalization (query normalization and the request-size limit are ported; see below); host-specific cache headers after the hosting decision; tightening the inherited site CSP
(theme-bootstrap hash, Vercel analytics origins). The staff gate is mounted, but `/admin` itself is not ported
(`repo-a27tc`), so a signed-in staff user gets the app's 404 until that decision lands.

**Cross-review (Codex, read-only) and what it changed.** Seven findings, all reproduced or confirmed by reading,
all fixed with tests:

| Finding | Fix |
|---|---|
| A malformed target (`GET //`) threw outside every catch and could kill the process | Targets are parsed safely; bad ones answer 400; the listener cannot reject |
| Whole-document nonce rewrite blessed any injected `<script>` (so `strict-dynamic` would run it) | Only renderer output is nonced; JSON-LD escapes `<` so a value cannot end its element |
| `/_expo/loaders/admin` (loader data alias) skipped the staff gate and got public-cache headers | Gates and cache policy use the normalized effective route |
| Bypass redirect `//attacker.example/x?maintenance_bypass=...` produced a protocol-relative `Location` | Location always has a single leading slash |
| Streaming responses were buffered without bound | Only HTML is buffered (16 MiB cap); the rest streams |
| 413 request-size limit not ported | Ported with the normalized route set; parity-tested |
| Renderer-error fallback kept stale length/encoding and skipped security headers | One error sender clears entity headers and applies the headers |

Also added unprompted: percent-decoded and case-insensitive staff-gate matching (`/%61dmin`, `/ADMIN`).

### Query canonicalization (`repo-v0lfu.3`)

`edge-query-normalization`, `query-normalization`, the relevant `constants`, and `records-query` are ported to
`server/edge/{query-normalization,records-query}.cjs` and wired in after the size limit. Topic vocabulary is a
snapshot (`topic-ids.json`) because `@repo/domain` is ESM-only; the parity test fails if it drifts.

Parity (`site-edge-parity.test.ts`, 15 tests): an 880-case matrix (20 paths x 44 queries) compares the redirect
decision, canonical pathname and query, `canonicalPathAndSearch`, and the full 308 response with the original;
a 600-round deterministic fuzz compares records-query parsing and printing. Mutating the port (page cap,
key sort order, tracking prefix list, a topic id) failed 4 tests; restoring it returned all to green.

**Documented differences** (each asserted in the parity file):

1. **`/explore` is not canonicalized.** The original canonicalizes it through the Explore URL-state parser (561
   lines plus geography and population vocabularies). That belongs with the map port; a partial port would
   redirect differently and could loop against the real route. Gap filed (`repo-5tjl0`).
2. **Eligibility is decided on the decoded path.** Next tested the encoded path, so `/%73earch?junk=1` escaped
   canonicalization (and cache keying). The port treats it as `/search`. A trailing slash on an exact route also
   redirects, because Next did that in the framework and Expo does not.

**Second Codex review** (read-only) found three defects, all fixed with tests: a loader data request
(`/_expo/loaders/records?kind=PERSON`) was 308ed to the HTML page (now never canonicalized; the staff gate still
sees its route); a slash-terminated prefix route (`/place/`) skipped the redirect the original gave; and the
decoded-path eligibility above, which I kept as stricter and documented.

## 13. Data layer, first slice (`repo-6obbo`)

**What the Next app does today.** Two `unstable_cache` users (`release-scoped-cache.ts`, `door-catalog.ts`) and nine
React `cache()` users (records, articles, theme-impact, lives, legal, shared-map-data, door-catalog, public-data
`source.ts`, materialized snapshots). The Next Data Cache only holds values under about 1.8 MB, so the catalogs (the
big reads) already fell through to process memory with a 30-minute TTL; what Next added was cross-instance caching of
small values. The shared layer for the big reads has always been the release artifact on the CDN, with Postgres
behind it.

**What replaces it** (`apps/site/src/server/data`, documented in the site README):

| Concern | Model |
|---|---|
| Key | kind + releaseId + activatedAt; a new release is a new key |
| Fresh / soft / hard | memory, then one background ETag refresh after 5 min (backoff 10 s to 5 min on failure), gone after 30 min |
| Cold read | single-flight, so a burst is one load; artifact first, Postgres second, each full Postgres pull logged (the 2026-08 egress incident) |
| Outage | stale-if-error up to 6 h for the two most recent releases |
| In-place correction | republish artifact + purge Cloudflare (runbook), then `POST /internal/purge`; otherwise convergence within the soft TTL |
| Purge semantics | drops entries and the stale copy, fences loads already running, and a post-purge reader never joins one |
| Per-request memo | not needed: `generateMetadata` and the loader both hit the process cache |

**Done:** the search-index path and `/records` as a real loader (live catalog: 4,210 records, cold 1 to 4 s, warm
about 85 ms; page 2, canonicalization and purge verified live). 45 cache/release/catalog/purge unit tests (five
mutations of the fencing, eviction and backoff logic each failed a test), 6 served tests, and a parity test that the
site's page model equals the Next loader's for nine query shapes.

**Codex review (read-only), six defects, all fixed with tests:** a purge could be undone by an in-flight load and a
post-purge reader could join it (generation fence); the same for the release pointer; a late refresh could overwrite a
newer load (one flight per key shared by refresh and foreground); an older release finishing cleared the live
release's stale-if-error copy (per-release, bounded); failed refreshes retried at request rate (backoff); and
`/records` lost the evidence-coverage fallback (now refused with a 503 until the entity catalog slice ports it,
rather than showing records ungraded).

**Observed, not guaranteed.** Under expo-server's Node adapter the purge route and the records loader share one cache
instance (a report after a `/records` request shows the loader's hits). Bundles are separate files, so a host adapter
that isolates functions would not share; filed with the hosting decision (`repo-34xfk`).

**Remaining slices (filed):** entity catalog and record reads; the records full-entity fallback; door-catalog and
shared-map-data; the five other `cache()` sources; purge reach on the chosen host.

### Entity catalog slice (`repo-v0lfu.6`, `.7`)

**One read model, not two.** The hydration logic (citation retention, learning-link hydration, the bounded 1-3 hop
neighborhood walk, thin card views) lived inside `source.ts` next to React `cache()`. It is now
`apps/web/src/lib/public-data/entity-views.ts`, with `source.ts` importing it and re-exporting the two names it used
to export. The site imports the same file, so there is no second implementation to drift. Checks on that refactor to
the shipping app: the whole apps/web suite (2,749 tests: 2,741 pass, 0 fail, 8 skipped), its typecheck and lint, and a
parity test that `source.ts` and the site hold the identical function objects.

**What the site adds** (`entities.ts`): `getEntities`, `getEntity`, `getEntitiesByIds`, `getEntityRedirect` on four
registered caches. Two differences from the Next path, on purpose: an entity page was an uncached set of up to a dozen
point reads per request (the CDN was its only cache), and now costs the database once per entity per soft TTL; and
misses are cached, LRU-bounded, so a storm of made-up ids is not a query each. An id over 200 characters is a miss
without a query.

**Live check** (real release, 5 sampled entities): the site's hydrated view is deep-equal to the Next path's, thin
by-ids and the redirect miss are equal, and a second pass is zero queries. `/records` falls back to full entities
below the evidence floor, built from the same release as the search-index read.

**Codex review (read-only).** No finding on the extraction. Five on the new code, all fixed with tests: refresh-failure
bookkeeping was unbounded (now capped at 1,000 keys, exposed as `backoffKeys`); a cached 404 could be served as
stale-if-error after expiry (negative entries opt out); two different id sets could share a by-ids entry through the
separator character (hash of a JSON array); the records fallback could mix two releases (pinned to one); and
`(release, scope)` keys could collide through separators (JSON tuple key). Three of those mutations were each caught by
a test.

**Left in `repo-6obbo`:** door-catalog and shared-map-data, and the five other `cache()` sources.


## Design package and component kit (2026-10-16)

- `apps/site/src/design` generates its Tamagui tokens from the shipped `packages/ui/src/styles/tokens.css`, so the CSS and the native/web kit cannot drift silently.
- The kit holds Confidence, Button, Card, Notice, EmptyState, Citation, VisuallyHidden, Pagination, ResultList, Timeline and Toolbar. Tests render to static markup under tsx; they cover structure, roles and which token a style uses, not events and not the active theme.
- Codex worktree findings: batches ported cleanly, but review caught a disabled-looking anchor that stayed a tab stop (Pagination), a hover that faded text below 4.5:1 (Button) and a duplicated visually-hidden pattern (Toolbar). Worktrees are cut from the committed HEAD, so uncommitted foundation work must be committed first.
- Next: Dialog, DataTable, shell header, tab bar, rooms sheet; a gallery route for in-browser checks; Playwright baselines.
