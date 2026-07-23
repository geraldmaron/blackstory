# BlackStory design direction v6 — about edition

**Status:** binding layout pattern for `/about` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** v5 about mast (`AboutMosaicMast` full-bleed living collage + ink band).  
**Unchanged:** brand tokens, type, dignity rules (`brand.md`); mission copy constants.

---

## 1. Intent

About is the **product thesis page**: why BlackStory exists, what the archive stands on, and where to begin on the site. Readers should feel they are still inside the same **archive edition** as `/`, not a separate marketing microsite or a dark charcoal mast with clickable mosaic tiles.

Design goals:

- **Arrive** through beat 00 intro: core line, lede, one copper CTA, quiet methodology link.
- **Trust** through pillars (01) and mission beats (02): presence, evidence, dignity.
- **Verify** through publish bar (03): released projections, methodology hand-off.
- **Depart** through destination list (04) and no-account close (05).

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **gutters only**.

---

## 2. Canvas law — theme-aware edition + shared atmosphere

About shares the **home mosaic atmosphere stack** via `EditionAtmosphereMosaic` and `edition-atmosphere.css`:

| Layer | Spec |
|---|---|
| Fixed grain + archive grid | `ds-edition-atmosphere-canvas::before` on route root |
| Gutter mosaic | `EditionAtmosphereMosaic` with seed `about-edition-v6` (distinct scatter from home/stories) |
| Surface panels | Opaque `ds-about-edition__panel` cards; no text atop mosaic without Surface |
| Ink / Charcoal bands | **Not on about** |
| Crumpled map / living clickable mast | **Banned** — superseded v5 `AboutMosaicMast` |

Mosaic tiles are **decorative only** in left/right gutter bands. `prefers-reduced-motion` hides live mosaic tiles. Dark theme scales mosaic opacity down.

Intro panel carries a quiet **mosaic credits** link to `/stories/mosaic-credits` (not interactive tile navigation).

---

## 3. Page scaffold

```
┌─ root (ds-about-edition + ds-edition-atmosphere-canvas) ────────┐
│  [ EditionAtmosphereMosaic — gutter scatter ]                    │
│  ┌─ main (ds-container) ─────────────────────────────────────┐ │
│  │  [ Beat 00 — Intro Surface panel ]                         │ │
│  │  [ Beat 01 — Pillars ]                                     │ │
│  │  [ Beat 02 — Mission beats ]                               │ │
│  │  [ Beat 03 — Publish bar (paper-deep variant) ]            │ │
│  │  [ Beat 04 — Where to begin ]                              │ │
│  │  [ Beat 05 — No account required ]                         │ │
│  │  [ MakerCredit inline ]                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
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

Each numbered beat uses the shared edition header register (history/stories aligned):

| Part | Typography |
|---|---|
| Index numeral | Mono copper graphic — `00` … `04` |
| Kicker | Mono uppercase copper slug |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`<em>place</em>` on intro) |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from body by bottom Rule hairline.

---

## 5. Beat specs

### Beat 00 — Intro

- Kicker: `BlackStory`
- Title: *History, pinned to **place**.*
- Lede: place-connected platform framing + support line
- **One copper CTA:** "Open the map" → `/explore`
- **One quiet CTA:** "Methodology" → `/methodology`
- Mosaic credits line (mono, hairline top rule)

### Beat 01 — Pillars

Three columns desktop / stacked mobile: Presence · Evidence · Dignity. Copy preserved from prior about page.

### Beat 02 — Mission beats

Three hairline-separated rows with mono indices 01–03: erased · findable · accessible.

### Beat 03 — Publish bar

Paper-deep panel variant. Methodology copper CTA + quiet corrections/errata links. No fixed-ink band.

### Beat 04 — Destinations

Two-column link grid (desktop): Map, Search, History, Data, Law, Submit with detail lines.

### Beat 05 — Close

"No account required" + copper explore CTA + quiet stories link.

---

## 6. Copper discipline

| Surface | Copper allowed |
|---|---|
| Beat 00 intro | One solid copper CTA |
| Beat 03 publish | One solid copper CTA |
| Beat 05 close | One copper CTA (`ds-cta--copper`) |
| Beats 01, 02, 04 | Indices, kickers, link hover text only |

Never two copper-filled buttons in the same above-the-fold viewport.

---

## 7. Rip list — v5 about vs v6 about

| Topic | v5 about (superseded) | v6 about (binding) |
|---|---|---|
| Hero | Full-bleed `LivingAtmosphereMosaic` mast on charcoal | Beat 00 Surface intro panel |
| Mosaic interaction | Clickable tiles → entity records | Decorative gutter scatter only |
| Body rhythm | Mixed container sections + ink band | Continuous Surface card stack |
| Atmosphere | Mast-fill living collage | Shared grain + grid + `EditionAtmosphereMosaic` |
| Theme | Charcoal mast + paper body mix | Theme-aware edition throughout |

**Carried forward:** mission copy, pillars, destinations, publish bar prose, maker credit.

---

## 8. Implementation pointers

- Route: `apps/web/src/app/about/page.tsx`
- CSS: `about-edition.css`; atmosphere: `components/patterns/edition-atmosphere/`
- Mosaic: `EditionAtmosphereMosaic` with `about-edition-v6` seed
- Panel chrome: `about-panel-chrome.ts` (class helpers + tests)
- Copy constants: `about-copy.ts`

---

## 9. Acceptance checklist

- [ ] `/about` renders theme-aware canvas + Surface panels — no ink/charcoal bands
- [ ] Paper grain + archive grid in gutters; scattered mosaic via shared component
- [ ] Beat 00 has exactly one copper and one quiet CTA; mosaic credits link present
- [ ] Beats 01–05 present in order with edition headers and copper index numerals
- [ ] Publish beat uses paper-deep variant; no fixed-ink band
- [ ] Mission copy preserved (pillars, three beats, destinations)
- [ ] No em dashes in shipped about copy
- [ ] Copper review passes: ≤1 copper button per viewport fold
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px
- [ ] `prefers-reduced-motion`: mosaic hidden
- [ ] v5 about mast superseded — this file cited in PR / bead close notes
