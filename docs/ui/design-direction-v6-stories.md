# BlackStory design direction v6 — stories edition

**Status:** binding layout pattern for `/stories` and `/stories/*` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** `design-direction-v5.md` § stories index mast and fixed-ink story mast only.  
**Unchanged:** story data/routing contract, `renderStoryTitle` accents, Article JSON-LD, Sources footnote.

---

## 1. Intent

Stories is the **longform reading room** inside the same archive edition as `/`, `/explore`, and `/history`. Readers browse a compact catalog, open place-first articles, and follow evidence off-ramps to records and the map.

Design goals:

- **Arrive** through a theme-aware Surface intro panel, not a fixed-ink mast band.
- **Browse** a hairline ledger catalog with era · place meta on every row.
- **Read** editorial serif body inside opaque Surface panels.
- **Trust** through required Sources footnote and mosaic attribution copy.
- **Depart** through related entity links and a single copper map CTA when geo exists.

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **page gutters only** (same register as home v6).

---

## 2. Canvas law — theme-aware edition + home mosaic

| Rule | Light theme | Dark theme |
|---|---|---|
| Page canvas | Archive Paper `#F4EFE5` (`--ds-canvas`) | Black Ink `#0A0A0A` |
| Edition panels | Surface `#FBF8F2` (`--ds-surface-raised`) | Charcoal mix on Surface |
| Ink / Charcoal bands | **Not on stories** | **Not on stories** |
| Copper | Text `#8E4F2A`, graphic `#B86B2A` | Text `#D07A32`, graphic `#D07A32` |
| Atmosphere | **Home-aligned gutter mosaic** — grain + archive grid + scattered collage tiles (`EditionAtmosphereMosaic`) | Same; tile opacity scales down in dark |

**Atmosphere stack (shared with home):**

1. Fixed pseudo-element texture (paper grain + quiet archive index grid on Rule and copper hairlines) via `.ds-edition-atmosphere-canvas`.
2. Optional scattered archive mosaic in left/right gutter bands only; center Surface stack stays opaque (WCAG floor).
3. `prefers-reduced-motion` hides live mosaic tiles.

**Banned on stories:** fixed-ink mast bands (`--ds-fixed-*`), full-bleed `AtmospherePlane` mast on article pages, crumpled continental silhouettes, shadows, gradients, glows, bevels, blur.

Article pages use **per-slug mosaic seed** (`stories-edition-v6:{slug}`) for variety; index and credits use route-level seeds.

---

## 3. Page scaffold

### 3.1 Index (`/stories`)

```
┌─ ds-stories-edition + ds-edition-atmosphere-canvas ─────────────┐
│  [ EditionAtmosphereMosaic — seed: stories-edition-v6 ]         │
│  ┌─ main (max ~84rem, centered) ─────────────────────────────┐ │
│  │  [ Beat 00 — Intro Surface: edition header + crosslink ]   │ │
│  │  [ Beat 01 — Catalog Surface: count + story rail grid ]    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

### 3.2 Article (`/stories/[slug]`)

Single-column edition stack only. Article body is the primary reading beat; related entities never sit beside or above the longform.

```
┌─ ds-stories-edition + atmosphere canvas ────────────────────────┐
│  [ Beat 00 — Intro: kicker, era·place, title, dek, map CTA ]   │
│  [ Beat 01 — Article body (editorial serif sections) ]          │
│  [ Beat 02 — Records panel (when related entities exist) ]      │
│  [ Beat 03 — Evidence: Sources footnote ]                       │
│  [ Quiet footer links ]                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Reading order (DOM + a11y):** intro mast → article → related entities → sources → footer. Map CTA stays in intro when geo exists; mosaic credit stays in intro footnote.

### 3.3 Mosaic credits (`/stories/mosaic-credits`)

Same canvas + intro panel + credits ledger panel. About page living mosaic is **out of scope** for this doc.

---

## 4. Rhythm tokens (align with home/history v6)

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` ( `1rem` ≤48rem ) | Horizontal padding of `main` |
| Card gap | `1.25rem` | Vertical stack gap between edition panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule borders, `--ds-radius-md` on panels, `--ds-radius-sm` on buttons/inputs. Flat matte only.

---

## 5. Beat 00 — Intro panel

| Element | Spec |
|---|---|
| Index | Mono copper numeral `00` (decorative; page `h1` remains in title) |
| Kicker | IBM Plex Mono uppercase copper slug: `Longform` (index) or `Story` (article) |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`<em>place</em>` on index; per-slug accent on articles via `renderStoryTitle`) |
| Lede | Source Serif 4, Stone, max ~54ch |
| Meta | Mono era · place row + published date on articles |
| Primary action | **One copper CTA** when related entity has geo: "View on map" |
| Mosaic credit | Mono footnote with link to `/stories/mosaic-credits` |

No second copper button in intro.

---

## 6. Beat 01 — Catalog panel (index)

| Element | Spec |
|---|---|
| Panel kicker | Mono uppercase: `Catalog` |
| Count | Mono label (`N stories`) |
| Story rail | Hairline rows; era · place meta, sans title, clamped dek |
| Grid | Two columns ≥56rem; single column on narrow viewports |
| Crosslink | Quiet `ds-cta-link` to `/books` in intro panel only |

Reuse shared `.ds-story-link` / `.ds-story-rail` from shell; stories edition CSS scopes density overrides under `.ds-stories-edition`.

---

## 7. Article body, related records, evidence

| Zone | Spec |
|---|---|
| Body panel kicker | `Article` |
| Sections | Source Serif 4 paragraphs; optional Sora section titles |
| Section dividers | Rule hairline between sections |
| Max measure | ~42rem for body copy |
| Related entities | Optional **secondary** Records panel **after** article body; compact Surface density, hairline story-link rows, same register as catalog; never a competing column or above-fold rail |
| Sources panel | `Evidence` kicker + `SourceFootnote` group density; follows related entities when present |

---

## 8. Shared modules

| Module | Path | Role |
|---|---|---|
| Edition atmosphere CSS | `components/patterns/edition-atmosphere/edition-atmosphere.css` | Grain + grid + tile placement (home + stories) |
| Edition atmosphere mosaic | `components/patterns/edition-atmosphere/EditionAtmosphereMosaic.tsx` | Client gutter tiles |
| Scattered layout | `components/patterns/edition-atmosphere/compute-scattered-mosaic-layout.ts` | Deterministic tile positions |
| Stories panel chrome | `app/stories/stories-panel-chrome.ts` | Class-name helpers + mosaic seed |
| Stories edition CSS | `app/stories/stories-edition.css` | Surface stack + typography |
| Home wrapper | `components/home/HomeAtmosphereMosaic.tsx` | Thin wrapper; seed `home-edition-v6` |

Import `edition-atmosphere.css` once per route bundle that renders the canvas class.

---

## 9. Adoption checklist

- [ ] Route wrapper uses `storiesEditionRootClassName()` (includes atmosphere canvas).
- [ ] `EditionAtmosphereMosaic` mounted with correct seed key.
- [ ] All beats are opaque Surface panels; no fixed-ink mast.
- [ ] Light + dark theme verified; mosaic tiles subdued in dark.
- [ ] `prefers-reduced-motion`: mosaic hidden; content readable without tiles.
- [ ] Copper reserved for kickers, index numerals, and single map CTA.
- [ ] No em dashes in touched copy.
- [ ] Article JSON-LD unchanged; Sources footnote present.
- [ ] Tests: `stories-panel-chrome.test.ts`, `story-article-page.test.ts`, `compute-scattered-mosaic-layout.test.ts`.

---

## 10. Superseded patterns

| v5 pattern | v6 replacement |
|---|---|
| `.ds-stories-page` flat document page | `.ds-stories-edition` Surface stack |
| `.ds-story-mast` fixed charcoal + `AtmospherePlane` | Intro Surface panel + gutter mosaic |
| Full-bleed mast mosaic grid | Scattered gutter tiles (home register) |
| `.ds-page__eyebrow` / `.ds-page__title` on index | Edition header (`ds-stories-edition__*`) |

`AtmospherePlane` remains in use on **about** only; do not reintroduce on stories.
