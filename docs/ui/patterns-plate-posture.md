# Plate posture

**Status: proposed (2026-07-30), binding when [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) is.** Law extracted from [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) sections 2 and 3, and demonstrated in the runnable reference build [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html) (`setPlate`, `frameMoment`, `pickMoment`, `lockGestures`).

Builds on, and does not replace: [`patterns-map-canvas.md`](./patterns-map-canvas.md) (single mount, WebGL lifecycle, ADR-017), [`patterns-atlas-instrument.md`](./patterns-atlas-instrument.md) (the Live posture in full), [`brand.md`](./brand.md) (map dignity, precision honesty).

---

## 1. The rule

One MapLibre plate mounts once in the root layout and never unmounts. It has exactly three declarative postures, and the posture is selected by the page's surface class (see [`patterns-surface-classes.md`](./patterns-surface-classes.md)), never by a component asking for one.

| Posture | Where | Geometry | Gestures | Camera |
|---|---|---|---|---|
| **Live** | Instrument | Fixed, full viewport, z 0 | Reader driven | All moves, subject to both dignity gates |
| **Framed** | Record page, chapter map moment | Inset into a bounded in-flow slot, z 26 | Locked until **Explore this place** | `flyTo` at stored precision only |
| **Parked** | Reading room by default, Utility always | Not painted, no GL cost on screen | None | None |

The plate is expressed as `data-plate` on the document root. `MapStageProvider` mounts data free, above the route group, so no navigation calls `map.remove()` and no route inherits `force-dynamic`. A provider that awaits release data before mounting makes the persistent plate a fiction, because every navigation tears the context down and rebuilds it.

---

## 2. The plate is never behind body text outside the Instrument

This is the rule most likely to be argued with, so the reasoning is written down.

A map behind prose is a decoration that costs a GL context, competes with the text for the reader's eye, and cannot be read as a map because the text is the thing in focus. Worse, it makes the page a claim it has not earned: a live map behind a paragraph implies the paragraph is about that view, and the camera has no way to know whether it is.

The Framed posture is the honest version of the same instinct. A bounded slot the reader scrolls to says "here is the geography of this passage", flies to a subject at stored precision, states the coarsening, and hands back the scroll. A full bleed plate says nothing and asserts everything.

**Enforcement is in CSS with a test, not in author discipline.** A test asserts no Live plate can sit behind a `.prose` column. A rule an author has to remember is a rule that ships broken on the fortieth chapter.

---

## 3. One Framed slot at a time

**A second Framed request while one is live is refused at runtime.** A chapter with several map moments spaces them so the plate is not thrashed, and a static seeded placeholder covers the inactive ones.

Which slot owns the plate is computed from the DOM on every scroll frame, not accumulated from `IntersectionObserver` callbacks. An entry-set diff gets this wrong the moment two figures cross a threshold in the same frame, and the failure mode is a plate stranded at a slot that has scrolled away. The reference build takes the slot with the greatest visible fraction above a 0.55 floor and frames that one.

The slot's rect is re-synced on scroll and resize through a single queued animation frame. The plate is fixed positioned and inset into the slot's box; it does not become a child of the document flow.

---

## 4. Gestures lock while Framed, and release on exit

Every gesture handler (`scrollZoom`, `dragPan`, `dragRotate`, `touchZoomRotate`, `doubleClickZoom`, `keyboard`) is disabled the moment the posture leaves Live, and re-enabled the moment it returns.

Two reasons, both load-bearing:

1. A pannable map inside a scrolling column steals the scroll gesture. On touch, a reader trying to get past a map moment gets a zoom instead.
2. A Framed plate is a citation, not an instrument. It is showing one subject at one precision. Letting the reader drag away from that subject inside a paragraph produces a view nobody authored and nothing explains.

**Release on exit is mandatory.** When the last Framed slot leaves the viewport, or the reader navigates away, the plate returns to Parked and every gesture handler is restored. A plate left locked after its slot is gone is the same defect as a plate left framed at a stale rect.

The reader's way out is a named control: **Explore this place** on a record page, or the map moment's open control in a chapter. Both hand the plate to the Atlas through the lens handoff builder (see [`patterns-lens-handoff.md`](./patterns-lens-handoff.md)), where it becomes Live and the reader gets the whole instrument.

Gate gesture and camera work on the map object existing, not on its `load` event. `load` is the right gate for reading rendered features and the wrong one for camera and resize: both are safe as soon as the object exists, and gating them on load leaves every map moment permanently inert behind a slow style fetch.

---

## 5. Reduced motion cuts, it does not fly

Under `prefers-reduced-motion`, a Framed slot `jumpTo`s its subject. It does not `flyTo`, and it does not pitch or bear.

The preference is read from a live `matchMedia` change listener, not once at boot. On a site that is one continuous session and never reloads, a one-shot read means a reader who enables Reduce Motion mid-session keeps full-motion camera work until they close the tab.

Dignity travels with it. A violence-adjacent subject gets a plain cut with no pitch and no bearing whether or not the reader has the preference set. The Framed posture never gets push in, orbit, spotlight, trace or the decade sweep; those belong to the Instrument.

---

## 6. Map failure degrades, it never leaves a blank rectangle

**A Framed slot with no plate must not render as an empty box.** If WebGL is unavailable, the style fetch failed, or the map object does not exist, the slot:

- keeps its caption, which is what actually carries the point
- states plainly that the map is unavailable, in words, in the slot
- leaves the posture Parked rather than framing nothing
- keeps its "open on the Atlas" control, because that path may still work

An empty bordered rectangle inside a paragraph reads as a broken image and tells the reader nothing about whether the archive still knows where the subject is. Every map moment is authored so its caption stands alone.

The same rule governs the Instrument, where map failure degrades to the accessible record list plus the link to `/records`, never a blank screen.

---

## 7. The z ladder

One token ladder, replacing the three scales that exist today.

| Layer | z |
|---|---|
| Map plate | 0 |
| Annotation overlay | 5 |
| Spotlight | 6 |
| Grain | 7 |
| Instruments | 20 |
| Document layer | 24 |
| **Framed plate** | **26** |
| Record sheet | 40 |
| Command bar | 50 |
| Overlays | 90 |
| Toasts | 95 |
| Skip link | above all |

The Framed plate sits above the document layer because it is inset into that layer's flow, and below the record sheet because a sheet opened over a record page must cover it.

**Two shell defects break the plate's containing block and are fixed with the postures.** A transform-based page enter animation with `animation-fill-mode: both` leaves a permanently non-none computed transform on the page wrapper, which makes that wrapper the containing block for the fixed plate. Plate geometry, the light theme background, MapLibre control restyling and the pointer-events contract belong in the shell stylesheet, not in a route-scoped one.

---

## 8. Do / Don't

**Do**

- Select the posture from the surface class, server side
- Compute the owning Framed slot from the DOM each frame
- Lock every gesture handler when the posture is not Live, and restore all of them on release
- Fly at stored precision only, and state the coarsening in the slot
- Give a failed plate words in the slot and keep the caption

**Don't**

- Paint a Live plate behind a `.prose` column on any surface class
- Let two Framed slots be live at once
- Mount a second MapLibre instance for an inline map, which is what `EntityLocationMap` and `MapInsetMoment` do today, and which SP-08 replaces
- Read `prefers-reduced-motion` once at boot
- Leave a Framed slot as a blank rectangle when the map is unavailable
- Put a spotlight, orbit, push in, trace or sweep on a Framed plate

---

## 9. Modules

| Concern | Module | Status |
|---|---|---|
| Persistent plate | `components/map-stage/MapStage.tsx`, `lib/map-experience/map-libre-lifecycle.ts` | Built, mounted inside the route group; hoisting is SP-07 |
| Posture switch | `data-plate` on the document root, shell stylesheet | Pending (SP-07, SP-08) |
| Framed slot in prose | `components/theme-spine/MapInsetMoment.tsx` | Built, but mounts a second MapLibre instance via `EntityLocationMap`; converted to borrow the persistent plate in SP-08 |
| Record place frame | `components/patterns/RecordPlacePreview.tsx` | Built |
| Camera vocabulary | `lib/map-experience/camera-moves.ts`, `camera-presets.ts` | Built |
| Dignity gate | `lib/map-experience/camera-dignity.ts` | Built, move level only; the composition gate is SP-18 |
| Live reduced motion | `lib/motion/use-reduced-motion.ts` | Pending (SP-18); `prefersReducedMotion()` is a one-shot read today |

---

## 10. Tests

| Contract | Assertion |
|---|---|
| Plate never behind prose | No Live plate can sit behind a `.prose` column, asserted in CSS |
| Containing block | A rendered DOM test asserts the plate's containing block is the viewport on every surface class |
| Persistence | Navigating between `/`, `/records`, `/entity/[id]` and `/chapters` never calls `map.remove()`, verified in the browser |
| One context | Exactly one WebGL context exists on a record page, verified in the browser |
| One Framed slot | A second Framed request while one is live is refused |
| Release | A Framed plate returns to Parked and re-enables every gesture on exit |
| Reduced motion | Enabling Reduce Motion mid-session changes camera behaviour without a reload |
| Failure | A Framed slot with no plate renders its caption and its unavailable line, not an empty box |

New test files under `apps/web` **must be registered** in `apps/web/package.json`'s `test` script. It is a hand-maintained file list, not a glob, and an unregistered test silently never runs.
