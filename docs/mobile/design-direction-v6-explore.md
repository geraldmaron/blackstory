# Mobile design direction v6 — Explore (native)

**Status:** binding for `@repo/mobile` Explore tab (2026-07-23).  
**Parent:** [`docs/ui/design-direction-v6-explore.md`](../ui/design-direction-v6-explore.md), [`docs/ui/design-direction-v6-home.md`](../ui/design-direction-v6-home.md) (place-first posture).  
**Code:** `apps/mobile/src/features/explore/`, `apps/mobile/src/features/map/`.

---

## Intent

Mobile Explore is the **place-first atlas** entry: `/` redirects to `/explore` (no separate home tab). Readers orient through geography, filter by kind **family**, and browse records in the bottom sheet when the map is unavailable.

---

## Canvas law

| Layer | Rule |
|---|---|
| Map plate | Fixed dark archive basemap (ADR-013); does not flip with OS theme |
| Floating chrome | Opaque `--ds-surface` panels, theme-aware (v6 — not v5 ink-glass cockpit) |
| Bottom sheet | Theme-aware Surface; metrics list + entity preview |
| Copper | Active filter chip, preview CTA, color-key section labels only |

---

## Map encoding

Binding: [`patterns-map-entity-encoding.md`](../ui/patterns-map-entity-encoding.md).

| Channel | Mobile implementation |
|---|---|
| Shade | Five kind families + three historical tones via `kind-encoding.ts` / `entity-paint.ts` |
| Glyph | Rim signatures on circle layers; event orbit ring |
| Size | `evidenceCount` + `confidenceTier` via `marker-size.ts` |
| Clusters | Copper aggregate; step radii 10/14/18/22 px |
| Confidence | Color key lists glyph + tier color (not map radius alone) |

Color key: `/color-key-sheet` modal + `MapColorKey.tsx`.

---

## Filters

Kind facet uses five **family** slugs (`people`, `places`, …). Legacy micro-kind URL params still filter that micro-kind.

---

## Safe fails

| Failure | Behavior |
|---|---|
| `GET /v1/map` error | `ErrorState` + list/metrics sheet stays interactive |
| `onDidFailLoadingMap` | `map-canvas-unavailable` copy; list fallback |
| Offline cold start | Dedicated offline copy; cached release when available |

---

## Acceptance

- [x] Entity circles use kind-family shades (not flat copper for all kinds)
- [x] Cluster size steps match web Color key
- [x] Color key modal lists same vocabulary as web legend
- [x] Floating chrome uses theme-aware opaque Surface
- [x] Kind filter uses five families
- [x] Map engine failure does not strand the reader (list remains)
- [ ] Manual QA: light + dark OS theme on sheet/chrome (375px)

---

## Supersession

For mobile Explore, this doc supersedes v5 "fixed ink-glass cockpit" language in `explore-chrome.tsx` comments and ADR-024 spike notes that described a single flat copper pin layer.
