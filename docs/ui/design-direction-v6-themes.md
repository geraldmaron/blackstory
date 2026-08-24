> **SUPERSEDED.** This document is superseded by the v9 chapters surface. Route today: /themes 308-redirects to /chapters; app/themes does not exist. It is kept as the provenance record; do not build from it. See the supersession table in docs/ui/README.md.

# BlackStory design direction v6 — themes edition

**Status:** binding layout pattern for `/themes` and `/themes/*` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** `design-direction-v5.md` § themes browse mast and flat container layout only.  
**Unchanged:** theme-impact data contract, packet fixtures, URL shape (`/themes/[themeId]/questions/[questionId]`), juxtaposition method stance.

---

## 1. Intent

Themes is the **policy-impact reading room** for hard readers (researchers / journalists): one continuous theme arc with cited instruments beside the prose, era beats, gap honesty without banner walls, and packet provenance available for verification.

Design goals:

- **Arrive** through beat 00 intro: impact framing, lede, quiet books crosslink, mosaic credits.
- **Trust** through beat method panel: juxtaposition bar + methodology hand-off (quiet; not lecture-first).
- **Read** one continuous arc (people → time → instruments), not a dump of Q cards as the primary pass.
- **Browse** P0 and P1 catalogs as hairline ledger rows inside opaque Surface panels.
- **Verify** secondary packet / question pages with full provenance quartet.
- **Relate** soft cross-theme threads where spines already share (housing→schools→voting; drug→incarceration).

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **gutters only** (same register as home/stories/about).

**Geography default:** metro OR national wherever the fullest story can be told; not Chicago-only.

**Tone:** steadier (~70%): pride without spectacle; calm, precise. Causation leans slightly toward implied connection by arc (~51%), with gates for true causal claims.

### 1.1 Theme arc voice (NYC professor)

Theme arcs are written as if a New York urban-history seminar is in session: you can smell the chalk and the archive in the room. Hard readers get taught, not briefed by a chartbook and not entertained by purple memoir.

| Trait | Practice |
|---|---|
| Journey first | One continuous theme page walks scene → policy → practice → lived place → measurement → unfinished consequences; not a Q-card dump |
| Human storytelling | Write in full, explanatory sentences: poised, pointed where needed, never choppy slogan lines or chartbook dump |
| Place you in the scene | Open with a named person / role / place / year when people appear; ink-sketch visuals pace each beat before instrument labels |
| Hand-drawn visuals | Each beat carries an ink-sketch chapter visual (`ThemeJourneyVisual`): flat matte line art, copper orientation only, no gradients or glow; prefer project SVG sketches; file asset gaps via beads when a theme lacks art |
| Classroom presence | Address the reader as if they are at the table with the maps, statutes, and series open |
| Teaching gesture | Walk from scene to spine: “stand here, then open the county series” |
| Expand names in prose | Spell out Home Owners' Loan Corporation, Federal Housing Administration, Fair Housing Act, Community Reinvestment Act, American Community Survey, and peers on first use; acronyms only after the full name or in quiet instrument labels |
| Inline entity links | When people, places, events, or laws enter the arc, link them with `[[entityId\|Label]]` markup to `/entity/{id}` (via `LinkedProse`); never leave a dangling id |
| Law / policy blurbs | When a statute is tied into a beat, show a short human summary inline beside the prose **and** in the side-rail acts list, with entity links |
| Embedded evidence | Specific figures and years live in the prose; instruments sit beside the arc |
| Multi-year instruments only | On themes that span years, the primary instrument rail shows multi-year spines (e.g. homeownership 1990 / 2000 / 2010 plus a later catalog handoff; Survey of Consumer Finances 1989 / 2010 / 2022; Home Mortgage Disclosure Act only when multiple years are loaded). Do not pin lone single-year chips, and do not float an American Community Survey-only snapshot on the primary rail unless it continues a series already shown |
| Comparative calm | Disparities named plainly; no sensational framing; no completeness overclaims |
| Named sources | Cite instruments in the room (National Archives Record Group 195, Federal Housing Administration manual, American Community Survey, NHGIS, BJS Table 6, CPS A-1, …) |
| Seam honesty | Multi-source handoffs written through in the lecture; method differences stay juxtaposed, never silently merged |
| Voice | Steady scholarly authority with dry precision; pride without spectacle; evidence before assertion; no em dashes in user-facing copy |

Do not advertise a slogan for this pattern. The page should simply read that way. EPI chartbook numbers remain useful instruments; EPI’s cool policy-institute register is not the voice. If an entity card needed for an inline link is missing or thin, backfill it in national-catalog fixtures in the same change.

**Folded chapters (stories promoted into a theme's spine):** when a story
folds into a theme arc as a chapter, its prose must additionally follow
`docs/content/neo-voice.md` (named actor/hour — Part II Law 1; prose builds
stakes before a `DataMoment` delivers the verdict — Part III; sentence
rhythm — Part IV; disputes shown in prose not only in metadata — Part V;
at most one earned closing flourish — Part IV; and prose that stands alone
without naming the site or its sibling chapters — Part V). That document
extends `docs/ui/story.md`'s presence+proof principle for this specific
prose format and includes a labeled illustrative sample chapter.

### 1.2 Journey beats (redlining pilot)

| Beat | Scene (person · role · place · year) | Sketch subject | Statutes inline |
|---|---|---|---|
| Q1 | Eugene Williams · teenager · 29th Street Beach · 1919 | Lake shoreline, invisible color line | Home Owners' Loan Act, National Housing Act |
| Q2 | HOLC surveyor · federal mapmaker · Chicago kitchen table · 1939 | Map unrolled with A–D grades | (maps only; gap named) |
| Q3 | Cook County household · renter seeking ownership · South Side · 1990–2024 | Multi-year ownership spine | Fair Housing Act, Community Reinvestment Act |
| Q4 | Robert S. Abbott · publisher · State Street, Bronzeville · 1919–1945 | Defender / YMCA streetscape | place entity binding |

Standalone preview: `.tmp-hero-proof/theme-preview-redlining.html` must mirror this journey (opening scene, sketch per beat, side-rail instruments, entity panel `#entity-{id}`).

---

## 2. Canvas law — theme-aware edition + shared atmosphere

Themes shares the **home mosaic atmosphere stack** via `EditionAtmosphereMosaic` and `edition-atmosphere.css`:

| Layer | Spec |
|---|---|
| Fixed grain + archive grid | `ds-edition-atmosphere-canvas::before` on route root |
| Gutter mosaic | `EditionAtmosphereMosaic` with seed `themes-edition-v6` (index) or `themes-edition-v6:{themeId}` (detail/question) |
| Surface panels | Opaque `ds-themes-edition__panel` cards; no text atop mosaic without Surface |
| Ink / Charcoal bands | **Not on themes** |
| Crumpled map / fixed-ink mast | **Banned** |

Mosaic tiles are **decorative only** in left/right gutter bands. `prefers-reduced-motion` hides live mosaic tiles. Dark theme scales mosaic opacity down.

Intro panel carries a quiet **mosaic credits** link (not interactive tile navigation).

---

## 3. Page scaffold

### 3.1 Index (`/themes`)

```
┌─ ds-themes-edition + ds-edition-atmosphere-canvas ──────────────┐
│  [ EditionAtmosphereMosaic — seed: themes-edition-v6 ]         │
│  ┌─ main (max ~84rem, centered) ─────────────────────────────┐ │
│  │  [ Beat 00 — Intro Surface: edition header + crosslink ]   │ │
│  │  [ Beat method — Juxtaposition panel ]                     │ │
│  │  [ Beat 01 — P0 catalog ledger ]                           │ │
│  │  [ Beat 02 — P1 coming soon ledger ]                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

Deep-link anchors `#p0-themes` and `#p1-themes` preserved for shell nav and bookmarks.

### 3.2 Theme detail (`/themes/[themeId]`)

```
┌─ ds-themes-edition + atmosphere canvas ─────────────────────────┐
│  [ Beat 00 — Intro: priority, title, lede ]                      │
│  [ Beat method — quiet juxtaposition + optional live source ]    │
│  [ Beat 01 — Continuous arc: prose beats + instruments aside ]   │
│  [ Instrument detail panels when era storytelling enabled ]      │
│  [ Redlining pilot consumers when themeId === redlining ]        │
│  [ Beat verify — packets secondary (provenance for hard readers) ]│
│  [ Footer — All themes ]                                         │
└─────────────────────────────────────────────────────────────────┘
```

Primary reading order: intro → method → **arc** → optional instrument detail → packets. Soft related-thread links live inside the arc footer.

### 3.3 Question (`/themes/[themeId]/questions/[questionId]`)

Intro (theme breadcrumb + question title) → optional storytelling → full packet card → footer links.

---

## 4. Rhythm tokens (align with home/history v6)

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` (`1rem` ≤48rem) | Horizontal padding of `main` |
| Card gap | `1.25rem` | Vertical stack gap between edition panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule borders, `--ds-radius-md` on panels, `--ds-radius-sm` on chips. Flat matte only.

---

## 5. Edition headers

Each numbered beat uses the shared edition header register (history/stories/about aligned):

| Part | Typography |
|---|---|
| Index numeral | Mono copper graphic — `00` … `03` |
| Kicker | Mono uppercase copper slug |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper on index (`<em>evidence</em>`) |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from body by bottom Rule hairline.

---

## 6. Catalog ledger (P0 / P1)

Reuse existing `ds-theme-impact__catalog*` hairline rows inside edition panels:

| Element | Spec |
|---|---|
| Row index | Mono numeral in first column |
| Title | Sans/display link when available |
| Chip | P0 live (copper border) or P1 coming soon (muted) |
| Lede | Editorial serif, clamped width |
| CTA | Quiet `ds-cta-link` "Open theme" when live |

No card-per-row chrome; ledger sits inside opaque Surface panel.

---

## 7. Copper discipline

| Surface | Copper allowed |
|---|---|
| Beat 00 intro | Crosslink text hover only (no second copper button) |
| Method panel | Title accent text + methodology link |
| Catalog chips | P0 live chip border/text |
| Packet cards | Method stance chip, meta dt labels, question links |

Never two copper-filled buttons in the same above-the-fold viewport.

---

## 8. Reusable patterns

| Pattern | Use on themes |
|---|---|
| `EditionAtmosphereMosaic` | All routes — required |
| `edition-atmosphere.css` | Canvas grain + grid |
| `theme-impact/*` | Packet cards, storytelling, map strip, embed (unchanged data contract) |
| `theme-impact-copy.ts` | Gap banners + empty-state copy (no em dashes in UI chrome) |
| `ThemeImpactEmptyNotice` | Safe fails for missing indicators, provenance, observations |
| `EditionFactIcon` / `RecordAnatomyPanel` | Not required on browse; reserved for future entity cross-links |
| `browse-mode` | Not on themes index (carousel semantics); entity session nav unchanged |

---

## 9. Rip list — v5 themes vs v6 themes

| Topic | v5 themes (superseded) | v6 themes (binding) |
|---|---|---|
| Hero | Flat `ds-page__*` mast in container | Beat 00 Surface intro panel |
| Method notice | Standalone bordered aside | Method Surface panel (paper-deep variant) |
| Body rhythm | Sections flush in page container | Continuous Surface card stack |
| Atmosphere | None | Shared grain + grid + gutter mosaic |
| Theme | Paper container only | Theme-aware edition throughout |

**Carried forward:** P0/P1 catalog data, `#p0-themes` / `#p1-themes` anchors, packet URL shape, juxtaposition copy intent.

---

## 10. Implementation pointers

- Routes: `apps/web/src/app/themes/**`
- CSS: `themes-edition.css`; atmosphere: `components/patterns/edition-atmosphere/`
- Mosaic: `EditionAtmosphereMosaic` with `themes-edition-v6` or `themes-edition-v6:{themeId}`
- Panel chrome: `themes-panel-chrome.ts` (class helpers + tests)
- Safe fails: `theme-impact-copy.ts`, `ThemeImpactEmptyNotice.tsx`
- Packet UI: `components/theme-impact/*` (journey visuals, arc reading, instruments aside, packets secondary)
- Soft related threads: `lib/theme-impact/theme-related-threads.ts`
- Folded-chapter prose voice: `docs/content/neo-voice.md`

---

## 11. Acceptance checklist

- [x] `/themes` renders theme-aware canvas + Surface panels — no ink/charcoal bands
- [x] Theme detail primary read is continuous journey with scene-led beats and ink-sketch visuals; packets are verify/secondary
- [x] Instruments sit beside arc prose on wide viewports; era beats without scrubber
- [x] Soft related-thread links where spines share
- [x] Gap honesty woven into arc notes (no primary missing-data wall)
- [x] Method panel cites `/methodology`; P0/P1 anchors preserved
- [x] Packet cards and provenance unchanged functionally; empty indicators/provenance show safe-fail notices
- [x] Theme-impact UI chrome (gap banners, storytelling lede, era notes) avoids em dashes
- [ ] Copper review passes: no duplicate copper CTAs per viewport fold
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px
- [ ] `prefers-reduced-motion`: mosaic hidden
- [x] v5 themes mast superseded — this file cited in PR / bead close notes
