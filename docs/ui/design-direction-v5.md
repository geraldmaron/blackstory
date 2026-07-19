# blap design direction v5 — the atlas opens to your page

## v5.1 revision — "the atlas instrument" (2026-07-18, session 3)

Owner verdict on the first v5 pass: "it all looks the same … nothing to remember … I need a
professional-grade, modern UX." This revision replaces the v5 chrome primitives wholesale.
Where anything below contradicts an earlier section of this document, **this section wins**:

- **The island.** Navigation is ONE floating ink pill (`.ds-shell-header__inner`), fixed near
  the top edge, detached from the page, identical on every surface and in both themes. There
  is no full-width header bar and no `--onmap` variant anymore — the island is a brand-fixed
  ink object like the map plate and footer. Active nav = paper pill; the single copper pill in
  the island is NEAR YOU (the product's one standing orientation action). Mobile: symbol +
  MENU in the island; the drawer is a bottom sheet rendered OUTSIDE the pill (its
  backdrop-filter creates a containing block for fixed descendants) with a tap-away scrim.
- **Pill action language.** `.ds-cta` and `.ds-button` share one pill recipe
  (`--ds-radius-full`). Radius 8/16/28 still governs boxes/sheets; actions are pills, full stop.
- **The copper tick.** Every eyebrow/kicker leads with a 1.75rem copper rule — the recurring
  orientation mark of the system (`.ds-page__eyebrow::before`).
- **Display register with a serif italic accent.** Masts scale to `clamp(2.75rem → 5rem)`
  (hero to 6.25rem); one warm word per headline may sit in Source Serif italic copper
  (`.ds-page__title em`). Copy pattern: hero morphs History → His/Her/Their/Your/Black Story
  happened *here*.; pages keep "Search the *archive*.", "Decade by *decade*."
- **The timeline instrument.** The hero's decades-in-motion is a full-width scrubbable rail of
  decade ticks (`.ds-hero-timeline`): passed decades burn copper, the live decade reads at
  display scale in mono, every tick is a 44px jump target, play/pause is a circular key.
  `/history`'s decade stepper restates the same language as document chrome (baseline rail,
  copper underline burn) — never a wrapping pile of chip buttons.
- **The plate is an artifact, not a web map.** Ocean/unmapped world sits one step below Black
  Ink (`DIGNITY_PALETTE.ocean` #080606); the landmass rests in a warm Page Sand wash
  (`densityUnknownFill`/`densityDisabledFill`), state bounds are warm sand hairlines. A bottom
  legibility scrim on the hero is a map-plate treatment, not page UI. Zoom envelope 3–10:
  national to county, never street scale (dignity + honesty — an empty street grid reads
  invasive and broken). The stock zoom control wears the island language and hides on touch
  viewports.
- **The cockpit is brand-fixed.** `/explore`'s floating instruments stamp `data-theme="dark"`
  on the stage wrapper: ink-glass panels over the plate in BOTH reader themes. Reader
  light/dark preference styles document pages only.
- **Ledger index.** Ranked listings (search results) are numbered rows: mono index numeral,
  display title, serif summary, slug meta (`.ds-index`). Rows, never cards. Facet controls are
  pill selects (`.ds-pill-select`) inline with the content — no fieldset "filter card" with an
  Apply button on primary surfaces (`/search` keeps one submit; `/history` facets apply on
  change with a no-JS GET fallback).
- **Search mast.** The query IS the headline: display-scale input over a heavy rule that turns
  copper on focus (`.ds-search-mast`).
- **Mega footer.** The footer closes with the kit lockup at landmark scale plus the columns —
  the page signs off with the brand, not a fine-print row.

### Cognitive-accessibility law (owner directive 2026-07-18: design for neurodivergent readers)

Binding on every record surface (list rows, search rows, entity page; history graph may still
use a compact off-ramp card) and every future "modeling" page. These are testable rules, not
vibes:

1. **Summary before story.** A record page opens with an "At a glance" block
   (`.ds-at-a-glance`): the whole record as labeled facts (kind, where, era, evidence,
   coverage, location precision) before any prose asks for sustained reading. A reader who
   never scrolls still leaves oriented.
2. **One record anatomy, everywhere.** List row, search row, and entity page present
   the same order: kind slug → name → one-line story → labeled facts → tags → precision →
   single action. Map pin / list activation opens the **entity page** (not a floating map
   card). `?selected=` on `/explore` only orients the copper ring when returning from
   “View on map.” Predictability is the accommodation — no surface invents its own order.
3. **Labels are literal.** Every fact carries a visible label (Era, Evidence, Confidence,
   Status) in a `dt/dd` pair. Never bare values glued together ("place1770s – 1850s" was the
   defect class), never meaning carried by position or color alone.
4. **Lists declare their order.** Any ranked or sorted listing says how it's ordered in its
   count line ("106 records · oldest first") and the order is deterministic
   (`sortFeaturesForList`: chronological, undated last, ties alphabetical).
5. **Chunk, then rule.** Long pages break into hairline-ruled sections with an automatic index
   numeral (`.ds-entity-sections` + `.ds-kicker-index`) — a visible "where am I" at every
   scroll position. Prose blocks stay short; walls of text are a defect.
6. **One action per chunk.** Each card/section carries at most one primary action; Close is a
   quiet icon key, never a pill competing with the real action.
7. **Controls apply themselves.** Facets are labeled pill selects that apply on change —
   no "Apply" memory burden, no hidden state between choosing and seeing. (No-JS fallbacks
   live in `<noscript>` GET forms where the surface supports no-JS at all.)
8. **Motion is opt-out and legible.** Anything that animates on its own has a visible pause
   key (hero timeline); reduced-motion collapses everything to cuts. Nothing meaningful is
   hover-only.
9. **Caps are slugs, not sentences.** All-caps is confined to short mono/sans slugs; body
   meaning never sets in caps (harder to read for many readers).

### Decades-in-motion is a modeling-library primitive, not a page-local hack

Owner directive 2026-07-18: "consider the population movement/growth stuff as part of the
broader modeling library... this must be a part of the modeling patterns... we should use
existing packages etc where possible." Per-decade state presence (the hero timeline's density
fills) is promoted into `packages/domain/src/map/decade-presence.ts` (`aggregateDecadePresence`)
— entities' own `eraBuckets`/active-span membership drives ACTIVE presence per decade (an
institution that closed in the 1920s stops counting toward density once it's inactive), while
pins stay CUMULATIVE (arrival never reverses). This reuses the same active-decade-bucket
derivation (`graph/decades.ts`'s `deriveActiveDecadeBuckets`) the history graph's own per-decade
node/edge views already depend on — one derivation path, two consumers.

The client-safe half of that module (`decade-presence.ts` itself) is deliberately import-free —
`apps/web`'s `decade-flow.ts` is transitively loaded by a `'use client'` component (`HeroStage.tsx`),
and the top-level `@repo/domain` barrel pulls in server-only modules a browser bundle can't
resolve. The raw-active-span convenience wrapper (`buildDecadePresenceAggregates`) lives in a
sibling `decade-presence-from-spans.ts` file instead, for server-side callers only.

Status: canonical UX/UI pattern reference. Supersedes design-direction-v4 §§2.5, 6, 7 (layout,
surface inventory, pattern law) and every layout decision that shipped under . Carries
forward unchanged and still binding from v4: §2 experience principles 0–4, §2b the human bar,
§3 theming contract, §4 responsive + mobile contract, §5 map architecture (persistent canvas,
camera grammar, dignity rules), §8 motion grammar. Owner directives folded in: 2026-07-18
session 2 — "complete rip; modern, clean, not bulky; map first-class; engaging; intuitive;
connect people with data; teach them about things close to them; their state and their state's
history with Black history."

## 1. Mission frame (drives every layout decision)

The site connects a reader to documented Black history **where they are**. The experience spine:

1. **Arrive** — the live national map is the first thing seen, immediately legible, never a void.
2. **Orient** — the reader is invited to make it personal: their state, their place. Location is
   an *invitation* (opt-in, one tap, honest about precision), never a demand. A state picker
   works with zero permissions.
3. **Discover** — records surface as stories (name, place, era, one-line story), reachable from
   map, search, and browse paths.
4. **Learn** — the record page teaches: narrative, evidence, confidence, related records.
5. **Trust** — methodology, corrections, errata always one step away, never shouting.

Anything on a surface that doesn't serve one of these five beats is chrome, and chrome loses.

## 2. Layout language — quiet chrome, typography-led

The v4-era shell read as boxes-on-boxes: slab hero panel, bordered pills, boxed card grids,
mono-caps everywhere. v5 removes the boxes:

- **Text sits on surfaces, not in slabs.** The hero is typography directly over the ink
  basemap (paper-on-ink is 17:1). No panel plate, no scrim block unless a photo demands it.
- **Hairlines carry structure.** Sections separate with 1px Rule lines and tone shifts.
  Full-box cards are reserved for genuinely discrete objects (a record photo, a form, a
  dialog); lists and rails use top-rule entries, not boxes.
- **One accent moment per view.** Copper stays a navigational signal (10–15%): the primary
  action, the active nav item, the selected pin, the kicker slug. Never two copper CTAs
  in one composition.
- **Density without weight.** Compact spacing rhythm (see §4) — generous around display type,
  economical inside chrome. No control taller than it needs to be; touch targets stay ≥44px
  via padding, not bulk.

## 3. Typography law (brand pack p.2, tightened usage)

| Register | Family | Where — and nowhere else |
|---|---|---|
| Display | Sora SemiBold | H1/H2/H3, hero headline, footer core line |
| UI | Inter 400–600 | Nav, buttons, labels, body copy, form controls |
| Editorial | Source Serif 4 | Ledes, record narrative, longform sections, standards prose |
| Data | IBM Plex Mono | Kickers/slugs (KIND / STATE), counts, dates, coordinates, IDs, citations, receipt codes |

- **Caps live in two places only:** mono data slugs (kickers, KIND/STATE metadata) and
  sans nav/CTA labels (guide p.4 reference: sans caps with 0.08em tracking). Everything else is
  sentence case. The v4 habit of mono-caps buttons is retired — mono is data, not chrome.
- **Fluid scale** (anchors from guide p.8, fluid between 375 and 1280):
  display `clamp(2.75rem → 4.5rem)`, H1 `clamp(2.25rem → 3.5rem)`, H2 `clamp(1.5rem → 2rem)`,
  H3 `1.25rem`, body 1rem/1.6, small 0.875rem, caption 0.75rem mono.
- Ledes and record summaries are **serif** — the archive speaks in an editorial voice; UI
  speaks in Inter around it.

## 4. Color law (brand pack p.2 palette, bound to tokens)

Black and paper lead. Copper points. Sand fills. Rust stays in the artwork.

| Brand color | Hex | Token | Allowed use — and nothing else |
|---|---|---|---|
| Black Ink | `#0A0A0A` | `--ds-ink` (light) / `--ds-canvas` (dark) / `--ds-fixed-ink` | Primary text on light; dark canvas; fixed surfaces (map plate, footer, bands) |
| Archive Paper | `#F4EFE5` | `--ds-canvas` (light) / `--ds-ink` (dark) / `--ds-fixed-paper` | Light canvas; text on ink |
| Surface | `#FBF8F2` | `--ds-surface(-raised)` | Raised light surfaces (cards, sheets, inputs) |
| Copper Pin | `#B86B2A` | `--ds-accent-graphic` | **Graphic** accent only: the primary CTA plate, selected pins, active-state fills. Never body-size text on light |
| Copper text | `#8E4F2A` light / `#D07A32` dark | `--ds-accent` | Copper as *text or underline*: kickers, active nav, links-as-orientation. The pair flips with theme so AA always holds |
| Page Sand | `#D8A178` | `--ds-accent-muted` | Decorative fill: map density tiers, sand-shade entity encodings, page-band motifs. Never foreground text |
| Page Rust | `#D84E2B` | *(no UI token — deliberate)* | Brand artwork only (the mark's page bands). Never a UI signal: it reads as red, which collides with error semantics and the dignity rule against violence-coded color |
| Soft Stone / Warm Gray | `#CFC7B8` / `#6E6961` | `--ds-ink-muted`, `--ds-ink-subtle`, `--ds-fixed-stone`, `--ds-rule`/`--ds-border` | Secondary text, hairlines, muted chrome |

- **Copper discipline is a review gate** (unchanged from the guide): copper occupies roughly
  10–15% of any composition, reserved for the moment of orientation — one primary action,
  the active nav item, selected/focused map state, kicker slugs. Copper as wash, border
  decoration, or default link color is a defect.
- **The accent trio is a hierarchy:** `--ds-accent` (text-safe copper) for type and
  underlines; `--ds-accent-graphic` (raw Copper Pin) for fills that carry ink-colored text;
  `--ds-accent-muted` (Page Sand) for area fills that carry no text. Picking the wrong tier
  is the most common contrast bug — raw copper never carries body text on light.
- **Status families stay semantic, never brand:** warning/dispute/error and the
  confidence high/medium/low sets (`--ds-warning-*`, `--ds-dispute-*`, `--ds-error-*`,
  `--ds-confidence-*`) are the only non-palette hues on any surface, always paired with a
  text label or glyph — color is never the only signal. They are contrast-tested per theme
  in `packages/ui/src/tokens/contrast.test.ts`.
- **Map color language** (carried from v4/): ink plate always; entity kinds encode in
  copper/sand shades + non-color glyphs; density is presence-tiered copper RGBA (12/28/50%),
  never incident-heat; state hairlines in fixed-rule; selected state label flips to
  copper-dark. No new map colors without a bead.
- **Data-viz** uses `--ds-viz-1..4` + `--ds-viz-grid` (ink, copper, stone, sand per theme) —
  charts never introduce hues outside the palette + status families.

## 5. Chrome specs

**Header** — one slim bar, 3.5rem, canvas at 94% + blur, bottom hairline. Lockup at brand
minimum (168px; compact mark <30rem). Nav: Inter 600 caps 0.75rem, 0.08em tracking; active
route = 2px copper underline; five primary + More disclosure. Theme toggle is a 44px
icon-only button (sun/moon glyph, `aria-pressed`, accessible name) — never a labeled pill.
On map surfaces the bar reads fixed-ink at 78% + blur. Mobile (<48rem): compact mark +
Menu button; nav is a bottom sheet with 44px rows and safe-area padding.

**Footer** — always ink. Compact: mark + core line row, three link columns (stacking),
meta line. Padding `space-10`, not `space-12`+.

**Page mast** — every document page: mono copper kicker, Sora title, serif lede (max 65ch).
Below it, content sections separated by hairlines (`ds-section`), each with optional
mono kicker + Sora section title.

**Actions** — one vocabulary, three weights, all `≥44px` target, radius-sm, Inter 600 caps
0.75rem/0.08em:
- `copper` — THE primary action of the view (max one per composition);
- `solid` — ink-on-paper (inverts per theme, fixed-paper inside ink bands);
- `quiet` — hairline border, transparent fill.
`.ds-cta` (links) and `.ds-button` (form buttons) share this exact recipe — same classes
modifier names, one definition site each, zero visual divergence.

## 6. Surface layouts (the rip, surface by surface)

**`/` home** — five beats, in order:
1. *Hero (Arrive):* full-viewport persistent map. Chrome: bottom-left typography directly on
   the basemap — mono copper kicker, Sora display headline, one serif support line. Actions:
   copper "Find what happened near you" (→ `/locate`), quiet "Explore the map" (engage →
   `/explore`). Mono count line ("104 records · 24 states"). No panel slab, no scrim box.
   Height `100svh` desktop, `88svh` mobile so the next beat peeks above the fold.
   *Decades in motion:* the hero map is ambient, not static — the archive fills in decade by
   decade (~3.6s dwell, looping): pins accumulate as their earliest documented decade
   arrives, state fills deepen through the presence tiers, and that decade's relationship
   lines trace movement between places; a bottom-right mono readout names the decade and the
   documented-record count, with a pause/play control. This is what makes home cinematic
   where `/explore` is instrumental. HONESTY RULE: intensity is driven by documented records
   (`decade-flow.ts`) and labeled as such — Black population share by decade (census bead
   black-book-vxz) rides this same density channel only when its ingestion lands; no
   population claim renders before the data is real. Reduced motion starts paused on the
   complete archive; play stays available as a deliberate choice.
2. *About (Thesis):* first paper section. Product line ("History, pinned to place"), three
   hairline pillars (presence / evidence / dignity), CTAs to Explore + `/about` + methodology.
   Quiet state `<select>` + coverage chips + `/locate` remain as a secondary place path under
   the thesis — not the lead headline.
3. *From the data:* archive mono strip (records / states / era) plus national census
   visualizations reused from `/data` (population by decade + share line + decade Δ strip)
   with citations and a hand-off to the full modeling page. Hate-crime charts stay on `/data`
   only (dignity).
4. *From the archive (Discover):* story rail — top-rule entries, mono KIND / STATE slug, Sora
   record name, serif one-line story. 3-up desktop, stacked mobile.
5. *How this works (Trust):* single ink band (fixed charcoal, full-bleed, no radius): three
   numbered points (what qualifies, how confidence works, what stays off the map) in serif +
   one solid CTA to `/methodology`. Replaces v4's two separate standards/transparency sections.

**`/explore`** — instruments, not furniture. Filters: one compact top-left instrument, mono
label + native selects, collapsed by default on mobile into a bottom sheet. Results: slim
right rail (hairline rows, no box-per-result), full-height on desktop, bottom sheet on
mobile. Legend: one-line strip bottom-left, disclosure for detail. Panel widths stay compact
(19/21/20rem); panel fills at 92% + blur; radius-md; nothing overlaps the map's center third.

**`/entity/[id]`** — editorial mast: media plane (rights-cleared photo or kind-derived record mark)
beside/above mono KIND · PLACE · framing slug, Sora name, and serif summary; slim at-a-glance
(non-mast labeled facts); then 2-column desktop layout: narrative/evidence main column (serif),
slim data aside (map, precision, maturity, revision — media lives in the mast). Sections
hairline-ruled with automatic index numerals. Connected records are one room (1-hop + optional
2-hop).

**`/stories/[slug]`** — atmosphere mast: rights-cleared B&W collage mosaic (deterministic per
slug via `selectAtmospherePlane`; tiles from `/brand/collage/tiles/`) over a flat geometric SVG
fallback when tiles fail, Save-Data, or reduced motion. The mosaic is symbolic atmosphere — not
a portrait of the story subject. Attribution at `/stories/mosaic-credits`. Editorial serif body
(`--ds-content-max`); copper **View on map** CTA when geo is available (one primary action per
view).

**`/search`, `/legal`** — document rhythm: mast, filter row (native controls,
compact), result list as top-rule entries with mono meta lines. Pagination quiet buttons.

**`/history`** — mast + decade scrubber + adaptive relationship graph that shares
  explore’s kind shade+glyph vocabulary: kind hubs at catalog scale, ego-neighborhood
  when a record is selected, sparse record graph only after filters shrink the set.
  Synchronized list peer, overview strip (counts, kind composition with the same
  shades, decade density), and richer facets (kind chips, status, topic, connections).
  Same instrument language as explore.

**Longform (`/methodology`, `/legal/[slug]`)** — single serif
column (`--ds-content-max`), numbered Sora subheads, mono citations. No cards.

**`/about`** — full-bleed living mosaic mast (thesis + copper CTA over archive collage), then
presence/evidence/dignity pillars, three numbered editorial beats, one ink publish-bar band, and
destination rows. Tiles swap softly and open `/entity/[id]` when selected. Attribution at
`/stories/mosaic-credits`. Not a documentation longform column.

**Forms (`/submit`, `/corrections`)** — single column, native controls at 44px, labels in
Inter 600 0.8125rem sentence case (not mono caps), serif intro, one copper submit per form.
Errors: field-level, `aria-describedby`, focus moves to the first error summary.

**States of absence** — empty/loading/error states speak in the product voice (suggest, never
scold) and always offer the three paths: map, search, browse.

## 7. Pattern law (reuse, never re-invent)

Primitives live in `@repo/ui` + `shell.css`; a new surface composes these. A new pattern
requires updating every prior use of the pattern it replaces — no parallel vocabularies.

- `ds-cta` / `ds-button` — action vocabulary (§5). Modifiers: `--copper`, `--solid`, `--quiet`
  (aliases kept this cycle: `--ink`, `--ghost`, `--primary`, `--secondary` map onto the three).
- `ds-page` + `ds-page__eyebrow/title/lede` — document mast.
- `ds-section` + `__kicker/__title/__lede` — hairline-ruled section.
- `ds-story-link` — top-rule story entry (rails, related lists, results share its anatomy).
- `ds-data-strip` — mono numbers row.
- `ds-band` — fixed-ink full-bleed band (one per page max).
- `ds-card` — boxed object (photo, form region, aside module only).
- `AtmospherePlane` + `selectAtmospherePlane` — story mast media plane (`mode: mosaic` default,
  `geometric` fallback); tiles from `tile-credits.ts`. Entity pages use `EntityRecordMark`
  instead — never collage mosaics on `/entity/[id]`.
- `LivingAtmosphereMosaic` + `AboutMosaicMast` — about-page full-bleed living collage mast
  (opacity tile swaps; entity click-through; static under reduced-motion / Save-Data).
- `Notice` — the only honest-state surface; never toasts.
- Tokens only; no raw hex, no shadows, no gradients; hairlines carry separation.

Anti-patterns (defects on sight): slab panels over the map; mono-caps chrome outside data
slugs; two copper actions in one view; boxed grids of prose; labeled theme pills; any control
whose tap target is under 44px; color-only signals; raw `<a>` internal nav.

## 8. Accessibility floor (verified per surface, both themes, 375/768/1280)

- Skip link first in DOM, visible on focus. Landmarks: banner/nav/main/contentinfo.
- One `h1` per page; heading order never skips.
- All text/control pairs AA in both themes (token pairs are contrast-tested; hero text sits
  on fixed-ink → paper/stone/copper-dark pairs only).
- Keyboard: every interactive element reachable and operable; the map canvas stays
  `aria-hidden` with the synchronized list as parity surface; focus lands sensibly after
  route changes (existing hero→explore handoff kept).
- `prefers-reduced-motion` collapses all motion including camera flights (unchanged).
- Forms: labels always visible; errors announced; iOS zoom guarded (≥16px inputs).

## 9. What explicitly survives from v4

Persistent map canvas + camera grammar (ADR-017), dignity rules, theming contract
(`--ds-fixed-*` surfaces), motion tokens (160/280ms, one easing), URL-carried state, the
`ds-` token set, and the brand palette/type/radii. The rip is layout, chrome, and pattern
vocabulary — not the architecture and not the brand foundation.

## 10. Logo (2026-07-18 kit supersession)

The binding logo source is the root `brand/` kit: a **standalone book-and-pin symbol (not a
B)** beside a **lowercase `blap` wordmark**, used exactly as provided (light/dark transparent
lockups + symbol-only variants + app icons; PNG artwork). The v3-era "the symbol is the first
B / never type the second B" rules are retired — see the supersession note atop
`docs/ui/brand.md`. Header uses the lockup (symbol-only below 30rem); footer uses the dark
symbol; app icons serve as browser/apple icons until proper favicon renders are produced from
the kit.
