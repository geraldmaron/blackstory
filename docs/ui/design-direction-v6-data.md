# BlackStory design direction v6 — data edition

**Status:** binding layout pattern for `/data` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** v5 data page mast (`ds-page__title` + flat `ds-data-page` sections).  
**Unchanged:** chart data contracts, warehouse/fixture ingest, dignity rules for indicators.

---

## 1. Intent

Data is the **national modeling room**: Census decades plus Phase 1 indicators (wealth, housing, credit, justice) that also appear on Themes. Readers should feel they are still inside the same **archive edition** as `/`, `/about`, and `/stories`, not a legacy document page with lightweight section chrome.

Design goals:

- **Arrive** through beat 00 intro: title, lede, quiet methodology link, mosaic credits.
- **Orient** through beat 01: how to read numbers, three orientation beats, on-page TOC pills.
- **Contextualize** Census population in beat 02 (paper-deep panel, densified chart pair).
- **Compare** wealth, housing, and justice indicators in beats 03–05 with cited SVG charts.
- **Connect** to Themes in beat 06 with Phase 1 coverage strip and quiet theme links.
- **Depart** through beat 07 with one copper Explore CTA.

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **gutters only**.

---

## 2. Canvas law — theme-aware edition + shared atmosphere

Data shares the **home mosaic atmosphere stack** via `EditionAtmosphereMosaic` and `edition-atmosphere.css`:

| Layer | Spec |
|---|---|
| Fixed grain + archive grid | `ds-edition-atmosphere-canvas::before` on route root |
| Gutter mosaic | `EditionAtmosphereMosaic` with seed `data-edition-v6` (distinct scatter from home/about/stories) |
| Surface panels | Opaque `ds-data-edition__panel` cards; no text atop mosaic without Surface |
| Ink / Charcoal bands | **Not on data** |
| Legacy page mast | **Banned** — superseded v5 `ds-page__eyebrow` + `ds-page__title` outside panels |

Mosaic tiles are **decorative only** in left/right gutter bands. `prefers-reduced-motion` hides live mosaic tiles. Dark theme scales mosaic opacity down.

Intro panel carries a quiet **mosaic credits** link to `/stories/mosaic-credits`.

---

## 3. Page scaffold

```
┌─ root (ds-data-edition + ds-edition-atmosphere-canvas) ───────────┐
│  [ EditionAtmosphereMosaic — seed: data-edition-v6 ]              │
│  ┌─ main (ds-container) ───────────────────────────────────────┐ │
│  │  [ Beat 00 — Intro Surface panel ]                           │ │
│  │  [ Beat 01 — Orientation + TOC pills ]                       │ │
│  │  [ Beat 02 — Population (paper-deep, chart pair) ]           │ │
│  │  [ Beat 03 — Wealth ]                                        │ │
│  │  [ Beat 04 — Housing and credit ]                            │ │
│  │  [ Beat 05 — Justice ]                                       │ │
│  │  [ Beat 06 — Themes hand-off ]                               │ │
│  │  [ Beat 07 — Next step (copper Explore) ]                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

**Rhythm tokens (align with home v6):**

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` (`1rem` ≤48rem) | `main` horizontal padding |
| Card gap | `1.25rem` | Vertical stack gap between panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

---

## 4. Edition headers

Each numbered beat uses the shared edition header register (about/history/stories aligned):

| Part | Typography |
|---|---|
| Index numeral | Mono copper graphic — `00` … `07` |
| Kicker | Mono uppercase copper slug |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`<em>archive</em>` on intro) |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from body by bottom Rule hairline.

---

## 5. Beat specs

### Beat 00 — Intro

- Kicker: `Numbers`
- Title: *Data behind the **archive**.*
- Lede: Census context + Phase 1 indicators + source visibility + Explore hand-off for county maps
- **One quiet CTA:** "Juxtaposition rules" → `/methodology`
- Mosaic credits line (mono, hairline top rule)

### Beat 01 — Orientation

- Three orientation beats (national first · sources visible · gaps are not silence)
- On-page TOC as Surface pills linking to beats 02–07
- Fixture/warehouse served-from note in lede

### Beat 02 — Population

- Paper-deep panel variant
- **Densified pair:** `PopulationByDecadeChart` + `BlackPopulationShareChart` (same components as home beat 03)
- Decade change strip, state shift (2010 to 2020), historical state coverage stats
- Census definition-boundary note preserved

### Beats 03–05 — Indicators

- Wealth: SCF race-pair comparison
- Housing: NHGIS homeownership, HMDA denial, CHAS cost burden
- Justice: BJS imprisonment + USSC federal drug sentences
- All charts reuse existing `components/data/*` SVG renderers and citations

### Beat 06 — Themes

- Phase 1 coverage strip when warehouse summary available
- Quiet CTAs to redlining theme, drug policy theme, methodology

### Beat 07 — Next step

- **One copper CTA:** "Explore the map" → `/explore`
- Quiet methodology and banned books links

---

## 6. Copper discipline

| Surface | Copper allowed |
|---|---|
| Beat 00 intro | Indices, kickers, link hover only |
| Beat 01 orientation | TOC pill border on focus/hover |
| Beat 02 population | Chart data marks only |
| Beats 03–06 | Indices, kickers, link hover |
| Beat 07 next | One solid copper CTA |

Never two copper-filled buttons in the same above-the-fold viewport.

---

## 7. Rip list — v5 data vs v6 data

| Topic | v5 data (superseded) | v6 data (binding) |
|---|---|---|
| Hero | `ds-page__eyebrow` + `ds-page__title` outside stack | Beat 00 Surface intro panel with edition header |
| Body rhythm | Flat `ds-data-page` + `ds-record-section` | Continuous Surface card stack |
| Atmosphere | None | Shared grain + grid + `EditionAtmosphereMosaic` |
| TOC | Hairline text links | Surface pill links inside orientation panel |
| Charts | `ds-data-section__viz` on flat sections | Densified `ds-data-edition__viz` inside panels |
| Theme | Mixed page mast + sections | Theme-aware edition throughout |

**Carried forward:** all chart components, data fetch contracts, section anchors, Themes/Explore hand-offs, Census notes.

---

## 8. Implementation pointers

- Route: `apps/web/src/app/data/page.tsx`
- Sections: `apps/web/src/app/data/DataSections.tsx`
- CSS: `data-edition.css`; atmosphere: `components/patterns/edition-atmosphere/`
- Mosaic: `EditionAtmosphereMosaic` with `data-edition-v6` seed
- Panel chrome: `data-panel-chrome.ts` (class helpers + tests)
- Copy constants: `data-copy.ts`
- Charts: `components/data/*` (unchanged renderers; `data-charts.css` shared)

---

## 9. Acceptance checklist

- [ ] `/data` renders theme-aware canvas + Surface panels — no ink/charcoal bands
- [ ] Paper grain + archive grid in gutters; scattered mosaic via shared component
- [ ] Beat 00 has quiet methodology CTA; mosaic credits link present
- [ ] Beats 01–07 present in order with edition headers and copper index numerals
- [ ] Population beat uses paper-deep variant and densified chart pair
- [ ] All Phase 1 indicator charts and Census sections preserved with citations
- [ ] No em dashes in shipped data copy
- [ ] Copper review passes: one copper button on page (beat 07)
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px
- [ ] `prefers-reduced-motion`: mosaic hidden
- [ ] v5 data mast superseded — this file cited in PR / bead close notes
