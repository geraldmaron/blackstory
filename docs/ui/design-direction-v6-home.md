# BlackStory design direction v6 — home edition

**Status:** binding layout pattern for `/` only (2026-07-23).  
**Source mockup:** `blackstory-home-redesign-mockup.html` v8.2+ (owner-approved).  
**Supersedes:** `design-direction-v5.md` §6 home beats and §5 footer-on-home only.  
**Unchanged:** brand tokens, type, color, radii, dignity rules (`brand.md`); all non-home surfaces remain on v5.

---

## 1. Intent

Home is a **place-first front door**, not a marketing landing page or a thin side-project splash.

Readers should feel they have entered an **institutional archive edition**: compact, evidence-dense, map-aware, and serious enough to trust with history. The page teaches through structure (beats 01–05), not through decorative chrome or cinematic full-bleed map theater.

Design goals:

- **Arrive** through a single hero panel that pairs copy with a legible map readout.
- **Orient** through geography (beat 01), not category walls.
- **Discover** one record at a time with visible anatomy (beat 02).
- **Trust** through numbers and methodology in the middle proof band (beats 03–04).
- **Depart** through atlas hand-off and a footer that carries real jobs (explore, about, legal).

Anything that does not serve one of these beats is chrome. Chrome loses.

---

## 2. Canvas law — theme-aware edition

Home runs as **one continuous archive edition** for the full scroll depth, following the site
reader theme toggle (light and dark). Do not hide or disable the theme control on `/`.

| Rule | Light theme | Dark theme |
|---|---|---|
| Page canvas | Archive Paper `#F4EFE5` (`--ds-canvas`) | Black Ink `#0A0A0A` |
| Raised panels | Surface `#FBF8F2` (`--ds-surface`) | Charcoal `#161616` |
| Deep panel variant | Paper-deep mix on canvas (beat 03) | Canvas/rule mix (beat 03) |
| Ink / Charcoal bands | **Not on home** | **Not on home** |
| Copper | Text `#8E4F2A`, graphic `#B86B2A` | Text `#D07A32`, graphic `#D07A32` |
| Reader theme toggle | **Active on `/`** — home is not a light-only exception |

**Atmosphere, not wallpaper:** page gutters carry a **two-layer stack** — fixed pseudo-element texture (paper grain + quiet archive index grid / corner brackets on Rule and copper hairlines) and an optional **scattered archive mosaic variant** (`HomeAtmosphereMosaic`) that reuses the rights-cleared `/brand/collage/tiles/` pool from story/about atmosphere. Tiles are deterministically shuffled into left/right gutter bands only; center content and Surface cards stay opaque (WCAG floor). Mosaic opacity scales down in dark theme; `prefers-reduced-motion` hides live mosaic tiles. No crumpled continental silhouettes, no competing fake map under the live hero readout, no sepia stock.

The hero map inside beat 0 is a **Surface-contained live readout**: the persistent MapLibre plate (`MapStage`) is **positioned** into the hero map column (viewport-fixed box from `hero-map-inset.ts`, not `clip-path`) so real archive pins render in-panel — never a decorative sketch, never full-bleed wallpaper under the whole page.

---

## 3. Page scaffold

```
┌─ main (max ~84rem, centered, page inset) ─────────────────────┐
│  [ Shell — sticky Surface card ]                               │
│  [ Hero — single Surface panel, copy | map ]                   │
│  [ Beat 01 — Your place ]                                      │
│  [ Beat 02 — One story + record carousel ]                     │
│  [ Beat 03 — What the numbers show ]  ← paper-deep variant     │
│  [ Beat 04 — Evidence before assertion ]                       │
│  [ Beat 05 — Atlas rewind ]                                    │
│  [ Footer — Surface card, three job columns ]                  │
└────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

**Rhythm tokens (mockup anchors, map to `--ds-space-*` in implementation):**

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` ( `1rem` ≤48rem ) | Horizontal padding of `main` |
| Card gap | `1.25rem` | Vertical stack gap between shell, hero, beats, footer |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Beat padding | `1.75rem 1.25rem` (tighter on mobile) | Inside numbered beats |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule `#D7D0C4` borders, `--ds-radius-md` (16px) on cards, `--ds-radius-sm` (8px) on buttons/inputs. Flat matte fills only — no shadows, gradients, glows, or bevels.

---

## 4. Shell / nav on home

Home shell is a **Surface card inside `main`**, not a full-bleed theme-flipping header bar.

| Element | Spec |
|---|---|
| Position | `sticky`; `top` = page inset; sits above beat stack |
| Surface | Surface fill, 1px Rule border, radius-md |
| Brand | Symbol (36px) + wordmark; official artwork from `apps/web/public/brand/` — never reconstruct lockup in JSX |
| Primary nav | Map · Data · Themes · Methodology — Inter 500, Stone default, copper-text on hover/active |
| Primary action | **One copper CTA:** "Near You" (or equivalent locate hand-off) — the only copper button in the shell |
| Mobile (<48rem) | Hide inline nav; keep symbol + wordmark + copper CTA; menu pattern follows v5 bottom-sheet law |

Shell follows reader document chrome weight (compact bar ~48–52px effective), not the oversized pill slab. No copper underline nav on home — orientation copper is reserved for the shell CTA and in-page beat indices.

---

## 5. Hero — single Surface panel

The hero is **one Surface card** containing copy and map. It is **not** a full-viewport MapLibre stage with typography overlaid on the basemap (v5 home).

### 5.1 Panel anatomy

| Zone | Share | Content |
|---|---|---|
| Copy column | ~46% desktop | Kicker, headline, lede, CTAs, scroll cue, micro-facts |
| Map column | ~54% desktop | Caption, map frame (edge-to-edge inside column) |
| Divider | 1px Rule hairline | Vertical between columns; horizontal on mobile stack |

**Internal copy frame:** optional decorative hairline rectangle inset on the copy side (low-opacity Rule border, radius-lg) — orientation affordance only; must not read as a second card.

### 5.2 Copy stack

1. **Kicker** — IBM Plex Mono, uppercase slug, Stone; leads with copper tick SVG (same orientation mark as v5.1).
2. **Headline** — Sora SemiBold, display clamp ~`1.875rem–2.625rem`; one warm word in Source Serif 4 italic copper text (`<em>`): *"Black Story happened **here**."* pattern.
3. **Lede** — Source Serif 4, Stone, max ~38ch.
4. **Actions** — exactly **one copper CTA** ("Find what happened near you" → beat 01 anchor) + **one quiet** secondary ("Explore the map" → `/explore`). No second copper button.
5. **Scroll cue** — mono slug linking to beat 01 ("Your place") with chevron; not a primary action.
6. **Micro-facts** — three-up grid separated by Rule hairlines: mono value + mono uppercase label (records pinned, states on map, eras spanned). Tabular nums.

### 5.3 Map readout

- Caption: mono uppercase, centered — e.g. "Live coverage · archive pins" (middle dot separator, not em dash).
- Frame: fills column height (`min-height` ~`min(48vh, 28rem)` desktop; ~14rem mobile).
- Content: **live MapLibre plate** positioned into the map column (`hero-map-inset.ts`) with real archive entity pins from the active release — stays inside the panel, never bleeds to viewport edges.
- Map column is a transparent pass-through (`pointer-events: none`); MapStage plate receives pin/state hits beneath it.
- `engage()` clears the hero geometry before routing to `/explore` (ADR-017 handoff).

**Cross-browser (Safari, Chrome, Firefox; mobile WebKit):** Hero inset uses viewport-fixed geometry from `hero-map-inset.ts`, not `clip-path` (Safari WebGL compositing). Inset resyncs on scroll, resize, and `orientationchange`; MapStage calls `resize()` after each apply. See [`patterns-map-canvas.md`](./patterns-map-canvas.md).

### 5.4 Mobile

Stack copy above map. Micro-facts become single column with horizontal rules between items. Hero max-height is **not** forced to `100svh` — the next beat may peek above the fold.

---

## 6. Edition beats (01–05)

Each beat is a **Surface panel card** with a shared **edition header**:

| Part | Typography |
|---|---|
| Index numeral | Large mono, copper pin color — `01` … `05` |
| Index ↔ title gap | `clamp(2rem, 4vw, 3.25rem)` column gap so numerals never collide with title stack |
| Kicker | Mono uppercase, copper text |
| Title | Sora SemiBold, section scale |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from body by bottom Rule hairline (except beat 05 inline header variant).

### Beat 01 — Your place

**Job:** Enter through geography.

- Two-column desktop: controls column (~1.15fr) + "How entry works" aside (~0.85fr).
- **Place controls:** native state `<select>` (44px, Paper fill) + ghost "Near You" button in one row; serif helper line with underlined copper link to map locate.
- **Presence strip:** Paper fill card listing deepest coverage corridors with record counts (mono copper counts, hairline-separated rows).
- **Entry-facts aside:** labeled rows (Pin / Browse / Source) — literal labels, v5 cognitive-accessibility law.

### Beat 02 — One story (record carousel)

**Job:** Show the grain of the archive — one featured record with anatomy visible.

- **Record carousel** (primary column): focusable region (`tabindex="0"`), `aria-roledescription="carousel"`.
  - Toolbar: shared `RecordBrowseControls` pattern — prev/next arrows (44px targets), optional dot rail (≤12 items), segmented **Ordered / Random** toggle, live position (`n / N` mono in ordered mode; `Random · N records` in random mode). See `docs/ui/patterns-browse-mode.md`.
  - Data: full active-release entity set (curated featured ids lead when present; every other release record follows without duplicates).
  - **Facts strip:** four columns — Kind · Where · Era · Evidence (wraps 2×2 on mobile).
  - Slide body: kind slug, Sora name, serif one-line story, actions.
  - **One copper CTA per slide:** "Open full record". Quiet secondary: "Show on map".
  - Keyboard: ArrowLeft / ArrowRight. Reduced motion: cut transitions, no auto-advance.
- **Sidebar:** "Also in this release" link list with mono place · role meta.

Carousel replaces v5's static 3-up story rail on home.

### Beat 03 — What the numbers show (proof band, part 1)

**Job:** Archive scale beside national census context.

- Panel uses **paper-deep** background variant to mark the proof band visually.
- **Data strip:** three mono stat tiles (records pinned, states, eras spanned) — same figures as hero micro-facts allowed but not required to duplicate.
- **Viz pair:** two-up desktop — bar chart (Black population by decade) + line chart (share of total population). Page Sand fills for early decades; copper for recent. Every chart carries mono source caption with hairline top rule.
- **Hand-off:** quiet CTA to `/data` — not copper (shell + hero + beat 04 own the copper budget).

Population data is **context for place**, not a substitute for it. No hate-crime or violence-coded charts on home (dignity).

### Beat 04 — Evidence before assertion (proof band, part 2)

**Job:** How records reach the map.

- **Pipeline diagram:** Discovery → Review → Verify → Publish → Pin (mono labels, copper arrows on forward path, dashed return path for held records).
- **Publish rules:** three numbered cards (01–03) with copper numerals — documented claims, visible contradictions, dignity as rule.
- **Dignity line:** serif callout with mono uppercase label — no anonymous decoration, no alarm framing, no crime-heat rendering.
- **One copper CTA:** "Read the methodology" → `/methodology`.

### Beat 05 — Atlas rewind

**Job:** Hand off to the full atlas experience.

- Two-column: copy + static timeline scrub preview (mono axis, sand/copper tick marks, paused playhead).
- Copy explains coverage thickens where evidence clusters.
- **Quiet CTA** only: "Open the full atlas" → `/explore` or atlas route.
- No autoplay decade animation on home (v5 hero "decades in motion" is **not** replicated here).

---

## 7. Footer on home

Home footer is a **Surface card**, not the v5 fixed-ink band. Sitewide footer follows the same pattern — see [`patterns-site-footer.md`](./patterns-site-footer.md).

| Element | Spec |
|---|---|
| Lockup | Sora display scale wordmark ("BlackStory") — typographic landmark, not the PNG lockup at mega size unless artwork bead says otherwise |
| Tagline | Source Serif — *People. Places. Evidence. Context.* |
| Columns | Three job columns with mono copper headings: **Explore** (Map, Data, Themes, Books, Law archive) · **About** (Our story, Methodology, Contributors, Contact) · **Legal** (Privacy, Terms, Accessibility, Data use) |
| Meta | Mono copyright + core line |

Links default Stone, copper-text on hover. Footer carries navigation jobs; it is not fine-print-only.

---

## 8. Density and copper discipline

### Compact density

- Body size ~`0.9375rem` / 15px effective on home edition.
- Generous display type; economical chrome padding.
- Lists use hairline rows, not boxed grids of prose.
- Sections chunk with visible index numerals — reader always knows where they are.

### Copper budget (review gate)

Copper (~10–15% of any viewport) is orientation only:

| Surface | Copper allowed |
|---|---|
| Shell | One CTA button |
| Hero | One CTA button |
| Beat 02 slide | One CTA button (per active slide) |
| Beat 04 | One CTA button |
| Beats 01, 03, 05, footer | Links and indices only (`--ds-accent` text, pin fills, index numerals) — **no copper button fill** |

Never two copper-filled buttons visible in the same above-the-fold viewport. Raw Copper Pin never carries body-size text on light canvas.

### Copy law

- **No em dashes** in user-facing home copy. Use "to" for ranges (`1820s to 1970s`), middle dots for compound labels (`Grade A · 4 sources`), commas and periods otherwise.
- Sentence case body; mono uppercase only for slugs, labels, and captions.
- People named with role and place context; no anonymous decoration.

---

## 9. Rip list — v6 home vs v5 home

| Topic | v5 home (superseded for `/`) | v6 home (binding) |
|---|---|---|
| Hero map | Full-viewport persistent MapLibre plate; typography on basemap | Single Surface panel; map is a column inside the card |
| Viewport height | `100svh` / `88svh` hero | Content-height hero; next beat may peek |
| Decades in motion | Ambient looping timeline on hero map | Static timeline preview in beat 05 only |
| Page canvas | Ink plate + paper sections mixed | Continuous theme-aware edition (Archive Paper or charcoal) |
| Footer | Fixed-ink band | Surface card with three job columns |
| Shell | Full-width theme-aware bar, blur | Sticky Surface card inside `main` |
| Story discovery | 3-up top-rule story rail | Record carousel with facts anatomy |
| Proof band | About thesis + data viz + trust section | Beats 03–04 as explicit middle proof band |
| Atmosphere | Map plate + optional scrim | Paper grain + archive grid in gutters; scattered mosaic variant; live map in hero frame |
| Theme on home | Follows reader light/dark | Follows reader light/dark (same as rest of site) |
| Place entry | Secondary under thesis | Beat 01 lead geography block |

**Carried forward unchanged from v5:** brand tokens, typography registers, 44px targets, dignity/map precision rules, cognitive-accessibility labeled-facts law, one-record anatomy, reduced-motion respect, WCAG AA floor, official brand artwork paths.

---

## 10. Implementation pointers (non-binding hints)

- CSS surface: `apps/web/src/app/(home)/` or page-scoped module; reuse `--ds-*` tokens, no raw hex.
- Atmosphere texture: `home-edition.css` (`::before` grain/grid); mosaic variant: `HomeAtmosphereMosaic` + `compute-scattered-mosaic-layout.ts`
- Record carousel: compose from `@repo/ui` primitives where possible; shared browse controls live in `apps/web/src/components/patterns/` (`RecordBrowseControls`, `BrowseModeToggle`, `browse-mode.css`).
- Live hero map wiring: `hero-map-inset.ts` positions MapStage over `.ds-home-hero__map` (map column); copy column is opaque Surface beside it.
- Mockup reference file: copy into `docs/ui/fixtures/` when owner drops it in repo; until then, Downloads path above is the binding visual.

---

## 11. Acceptance checklist

Use this list to sign off home implementation against v6:

- [ ] `/` renders on theme-aware canvas + Surface cards — no ink/charcoal bands; theme toggle works on home
- [ ] Paper grain + archive grid atmosphere in gutters; scattered mosaic optional; no text atop mosaic without Surface
- [ ] Shell is sticky Surface card with one copper CTA; mobile nav collapses per v5 sheet law
- [ ] Hero is one panel with hairline-split copy and map columns (stacked on mobile)
- [ ] Hero has exactly one copper and one quiet CTA; micro-facts render three-up with labels
- [ ] Beats 01–05 present in order with edition headers and copper index numerals
- [ ] Beat 02 carousel is keyboard-operable, exposes Kind/Where/Era/Evidence, one copper action per slide
- [ ] Beat 03 uses paper-deep variant, data strip, two cited viz cards, quiet link to `/data`
- [ ] Beat 04 shows pipeline + three publish rules + dignity line + one copper link to `/methodology`
- [ ] Beat 05 shows static timeline preview + quiet atlas hand-off
- [ ] Footer is Surface card with Explore / About / Legal columns and tagline (pattern: `patterns-site-footer.md`)
- [ ] No em dashes in shipped home copy
- [ ] Copper review passes: ≤1 copper button per viewport fold; no raw copper body text
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px
- [ ] `prefers-reduced-motion`: carousel cuts, no ambient map animation
- [ ] v5 home layout docs superseded — this file cited in PR / bead close notes

---

## 12. Supersession

For **`/` only**, this document supersedes:

- `design-direction-v5.md` §6 home bullet list (five beats)
- `design-direction-v5.md` §5 footer spec **as applied to home**
- `docs/ui/README.md` statement that home is an "intentional text-led interim"

All other v5 surfaces, chrome primitives (pill CTAs, explore cockpit, search mast, entity anatomy), and `brand.md` tokens remain binding until a future direction doc says otherwise.
