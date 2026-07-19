# blap design direction v4 — the whole experience

Status: canonical UX/UI pattern reference (supersedes design-direction-v3, which code comments
cite but which never landed as a file). Every redesign bead cites sections of this document.
Owner directives folded in: 2026-07-17 redesign brief, 2026-07-18 rebrand-to-blap + "one
experience, not page refreshes" + "map is first class" + street-level/address-search brief.

## 1. Brand foundation (from brand-pack/, binding)

- **Name**: blap. The custom book-form B is the first letter of the wordmark — never typed
  beside it (`apps/web/public/brand/blap-primary-*.svg` carries the approved lockup; the
  compact mark alone at small sizes). Never recreate the B with a font; never separate emblem
  from wordmark; never recolor the pin; page-band colors stay in order; no shadows or
  gradients on the mark; clear space = pin width; minimum sizes 120/48/32 px per kit p.3.
- **Palette**: Black Ink `#0A0A0A`, Archive Paper `#F4EFE5`, Copper Pin `#B86B2A`, Page Sand
  `#D8A178`, Page Rust `#D84E2B`; neutrals Soft Stone `#CFC7B8`, Warm Gray `#6E6961`. All
  usage through tokens (`--ds-*`), never raw hex in app code.
- **Copper discipline**: copper is orientation — primary actions, active nav, selected/open
  states, kickers — at roughly 10–15% presence. It is never a wash, never body text on raw
  copper without the accessible-pairs table.
- **Type**: Sora SemiBold headlines (56/32/20 scale), Inter UI/body (16/14), Source Serif 4
  longform/editorial, IBM Plex Mono data/citations/metadata registers (12/16). Fluid type
  carries the scale between breakpoints.
- **Shape**: radius 8/16/28; hairline rules carry ALL separation; no box shadows anywhere.
- **Voice** (kit + constitution): core line "History, pinned to place."; support "People.
  Places. Evidence. Context." Specific over sweeping; evidence before assertion; pride
  without spectacle; invite, don't lecture.

## 2. Experience principles

0. **Nothing incumbent is protected.** Owner directive 2026-07-18: we are not beholden to
   anything already in place — layouts, the basemap ceiling, chrome, copy. When an existing
   element blocks a principle below, rip it. (Reuse of PATTERNS — §7 — still governs how the
   replacement is built.)
1. **One continuous experience.** Navigations are movements through one archive, never page
   reloads: internal navigation is exclusively `next/link` (raw `<a>` only for external
   hrefs), the shell (header/footer) persists, the map canvas persists across `/` ↔
   `/explore` (ADR-017), and page content arrives with the token-driven
   `ds-surface-arrive` rise. Anything that visibly remounts the shell is a defect.
2. **The story is the spine.** Every surface answers "what happened here?" before it answers
   anything else. Home: hero map → "See what happened here" rail → standards → transparency
   hand-off. Entity: name/place/era → narrative → evidence → related. History: movement
   through decades. Never dashboards-first, never chrome-first.
3. **Evidence before assertion.** Claims carry citations and confidence registers (never
   color-only); disputes stay visible; released projections only.
4. **Dignity rules** (BB-051, non-negotiable): no trauma-forward or sensational framing; no
   crime-heat rendering; street-level residence precision stays off the public surface;
   living-person redaction; population presence framed as presence, never deficit.
5. **Clean and compact.** The canvas or the content dominates; chrome is an instrument.
   Floating panels stay within the compact widths set 2026-07-18 (filters 19rem, results
   21rem, legend 20rem); summaries clamp; full text lives on the record.

## 2b. The human bar (owner directive 2026-07-18 — binding on every bead)

Surfaces must feel human, not generated. Every bead that touches a surface is judged against
these, not only its own acceptance list:

- **Finding**: every record is reachable by at least three honest paths — the map, search,
  and a browse/story path (topics, related records, story rails, "nearby"). Dead ends are
  defects: an empty result, an unlinked mention, a filter that strands the reader.
- **Transitions**: movement carries context — camera flights continue across navigation,
  focus lands somewhere sensible after a route change, back always returns to where the
  reader actually was (scroll, filters, viewport), and nothing flashes or reflows on arrival.
- **Nuance & nice-to-haves**: hover/press states that reward attention; empty and loading
  states written in the product voice (an empty search suggests, never scolds); microcopy
  that sounds like a careful archivist, not a system; small moments of discovery (a related
  record surfacing, a decade scrubbed, a "nearby" reveal) planned deliberately, not left to
  chance.
- **Smoothness**: no jank — prefetched routes, optimistic UI where safe, animations on
  compositor properties only, interactions responsive under 100ms perceived.
- **Ease**: the payoff action of any surface is one tap/click away (visit hand-off on a
  record, a pin from a search, directions from a card); shareable state everywhere the URL
  can carry it; forgiving inputs (typos, partial addresses, case).

When a bead's Deliver list conflicts with this bar, the bar wins or the conflict is
escalated to the owner — never silently shipped.

## 3. Theming contract — dark AND light, first-class everywhere

- Every route renders correctly in both `[data-theme="light"]` (Archive Paper canvas) and
  `[data-theme="dark"]` (Black Ink canvas). Theme is user-controlled (ThemeToggle), no
  hydration flash, `prefers-color-scheme` respected as the default.
- **Theme-invariant surfaces** (deliberate exceptions, `--ds-fixed-*` tokens): the map canvas
  plate (always ink — an archival map insert doesn't recolor with the page), the site footer
  (always ink), the on-map header treatment. Everything else derives from theme tokens.
- AA contrast holds in BOTH themes on every text/control pairing; the BB-101 gate verifies
  both-theme screenshots per surface. Copper on ink uses the light-copper dark variant
  (`--ds-accent` flips value by theme); body text never sits on raw copper.

## 4. Responsive + mobile-ready contract

- Verification floor at **375 / 768 / 1280** on every surface; no horizontal page scroll
  ever; wide content (tables, code, diagrams) scrolls inside its own container.
- Touch targets ≥ 44px; map tap targets meet the same bar on mobile.
- Map surfaces on mobile: floating panels consolidate into bottom sheets (w72 scope) —
  filters and results reachable one-handed; the canvas never shrinks into a card.
- Nav: ≥48rem gets the full header nav + More disclosure; below it, the drawer. Footer
  columns stack.
- **Mobile app readiness** (iOS/Android later): the portable contract is (a) the token set
  (`packages/ui/src/styles/tokens.css` + brand-pack JSON) as the single source for a native
  token pipeline, (b) the read-only public projections API as the data contract, (c)
  MapLibre (GL JS ↔ Native) as the shared map stack, (d) this document's surface inventory
  as the screen map. Nothing web-only leaks into domain logic.

## 5. Map, first class — people will USE this to go there

The map's first job is no longer illustration: readers will find a record and then physically
visit the place — a marker on a Montgomery corner, a church in Tulsa, a campus in Nashville.
Design for the person planning the trip at a desk AND the person standing on the sidewalk
holding a phone. Nothing currently in place is protected: the boundaries-only archive plate,
the z12 ceiling, and any assumption that the map is a closed diorama get ripped where they
block the visiting job.

- **Architecture** (keeps earning its place): one persistent MapLibre canvas owned by the
  `(map)` route-group layout (ADR-017); pages are surface controllers via `useMapStage()`;
  camera moves only through named presets; reduced-motion collapses flights to cuts.
- **Full basemap, street level down** (rips the current plate): a real self-hostable vector
  basemap (Protomaps PMTiles or OpenFreeMap — free-first, no per-tile vendor fees) restyled
  into the archive treatment, national frame to **street level (z18)**: muted street
  casings and names, city/neighborhood place labels, transit/civic anchors; commercial POI
  noise suppressed. The archive look survives as a STYLE on real geography, not a ceiling on
  it. Cities label at locality zooms; streets and building footprints appear where a visitor
  needs them to orient on foot.
- **Visual language**: kind-encoded entity circles (copper/sand shades + non-color glyph
  signatures), county-proportionate zoom sizing, slight transparency; state-over-county
  hairline boundary system; clusters decompose within two interactions; density layer is
  presence-tiered, never incident-heat.
- **Address + place search**: one search input accepts records, addresses, and place names
  (census-geo adapter first, free; extend provider only if quality demands); results fly the
  camera via presets. On mobile this is the primary entry into the map.
- **Visit hand-off** (core flow, not garnish): every entity surface (page, narrative card,
  explore selection) offers "Open in Maps" / "Get directions" via `geo:` URI with
  Apple/Google web fallbacks — ALWAYS at the record's public precision, never finer;
  redacted records hand off at their locality/county centroid with honest labeling. Where a
  record is a visitable institution (museum, church, campus, marker), the record carries its
  visitable status: standing / rebuilt / demolished / marker-only — a visitor must never
  navigate to an empty lot expecting a building without the record saying so.
- **On-site mode is mobile reality**: locality/street zooms, 44px+ targets, bottom sheets,
  one-handed reach, glare-legible contrast in both themes.
- **Data layers**: county-decade Black population choropleth (census bead) rides the density
  layer with a decade control tied to the era filter; History edges render movement between
  places; both respect the dignity framing rules.

## 6. Surface inventory (every visible surface; all follow §2–§5)

| Surface | Purpose / story beat | Layout notes | Mobile notes |
|---|---|---|---|
| Shell header | Orientation + identity | blap lockup (compact mark <48rem), 5 primary + More, active copper underline, on-map ink treatment | drawer nav, 44px targets |
| Shell footer | Grounding + trust nav | Always-ink band, mark, 3 mono-caps columns | columns stack |
| `/` home | The thesis: history pinned to place | Hero IS the live map + panel chrome; story rail; standards; transparency band | hero panel full-width; rail cards stack |
| `/explore` | The archive, navigable | Persistent canvas + compact floating instruments (filters/results/legend) | bottom sheets (w72) |
| `/search` | Direct retrieval | Document rhythm, filter bar, result list (roomier than explore panel); gains address/place search | single column |
| `/entity/[id]` | One record, fully evidenced — and visitable | Name/kind/place/era → summary → claims+citations → timeline → related → visit block (map hand-off, directions, visitable status: standing/rebuilt/demolished/marker-only) | sections stack; visit block stays above the fold on mobile |
| `/history` | Movement through time | Decade graph views, edge panels, era scrubber | edge panel becomes sheet |
| `/stories`, `/stories/[slug]` | History articles | Longform narratives → entity off-ramps | 2-col → 1-col |
| `/methodology` | Trust: how records qualify | Longform serif, numbered sections, confidence-language explainer | — |
| `/errata`, `/corrections` | Visible fallibility | Dated entries, hairline separation | — |
| `/submit` | Community intake | Guided form on shell rhythm, moderation framing, App Check | full-width fields |
| `/about` | Who/why | Longform serif + voice lines | — |
| `/legal` | Plain-language law | Serif longform + mono citations | — |
| `/design-system` | Internal reference | Token/primitive gallery — stays current with this doc | — |
| Notices (seed/offline/degraded) | Honest state | `Notice` primitive only, never toasts | — |

## 7. Pattern law (reuse, never re-invent)

- Primitives live in `@repo/ui` (`ds-` prefix): Button, Card, Notice, FilterBar, Citation,
  confidence chips, timeline, result list, story link, section/kicker/band, CTA variants,
  count-label/subheading/dt utilities. A new surface composes these; a new pattern requires
  a bead with a "no existing pattern serves this" justification.
- Tokens only — no raw hex, no raw px durations, no ad-hoc font stacks. Copper via
  `--ds-accent(-graphic)`, fixed surfaces via `--ds-fixed-*`.
- Anti-patterns (defects on sight): box shadows; color-only signals; raw `<a>` for internal
  nav; per-page map instances; layout-thrashing transitions; unclamped panel prose;
  numeric scores in public payloads (see `public-numeric-policy.ts` for the exhaustive
  carve-outs); trauma-forward imagery; fake/placeholder data presented as real; new CSS
  patterns duplicating an existing primitive.

## 8. Motion grammar

Two durations (`--ds-duration-fast` 160ms, `--ds-duration-base` 280ms), one easing, opacity/
transform only. Route arrival = `ds-surface-arrive`; hero dissolve + camera flight per
ADR-017; hover states fade borders/backgrounds. `prefers-reduced-motion` collapses
everything to instant cuts — including map camera flights (jumpTo).
