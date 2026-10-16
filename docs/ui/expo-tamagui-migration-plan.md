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
| Spacing | 4px grid: 4, 8, 12, 16, 24, 32, 48, 64. Remove 3px and 5px. |
| Type | One ramp of about 8 steps (e.g. 12, 14, 16, 18, 20, 24, 32, 44). Four families stay. |
| Radius | none, sm 8, md 16, lg 28, full (existing). |
| Elevation | Flat; hairline borders (existing rule, keep). |
| Targets | 44px minimum for every interactive element. |
| Breakpoints | One set, e.g. 480, 768, 1024, 1280, in Tamagui media tokens. Retire 819 and 47.9375rem. |
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
