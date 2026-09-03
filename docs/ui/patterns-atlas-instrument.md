# Explore Instrument

**Status: In build (v9).** The pattern the Instrument surface class is made of: `/` (the Explore map) and `/story`. Extracted from the runnable reference build [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) and governed by [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md), binding since 2026-07-30. Work packages and sequencing live in [`v9-atlas-implementation-plan.md`](./v9-atlas-implementation-plan.md).

Builds on, and does not replace: [`patterns-map-canvas.md`](./patterns-map-canvas.md) (persistent `MapStage`, ADR-017), [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) (pin colour and shape), [`patterns-record-anatomy.md`](./patterns-record-anatomy.md) (the 2×2 fact grid), [`brand.md`](./brand.md) (flat matte, copper discipline, dignity law).

**Where the other four surface classes live.** This pattern covers the Instrument only. [`patterns-surface-classes.md`](./patterns-surface-classes.md) names all five classes and which routes are in each; [`patterns-plate-posture.md`](./patterns-plate-posture.md) governs the plate everywhere the Instrument is not; [`patterns-reading-room.md`](./patterns-reading-room.md) and [`patterns-record-page.md`](./patterns-record-page.md) carry the editorial and record surfaces; [`patterns-lens-handoff.md`](./patterns-lens-handoff.md) is how they hand a filter back to this instrument.

**Relationship to [`patterns-cinematic-map.md`](./patterns-cinematic-map.md):** that pattern describes a map *behind* editorial content, locked until invited (Rest → Invite → Engaged). This one describes a map that *is* the content, live from first paint. A surface adopts one or the other, never both. The mobile Explore tab stays on the cinematic backdrop. On web, the v9 resolution replaces the cinematic backdrop's web adopters with the Framed plate posture: `/entity/[id]` becomes a Record page and `/history` dissolves into `/records`. See [`patterns-plate-posture.md`](./patterns-plate-posture.md).

---

## 1. What it is

An instrument, not a page. One full-viewport map plate with opaque panels floating over it. Nothing scrolls the plate away, no navigation reloads it, and every control acts on the same canvas.

Four properties define the pattern:

1. **The map is the product.** First paint is a live map with records already on it. No hero, no throat-clearing.
2. **Search is the primary affordance.** `⌘K` replaces a navigation menu. Destinations are a consequence of search.
3. **Motion explains.** Camera moves are how the archive argues. Static is the exception, reserved for dignity-sensitive content.
4. **Panels float, they do not dock.** Each instrument is independently hideable to a dock chip, and the camera's padding responds to which ones are open.

### When to use

Only on a surface whose `data-surface` is `instrument`: `/` and `/story`, with `/explore` and `/locate` redirecting into them. This pattern is expensive: it owns the viewport, the keyboard, and the camera. Any surface that also wants scrollable editorial content takes a Reading room or Record page instead, with the plate Parked or Framed. See [`patterns-plate-posture.md`](./patterns-plate-posture.md).

---

## 2. Canvas law: the layer stack

One canvas, two modes (Explore and Story), no page-to-page reload of the plate.

| Layer | z | Rule |
|---|---|---|
| Map plate | 0 | Fixed full-viewport MapLibre. Single mount, persists across mode changes (ADR-017). |
| Annotation overlay | 5 | SVG, `pointer-events: none`. Reprojected on `move`. |
| Spotlight | 6 | Radial CSS mask over a canvas-coloured plate. |
| Grain | 7 | Archive texture, `mix-blend-mode: overlay`, opacity ≤ .3. |
| Instruments | 20 | Opaque `--ds-surface` panels: Lens, Results, Time, Camera, Dock. |
| Record sheet | 40 | Right-anchored slab, 3px copper left rule. |
| Command bar | 50 | Fixed top. |
| Palette and overlays | 90 | Command palette, shortcuts, collections. |
| Toasts | 95 | Bottom centre, above the Time panel. |

**Pointer-events contract (map stays operable):** Hover and touch on the plate itself pan, zoom and wheel-zoom. That is the common full-viewport map pattern: chrome keeps its own hits, gaps hand the gesture to the canvas. `.ds-atlas`, `.ds-shell`, `.ds-shell-body`, and the Instrument route wrappers are `pointer-events: none`. `pointer-events` is not inherited, so every covering ancestor has to opt out or the auto parent still eats the gesture. Only interactive surfaces re-enable hits (command bar, Lens, Results, Record sheet, Time, Camera, dock, notice, legend, Story scroll root, palette / shortcuts / saved overlays, offline banner). Full-bleed chrome (annotation, spotlight, readout) and the toast stack stay `none` so pan/zoom reaches the plate in the gaps; individual toasts set `auto` on themselves. Record sheet is non-modal (`aria-modal="false"`) for the same reason.

**First paint is a map, not pins on empty canvas.** `/explore` first HTML is the Albers US locator (`/geo/us-locator.svg`) with state hairlines and the pin plate. MapLibre starts as ocean-only; hiding that locator when `.maplibregl-canvas` appears leaves a blank plate. Hand off when `.ds-map-stage[data-plate-ready]` is set: the first `idle` after style apply, or when state polygons land, whichever is first. After handoff, camera moves, uncovered pin and cluster clicks, and MapLibre pan/zoom own the plate. If WebGL never arrives, the locator stays and still takes wheel, drag, pinch, and pin clicks. Pin discs on that locator are hit targets: a tap that does not pan opens the record sheet (opaque `pin-N` ids match catalog geography; shop tokens stay off the first document). Majority record discs are Page Sand on Door, Explore, MapFrame, and the live plate; copper stays on holding walks and the selected pin. A pin or cluster click opens the record sheet on the plate (not a place or entity page). Cluster clicks resolve one leaf so a national aggregate still opens a card.

**Banned** (carried from `brand.md`): gradients as decoration, glows, bevels, 3D chrome, `backdrop-filter` blur on instrument panels, sepia, alarm hues, crime-heat rendering.

**Permitted, and only here:** one soft tinted shadow on panels that float *over the map*. Five opaque panels over a live basemap with no elevation cue read as debris. Shadow carries z-order, never decoration, and is absent on paper-on-paper surfaces.

---

## 3. Camera vocabulary

Seven moves. Implemented in [`camera-moves.ts`](../../apps/web/src/lib/map-experience/camera-moves.ts), which extends `camera-presets.ts` rather than replacing it.

| Move | Key | Camera | Duration | When |
|---|---|---|---|---|
| **Wide** | `W` | `fitBounds(CONUS, {padding, pitch: 0, bearing: 0})` | 1500ms | Establishing shot. The opening move, always. |
| **Push in** | `P` | `flyTo({zoom: max(z+2.6, 8.4), pitch: 48, speed: .85})` | 1600ms | Into the subject. Creates focus. |
| **Orbit** | `O` | `easeTo({bearing: b+60})` linear, pitch raised to 46 first | 5200ms | Gravitas and scale. Use sparingly. |
| **Tilt** | `T` | `easeTo({pitch: 55 or 0})` slow-out | 900ms | Toggle informational plate against cinematic plate. |
| **Spotlight** | `F` | No camera change. Radial mask. | 720ms fade | Isolate a region without moving. |
| **Trace** | `R` | Wide, then draw annotation arcs | 900ms + 130ms stagger | Show movement between places. |
| **Fly to record** | (selection) | `flyTo({zoom: 12.6, pitch: 52, bearing: -18})` | 2200ms | Record selection. |

### Non-negotiable camera rules

1. **`curve: 1.42` on every `flyTo`.** The mean value from the van Wijk (2003) smooth-zoom study, and MapLibre's documented default rationale. Never hand-tuned per call site. Asserted in `camera-moves.test.ts`.
2. **Start wide, then go deep.** Any sequence that pushes in without an establishing shot first is rejected in review. `trace()` enforces this itself by calling `wide()` before drawing.
3. **Padding is clamped.** See §4.
4. **Never `fitBounds` in the `Map` constructor.** Construct on `center`/`zoom`, run the framing fit in a `map.once('idle')` handler once the canvas has real dimensions.
5. **Bounds padding is applied once**, in the fit call only, never re-applied on a following `easeTo`. Re-applying causes a double-shift.
6. **`prefers-reduced-motion` collapses every duration to 0** and cuts to the destination. `essential: true` is set *only* on reader-triggered moves, never on ambient or scroll-driven ones. That distinction is what makes the flag meaningful: marking everything essential defeats the reader's own setting.
7. **Reader input always wins.** Any pointer or keyboard interaction cancels an in-flight scripted move. `createCamera` exposes `cancel()`, and every move calls it before starting.

### Announcements

Every move reports to the camera readout in a fixed `"Move · detail"` shape (`Wide · continental`, `Fly to · Birmingham, Alabama`). The readout is `role="status" aria-live="polite"` and clears after 2.4s.

---

## 4. Padding clamp

Implemented in [`chrome-padding.ts`](../../apps/web/src/lib/map-experience/chrome-padding.ts).

MapLibre **throws** `Map cannot fit within canvas with the given bounds, padding, and/or offset` when padding exceeds the canvas, and that throw kills map init outright. This is not hygiene, it is the difference between a working surface and a blank one.

```
Narrow (< 820px):  top 88, bottom min(210, h*0.3), left 16, right 16
Wide:              left  = lensOpen ? 330 : 40
                   right = sheetOpen ? 468 : resultsOpen ? 376 : 40
                   top 96, bottom round(min(160, h*0.22))
Clamp:             if left+right > w*0.5, scale both by k = (w*0.5)/(left+right)
Vertical guard:    if top+bottom > h*0.5, fall back to 40/40
```

Both sides scale by the **same** factor so the camera stays centred on the free area instead of drifting toward whichever panel is narrower. The vertical guard applies on the narrow branch too: a short landscape viewport hits it before any desktop size does, and a throw there is just as fatal.

`fitBounds` is additionally wrapped in try/catch with an `easeTo` fallback to `[-96.5, 38.6] z3.6`, so a clamp miss degrades to a plain ease rather than taking the map down.

---

## 5. Dignity gate on motion

Implemented in [`camera-dignity.ts`](../../apps/web/src/lib/map-experience/camera-dignity.ts). **This is an enforced gate, not a review convention**, and it ships before the camera console that exposes the moves.

Camera drama is permitted for geography and scale. It is not permitted to dramatise harm.

| Record | Permitted | Refused |
|---|---|---|
| Violence-adjacent (tone `massacre` or `plantation`; topics matching lynching, riot, sundown, destruction, displacement, terror) | `wide`, `flyToRecord`, `tilt` | `push`, `orbit`, `trace`, `spotlight` |
| Any `kind === 'person'` | everything except `spotlight` | `spotlight`, regardless of tone |
| Everything else | all seven | none |

Three points the implementation makes deliberately:

- **The vocabulary is the catalog's own.** Tone comes from `resolveMapTone` in `kind-encoding.ts`, reused rather than reimplemented, so a record cannot read as `massacre` for painting and something else for camera purposes. No parallel taxonomy.
- **`plantation` is included** although §4.3 does not name it. It is a site of enslavement, and an orbit "for gravitas" over one is precisely the failure mode the rule exists to prevent. `epicenter` is deliberately excluded: it encodes presence, and presence is what the camera is for.
- **Topic matching is deliberately broad.** Over-matching costs a record some camera drama. Under-matching puts a push-in on a lynching. The asymmetry is the point.

A refused move is a **silent no-op** plus a dev-only `console.warn`. Never a user-facing error: the reader pressed a key, and telling them the archive has opinions about their keystroke is worse than simply not moving.

**Sundown enforcement** is named by the design law but is not a typed record property today. It exists as a source lane (`tougaloo-sundown-towns`), not a tone or category on a map record. The topic-slug list is the seam. When it becomes typed, gate it there rather than inventing a parallel taxonomy.

---

## 6. Chrome anatomy

Five instruments, each independently hideable to a dock chip.

### 6.1 Command bar (top, z 50)

`grid-template-columns: auto 1fr auto`, height 56px (50px compact).

| Zone | Contents |
|---|---|
| Left | Official symbol artwork alone, from `BRAND_ASSETS.symbol`, light and dark pair swapping on `data-theme`, then the `ATLAS` mono tag |
| Centre | **`⌘K` trigger**, pill, `max-width: 520px`, right-aligned `⌘K` kbd chip |
| Right | Mode switch (Explore / Story), divider, Saved with count badge, Shortcuts, Theme |

The centre slot is the single most important change in v9: navigation moves into the palette, and the bar carries two modes instead of fourteen destinations. Below 820px, drop the mode-switch labels and the `ATLAS` tag.

**No wordmark in the bar, and the symbol is sized by its visible mark, not its box.** Typing the wordmark beside a symbol render is a reconstructed lockup, which [`brand.md`](./brand.md) lists under Misuse (never). The symbol PNG is a 512x512 box holding a 181x292 mark, so visible height is box height x 0.57 and visible width is box height x 0.35. A 40px box in the 56px bar and a 36px box in the 50px compact bar clear brand.md's 20px compact-mark minimum; the 32px primary-mark minimum needs a 57px box, which does not fit. Full derivation and the lockup arithmetic are in [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md) section 5.1.

**Adoption gate:** every destination that leaves the bar (Data, Law, Banned books, Memorial, Methodology, Corrections, Errata, Submit) must be reachable from the palette **and** the site footer before this ships. No route may become unreachable.

### 6.2 Lens (left, z 20)

Width 300px (276 compact). One scrolling panel, hairline-separated groups, **not** tabs. v6's Filters and Color-key segmented tabs are removed: tabs hid half the instrument behind a click.

Group order: Where (state select, Near me) · Kind (five family chips with live counts, `aria-pressed`) · Evidence floor (`Any` / `C and up` / `B and up` / `A only`, each with its grade dot) · Layers · hairline · Deepest coverage (presence bars) · Reset lens.

Filters auto-apply. No Apply button. Reset offers undo via toast. A scrollable panel gets a bottom fade when content continues below the fold.

Colour key moves into the palette and the record sheet, where the encoding is actually being read.

### 6.3 Results (right, z 20)

Width 344px (316 compact). `role="listbox"` / `role="option"` / `aria-selected`, exactly one selected at a time.

Row grid `18px 1fr auto`: kind glyph · name (13.5px, weight 550) + meta line · save affordance (opacity 0 until row hover or already saved). The meta line is a single non-wrapping line: place truncates via `text-overflow: ellipsis`, era and grade never truncate. Selected row takes `--copper-wash` fill and a 2.5px copper left rule.

**The rail must window or virtualise.** It carries the full 4,078-record set. `/history` currently renders 4,078 anchors in one document; do not repeat that.

### 6.4 Time (bottom centre, z 20)

Width `min(760px, 100vw - 24px)`. Implemented in [`TimePanel.tsx`](../../apps/web/src/components/map-experience/TimePanel.tsx) over [`decade-density.ts`](../../apps/web/src/lib/map-experience/decade-density.ts).

Replaces v6's horizontally scrolling decade-tab rail, which required scrolling to see the shape of the archive.

- Header: `WHEN` · current decade (Sora 17px) · sub-line · play/pause · `ALL TIME`
- **Density histogram**: one bar per decade. Rest `--ds-border`, in-range `--ds-accent-muted`, active `--ds-accent-graphic`
- Playhead: 2px copper line with a 9px cap
- Axis: 6 labels, mono
- `role="slider"` with `aria-valuemin` / `valuemax` / `valuenow` / `valuetext`
- Pointer-capture drag to scrub, `←`/`→` to step, `SPACE` to play/pause, `Home`/`End` to jump

**Density normalisation** carries a floor so a one-record decade stays visible against a 340-record peak: `height = 17 + (count/max) × 83` percent. The floor is honest in one specific way: a decade with **zero** records gets height zero, not the floor. Lifting an empty decade to a visible bar draws presence that is not in the archive, which is a worse lie than the one the floor fixes.

**One control owns "when."** Selecting a decade sets the pin filter and the relationship-line slice. No second decade control anywhere.

**Carried from v6, still binding:** decade views show status **as-of that decade** from published status history. Never present-day status backfilled.

### 6.5 Camera console (bottom right, z 20)

`CAMERA` mono header with a compact zoom stepper, then a 3×2 grid of move buttons each carrying its keyboard chip. Active move takes `--copper-wash` for 2.2s.

**The default MapLibre `NavigationControl` is removed.** Zoom and pitch live in this console so the map keeps one control vocabulary. Two zoom vocabularies on one map is the defect being fixed. Attribution moves to a bottom-left pill.

Moves refused by the dignity gate render disabled with a `title` explaining why.

### 6.6 Record sheet (right, z 40)

430px, radius-lg, 3px copper left rule. **Non-modal** `role="dialog"`: the map stays pannable behind it. This is the pattern's sharpest break from v6, which used a modal `<dialog>` that froze the canvas.

Order, fixed: top strip (`RECORD` · prev / `n of N` / next / close) · kicker (kind glyph · Kind · place · era) · name (Sora 27px) · story (Source Serif 4, 15.5px) · **anatomy** (reuse `RecordAnatomyPanel`, do not rebuild) · compact Visit block when geo resolves · precision note · actions (Open record primary; Fly to place secondary; Save / Cite / Share quiet text) · numbered sources · documented connections.

Visit maps exits inside the sheet are quiet text (see [`patterns-visit-handoff.md`](./patterns-visit-handoff.md)); they must not compete with Fly to place as twin primaries.

The precision note is mandatory and reads exactly:

> Rendered at {precision} precision. The archive never draws a point sharper than the source supports.

Opening hides Results and flies the camera to the pin. Closing restores Results. `ESC` closes.

### 6.7 Dock, readout, attribution

- **Dock** (bottom left): chips restoring any hidden panel
- **Readout** (bottom centre, above Time): transient camera status, `role="status"`, 2.4s
- **Attribution** (bottom-left pill): OpenFreeMap · © OpenStreetMap, mono 9px

---

## 7. Annotation overlay and arc geometry

SVG layer at z 5, `position: fixed; inset: 0; pointer-events: none`. Subscribes to `map.on('move')` and reprojects through `map.project()`.

**Arc geometry** is a quadratic bezier. The control point is offset perpendicular from the midpoint by `min(distance × 0.22, 190)`:

```
p1, p2   = map.project(a), map.project(b)
d        = p2 - p1;  len = hypot(d) or 1
normal   = (-dy/len, dx/len)
lift     = min(len * 0.22, 190)
path     = M p1  Q (midpoint + normal*lift)  p2
```

The 190px clamp matters: without it, a coast-to-coast corridor arcs off the top of the viewport.

Rendering: `stroke-dasharray` draw-on with 130ms stagger between arcs, endpoint dots, mono uppercase labels with `paint-order: stroke` halos, and alternating `.an-arc` / `.an-arc.soft` weight so a dense field stays readable.

**The overlay renders what it is given.** Corridor data lives in [`migration-corridors.ts`](../../apps/web/src/lib/map-experience/migration-corridors.ts), never in the component.

### Corridor honesty

Every corridor carries a required note, and any surface that renders one must surface it:

> Corridors are illustrative of documented migration streams, drawn between origin and destination metros. Not individual paths.

The type enforces this: `granularity` is the literal `'metro-to-metro'`, `note` is required, and there is deliberately no waypoint or path field. A caller cannot widen a corridor into an itinerary without changing the type and reading why.

---

## 8. Story mode

Scroll-driven cinema over the same persistent plate. Six chapters. `IntersectionObserver` at `threshold: 0.42` with `root` set to the story scroll container.

| Ch | Kicker | Camera | Beat |
|---|---|---|---|
| 0 | cold open | `[-96.5, 38.6] z3.35 p0` | Kinetic headline, word-staggered |
| 1 | Where the record is thickest | `[-90.05, 32.3] z5.1 p34 b-14` | Spotlight the Delta at 20% radius |
| 2 | One record, up close | `[-86.81, 33.52] z13.4 p56 b24` | Push to A.G. Gaston Motel |
| 3 | The Great Migration | `[-88.2, 37.6] z4.05 p42` | Draw 7 corridor arcs, 130ms stagger |
| 4 | Four centuries in ten seconds | `[-95.2, 39.2] z3.5 p0` | Decade sweep, 190ms per decade |
| 5 | Your turn | `[-96.5, 38.6] z3.4 p0` | Hand off to Atlas or Near me |

Chapter specs live as **data**, not markup: camera, spotlight, routes, focus and sweep flags per chapter. Chapter cards alternate left and right; cold open and outro centre. A right-edge progress rail shows chapter labels on hover.

**Reduced motion:** chapters still advance, the camera cuts instead of flying, the sweep runs at 400ms instead of 190ms, and kinetic type is disabled. Chapters advancing is functional; how they arrive is decoration.

**The sweep renders presence only.** It must never encode harm density, and the dignity gate applies to every camera spec a chapter fires.

---

## 9. Keyboard layer

One source of truth for every binding. The palette, the camera console and the shortcut sheet all read from it. A shortcut defined in two places is a defect.

| Group | Bindings |
|---|---|
| Find | `⌘K` / `/` palette · `?` shortcuts · `N` near me |
| Camera | `W` wide · `P` push · `O` orbit · `T` tilt · `F` spotlight · `R` trace |
| Records | `J` / `K` step · `S` save · `C` cite · `⌘L` share link |
| View | `D` theme · `⌥D` density · `M` motion · `\` hide chrome |
| Time | `←` / `→` step decade · `SPACE` play/pause |

Global handler rules:

- Ignore when focus is in `INPUT`, `TEXTAREA`, `SELECT` or a `contenteditable`
- `⌘`/`Ctrl` combos are handled before the bare-key switch
- `ESC` unwinds in order: palette → overlay → spotlight → sheet

---

## 10. Accessibility contract

- Every tappable control ≥ 44px. Chips may be 30px tall inside a 44px row target.
- `:focus-visible` is 2px `--ds-accent` at 2px offset, everywhere.
- Results is `role="listbox"` / `role="option"` with `aria-selected`.
- Time track is `role="slider"` with `aria-valuemin` / `max` / `now` / `valuetext`.
- Camera readout is `role="status" aria-live="polite"`.
- Palette is `role="dialog" aria-modal="true"` with focus trap and restore to the trigger.
- Record sheet is a **non-modal** `role="dialog"`. The map stays operable behind it.
- Toast region is `role="status" aria-live="polite"` on the *region*, not per toast, so a new entry does not re-announce the stack.
- `prefers-reduced-motion` is honoured at the CSS level (`.01ms` durations) **and** the camera level. `M` gives an in-app calm toggle independent of the OS setting.
- Map failure degrades to the accessible record list. Never a blank screen.
- Contrast: ≥ 4.5:1 text, ≥ 3:1 UI boundaries, verified in both themes.

---

## 11. Map plate legibility

Nine `--ds-map-*` roles per theme, in `packages/ui/src/styles/tokens.css` and mirrored in `packages/ui/src/tokens/colors.ts`. The style builders consume the TS values, since MapLibre styles are JSON rather than CSS.

Separation between adjacent roles is a **contract**, asserted in `packages/ui/src/tokens/map-contrast.test.ts` in both themes:

| Pair | Minimum |
|---|---|
| land / water | 18 ΔL\* |
| land / line (state) | 18 ΔL\* |
| land / line-2 (country) | 24 ΔL\* |
| label / land | 40 ΔL\* |
| label-hi on land | 4.5:1 WCAG contrast |

**Separation uses CIE L\***, not WCAG relative luminance. Y is compressed near black, so on a dark plate two visibly different colours sit a fraction of a Y point apart and any Y-based threshold is unreachable by construction. Text contrast still uses the WCAG ratio, which is what WCAG defines.

If a token fails one of these, **the token is wrong**. Do not loosen a threshold to make a value pass.

**Label field expression:** always the shared `MAP_LABEL_NAME_FIELD` constant, never an inline `['get','name:en']`. OpenMapTiles ships localised name fields inconsistently across planet releases. Layers backed by our own GeoJSON (county lines, memorial names) keep a plain `['get','name']`: routing them through a localisation coalesce would imply a field they do not carry.

---

## 12. Quality-of-life contract

These are the difference between a site and a tool, and all of them ship in v1.

| Capability | Trigger | Behaviour |
|---|---|---|
| Command palette | `⌘K`, `/`, click | Records, state jumps, actions. Fuzzy. Matched substring in `<mark>` |
| Save / collect | `S`, row bookmark | Badge count in bar, undo toast |
| Collections drawer | Saved button | List, `Copy all citations`, `Copy as GeoJSON`, `Clear` |
| Cite | `C` | Fixed format, injected accessed date so it is reproducible |
| Share deep link | `⌘L` | Carries record, state, era, grade, kind. **Never** live pan/zoom |
| Near me | `N` | Geolocate, fly, spotlight, select nearest, report distance |
| Toasts | on action | 2.6s plain, 6s with an action |
| Skeletons | on load | Shimmer, 1.4s linear. **Never a spinner** |
| Empty states | on zero results | Name the cause, offer the fix. Never a bare "no results" |

**Share links never carry viewport state (ADR-017).** A shared URL restores *what* the reader was looking at, never *where the camera was*. The camera is a property of one reader's session, and pinning it hands the recipient a framing they did not choose and cannot distinguish from data. `deep-link.ts` asserts this at runtime rather than trusting the caller.

Deep links serialize to the params `/explore` already parses (`selected`, `confidence`), not to the share-side field names. A link the app cannot read is a broken link.

---

## 13. Do / Don't

**Do**

- Start wide before going deep, every time
- Let the padding clamp decide framing, and wrap every `fitBounds`
- Route new camera behaviour through `createCamera` so the gate and the curve apply
- Keep corridor data out of the overlay component
- Give a toast an action when the change is destructive, and honour the undo

**Don't**

- Hand-tune `curve` at a call site
- Set `essential: true` on an ambient or scroll-driven move
- Add a second decade control, a second matcher, or a second header
- Render a bar for a decade with zero records
- Put a push-in, orbit, trace or spotlight anywhere near a violence-adjacent record
- Use raw hex in component CSS. Tokens are `--ds-*`

---

## 14. Modules

| Concern | Module | Status |
|---|---|---|
| Plate tokens | `packages/ui/src/tokens/colors.ts`, `styles/tokens.css` | Built |
| Contrast contract | `packages/ui/src/tokens/map-contrast.test.ts` | Built |
| Padding clamp | `lib/map-experience/chrome-padding.ts` | Built |
| Label expression | `lib/map-experience/label-expression.ts` | Built |
| Camera vocabulary | `lib/map-experience/camera-moves.ts` | Built |
| Dignity gate | `lib/map-experience/camera-dignity.ts` | Built |
| Corridor data | `lib/map-experience/migration-corridors.ts` | Built |
| Decade density | `lib/map-experience/decade-density.ts` | Built |
| Time panel | `components/map-experience/TimePanel.tsx` | Built |
| Toasts | `components/patterns/Toast.tsx`, `toast.ts` | Built |
| Empty states | `components/patterns/EmptyState.tsx`, `empty-state.ts` | Built |
| Skeletons | `components/patterns/skeleton.css` | Built |
| Citation | `lib/citation/format.ts` | Built |
| Share deep link | `lib/share/deep-link.ts` | Built |
| Annotation overlay | `components/map-experience/AnnotationOverlay.tsx`, `lib/map-experience/arc-geometry.ts` | Built |
| Command palette | `components/patterns/command-palette/` | Built |
| Command bar | `components/shell/CommandBar.tsx` | Pending (WP-10) |
| Lens panel | `components/map-experience/LensPanel.tsx` | Pending (WP-11) |
| Results rail | `components/map-experience/ResultsRail.tsx` | Pending (WP-12) |
| Decade transition | `lib/map-experience/decade-transition.ts` | Pending (WP-14) |
| Keyboard bindings | `lib/keyboard/bindings.ts` | Pending (WP-15) |
| Camera console | `components/map-experience/CameraConsole.tsx` | Pending (WP-16) |
| Record sheet | `components/map-experience/RecordSheet.tsx` | Pending (WP-17) |
| Collections | `lib/collections/store.ts` | Pending (WP-18) |
| Story engine | `components/story/StoryMode.tsx`, `lib/story/chapters.ts` | Pending (WP-21) |

**"Built" means built and tested, not mounted.** Every module above exists, typechecks and has
tests, but none of them is reachable in the running app yet: nothing on `/explore` renders the
time panel, constructs the camera, or draws a corridor. Mounting is **WP-27**, a package added
after review found that the original plan had no composition step at all. Read this table as an
inventory of parts, and check WP-27 before assuming a surface uses one.

**Plate wiring is not yet done.** The `--ds-map-*` roles exist and are contract-tested, but the
MapLibre style builders still read `dignity-style.ts`'s `plateForScheme`. Until that is wired, the
live map renders the old plate. **WP-28** owns this.

---

## 15. Tests

| Contract | Test |
|---|---|
| Plate contrast, both themes | `packages/ui/src/tokens/map-contrast.test.ts` |
| Padding never exceeds the canvas | `chrome-padding.test.ts`, 6 viewports × 8 panel combinations |
| `curve: 1.42` on every flight | `camera-moves.test.ts` |
| `fitBounds` throw degrades, does not kill | `camera-moves.test.ts` |
| Reduced motion zeroes every duration | `camera-moves.test.ts` |
| `essential` only on reader-triggered moves | `camera-moves.test.ts` |
| Refused move is a silent no-op | `camera-moves.test.ts` |
| Dignity gate over the kind × tone grid | `camera-dignity.test.ts` |
| Density floor, ordering, empty decades | `decade-density.test.ts` |
| Corridor count, CONUS bounds, honesty note | `migration-corridors.test.ts` |
| Citation stability, UTC accessed date | `lib/citation/format.test.ts` |
| No viewport key can be emitted | `lib/share/deep-link.test.ts` |
| Empty state always names cause and fix | `components/patterns/empty-state.test.ts` |

New test files under `apps/web` **must be registered** in `apps/web/package.json`'s `test` script. It is a hand-maintained file list, not a glob, and an unregistered test silently never runs.
