# v9 Atlas — implementation plan for delegated agents

**Companion to:** [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md) (the design law)
**Reference build:** [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) (runnable; open it before writing any code)
**Written:** 2026-07-30
**Target executors:** Claude Sonnet and Claude Haiku subagents, one work package per agent.

---

## 0. How to use this document

Each work package (WP) is scoped to **one agent, one session, one commit**. A WP names its model tier, its dependencies, the exact files it may touch, what "done" means, and what it must not do.

**Model tiers:**

| Tier | Give it | Rationale |
|---|---|---|
| **Haiku** | Pure functions, token tables, CSS extraction, data builders, unit tests against a stated contract, doc and copy sweeps | Output is fully determined by the spec. No design judgement required. |
| **Sonnet** | React components, state wiring, camera choreography, a11y semantics, integration, monolith decomposition | Requires holding several files in context and making local judgement calls. |

Do not send a Sonnet package to Haiku. Packages are marked; the mark is binding.

---

## 1. Shared agent preamble

**Paste this into every agent prompt, verbatim, above the WP body.**

> You are implementing one work package for the BlackStory v9 Atlas redesign.
>
> **Read first, in this order:**
> 1. `docs/ui/design-direction-v9-atlas.md` — the binding design law
> 2. `docs/ui/brand.md` — tokens, palette, type, dignity rules (still binding, unchanged)
> 3. `.design-mocks/blackstory-atlas-v9.html` — the reference implementation. Open it in a browser. Your output should match its behavior, not its code structure.
> 4. The specific files listed in your work package
>
> **Repo rules, non-negotiable:**
> - Task tracking is **beads** (`bd`). Never TodoWrite, never markdown TODO lists. `bd update <id> --claim` before you start, `bd close <id>` when done.
> - Never push to `main`. Work lands on `staging`. `git pull --rebase origin staging` → `git push origin HEAD:staging`.
> - **Never add a `Co-Authored-By` line or any AI attribution trailer to a commit message.** Summary and body only.
> - Never invent a second variant of an existing hook, component or utility. Search first (`rg`), extend the original.
> - Never commit entity or catalog data. That lives in Supabase only.
> - No bead ids (`repo-…`) in user-facing copy, comments that ship, or error strings.
>
> **Code rules:**
> - CSS uses `--ds-*` tokens. No raw hex in component CSS. New tokens go in `packages/ui/src/styles/tokens.css` and are mirrored in `packages/ui/src/tokens/colors.ts`.
> - Tests are `node:test` + `node:assert/strict`, colocated as `<name>.test.ts`. Follow `apps/web/src/app/explore/explore-panel-chrome.test.ts` for style.
> - TypeScript is strict with `exactOptionalPropertyTypes`. Build conditional object properties with spread (`...(x ? { k: x } : {})`), not `k: x | undefined`.
> - No em dashes in user-facing copy. Use "to" for ranges, middle dots for compound labels.
>
> **Definition of done — all five must pass before you close the bead:**
> ```bash
> pnpm lint && pnpm typecheck && pnpm test:js && pnpm test:a11y && pnpm format:check
> ```
> `pnpm lint` runs with `--max-warnings 0`. A warning is a failure.
>
> **Verification is not optional.** Run the dev server (`pnpm dev:web`, port 3048) and confirm your change in the browser at 375px, 768px and 1440px before claiming done. If you cannot verify something, say so explicitly and name the residual risk. Never report untested work as complete.
>
> **Dignity rules apply to everything you build.** No alarm hues, no crime-heat rendering, no camera drama on violence-adjacent records, no point rendered sharper than its stored precision, no anonymous decoration.

---

## 2. Current-state facts your agents will need

Verified 2026-07-30 against `staging`.

| Fact | Value |
|---|---|
| Web app | `apps/web`, Next.js 16.2.11, webpack, dev port 3048 |
| Map engine | `maplibre-gl@^5.24.0` |
| Tiles | `https://tiles.openfreemap.org/planet`, glyphs `.../fonts/{fontstack}/{range}.pbf` |
| Available glyph stacks | `Noto Sans Regular`, `Noto Sans Bold`, `Noto Sans Italic` |
| Records in active release | 4,078 (4,075 pinned, 49 states, 1630s to 2020s) |
| **`ExploreMapExperience.tsx`** | **2,207 lines** — monolith, decomposition target |
| **`MapStage.tsx`** | **2,087 lines** — monolith, decomposition target |
| `map-surfaces.css` | 1,263 lines |
| `explore.css` / `explore-edition.css` | 701 / 360 lines |
| Existing camera system | `apps/web/src/lib/map-experience/camera-presets.ts` — exports `CAMERA_PRESETS`, `REDUCED_MOTION_CAMERA_PRESETS`, `CAMERA_EASING_SLOW_OUT` (cubic-bezier .16,1,.3,1), `cameraPresetFor()`, `MAP_MIN_ZOOM` 3, `MAP_MAX_ZOOM` 14, `CAMERA_POINT_ZOOM` 13, `prefersReducedMotion()` |
| Existing map-state machine | `apps/web/src/components/patterns/cinematic-map/cinematic-map-state.ts` (Rest → Invite → Engaged) |
| Existing encoding | `lib/map-experience/kind-encoding.ts`, `kind-icons.ts`, `confidence-icons.ts`, `marker-size.ts`, `geo-precision.ts` |
| Existing patterns | `components/patterns/`: `RecordBrowseControls`, `BrowseModeToggle`, `EditionFactIcon`, `RecordAnatomyPanel`, `RecordPlacePreview` |
| Existing search | `lib/typeahead/match.ts`, `components/typeahead/TypeaheadCombobox.tsx` — **reuse for the palette, do not write a new matcher** |
| Doc index to update | `docs/ui/README.md` pattern table |

---

## 3. Phase map

```
P0  Foundations        WP-01 … WP-04     no UI change, unblocks everything
P1  Camera             WP-05 … WP-08     the headline capability
P2  Chrome             WP-09 … WP-15     the instrument surfaces
P3  Record + QoL       WP-16 … WP-20     save, cite, share, sheet
P4  Story mode         WP-21 … WP-22     scroll cinema
P5  Consolidation      WP-23 … WP-28     decompose monoliths, mount, retire v6, docs
```

> **Amended 2026-07-30.** P5 originally ran WP-23 … WP-26 and made WP-23 responsible for both
> decomposing `ExploreMapExperience.tsx` *and* composing the new instruments into it. Those two
> jobs contradict each other: WP-23 is specified behavior-preserving with "an edited existing
> test is the stop signal" (§5), but mounting chrome that a surface has never had is a behavior
> change and will require editing existing tests. An agent following the original package could
> not satisfy both halves.
>
> The two jobs are now separate. **WP-23 decomposes only.** **WP-27 mounts.** A second gap fell
> out of the same review: eleven built modules had no package that mounted them at all, and the
> `--ds-map-*` plate tokens had no package that wired them, so **WP-28** now owns the plate.
> Nothing built in P0 to P4 reaches a reader until WP-27 and WP-28 run.

Phases are gates. Do not start P1 until every P0 package is closed and green.

**Parallelism:** inside a phase, packages with no shared files may run concurrently. The `Touches` list is the lock — two agents must never hold the same file.

---

## P0 — Foundations

### WP-01 · Map plate legibility tokens — **Haiku**

**Depends on:** nothing.
**Touches:** `packages/ui/src/styles/tokens.css`, `packages/ui/src/tokens/colors.ts`.

Add the nine `--map-*` roles from design-direction-v9-atlas.md §3 to both `[data-theme='light']` and `[data-theme='dark']` blocks, and mirror them in `colors.ts` so the TS and CSS token sets stay in sync (the file header already requires this).

Exact values are in §3 of the design doc. Copy them; do not re-derive.

**Acceptance:**
- Both theme blocks carry all nine roles
- `colors.ts` exports match the CSS values character for character
- No existing token is renamed or removed

**Test:** none of its own. WP-02 tests these values.

**Do not:** touch any map style file. Tokens only.

---

### WP-02 · Map contrast contract test — **Haiku**

**Depends on:** WP-01.
**Touches:** `packages/ui/src/tokens/map-contrast.test.ts` (new).

Write a `node:test` suite that imports the map roles from `colors.ts` and asserts, for **both** themes:

1. `|L(land) − L(water)| ≥ 18`
2. `|L(land) − L(line)| ≥ 18`
3. `|L(land) − L(line2)| ≥ 24`
4. `|L(label) − L(land)| ≥ 40`
5. `contrast(labelHi, land) ≥ 4.5`

`L` is CIE relative luminance scaled 0–100. `packages/ui/src/tokens/contrast.ts` already exists — **read it first and reuse its helpers**; only add a luminance helper if one is genuinely absent.

**Acceptance:** `pnpm --filter @repo/ui test` passes; deliberately breaking one token value makes it fail.

**Do not:** loosen a threshold to make a value pass. If a token fails, report it and stop — the token is wrong, not the test.

---

### WP-03 · Camera padding clamp — **Haiku**

**Depends on:** nothing.
**Touches:** `apps/web/src/lib/map-experience/chrome-padding.ts` (new), `chrome-padding.test.ts` (new).

Extract the instrument-padding calculation from the mock (`chromePadding()`) into a pure, testable function.

```ts
export type ChromeInset = { top: number; right: number; bottom: number; left: number };
export type ChromeState = {
  viewportWidth: number;
  viewportHeight: number;
  lensOpen: boolean;
  resultsOpen: boolean;
  sheetOpen: boolean;
};
export function chromePadding(state: ChromeState): ChromeInset;
```

Rules, from design doc §4.2 rule 3:
- Narrow (`viewportWidth < 820`): `{ top: 88, bottom: min(210, h*0.3), left: 16, right: 16 }`
- Wide: `left = lensOpen ? 330 : 40`; `right = sheetOpen ? 468 : resultsOpen ? 376 : 40`
- **Clamp:** if `left + right > viewportWidth * 0.5`, scale both by `k = (viewportWidth * 0.5) / (left + right)`
- `top = 96`, `bottom = round(min(160, viewportHeight * 0.22))`
- If `top + bottom > viewportHeight * 0.5`, fall back to `{ top: 40, bottom: 40 }`

**This is a real bug fix, not hygiene.** MapLibre throws `Map cannot fit within canvas with the given bounds, padding, and/or offset` when padding exceeds the canvas, and the throw kills map init entirely.

**Test (all required):**
- 320×568, 375×812, 768×1024, 1024×768, 1440×900, 1920×1080
- every combination of `lensOpen` / `resultsOpen` / `sheetOpen`
- assert in every case: `left + right < viewportWidth` **and** `top + bottom < viewportHeight`
- assert the clamp actually engages at 1024 with all panels open

---

### WP-04 · Map label name expression — **Haiku**

**Depends on:** nothing.
**Touches:** `apps/web/src/lib/map-experience/label-expression.ts` (new) + test; call sites in `apps/web/src/app/map/explore-style.ts` and `apps/web/src/lib/map-experience/entity-location-map-style.ts`.

Export:
```ts
export const MAP_LABEL_NAME_FIELD = [
  'coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name'],
] as const;
```

Replace every `'text-field': ['get', 'name:en']` (or bare `['get','name']`) in the two style files with this constant.

**Why:** OpenMapTiles ships localised name fields inconsistently across planet releases. Pinning `name:en` silently drops a large share of labels — confirmed in the mock.

**Acceptance:** `rg "get', 'name:en'" apps/web/src` returns only the constant's own definition.
**Test:** assert the exported expression shape and that both style builders reference it.

---

## P1 — Camera

### WP-05 · Camera move library — **Sonnet**

**Depends on:** WP-03.
**Touches:** `apps/web/src/lib/map-experience/camera-moves.ts` (new) + test.

Implement the six moves from design doc §4.1 as a library over an injected map handle. **Extend `camera-presets.ts`; do not duplicate its easing or zoom constants.**

```ts
export type CameraMove = 'wide' | 'push' | 'orbit' | 'tilt' | 'spotlight' | 'trace' | 'flyToRecord';
export type CameraDeps = {
  map: MapLike;                 // minimal structural type: flyTo/easeTo/fitBounds/getZoom/getBearing/getPitch/getCenter
  padding: () => ChromeInset;
  reducedMotion: () => boolean;
  announce: (text: string) => void;
};
export function createCamera(deps: CameraDeps): Record<CameraMove, (arg?: unknown) => void>;
```

Requirements, each individually testable:
- Every `flyTo` passes `curve: 1.42`. No exceptions, no per-call-site tuning.
- Every `fitBounds` is wrapped in try/catch with an `easeTo` fallback to `[-96.5, 38.6] z3.6`.
- `reducedMotion()` true ⇒ all durations 0.
- `essential: true` only on reader-triggered moves. Never on ambient or scroll-driven ones.
- `announce()` fires on every move with the `"Move · detail"` shape.
- Any in-flight scripted move is cancellable; expose `cancel()`.

**Test:** a fake `MapLike` recording calls. Assert curve on every flyTo, zero durations under reduced motion, fallback engages when `fitBounds` throws, `essential` flags are correct per move.

**Do not:** touch `MapStage.tsx` in this package. Library only.

---

### WP-06 · Dignity gate on camera moves — **Sonnet**

**Depends on:** WP-05.
**Touches:** `apps/web/src/lib/map-experience/camera-dignity.ts` (new) + test; wire into `camera-moves.ts`.

Implement design doc §4.3 as an enforced gate, not a convention.

```ts
export function allowedMovesFor(record: RecordLike): ReadonlySet<CameraMove>;
```

- A record whose kind, tone or theme marks it violence-adjacent (lynching, massacre, riot-with-fatalities, destruction, sundown enforcement) permits **only** `wide`, `flyToRecord` and `tilt`.
- `push`, `orbit`, `trace` and `spotlight` are refused for those records. A refused move is a silent no-op plus a dev-only `console.warn`, never a user-facing error.
- `spotlight` is refused for any `kind === 'person'` record regardless of tone.

Derive the violence-adjacent predicate from the existing catalog vocabulary — read `lib/map-experience/kind-encoding.ts` and `packages/domain` tone/theme enums first. **Do not invent a new taxonomy.**

**Test:** table-driven over each kind × tone combination. Assert `spotlight` never appears for `person`. Assert a lynching record permits exactly `{wide, flyToRecord, tilt}`.

---

### WP-07 · Annotation overlay — **Sonnet**

**Depends on:** WP-05.
**Touches:** `apps/web/src/components/map-experience/AnnotationOverlay.tsx` (new), `annotation-overlay.css` (new), `lib/map-experience/arc-geometry.ts` (new) + test.

An SVG layer over the map that reprojects on `move`.

`arc-geometry.ts` is pure and separately testable:
```ts
export function arcPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { d: string; length: number };
```
Quadratic bezier; control point offset perpendicular from the midpoint by `min(distance * 0.22, 190)`.

The component:
- `position: fixed; inset: 0; pointer-events: none; z-index: 5`
- Subscribes to `map.on('move')`, reprojects via `map.project()`
- Draws corridors with `stroke-dasharray` draw-on, 130ms stagger between arcs
- Endpoint dots and mono uppercase labels with `paint-order: stroke` halos
- Alternating `.an-arc` / `.an-arc.soft` weight so a dense field stays readable
- Cleans up its listener on unmount

**Test:** `arc-geometry.test.ts` only — assert the path starts at `a`, ends at `b`, lift is clamped at 190, and a zero-length input does not divide by zero.

**Do not:** put migration data in this component. It renders what it is given. Data comes from WP-08.

---

### WP-08 · Migration corridor data — **Haiku**

**Depends on:** nothing.
**Touches:** `apps/web/src/lib/map-experience/migration-corridors.ts` (new) + test.

Export the seven documented Great Migration corridors as origin/destination metro pairs with labels: New Orleans→Chicago, Jackson→Chicago, Birmingham→Detroit, Atlanta→New York, Houston→Los Angeles, Charleston→Philadelphia, Memphis→St. Louis.

Each entry carries `from`, `to`, `fromLabel`, `toLabel`, and a required `note` field holding the honesty line from design doc §6:

> Corridors are illustrative of documented migration streams, drawn between origin and destination metros. Not individual paths.

**Acceptance:** coordinates are metro-centroid accurate to ~0.05°; every entry has a non-empty `note`.
**Test:** assert seven entries, all coordinates inside CONUS bounds, all notes present.

**Do not:** draw individual or family-level paths. These are aggregate streams, and the type must make that impossible to misuse.

---

## P2 — Chrome

### WP-09 · Command palette — **Sonnet**

**Depends on:** WP-05.
**Touches:** `apps/web/src/components/patterns/command-palette/` (new dir): `CommandPalette.tsx`, `command-palette.css`, `command-registry.ts`, `command-registry.test.ts`.

Per design doc §7. **Reuse `lib/typeahead/match.ts` for matching — do not write a second matcher.**

- Opens on `⌘K` / `Ctrl+K` / `/` (when not typing) / bar trigger
- Three result sections: Records, Jump to state, Actions
- `↑`/`↓` move, `↵` opens, `⌘↵` opens and flies, `ESC` closes and restores focus
- Matched substring wrapped in `<mark>`
- `role="dialog" aria-modal="true"`, focus trapped, focus restored to the trigger on close
- Footer shows the key legend and the indexed record count

`command-registry.ts` is a pure, testable list of actions: `{ id, title, section, keys, run }`. Every camera move from WP-05 registers here so the palette and the console never drift.

**Test:** registry contract only — every action has a unique id, a non-empty title, and a `keys` entry that matches the shortcut sheet in WP-15.

---

### WP-10 · Command bar — **Sonnet**

**Depends on:** WP-09.
**Touches:** `packages/ui/src/styles/shell-header.css`, `apps/web/src/components/shell/CommandBar.tsx` (new). Read `SiteHeader` first and **extend it** rather than adding a parallel header.

Per design doc §5.1. Three-zone grid: brand · `⌘K` trigger · tools (mode switch, Saved with count badge, Shortcuts, Theme).

The 14-destination nav collapses. Destinations that leave the bar (Data, Law, Banned books, Memorial, Methodology, Corrections, Errata, Submit) must all be reachable from the palette **and** the site footer before this ships — verify both, and list the verification in your close notes.

**Acceptance:** no route becomes unreachable. Confirm by walking every entry in `docs/ui/README.md`'s pattern table.

---

### WP-11 · Lens panel — **Sonnet**

**Depends on:** WP-01.
**Touches:** `apps/web/src/components/map-experience/LensPanel.tsx` (new), `lens-panel.css` (new). Reads existing facet state from `app/explore/explore-view-model.ts` — **do not fork the view model.**

Per design doc §5.2. Six groups in one scrolling panel; the v6 Filters/Color-key tabs are removed.

- Kind chips carry glyph + label + live count, `aria-pressed`
- Evidence floor chips carry their grade dot
- Presence bars: `--sand` track filling to `--copper-graphic` on hover, mono count right-aligned
- Auto-apply, no Apply button (carried from v6)
- Reset offers undo via toast
- Bottom fade appears when content continues below the fold

**Test:** extend `explore-view-model.test.ts` for any new selector you add. No new view model.

---

### WP-12 · Results rail — **Sonnet**

**Depends on:** WP-01.
**Touches:** `apps/web/src/components/map-experience/ResultsRail.tsx` (new), `results-rail.css` (new).

Per design doc §5.3. `role="listbox"` / `role="option"` / `aria-selected`.

Row grid `18px 1fr auto`: kind glyph · name + meta · save. Meta is a single non-wrapping line with the place truncating via `text-overflow: ellipsis`; era and grade never truncate.

**Performance:** the rail must handle the full 4,078-record set. Virtualise or window it. `/history` currently renders 4,078 anchors in one document — do not repeat that.

**Test:** a11y roles present; selected row sets `aria-selected="true"` and exactly one row does at a time.

---

### WP-13 · Time histogram — **Sonnet**

**Depends on:** nothing.
**Touches:** `apps/web/src/components/map-experience/TimePanel.tsx` (new), `time-panel.css` (new), `lib/map-experience/decade-density.ts` (new) + test.

Per design doc §5.4. Replaces the v6 scrolling decade-tab rail.

`decade-density.ts` is pure: takes decade counts, returns normalized bar heights with a documented floor so a one-record decade is still visible.

The panel:
- `role="slider"` with `aria-valuemin` / `aria-valuemax` / `aria-valuenow` / `aria-valuetext`
- Pointer-capture drag to scrub; `←`/`→` step; `SPACE` play/pause
- Bar states: rest `--rule-strong`, in-range `--sand`, active `--copper-graphic`
- Playhead 2px copper with a 9px cap
- Sub-line reads `{n} records · status as-of this decade`

**Carried from v6, still binding:** decade views show status as-of that decade from published status history. Never present-day status backfilled.

**Test:** density normalization — a decade with 1 record and a decade with 340 both produce a visible bar; the floor is respected; ordering is chronological.

---

### WP-14 · Decade transition and sweep — **Sonnet**

**Depends on:** WP-13, WP-06.
**Touches:** `apps/web/src/lib/map-experience/decade-transition.ts` (new) + test; paint wiring in `app/map/explore-style.ts`.

Replaces v6's mandated hard snap with a 420ms `circle-opacity-transition` staggered pin change.

- Set `circle-opacity-transition: { duration: 420 }` on the pin layers
- `sweep(from, to, msPerDecade)` steps decades for story mode; 190ms normal, 400ms reduced motion
- The sweep renders **presence only**. It must not encode harm density, and WP-06's dignity gate applies.

**Test:** sweep emits decades in order, terminates, and respects the reduced-motion interval.

**Note:** this deliberately supersedes v6-explore §4.4's "snap, no morph" rule. Cite design-direction-v9-atlas §11 in the commit body.

---

### WP-15 · Shortcut sheet and keyboard layer — **Sonnet**

**Depends on:** WP-09.
**Touches:** `apps/web/src/components/patterns/ShortcutSheet.tsx` (new), `shortcut-sheet.css` (new), `lib/keyboard/bindings.ts` (new) + test.

`bindings.ts` is the single source of truth for every shortcut in design doc §7. The palette (WP-09), the camera console (WP-16) and this sheet all read from it. A shortcut defined in two places is a defect.

Global handler rules:
- Ignore when focus is in `INPUT` / `TEXTAREA` / `SELECT` or a `contenteditable`
- `⌘`/`Ctrl` combos handled before the bare-key switch
- `ESC` unwinds in order: palette → overlay → spotlight → sheet

**Test:** no duplicate binding across sections; every registry action in WP-09 has a binding or is explicitly marked palette-only.

---

## P3 — Record and quality of life

### WP-16 · Camera console — **Sonnet**

**Depends on:** WP-05, WP-06, WP-15.
**Touches:** `apps/web/src/components/map-experience/CameraConsole.tsx` (new), `camera-console.css` (new).

Per design doc §5.5. 3×2 grid of moves with keyboard chips, plus a compact zoom stepper in the header.

**Remove the MapLibre `NavigationControl`** from the explore map and move attribution to a bottom-left pill. Two zoom vocabularies on one map is the defect being fixed.

Active move gets `--copper-wash` for 2.2s. Moves refused by WP-06's dignity gate render disabled with a `title` explaining why.

**Verify in browser:** all six moves at 1440px and 375px; console must not collide with the time panel or attribution at either size.

---

### WP-17 · Record sheet — **Sonnet**

**Depends on:** WP-12.
**Touches:** `apps/web/src/components/map-experience/RecordSheet.tsx` (new), `record-sheet.css` (new). **Reuse `RecordAnatomyPanel` and `EditionFactIcon`** from `components/patterns/` — do not rebuild the anatomy grid.

Per design doc §5.6. Non-modal `role="dialog"`; the map stays pannable behind it.

Required, in order: top strip with prev/`n of N`/next/close · kicker · Sora name · serif story · 2×2 anatomy · precision note · four actions · numbered sources · connections.

The precision note is mandatory and reads exactly:
> Rendered at {precision} precision. The archive never draws a point sharper than the source supports.

Opening hides Results and flies the camera to the pin. Closing restores Results. `ESC` closes.

---

### WP-18 · Save and collections — **Sonnet**

**Depends on:** WP-17.
**Touches:** `apps/web/src/components/patterns/CollectionsDrawer.tsx` (new), `lib/collections/store.ts` (new) + test.

Per design doc §7. `localStorage`-backed, schema-versioned so a future migration is possible.

- Save/unsave with an undo toast
- Count badge on the bar
- Drawer lists saved records with kind glyph, place, era, grade
- `Copy all citations`, `Copy as GeoJSON`, `Clear list`

**Test:** store round-trips, tolerates corrupt JSON without throwing, and honors the schema version.

---

### WP-19 · Cite and share — **Haiku**

**Depends on:** nothing.
**Touches:** `apps/web/src/lib/citation/format.ts` (new) + test, `lib/share/deep-link.ts` (new) + test.

Citation format, exact:
```
"{name}." BlackStory Archive, {place}, {era}. Evidence grade {grade}, {n} sources. Accessed {YYYY-MM-DD}. {url}
```

Deep link carries `record`, `state`, `era`, `grade`, `kind`. It must **not** carry live pan/zoom — that is ADR-017 and it is binding.

**Test:** citation is stable for a fixed input and injected date; deep link round-trips through parse; assert no `lat`/`lng`/`zoom`/`bearing`/`pitch` key can appear in the output.

---

### WP-20 · Toasts, skeletons, empty states — **Haiku**

**Depends on:** nothing.
**Touches:** `apps/web/src/components/patterns/Toast.tsx` (new), `toast.css` (new), `skeleton.css` (new).

- Toast: 2.6s plain, 6s with an action, `role="status" aria-live="polite"`, stacks bottom-center above the Time panel
- Skeleton: `.sk` shimmer, 1.4s linear. Never a spinner.
- Empty state: names the cause and offers the fix. `"No records match this lens. Widen the evidence floor or clear the decade."` plus a reset button. Never a bare "no results".

**Test:** none required. Verify visually at all three breakpoints and in both themes.

---

## P4 — Story mode

### WP-21 · Story chapter engine — **Sonnet**

**Depends on:** WP-05, WP-07, WP-14.
**Touches:** `apps/web/src/components/story/StoryMode.tsx` (new), `story-mode.css` (new), `lib/story/chapters.ts` (new) + test.

Per design doc §6. `IntersectionObserver` at `threshold: 0.42` with `root` set to the story scroll container.

`chapters.ts` holds the six chapter specs as data — camera, spotlight, routes, focus, sweep flags. Pure and testable.

Reduced motion: chapters still advance, camera cuts instead of flying, sweep runs at 400ms, kinetic type is disabled.

**Test:** six chapters in order; every chapter's camera spec parses; chapter 3 carries the corridor honesty note from WP-08.

---

### WP-22 · Story copy and kinetic cold open — **Haiku**

**Depends on:** WP-21.
**Touches:** `apps/web/src/components/story/story-copy.ts` (new), kinetic type CSS in `story-mode.css`.

All six chapters' kicker, heading, prose, facts and citation lines. Draft copy is in the mock — refine it, keep the voice.

Voice rules, binding: no em dashes; sentence case body; mono uppercase for slugs only; one italic serif accent word per heading; people named with role and place; presence framed as presence, never as deficit.

Cold open: `History happened here.` split into word spans with 130ms stagger, `translateY(.4em) rotate(1.5deg)` → rest.

**Every factual claim in chapter prose needs a source.** Chapter 3's "six million people, 1910 to 1970" is the standard Great Migration figure and must carry its citation line. If you cannot source a claim, cut it.

---

## P5 — Consolidation

### WP-23 · Decompose `ExploreMapExperience.tsx` — **Sonnet**

**Depends on:** nothing. This package no longer waits on the chrome packages — see below.
**Touches:** `apps/web/src/app/explore/ExploreMapExperience.tsx` and new sibling modules.

2,207 lines to an orchestrator under 400. Extract state into hooks under `app/explore/hooks/`.

**Decomposition only. Do not mount anything new.** This package reorganizes the code that is
already there and nothing else. It does not import `LensPanel`, `ResultsRail`, `TimePanel`,
`CommandPalette`, `AnnotationOverlay`, `CameraConsole`, `RecordSheet` or `createCamera`. Mounting
those is WP-27, and keeping the two apart is what makes this diff reviewable: a 1,800-line
restructure with feature changes folded in cannot be bisected when something regresses.

**Behaviour-preserving only.** Every existing test must pass untouched; if a test needs editing,
you have changed behavior — stop and file a bead instead. That stop signal is only meaningful
because this package adds no features, which is why its dependency list is now empty.

---

### WP-24 · Decompose `MapStage.tsx` — **Sonnet**

**Depends on:** WP-23.
**Touches:** `apps/web/src/components/map-stage/MapStage.tsx` and new sibling modules.

2,087 lines. Split along: style building, source syncing, lifecycle (`map-libre-lifecycle.ts` already exists — use it), camera, event wiring. Same behavior-preserving constraint as WP-23.

---

### WP-25 · Route consolidation — **Sonnet**

**Depends on:** WP-10, WP-27. (Was WP-23; WP-27 is what actually makes `/` an Atlas.)
**Touches:** `apps/web/src/app/page.tsx`, `app/explore/page.tsx`, redirects.

`/` becomes the Atlas. `/explore` 308s to `/`. Story is a mode on `/`, not a route.

**This is the irreversible package.** Do not start it without explicit owner approval, and do not
start it before WP-27 has shipped and been looked at in a browser. Redirecting `/explore` to a `/`
that is still the old surface loses a working route and gains nothing.

**Before shipping:** every route in `docs/ui/README.md`'s pattern table must still resolve. Add a redirect test asserting `/explore` → `/` and that no previously-public URL 404s. Preserve SEO metadata and canonical tags.

---

### WP-26 · Docs and supersession — **Haiku**

**Depends on:** all of P0 to P5.
**Touches:** `docs/ui/README.md`, `docs/ui/design-direction-v6-home.md`, `design-direction-v6-explore.md`, `design-direction-v9-atlas.md`, `docs/ui/patterns-registry.md`, root `AGENTS.md` § UI Design Patterns.

- Flip v9's status line from `proposed` to `binding`
- Add a supersession banner to the top of v6 home and v6 explore
- Update the README pattern table: Atlas row replaces the Home and Explore rows
- Register every new `components/patterns/*` component in `patterns-registry.md` with its import path
- Update the `AGENTS.md` UI section to point at v9

**Do not** delete the v6 documents. They are the provenance record. Banner them.

---

### WP-27 · Atlas composition — **Sonnet**

**Depends on:** WP-05, WP-06, WP-07, WP-09, WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-23, WP-24.
**Touches:** `apps/web/src/app/explore/ExploreMapExperience.tsx`, `app/explore/hooks/`, `components/map-stage/MapStage.tsx` (props only), and the tests those changes break.

The package that makes the archive reachable. Everything P0 to P4 built is inert until this runs:
the modules exist, typecheck and have tests, but nothing renders a time panel, constructs a camera
or draws a corridor.

Mount, in this order, verifying in a browser after each:

1. `createCamera` against the live `MapStage` handle, wired to `chromePadding()` and the reduced
   motion query. Supply every `CameraDeps` member, including `setRoutes` and `setSpotlight`.
2. `CommandPalette` + `useCommandPaletteShortcut`, with a fully populated `CommandContext`. The
   context's members are required on purpose: if one has no real handler yet, that is a missing
   feature to file, not a no-op to stub.
3. `LensPanel`, `ResultsRail`, `TimePanel`, `CameraConsole`, `RecordSheet` over the existing view
   model.
4. `AnnotationOverlay`, fed `MIGRATION_CORRIDORS` and toggled by the same routes flag `trace()`
   sets.
5. Retire the v6 chrome the above replaces. Delete it; do not leave both mounted behind a flag.

**Behaviour changes here, and that is the point.** Existing tests for the v6 chrome will fail
because that chrome is gone. Editing or deleting those tests is expected in this package and only
in this package — the WP-23 stop signal does not apply. What must not change: record data, status
derivation, evidence grading, or any URL that previously resolved.

**Acceptance:** on `/explore`, a reader can open the palette with `⌘K`, run every Camera command
from the keyboard, scrub the decade histogram, toggle corridors and see arcs draw over the map.
Camera announcements reach the `role="status"` readout. `pnpm test:a11y` green.

**Do not** fold route consolidation in. That is WP-25, it is irreversible, and it needs its own
approval.

---

### WP-28 · Wire the map plate to the tokens — **Sonnet**

**Depends on:** WP-01.
**Touches:** `apps/web/src/lib/map-experience/dignity-style.ts`, `app/map/explore-style.ts`, `lib/map-experience/entity-location-map-style.ts`.

The `--ds-map-*` roles ship and are contract-tested, but no style builder reads them: the live map
still renders `plateForScheme()`'s palette from `dignity-style.ts`. The legibility defect the whole
plate rework exists to fix is therefore still on screen.

Make `mapPalettes` from `packages/ui/src/tokens/colors.ts` the single source for plate color and
delete the duplicate literals. MapLibre styles are JSON, not CSS, so the TypeScript export is the
source of truth and `tokens.css` is the mirror — not the other way round.

**Acceptance:** no plate hex literal survives outside `colors.ts`. Land and water separate by at
least 18 ΔL\* on the rendered map in both themes, checked against the design law §3 table.
Existing style tests pass or are updated to assert the token values rather than the old hexes.

---

## 4. Sequencing and parallelism

| Wave | Packages | Concurrent agents |
|---|---|---|
| 1 | WP-01, WP-03, WP-04, WP-08, WP-19, WP-20 | 6 (all Haiku except none — fully parallel, no shared files) |
| 2 | WP-02, WP-05, WP-13 | 3 |
| 3 | WP-06, WP-07, WP-09, WP-11, WP-12, WP-28 | 6 |
| 4 | WP-10, WP-14, WP-15, WP-16, WP-17 | 5 |
| 5 | WP-18, WP-21 | 2 |
| 6 | WP-22, WP-23 | 2 |
| 7 | WP-24 | 1 |
| 8 | WP-27 | 1 |
| 9 | WP-25 | 1 (owner approval required) |
| 10 | WP-26 | 1 |

WP-27 runs alone. It is the first package where the surface visibly changes, it touches files two
other packages just restructured, and it is the only place a regression in the new chrome can
surface — sharing a wave with it would make an unbisectable diff.

Waves are gates. Run `pnpm lint && pnpm typecheck && pnpm test:js && pnpm test:a11y` on `staging` between waves; a red wave blocks the next.

---

## 5. Risks and how they are controlled

| Risk | Control |
|---|---|
| Camera drama applied to violence-adjacent records | WP-06 is an enforced gate, not a review convention. It ships before the console (WP-16). |
| `fitBounds` throwing and killing map init | WP-03's clamp plus try/catch fallback in WP-05. Cost real debug time in the mock; do not skip. |
| Motion harming reduced-motion or vestibular users | Reduced motion collapses at both CSS and camera level. `M` gives an in-app calm toggle independent of OS setting. |
| Route loss during consolidation | WP-25 gates on the README pattern table plus a redirect test. |
| Monolith refactors changing behavior | WP-23 and WP-24 are behavior-preserving; an edited existing test is the stop signal. That signal only works because neither package mounts anything new — adoption is WP-27, where test edits are expected. |
| Packages that build modules nothing ever renders | WP-27 owns mounting and WP-28 owns the plate. Both were missing from the original plan, and without them every P0 to P4 package ships code no reader reaches. Treat "built and tested" as unfinished until one of those two consumes it. |
| Results rail repeating the `/history` 4,078-node problem | WP-12 requires windowing, called out explicitly. |
| Two agents colliding on a file | The `Touches` list is the lock. One writer per file per wave. |
| Copy drifting from the archive's voice | WP-22 restates the voice rules; unsourced claims get cut, not softened. |

---

## 6. What is deliberately not in scope

Named so no agent wanders into them:

- Mobile app (`apps/mobile`) — v6 mobile stays binding until a separate v9 mobile doc exists
- Admin app, API surfaces, ingestion, the beads tracker itself
- Any change to entity data, catalog status derivation, or living-status logic
- `/entity/[id]` full page — the sheet is a preview; the full record page keeps its v6 treatment for now
- Charts on `/data` — the census viz stays as-is this pass
- Anything requiring a new runtime dependency. If you believe one is needed, file a bead and stop.
