# Accessibility, SEO, performance, and privacy gates

Repo acceptance gates for core public journeys. No live deploy required — automated checks run in CI via `@repo/testing` and `apps/web` unit tests.

## Layers

| Gate | Command | What it checks |
|------|---------|----------------|
| A11y fixtures | `pnpm --filter @repo/testing test:a11y` | Landmark, heading order, alt text, core journey HTML fixtures |
| Release gates | `pnpm --filter @repo/testing test:release-gates` | Degraded-mode copy contracts + mobile store release gate |
| SEO builders | `pnpm --filter @repo/web test` (seo tests) | Protected fields stripped from metadata previews |
| Sitemap | `apps/web/src/app/sitemap.xml/route.ts` | Static routes + active release entity URLs |

Parent wiring: merge `release-gates` into `scripts/run-testing-layer.mjs` (add `release-gates` matcher or extend `a11y`) and append seo test paths to `apps/web/package.json` `test` script.

## Core journeys under test

Automated HTML fixtures in `packages/testing/src/a11y/journey-fixtures.ts` mirror:

- **History** (`/history`, legacy `/search` redirects here) — form labels, results list, pagination nav
- **Explore** (`/explore`) — synchronized accessible list peer beside map region
- **Entity** (`/entity/[id]`) — section landmarks and h1/h2 order
- **Locate** (`/locate`) — privacy notice, labeled inputs, no-JS search fallback
- **Corrections** (`/corrections`) — quarantine notice, labeled form fields
- **Degraded shell** — `PUBLIC_READ_API_DISABLED` snapshot banner + stable `<main>`

Run extended audits via `auditHtmlFixture()` (`packages/testing/src/a11y/audit.ts`).

## Accessible alternatives (search + map)

Documented peers (`packages/testing/src/a11y/map-search-peers.test.ts`):

| Journey | Peer | Contract |
|---------|------|----------|
| History | `HistoryResultList` | Server-rendered find-in-time list with `labelledBy` |
| Explore | `SynchronizedResultList` | Full list peer — not a map fallback; `aria-current` for selection |
| Explore | `explore/page.tsx` noscript `FilterBar` | Native GET filters without JavaScript |
| Locate | `ManualPlaceSearchForm` + `/history` link | Manual entry without geolocation |

Do not edit explore/map-experience components in  — read-only ownership.

## Metadata and previews

`apps/web/src/lib/seo/` provides:

- `stripProtectedFields()` — removes scores, coordinates, sensitivity internals, moderation fields
- `buildEntityPageMetadata()` / `buildPublicMetadataPreview()` — canonical URLs + Open Graph without protected content
- `buildPublicSitemapEntries()` — release-scoped entity URLs for `sitemap.ts`

Protected patterns block street addresses, phone numbers, emails, raw confidence scores, and moderation tokens from title/description/OG tags.

## Web performance budget: removed

The web performance-budget gate (`packages/testing/src/release-gates/performance-budget.ts`,
`ds-057-v1`'s LCP/FCP/TBT/CLS/TTFB/transfer thresholds) is gone (owner decision, 2026-09-14): it
had no producer wired to any real Lighthouse CI or bundle-analyzer run, so it only ever evaluated
on empty input and passed vacuously. Mobile has a real, wired equivalent instead — see
`docs/mobile/release/release-gates.md`'s `mobile-performance-baseline` gate, a report-only launch
baseline (no thresholds yet) fed by `scripts/release/mobile-perf-baseline.mjs`.

## Degraded / API-off mode

Public pages must remain readable when live reads fail:

- **Global snapshot** — `DegradedModeNotice` (`role="status"`, “Showing snapshot data”)
- **Explore refine** — `DEGRADED_MODE_COPY` in `snapshot-mode.ts` always mentions “last-loaded snapshot”
- **Map unavailable** — copy steers users to the accessible list view

Contract tests: `packages/testing/src/release-gates/public-degraded-contracts.test.ts`

## Privacy

- Minimal analytics — geocode analytics client is consent-aware (see  locate components)
- No behavioral advertising fields in public metadata builders
- Location coordinates never appear in SEO previews (`protected-fields.ts`)

## Manual checklist (pre-release)

- [ ] Keyboard-only walkthrough: search → entity → corrections
- [ ] Screen reader spot-check: explore list announces selection (`aria-current`)
- [ ] View page source / social debugger: no protected fields in `<meta>` or OG tags
- [ ] Set `PUBLIC_READ_API_DISABLED=1` locally — pages render snapshot copy
- [ ] Run `pnpm --filter @repo/testing test:a11y` and `test:release-gates`

## WCAG target

WCAG 2.2 Level AA for core journeys. Automated fixtures catch regressions; manual review still required for focus order on client islands (map canvas, locate consent flow).
