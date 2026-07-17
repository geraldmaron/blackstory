# Accessibility, SEO, performance, and privacy gates (BB-057)

Repo acceptance gates for core public journeys. No live deploy required — automated checks run in CI via `@black-book/testing` and `apps/web` unit tests.

## Layers

| Gate | Command | What it checks |
|------|---------|----------------|
| A11y fixtures | `pnpm --filter @black-book/testing test:a11y` | Landmark, heading order, alt text, core journey HTML fixtures |
| Release gates | `pnpm --filter @black-book/testing test:release-gates` | Performance budgets + degraded-mode copy contracts |
| SEO builders | `pnpm --filter @black-book/web test` (seo tests) | Protected fields stripped from metadata previews |
| Sitemap | `apps/web/src/app/sitemap.ts` | Static routes + active release entity URLs |

Parent wiring: merge `release-gates` into `scripts/run-testing-layer.mjs` (add `release-gates` matcher or extend `a11y`) and append seo test paths to `apps/web/package.json` `test` script.

## Core journeys under test

Automated HTML fixtures in `packages/testing/src/a11y/journey-fixtures.ts` mirror:

- **Search** (`/search`) — form labels, results list, pagination nav
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
| Search | `ResultList` (`@black-book/ui`) | Server-rendered list with `labelledBy` |
| Explore | `SynchronizedResultList` | Full list peer — not a map fallback; `aria-current` for selection |
| Explore | `explore/page.tsx` noscript `FilterBar` | Native GET filters without JavaScript |
| Locate | `ManualPlaceSearchForm` + `/search` link | Manual entry without geolocation |

Do not edit explore/map-experience components in BB-057 — read-only ownership (BB-051).

## Metadata and previews

`apps/web/src/lib/seo/` provides:

- `stripProtectedFields()` — removes scores, coordinates, sensitivity internals, moderation fields
- `buildEntityPageMetadata()` / `buildPublicMetadataPreview()` — canonical URLs + Open Graph without protected content
- `buildPublicSitemapEntries()` — release-scoped entity URLs for `sitemap.ts`

Protected patterns block street addresses, phone numbers, emails, raw confidence scores, and moderation tokens from title/description/OG tags.

## Performance budgets

Config: `packages/testing/src/release-gates/performance-budget.ts`

Default thresholds (bb-057-v1):

| Metric | Max |
|--------|-----|
| LCP | 2500 ms |
| FCP | 1800 ms |
| TBT | 300 ms |
| CLS | 0.1 |
| TTFB | 800 ms |
| JS transfer | 320 KB |
| CSS transfer | 48 KB |
| Image transfer | 512 KB |
| Font transfer | 120 KB |
| Document requests | 42 |

Supply samples from Lighthouse CI or bundle analyzers; call `evaluatePerformanceBudget(samples)` — violations fail CI when wired.

## Degraded / API-off mode

Public pages must remain readable when live reads fail:

- **Global snapshot** — `DegradedModeNotice` (`role="status"`, “Showing snapshot data”)
- **Explore refine** — `DEGRADED_MODE_COPY` in `snapshot-mode.ts` always mentions “last-loaded snapshot”
- **Map unavailable** — copy steers users to the accessible list view

Contract tests: `packages/testing/src/release-gates/public-degraded-contracts.test.ts`

## Privacy

- Minimal analytics — geocode analytics client is consent-aware (see BB-050 locate components)
- No behavioral advertising fields in public metadata builders
- Location coordinates never appear in SEO previews (`protected-fields.ts`)

## Manual checklist (pre-release)

- [ ] Keyboard-only walkthrough: search → entity → corrections
- [ ] Screen reader spot-check: explore list announces selection (`aria-current`)
- [ ] View page source / social debugger: no protected fields in `<meta>` or OG tags
- [ ] Set `PUBLIC_READ_API_DISABLED=1` locally — pages render snapshot copy
- [ ] Run `pnpm --filter @black-book/testing test:a11y` and `test:release-gates`

## WCAG target

WCAG 2.2 Level AA for core journeys. Automated fixtures catch regressions; manual review still required for focus order on client islands (map canvas, locate consent flow).
