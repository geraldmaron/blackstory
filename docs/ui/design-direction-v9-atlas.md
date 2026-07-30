# BlackStory design direction v9 — Atlas edition

**Status:** proposed (2026-07-30). Binding once owner-approved and this line is changed to `binding`.
**Source mockup:** [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) — runnable, MapLibre-backed, owner-reviewed.
**Supersedes on approval:** `design-direction-v6-home.md` (all), `design-direction-v6-explore.md` (all), `design-direction-v6-search.md` (already a redirect stub).
**Unchanged and still binding:** [`brand.md`](./brand.md) tokens, palette, type, dignity law; [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md); [`patterns-map-canvas.md`](./patterns-map-canvas.md); ADR-017 map handoff; WCAG AA floor.

---

## 0. Why v9 exists

v6 split the product into a **brochure** (`/`, five numbered beats) and a **cockpit** (`/explore`, collapsed panels over a dark map). Reading the shipped implementation against the docs produced this list:

| # | Finding | Evidence |
|---|---|---|
| 1 | Home tells you the good part is elsewhere | Beat 05 copy ships as *"The timeline is paused here; open the atlas to move it."* |
| 2 | Every surface is the same card | Shell, hero, five beats, footer all render `--ds-surface` + 1px rule + radius-md at `1.25rem` gaps. No weight hierarchy. |
| 3 | Explore's empty state is a wall | `/explore` first paint shows a black map, two mono chips (`FILTERS`, `COLOR KEY`, `RECORDS`) and zero records. |
| 4 | Nav lost a fight with the sitemap | 6 top-level items, one of which is `MORE`, hiding 9 more destinations (Data, Law, Banned books, Memorial, Methodology, Corrections, Errata, Submit, Admin login). |
| 5 | No search in the chrome at all | `/search` 302s to `/history`. The shell has no search affordance on any route. |
| 6 | 4,078 records are browsed one at a time | Home beat 02 carousel renders a live position indicator reading `3971 / 4078`. |
| 7 | `/history` ships every record as a link | 4,078 `a[href^="/entity/"]` nodes in one document. |
| 8 | Motion is banned rather than budgeted | `brand.md` §Shape bans "ornamental motion"; v6 explore §4.4 mandates decade patches "**snap** (no 1.6s dual-buffer morph)". The result is a static instrument in 2026. |
| 9 | Copper is a quota, not a system | v6 home §8 sets a "copper budget" of one filled button per fold. Produces a monochrome page where nothing carries priority. |
| 10 | Four type families inside one card | Entity page renders mono kicker + Sora title + serif body + mono chips + mono fact labels in a single panel. |
| 11 | The map does not read as a map | Dark plate ships `--map-land` and `--map-water` ~12 points apart in luminance; coastlines and state lines disappear at continental zoom. |
| 12 | Nothing is savable, citable or shareable | No collect, cite, export or deep-link affordance exists in any chrome. |

v9 keeps the archive's voice and every dignity rule. It changes the **shape of the product**: from a page you read to an **instrument you hold**.

---

## 1. Intent

**The map is the product. Everything else floats over it.**

Design goals, in priority order:

1. **Land in the tool.** No throat-clearing. First paint is a live map with records already on it.
2. **Search-first, not nav-first.** `⌘K` is the primary affordance. Navigation is a consequence of search, not a menu.
3. **Motion that explains.** Camera moves are how the archive *argues*. Static is the exception, reserved for dignity-sensitive content.
4. **Evidence stays legible.** Kind / Where / Era / Evidence anatomy, confidence grades, precision honesty — all carried forward unchanged.
5. **Quality of life is not optional.** Save, cite, share, export, keyboard, density, motion preference all ship in v1.

Anything that does not serve one of these is chrome. Chrome loses.

---

## 2. Canvas law

One canvas, two modes, no page-to-page reload of the map plate.

| Layer | z | Rule |
|---|---|---|
| Map plate | 0 | Fixed full-viewport MapLibre. Single mount, persists across mode changes (ADR-017). |
| Annotation overlay | 5 | SVG, `pointer-events: none`. Migration arcs, leader lines, callouts. Reprojected on `move`. |
| Spotlight | 6 | Radial CSS mask over a canvas-coloured plate. Dims everything outside the focus radius. |
| Grain | 7 | Archive texture, `mix-blend-mode: overlay`, opacity ≤ .3. Carried from v6 atmosphere. |
| Instruments | 20 | Opaque `--ds-surface` panels. Lens, Results, Time, Camera, Dock. |
| Record sheet | 40 | Right-anchored slab, radius-lg, 3px copper left rule. |
| Command bar | 50 | Fixed top. Brand, `⌘K` trigger, mode switch, tools. |
| Palette / overlays | 90 | Command palette, shortcuts, collections. |
| Toasts | 95 | Bottom centre, above the Time panel. |

**Theme:** follows reader `data-theme`. Both light (Archive Paper) and dark (Black Ink) are first-class. No forced-dark cockpit — that v5 rule stays dead.

**Banned, carried from brand.md:** gradients as decoration, glows, bevels, 3D chrome, `backdrop-filter` blur on instrument panels, sepia, alarm hues, crime-heat rendering.

**Newly permitted, and why:** one soft tinted shadow (`--shadow-2`) on panels that float *over the map*. v6's flat-only rule was written for panels on a paper canvas. Five opaque panels floating over a live basemap with no elevation cue read as debris. Shadow is used for z-order only, never for decoration, and is invisible on paper-on-paper surfaces.

---

## 3. Map plate legibility (blocking defect)

The current dark plate is not readable as a map. v9 sets minimum separation between adjacent map roles.

| Role | Light | Dark | Rule |
|---|---|---|---|
| `--ds-map-land` | `#f6f2e9` | `#38332b` | Base. |
| `--ds-map-water` | `#c7bdaa` | `#0a0a0c` | ≥ 18 ΔL\* from land at both themes. |
| `--ds-map-green` | `#ebe5d1` | `#3e3728` | Parks/wood, subtle. |
| `--ds-map-line` (state) | `#bdb19a` | `#665e4f` | State boundary. Dashed `[3,2]`. |
| `--ds-map-line-2` (country) | `#a2957c` | `#776c5a` | Country boundary. Solid, heavier. |
| `--ds-map-road` | `#e6dcc6` | `#474034` | Motorway/trunk/primary, `minzoom: 6`. |
| `--ds-map-label` | `#6d675f` | `#9e9587` | State labels, uppercase, `letter-spacing: .16`. |
| `--ds-map-label-hi` | `#2e2a24` | `#ded7c9` | City/town labels. |
| `--ds-map-halo` | `#f8f5ee` | `#16130f` | Label halo, `width: 1.2–1.4`. |

**Metric:** separation is **CIE L\*** (0–100, perceptually uniform), not WCAG relative luminance. Y is compressed near black — on a dark plate two visibly different colors sit a fraction of a Y point apart, so a Y-based threshold is unreachable by construction. Text contrast (`label-hi` on `land`) still uses the WCAG ratio, which is what WCAG defines.

**Contract test:** `packages/ui/src/tokens/map-contrast.test.ts` asserts, in both themes, ΔL\* ≥ 18 land/water, ≥ 18 land/line, ≥ 24 land/line-2, ≥ 40 label/land, and ≥ 4.5:1 contrast for label-hi on land. See WP-02.

> **Amended 2026-07-30 (owner-approved).** The values first published in this table failed their own contract: dark land/water was 9.14 ΔL\* and dark land/line 15.03, both short of 18; light land/water was 13.61. Dark was not fixable by darkening water — water was already near-black, and even pure `#000000` reaches only 11.92 against the original land — so **`--ds-map-land` was lightened** in dark theme and `green`, `line`, `line-2`, `road` and `label` were moved to keep their relationships to it. Light theme changed one value (`water`). The page canvas (`--ds-canvas`, `#0a0a0a`) is untouched: only the landmass lightened. Prefix is `--ds-map-*`, matching the `--ds-*` rule for every other token in `tokens.css`.

**Label field expression:** always
```js
['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]
```
OpenMapTiles ships localised name fields inconsistently across planet releases; pinning `name:en` silently drops roughly half the labels.

---

## 4. Camera console — the cinematic vocabulary

This is the headline capability. It builds on the existing `lib/map-experience/camera-presets.ts` (which already ships `CAMERA_EASING_SLOW_OUT`, `CAMERA_PRESETS`, `REDUCED_MOTION_CAMERA_PRESETS`, `MAP_MIN_ZOOM`/`MAX_ZOOM`) — it does **not** replace it.

### 4.1 The moves

| Move | Key | Camera | Duration | When |
|---|---|---|---|---|
| **Wide** | `W` | `fitBounds(CONUS, {padding, pitch: 0, bearing: 0})` | 1500ms | Establishing shot. The opening move, always. |
| **Push in** | `P` | `flyTo({zoom: max(z+2.6, 8.4), pitch: 48, curve: 1.42, speed: .85})` | 1600ms | Into the subject. Creates focus. |
| **Orbit** | `O` | `easeTo({bearing: b+60}, easing: linear)`, pitch raised to 46 first | 5200ms | Gravitas and scale. Use sparingly. |
| **Tilt** | `T` | `easeTo({pitch: 55 \| 0}, easing: easeOutQuint)` | 900ms | Toggle informational plate ↔ cinematic plate. |
| **Spotlight** | `F` | No camera change; radial mask at 82% opacity | 720ms fade | Isolate one region without moving. |
| **Trace** | `R` | Wide, then draw annotation arcs | 900ms + 130ms stagger | Show movement between places. |
| **Fly to record** | — | `flyTo({center, zoom: 12.6, pitch: 52, bearing: -18, curve: 1.42})` | 2200ms | Record selection. |

### 4.2 Non-negotiable camera rules

1. **`curve: 1.42` on every `flyTo`.** This is the mean value from the van Wijk (2003) smooth-zoom user study and is MapLibre's documented default rationale. Do not hand-tune per call site.
2. **Start wide, then go deep.** Any sequence that pushes in without an establishing shot first is rejected in review.
3. **Padding is clamped.** Instrument padding must never exceed 50% of viewport width or 50% of height. MapLibre **throws** `Map cannot fit within canvas with the given bounds, padding, and/or offset` when it does — this bug cost real debugging time in the mock. `fitBounds` calls are additionally wrapped in try/catch with an `easeTo` fallback.
4. **Never `fitBounds` in the `Map` constructor.** Construct on `center`/`zoom`; run the framing fit in a `map.once('idle')` handler once the canvas has real dimensions.
5. **Bounds padding is applied once**, in the fit call only — never re-applied on a following `easeTo` (carried from v6, this caused double-shift).
6. **`prefers-reduced-motion`** collapses every duration to 0 and cuts to the destination. `essential: true` is set only on camera moves the reader explicitly triggered.
7. **Reader input always wins.** Any pointer/keyboard interaction with the map cancels an in-flight scripted camera move.

### 4.3 Dignity constraints on motion

Camera drama is permitted for **geography and scale**. It is not permitted to dramatise harm.

- No push-in, shake, pulse, whip-pan or spiral onto a violence-adjacent record. Those records get a plain `flyTo` at locality precision.
- No auto-playing sequence over lynching, massacre or destruction records.
- Spotlight may isolate a region; it may never isolate an individual person record.
- The `sweep` decade animation (WP-14) renders record *presence*, never *harm density*.

---

## 5. Chrome anatomy

### 5.1 Command bar (top, z 50)

`grid-template-columns: auto 1fr auto`, height 56px (50px compact), `--r-md`, `--shadow-2`.

| Zone | Contents |
|---|---|
| Left | Book-and-pin symbol (24px) + `BlackStory` wordmark + `ATLAS` mono tag |
| Centre | **`⌘K` trigger** — pill, `max-width: 520px`, placeholder `Search 4,078 records, places, eras…`, right-aligned `⌘K` kbd chip |
| Right | Mode switch (`Atlas` / `Story`), divider, Saved (with count badge), Shortcuts, Theme |

The centre slot is the single most important change in v9. **Navigation moves into the palette.** The bar carries two modes, not fourteen destinations.

Mobile (<820px): drop the mode switch labels and the `ATLAS` tag; keep symbol + search + tools.

### 5.2 Lens (left, z 20)

Width `300px` (276 compact). One scrollable panel, hairline-separated groups, **not** tabs. v6's Filters/Color-key segmented tabs are removed — tabs hid half the instrument behind a click.

Group order, top to bottom:

1. **Where** — state `<select>` (44px), `Near me` link action
2. **Kind** — five family chips with live counts, `aria-pressed`, glyph + label + count
3. **Evidence floor** — `Any` / `C and up` / `B and up` / `A only`, each carrying its grade dot
4. **Layers** — `Archive pins`, `Migration routes`, `Place labels`
5. *hairline*
6. **Deepest coverage** — presence bars, state name + mono count, `--sand` track filling to `--copper-graphic` on hover
7. **Reset lens** — ghost, full-width, left-aligned

Colour key moves into the palette (`⌘K` → "legend") and the record sheet, where the encoding is actually being read.

### 5.3 Results (right, z 20)

Width `344px` (316 compact). Header: `RECORDS` + `n of N` + sort toggle (`OLDEST`/`NEWEST`) + hide.

Row anatomy — `grid-template-columns: 18px 1fr auto`:
- Kind glyph (shape carries the signal; colour never alone)
- Name, 13.5px, weight 550
- Meta line: place (truncating) · era · grade dot + letter — mono, 10px, `nowrap`
- Save affordance, opacity 0 until row hover or already-saved

Selected row: `--copper-wash` fill, 2.5px copper left rule, `aria-selected`.

### 5.4 Time (bottom centre, z 20)

Width `min(760px, 100vw - 24px)`.

- Header: `WHEN` · current decade (Sora 17px) · sub-line (`n records · status as-of this decade`) · play/pause · `ALL TIME`
- **Density histogram**: one bar per decade, height by record count, `--rule-strong` at rest, `--sand` in range, `--copper-graphic` active. This replaces v6's horizontally-scrolling decade-tab rail, which required scrolling to see the shape of the archive.
- Axis: 6 labels, mono 9.5px
- Playhead: 2px copper line with a 9px cap
- Drag to scrub (pointer capture), `←`/`→` to step, `SPACE` to play

One control owns "when" — carried from v6 §4.4. Selecting a decade sets the pin filter **and** the relationship-line slice. No second decade control anywhere.

### 5.5 Camera console (bottom right, z 20)

`CAMERA` mono header with a compact zoom stepper, then a 3×2 grid of move buttons, each with its keyboard chip. Active move gets `--copper-wash` for 2.2s.

**The default MapLibre `NavigationControl` is removed.** Zoom and pitch live in this console so the map keeps one control vocabulary. Attribution moves to a bottom-left pill.

### 5.6 Record sheet (right, z 40)

Replaces both the v6 explore spotlight `<dialog>` and — for preview purposes — the `/entity/[id]` page mast. `430px`, `--r-lg`, 3px copper left rule, `--shadow-3`.

Order:
1. Top strip: `RECORD` · prev / `n / N` / next · close
2. Kicker: kind glyph · Kind · place · era
3. Name — Sora 27px, `-0.03em`
4. Story — Source Serif 4, 15.5px, `line-height: 1.58`
5. **Anatomy** — 2×2 grid, 1px gap showing `--rule-2` as gridlines: Kind / Where / Era / Evidence
6. **Precision note** — mono, `--note-wash`: *"Rendered at {precision} precision. The archive never draws a point sharper than the source supports."*
7. Actions: **Fly to place** (copper) · Save · Cite · Share
8. Sources — numbered hairline rows
9. Documented connections — kind glyph + name + relation slug

Opening the sheet hides the Results rail and pushes the camera to the pin. Closing restores Results. `ESC` closes.

### 5.7 Dock, readout, attribution

- **Dock** (bottom left): chips to restore any hidden panel
- **Readout** (bottom centre, above Time): transient camera status — `**Wide** · continental`, `**Fly to** · Birmingham, Alabama`. `role="status"`, `aria-live="polite"`. 2.4s.
- **Attribution** (bottom left pill): OpenFreeMap · © OpenStreetMap, mono 9px

---

## 6. Story mode

Scroll-driven cinema over the same persistent map plate. Six chapters. This replaces v6 home's beats 01–05 **and** the "decades in motion" idea v6 explicitly killed.

| Ch | Kicker | Camera | Beat |
|---|---|---|---|
| 0 | cold open | `[-96.5, 38.6] z3.35 p0` | Kinetic headline, word-staggered. *History happened **here**.* |
| 1 | Where the record is thickest | `[-90.05, 32.3] z5.1 p34 b-14` | Spotlight the Delta at 20% radius. Presence facts. |
| 2 | One record, up close | `[-86.81, 33.52] z13.4 p56 b24` | Push to A.G. Gaston Motel. Pin marker. Anatomy facts. |
| 3 | The Great Migration | `[-88.2, 37.6] z4.05 p42` | Draw 7 corridor arcs with 130ms stagger and endpoint labels. |
| 4 | Four centuries in ten seconds | `[-95.2, 39.2] z3.5 p0` | Decade sweep, 190ms per decade, pins refilling. |
| 5 | Your turn | `[-96.5, 38.6] z3.4 p0` | Hand off to Atlas or Near me. |

Mechanics:
- `IntersectionObserver` on `.chapter`, `threshold: 0.42`, `root: #story`
- Camera spec lives in `data-cam` as JSON; beats in `data-spot`, `data-routes`, `data-focus`, `data-sweep`
- Chapter cards alternate left/right; cold open and outro centre
- Right-edge progress rail with chapter labels on hover
- Reduced motion: chapters still advance, camera cuts, sweep runs at 400ms, no kinetic type

**Copy law holds:** no em dashes, sentence case body, mono uppercase for slugs only, people named with role and place.

**Chapter 3 honesty line, required:** *"Corridors are illustrative of documented migration streams, drawn between origin and destination metros. Not individual paths."*

---

## 7. Quality-of-life contract

All of these ship in v1. They are the difference between a site and a tool.

| Capability | Trigger | Behaviour |
|---|---|---|
| Command palette | `⌘K`, `/`, click trigger | Records + state jumps + actions, fuzzy, `↑↓` navigate, `↵` open, `⌘↵` fly to, highlighted match via `<mark>` |
| Shortcut sheet | `?` | Four columns: Find, Camera, Records, View |
| Save / collect | `S`, row bookmark | Badge count in bar, undo toast |
| Collections drawer | Saved button | List + `Copy all citations` + `Copy as GeoJSON` + `Clear` |
| Cite | `C` | `"{name}." BlackStory Archive, {place}, {era}. Evidence grade {g}, {n} sources. Accessed {ISO date}. {url}` |
| Share deep link | `⌘L` | URL carries `record`, `state`, `era`, `grade`, `kind`. Never live pan/zoom (ADR-017). |
| Step records | `J` / `K` | Wraps within the current lens |
| Near me | `N` | Geolocate, fly, spotlight, select nearest, report distance |
| Theme | `D` | Light / dark, restyles the map plate and re-syncs sources |
| Density | `⌥D` | Comfortable / compact — rescales spacing and rail widths |
| Motion | `M` | Cinematic / calm — kills pings and ambient loops, keeps functional transitions |
| Hide chrome | `\` | Everything to the dock; bar drops to 15% |
| Undo | toast action | Any destructive lens or save change |
| Overflow affordance | automatic | Scrollable panels get a bottom fade when content continues |
| Skeletons | on load | `.sk` shimmer, never a spinner |
| Empty states teach | on zero results | Names the cause and offers the fix, never "no results" alone |

---

## 8. Accent hierarchy (replaces the copper budget)

v6 rationed copper by count. v9 assigns it by **role**, which is what actually creates hierarchy.

| Role | Token | Use |
|---|---|---|
| Primary action / active state | `--copper-graphic` fill | One filled button per panel, active chip, selected row rule, playhead, pins |
| Interactive text / links | `--copper` | Kickers, group labels, links, hover |
| Secondary data | `--sand` | Histogram in-range bars, presence tracks, soft annotation arcs |
| Structure | `--rule` / `--rule-2` | Hairlines, panel borders, gridlines |
| Evidence | `--ok` / `--warn` / `--note` | Grade A / B / C, **always paired with a glyph shape** |

Hard rules kept from v6: raw Copper Pin never carries body-size text on light canvas; colour is never the only signal; confidence stays glyph-encoded.

---

## 9. Typography discipline

Four families stay. The rule is **one register per element class**, not one register per line.

| Register | Family | Where |
|---|---|---|
| Display | Sora 600 | Record names, chapter headings, decade current value, brand |
| UI | Inter 400–600 | Buttons, rows, controls, body chrome |
| Editorial | Source Serif 4 | Record story prose, chapter prose, one italic accent word in headings |
| Data | IBM Plex Mono | Counts, grades, eras, coordinates, labels, kickers, keyboard chips, axis |

Not allowed: mono and serif in the same line; three families inside one card component; mono for anything longer than a short phrase.

---

## 10. Accessibility floor

- Every tappable control ≥ 44px (chips may be 30px tall inside a 44px row target)
- `:focus-visible` — 2px `--copper`, 2px offset, everywhere
- Results list is `role="listbox"` / `role="option"` with `aria-selected`
- Time track is `role="slider"` with `aria-valuemin/max/now/valuetext`
- Camera readout is `role="status" aria-live="polite"`
- Palette is `role="dialog" aria-modal="true"` with focus trap and restore
- Record sheet is a non-modal `role="dialog"` — the map stays operable behind it
- `prefers-reduced-motion` honoured at the CSS level (`.01ms` durations) **and** the camera level
- Map failure degrades to the accessible record list; never a blank screen
- All contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries, verified in both themes

---

## 11. Rip list — v6 → v9

| Topic | v6 (superseded) | v9 (binding on approval) |
|---|---|---|
| Product shape | Brochure `/` + cockpit `/explore` | One Atlas surface; Story is a mode, not a page |
| First paint | Hero panel with map column | Live map, records already loaded |
| Primary affordance | Nav menu of 14 destinations | `⌘K` command palette |
| Filters | Segmented Filters / Color key tabs | Single scrolling Lens panel |
| Time control | Horizontally scrolling decade tabs | Density histogram with drag scrub + playback |
| Decade change | Snap, no morph | Staggered pin transition, 420ms opacity |
| Motion | Banned as ornament | Budgeted as explanation, with dignity carve-outs |
| Copper | Quota per fold | Role-based hierarchy |
| Record preview | Modal `<dialog>` spotlight | Non-modal sheet; map stays live |
| Story | Static beats 01–05 on `/` | Scroll-driven camera cinema |
| Zoom control | MapLibre `NavigationControl` | Camera console |
| Save / cite / share | Absent | First-class, keyboard-driven |
| Legend | Color key tab | Palette + sheet, at point of use |

**Carried forward unchanged:** brand tokens, type registers, 44px targets, dignity and precision rules, cognitive-accessibility labelled-facts law, record anatomy, reduced-motion respect, WCAG AA floor, official brand artwork paths, ADR-017 handoff, shareable-URL-without-viewport rule.

---

## 12. Acceptance checklist

- [ ] First paint of `/` shows a live map with pins, no marketing hero
- [ ] `⌘K` and `/` open the palette from every surface; `ESC` restores focus
- [ ] Map land/water and land/line luminance deltas pass the contract test in both themes
- [ ] All six camera moves run, are keyboard-reachable, and are listed in `?`
- [ ] `fitBounds` never throws — padding clamp test passes at 320px, 768px, 1440px
- [ ] Reduced motion cuts every camera move and disables the sweep
- [ ] No push-in, orbit or sweep is applied to a violence-adjacent record
- [ ] Lens filters auto-apply; no Apply button; reset offers undo
- [ ] Time histogram is draggable, keyboard-steppable, and announces via `aria-valuetext`
- [ ] Record sheet is non-modal and the map remains pannable behind it
- [ ] Save, cite, share, GeoJSON export all work and are toasted
- [ ] Story mode's six chapters fire their camera specs in order
- [ ] Responsive verified at 375 / 768 / 1280 / 1440
- [ ] `pnpm lint && pnpm typecheck && pnpm test:js && pnpm test:a11y && pnpm format:check` clean
- [ ] No em dashes in shipped copy
- [ ] v6 home and explore docs marked superseded; `docs/ui/README.md` index updated

---

## 13. Research basis

- **Camera vocabulary and the "start wide, then go deep" rule** — [Map Zoom Animation & Camera Guide, mapanimation.io](https://mapanimation.io/guide/camera-guide): fly-to, smooth glide, instant cut, follow-path, slow orbit; wide-establishing → push-in → pull-back-for-scale; depth of field, dolly zoom, whip pan; and the explicit warning that "less is more with effects."
- **Johnny Harris / Vox map technique** — [How Johnny Harris Makes Maps, aescripts](https://aescripts.com/learn/post/how-johnny-harris-makes-maps) and [Making Maps for Johnny Harris, PremiumBeat](https://www.premiumbeat.com/blog/making-maps-for-johnny-harris/): the house style is motion graphics over cinematic footage, built in After Effects with GEOlayers 3, and the signature reveal is a **track-matte mask over a duplicated map layer** — which is exactly what §2's spotlight layer reproduces in CSS.
- **`curve: 1.42`** — [MapLibre `FlyToOptions`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/): documented as the average value selected by participants in the van Wijk (2003) smooth-and-efficient-zooming study.
- **Scroll-driven camera chapters** — [MapLibre: fly to a location based on scroll position](https://maplibre.org/maplibre-gl-js/docs/examples/fly-to-a-location-based-on-scroll-position/) and [`story_map`, mapgl](https://rdrr.io/cran/mapgl/man/story_map.html): chapters carry `center`, `zoom`, `bearing`, `pitch`, `duration`, `speed`.
- **`essential: true`** — [MapLibre `AnimationOptions`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/): marks an animation as essential so it is not suppressed by `prefers-reduced-motion`. v9 sets it **only** on reader-triggered moves, never on ambient ones.
- **Bento density and scroll storytelling** — [Figma, Top Web Design Trends](https://www.figma.com/resource-library/web-design-trends/) and [Envato Elements, Web design trends](https://elements.envato.com/learn/web-design-trends): asymmetric modular blocks for information density; scroll storytelling as timed reveal; kinetic type as an architectural element rather than decoration.

---

## 14. Supersession

On approval this document supersedes, in full:

- `design-direction-v6-home.md`
- `design-direction-v6-explore.md`
- `design-direction-v6-search.md`

`brand.md`, `patterns-map-entity-encoding.md`, `patterns-map-canvas.md`, `patterns-record-anatomy.md`, `patterns-browse-mode.md` and `patterns-edition-fact-icon.md` remain binding and are consumed by v9 unchanged. Surfaces outside `/` and `/explore` stay on their v6 documents until separately revised.
