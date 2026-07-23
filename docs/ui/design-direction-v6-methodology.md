# BlackStory design direction v6 — methodology edition

**Status:** binding layout pattern for `/methodology` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** v5 methodology page mast (`ds-page__*` hero + flat `ds-methodology` body).  
**Unchanged:** trust domain copy, JSON-LD, ledger definitions, verification rules.

---

## 1. Intent

Methodology is the **full transparency receipt**: definitions, source hierarchy, confidence grades, map dignity limits, and correction policy. Readers should feel they are still inside the same **archive edition** as `/`, `/about`, and `/stories`, not a dense legal appendix or a separate trust microsite.

Design goals:

- **Arrive** through beat 00 intro: transparency lede, site disclaimer, on-page index, one copper CTA.
- **Trust** through mission beats (01) and evidence pipeline (02) aligned with home beat 04.
- **Verify** through research flow (03), reading pedagogy (04), definitions (05), and sources (06).
- **Audit** through standards panel (07): verification, confidence, dignity, limitations.
- **Account** through operations grid (08) and related links (09).

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **gutters only**.

---

## 2. Canvas law — theme-aware edition + shared atmosphere

Methodology shares the **home mosaic atmosphere stack** via `EditionAtmosphereMosaic` and `edition-atmosphere.css`:

| Layer | Spec |
|---|---|
| Fixed grain + archive grid | `ds-edition-atmosphere-canvas::before` on route root |
| Gutter mosaic | `EditionAtmosphereMosaic` with seed `methodology-edition-v6` (distinct scatter from home/about/stories) |
| Surface panels | Opaque `ds-methodology-edition__panel` cards; no text atop mosaic without Surface |
| Ink / Charcoal bands | **Not on methodology** |
| v5 page mast | **Banned** — superseded flat `ds-page__eyebrow` + `ds-page__title` hero |

Mosaic tiles are **decorative only** in left/right gutter bands. `prefers-reduced-motion` hides live mosaic tiles. Dark theme scales mosaic opacity down.

Intro panel carries a quiet **mosaic credits** link to `/stories/mosaic-credits`.

---

## 3. Page scaffold

```
┌─ root (ds-methodology-edition + ds-edition-atmosphere-canvas) ──┐
│  [ EditionAtmosphereMosaic — seed methodology-edition-v6 ]       │
│  ┌─ main (ds-container) ──────────────────────────────────────┐ │
│  │  [ Beat 00 — Intro: transparency lede + TOC + CTAs ]      │ │
│  │  [ Beat 01 — Mission beats ]                               │ │
│  │  [ Beat 02 — Evidence pipeline (home beat 04 alignment) ]  │ │
│  │  [ Beat 03 — Full research pipeline sketch ]               │ │
│  │  [ Beat 04 — How to read / prebunk ]                       │ │
│  │  [ Beat 05 — Definitions ledgers ]                         │ │
│  │  [ Beat 06 — Source hierarchy ]                            │ │
│  │  [ Beat 07 — Standards (paper-deep variant) ]              │ │
│  │  [ Beat 08 — Operations grid ]                             │ │
│  │  [ Beat 09 — Related trust links ]                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

**Rhythm tokens (align with home/about v6):**

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` (`1rem` ≤48rem) | `main` horizontal padding |
| Card gap | `1.25rem` | Vertical stack gap between panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

---

## 4. Edition headers

Each numbered beat uses the shared edition header register:

| Part | Typography |
|---|---|
| Index numeral | Mono copper graphic — `00` … `09` |
| Kicker | Mono uppercase copper slug |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`<em>work</em>` on intro) |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from body by bottom Rule hairline.

---

## 5. Beat specs

### Beat 00 — Intro

- Kicker: `Transparency`
- Title: *How we **work**.*
- Lede: full receipt framing (definitions, sources, confidence, dignity, corrections)
- Site-wide disclaimer (`TrustSiteDisclaimer`)
- **One copper CTA:** "Open the map" → `/explore`
- **One quiet CTA:** "About BlackStory" → `/about`
- On-page anchor index (Mission through Operations)
- Mosaic credits line (mono, hairline top rule)

### Beat 01 — Mission

Three-column mission beats desktop / stacked mobile: not erased · not hidden · about you. Copy preserved from prior methodology page.

### Beat 02 — Evidence pipeline (home beat 04 alignment)

Mirrors home beat 04 **Evidence before assertion**:

- Compact `ResearchPipelineSketch`
- Three numbered publish-rule cards (01–03): documented claims, visible contradictions, dignity as rule
- Dignity callout line (mono label + serif body)
- **No copper CTA here** (intro owns the fold copper budget)

Publish rule copy matches `HomeHowThisWorks` / `methodology-copy.ts` constants.

### Beat 03 — Research flow

Full `ResearchPipelineSketch` with expanded lede on intake, aggregation, models, and human publish gate.

### Beat 04 — How to read

Prebunk technique grid (2-up tablet, 3-up desktop). Copy from `PREBUNK_TECHNIQUE_FRAMES`.

### Beat 05 — Definitions

Ledger stacks for notability, fact lifecycle, entity status vocabularies. Warning callouts for cultural-figure calibration and public projection gate.

### Beat 06 — Sources

Numbered source tier stack + `SourceTypesSketch` side panel on wide viewports.

### Beat 07 — Standards

Paper-deep panel variant. Policy blocks: verification steps, confidence grade cards (glyph + label), map dignity rules, known limitations.

### Beat 08 — Operations

Two-column grid: cadence, corrections lane, funding firewall, masthead roles, Trust Project indicators, IFCN alignment. Theme-aware tokens only; no fixed-ink band.

### Beat 09 — Close

Quiet link row: About · Corrections · Errata · Open the map.

---

## 6. Copper discipline

| Surface | Copper allowed |
|---|---|
| Beat 00 intro | One solid copper CTA |
| Beats 01–09 | Indices, kickers, link hover, publish-rule numerals, rule-strip indices |
| Beat 02 pipeline | Copper arrows in sketch SVG (orientation only) |

Never two copper-filled buttons in the same above-the-fold viewport.

---

## 7. Rip list — v5 methodology vs v6 methodology

| Topic | v5 methodology (superseded) | v6 methodology (binding) |
|---|---|---|
| Hero | `ds-page__eyebrow` + `ds-page__title` outside panels | Beat 00 Surface intro panel |
| Body rhythm | Flat `ds-methodology` sections in container | Continuous Surface card stack |
| Atmosphere | None | Shared grain + grid + `EditionAtmosphereMosaic` |
| Evidence band | Research sketch only in one section | Beat 02 mirrors home beat 04 pipeline + publish rules |
| Theme | Mixed section tokens | Theme-aware edition throughout |
| Operations | Already theme-aware (2026 fix) | Edition panel beat 08 |

**Carried forward:** all trust copy, ledger definitions, JSON-LD, verification/dignity/limitation rules, operations grid content.

---

## 8. Implementation pointers

- Route: `apps/web/src/app/methodology/page.tsx`
- Sections: `MethodologySections.tsx`
- CSS: `methodology-edition.css`; atmosphere: `components/patterns/edition-atmosphere/`
- Mosaic: `EditionAtmosphereMosaic` with `methodology-edition-v6` seed
- Panel chrome: `methodology-panel-chrome.ts` (class helpers + tests)
- Copy constants: `methodology-copy.ts` (publish rules align with home beat 04)

---

## 9. Acceptance checklist

- [ ] `/methodology` renders theme-aware canvas + Surface panels — no ink/charcoal bands
- [ ] Paper grain + archive grid in gutters; scattered mosaic via shared component
- [ ] Beat 00 has exactly one copper and one quiet CTA; mosaic credits link present
- [ ] Beats 00–09 present in order with edition headers and copper index numerals
- [ ] Beat 02 aligns with home beat 04: compact pipeline + three publish-rule cards + dignity line
- [ ] Beat 07 uses paper-deep variant; standards content preserved
- [ ] Beat 08 operations theme-aware; no fixed-ink band
- [ ] All prior methodology copy preserved (definitions, sources, confidence, dignity, operations)
- [ ] No em dashes in shipped methodology copy
- [ ] Copper review passes: ≤1 copper button per viewport fold
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px
- [ ] `prefers-reduced-motion`: mosaic hidden
- [ ] v5 methodology mast superseded — this file cited in PR / bead close notes
