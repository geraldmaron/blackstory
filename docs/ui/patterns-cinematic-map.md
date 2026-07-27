# Cinematic Map Backdrop

**Status: Binding — reusable, cross-surface.** Supersedes the home-only "map behind hero" treatment in [`design-direction-v6-home.md`](./design-direction-v6-home.md) by generalizing it into one pattern every map-bearing surface shares. Builds on (does not replace) [`patterns-map-canvas.md`](./patterns-map-canvas.md) (persistent `MapStage`, ADR-017) and [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) (pin color/shape). Governed by [`brand.md`](./brand.md) (flat matte, copper discipline, dignity) and [`story.md`](./story.md) (voice).

Token contract: `--ds-easing: cubic-bezier(0.16, 1, 0.3, 1)`, `--ds-duration-fast 160ms` / `--ds-duration-base 280ms` / `--ds-duration-slow 480ms` (`packages/ui/src/styles/tokens.css`, `packages/ui/src/tokens/foundation.ts`, mobile `apps/mobile/src/ui/tokens/generated/motion.generated.ts`). Camera timings from `apps/web/src/lib/map-experience/camera-presets.ts` and mobile `apps/mobile/src/features/map/mapCamera.ts`.

---

## 1. What it is

A **persistent map plate sits behind the page content** on any surface that has geography. The map is a continuous cinematic backdrop, not a widget the reader has to fight. The reader scrolls the page normally; the map only takes gestures when the reader explicitly asks for it.

The pattern has exactly **three states**. Every adopting surface uses the same three; surfaces differ only in their copy and which camera presets they visit.

| State | What the reader sees | Map gestures | Page scroll |
|---|---|---|---|
| **Rest** (default) | Content over a locked, dimmed map. The map is framed on a relevant place and holds still (or drifts imperceptibly). | Locked (`pointer-events: none`) | Natural — the whole page scrolls |
| **Invite** (optional intro) | As the reader scrolls the first 1–3 "beats", the camera flies between framed places and preview-pulses the entity each beat names. Still no hand gestures. | Locked; camera is scroll-driven | Natural — scroll drives the camera |
| **Engaged** (hands-on) | The reader taps **Explore the map**. The scrim lifts, content recedes to a slim bar, the full surface takes touch. A single **✕ / Close** relocks and restores the content. | Live (pan/zoom/select) | Suspended while engaged |

**Rule of the pattern:** the map is *locked until invited*. This is what keeps scrolling natural and stops the "map flashes as if loading" problem (the plate mounts once, settles once, and is never re-initialized on scroll). See [repo-96j2](#) / [repo-mrmh](#) for the paint-stability fixes this pattern depends on.

### When to use

- Any surface with a `MapStage` behind editorial content: `/` (home), `/explore`, `/history`, `/entity/[id]` place context, and the mobile Explore tab.
- **Do not** use the Invite (scroll-scene) state on utility pages or dense index surfaces — those use **Rest → Engaged** only. Invite is for landing/narrative surfaces with a story spine.

---

## 2. Interaction contract (identical on web and mobile)

1. **Rest is the resting state.** Load into Rest. Never auto-engage. Never start hand-gesture capture without an explicit user action.
2. **Scroll is sacred.** In Rest and Invite, the marker/canvas layer is `pointer-events: none`. Vertical scroll must never be intercepted, on either platform. On mobile the map plate must not steal the scroll gesture from the content sheet.
3. **Engage is one control.** A persistent, always-visible **Explore the map** control (copper, ≥44px touch target) is the only way into Engaged. It is `position: sticky`/floating so it is reachable without scrolling.
4. **Relock is always available.** In Engaged, a **✕ / Close** control (≥44px, top-trailing) returns to Rest, deselects any entity, and restores the camera to the surface's home preset. `Escape` does the same on web.
5. **Selection is single-feature.** Selecting an entity toggles state on that one feature only. Deselecting touches only that feature. Neighbors never repaint. (This is the fix for the neighbor-flash bug; do not re-filter or re-encode the whole source on selection — use feature-state or a dedicated one-feature selection layer.)
6. **Selected entity shows a pulsing orientation ring.** Copper ring + Archive-Paper inner rim (dual signal on the dark plate). Static enlarged ring under reduced motion.

---

## 3. Motion grammar

Reuse the existing cinematic camera system; do **not** invent new easing.

- **Camera flights** use `camera-presets.ts` (web) / `mapCamera.ts` (mobile): `national` (2000–2600ms) → `state` (1600ms) → `locality`/`point` (1200ms), authored slow-out curve.
- **Chrome transitions** (scrim fade, content recede, control show/hide) use `--ds-duration-base` (280ms) with `--ds-easing`.
- **Selection pulse**: 1.8s ease-in-out loop, copper ring scales ~1→2.1 while fading 0.9→0.12. One ring, one feature.
- **Rest drift** (optional, home/landing only): ≤2% translate over ≥20s, disabled the moment a camera flight or Engaged begins so it never fights an authored transform.

### Reduced motion (mandatory)

Read platform preference: web `@media (prefers-reduced-motion: reduce)` (already collapses `--ds-duration-*` to `0.01ms` in `tokens.css`); mobile `apps/mobile/src/ui/useReduceMotion.ts`.

- Camera flights become cuts (`jumpTo` on web, non-animated `setCamera` on mobile) with full framing parity — same destination, no in-between.
- Pulse ring stops animating and renders as a static enlarged ring (opacity ~0.85, scale ~1.35).
- Rest drift is disabled entirely.
- Scrim/content transitions become instant.

---

## 4. Accessibility contract

- **Keyboard:** `Explore the map` and `Close` are real buttons in tab order. Entities are focusable in Engaged; `Enter`/`Space` selects; `Escape` closes. Focus moves to `Close` on engage and returns to `Explore the map` on close.
- **Focus-visible:** copper/paper `:focus-visible` ring on every control and entity.
- **Touch:** all controls ≥44px.
- **No color-alone:** selection is signaled by the ring *and* the label chip, not hue alone. Entity kind still carries its glyph per `patterns-map-entity-encoding.md`.
- **Announce state:** engage/close toggles `aria-pressed`; the map region gets an `aria-label` that names the current framing.
- **Locked map is inert to AT:** in Rest/Invite the marker layer is `aria-hidden` and non-focusable so screen-reader and keyboard users are not trapped in a map they cannot yet use.

---

## 5. Paint order & pointer-events (web)

Extends the contract in `apps/web/src/app/(map)/map-surfaces.css`.

```
z 0   .ds-map-stage        persistent MapLibre canvas (ADR-017), fixed plate
z 1   .ds-map-scrim        gradient legibility scrim; opacity 1 (Rest) → 0 (Engaged)
z 2   .ds-cinematic-content page content / beats; pointer-events pass through to scroll
z 3   .ds-cinematic-rail    Explore-the-map control (sticky), Close (Engaged only)
```

- Rest/Invite: `.ds-map-stage` markers `pointer-events: none`; content scrolls.
- Engaged: scrim `opacity: 0`, markers `pointer-events: auto`, and the page recedes — see below.
- Never use `clip-path` to inset the map (WebGL reliability) — use fixed viewport geometry via `hero-map-inset.ts` `applyHeroMapInset()` / `clearHeroMapInset()`.

**Engaged recedes the whole document, not just the route's copy.** `CinematicMapProvider` mirrors Engaged onto `<html>` as `data-cinematic-engaged`, and `cinematic-map.css` keys off `:root[data-cinematic-engaged]` to fade + `visibility: hidden` the site header, the site footer, anything the route marks `data-cinematic-recede`, and the route's `edition-atmosphere` wash; it also suspends document scroll and pins `.ds-cinematic-rail` to the viewport. Fading only `.ds-cinematic-content` leaves the surrounding page legible over a live map, which reads as "the map zoomed in on top of the page" rather than a transition into it.

**The plate's geometry change is animated, and the camera is fitted after it lands.** `animateHeroMapPlate()` (`hero-map-inset.ts`) transitions the plate box between hero-inset and full-bleed, resizing the GL buffer every frame so the canvas does not stretch, and runs the camera fit only once the box has stopped moving — a fit computed mid-flight lands off-centre. Reduced motion skips straight to the destination.

## 5b. Sheet & pointer-events (mobile)

- Map plate is the base layer; content rides in `AppBottomSheet` (`apps/mobile/src/ui/AppBottomSheet.tsx`) via the Explore wrapper (`apps/mobile/src/features/map/explore/ExploreBottomSheet.tsx`).
- Rest = sheet at peek/half snap over a locked map; the sheet owns vertical scroll, the map does not capture drags behind it.
- Engaged = sheet collapses toward peek and the map gains gestures; **Explore the map** lives in the sheet, **Close** floats top-trailing.
- Pass `reduceMotion` from `useReduceMotion.ts` into `AppBottomSheet` and every camera call.

---

## 6. Reusable module (to build)

Web reusable family under `apps/web/src/components/patterns/cinematic-map/` (import CSS once per route):

| Export | Kind | Role |
|---|---|---|
| `CinematicMapProvider` | context | Holds `state: 'rest' \| 'invite' \| 'engaged'`, `selectedEntityId`, and the camera driver. One per route with a `MapStage`. |
| `useCinematicMap()` | hook | `{ state, engage(), close(), select(id), deselect(), flyTo(preset) }`. `select`/`deselect` mutate a single feature only. |
| `ExploreMapControl` | component | The copper "Explore the map" button (sticky). ≥44px, `aria-pressed`. |
| `CinematicScrim` | component | Gradient scrim; binds opacity to state. |
| `MapIntroBeat` | component | One Invite beat: on scroll-into-view it calls `flyTo(preset)` + `select(entityId)`. Uses `IntersectionObserver`; guarded so it is inert while `engaged`. |
| `cinematic-map.css` | styles | Scrim, rail, engaged transitions — `--ds-*` tokens only. |

Mobile reuses `AppBottomSheet` + `mapCamera.ts`; add a `useCinematicMap` equivalent in `apps/mobile/src/features/map/` that drives the same three states and the single-feature selection.

Selection paint (both platforms) must go through the map's **feature-state / dedicated selection layer**, never a whole-source refilter. See `apps/mobile/src/features/map/entity-paint.ts` and web `explore-style.ts`.

---

## 7. Do / Don't

**Do**
- Load into Rest; keep the map locked until the reader taps Explore.
- Mount the map once and reuse it (`MapStage`); animate the camera, never remount.
- Toggle selection on a single feature; keep neighbors untouched.
- Give every camera move a reduced-motion cut with identical framing.

**Don't**
- Don't capture pan/zoom under scrolling content.
- Don't re-encode the GeoJSON source or re-filter all pins on select/deselect.
- Don't animate the Rest drift and an authored camera flight on the same element at once.
- Don't add bevels, glows, or shadows to the plate or rings (brand: flat matte).
- Don't use the Invite/scroll-scene state on utility or dense-index surfaces.

---

## 8. Copy

Per [`story.md`](./story.md): evidence-before-assertion, sentence case, no em dashes on the surface.
- Engage control: **Explore the map**.
- Close control: **Close** (icon ✕ with `aria-label="Close map"`).
- Invite beats: name a place and what happened there; the map is the index, not decoration.

---

## 9. Tests

- Pure state machine (`rest → invite → engaged → rest`) and single-feature selection reducer — unit tested (mirror `browse-mode.test.tsx`).
- Reduced-motion branch: assert cuts (`jumpTo`/instant) replace flights.
- Pointer-events: assert markers are inert in Rest and live in Engaged.
- A11y: focus moves to Close on engage and back on close; Escape closes (web).

---

## 10. Adoption checklist (per surface)

1. Wrap the route's `MapStage` in `CinematicMapProvider`; render `CinematicScrim` + `ExploreMapControl`.
2. Choose the surface's home camera preset and, if a landing/narrative surface, its Invite beats (`MapIntroBeat` list).
3. Wire selection through feature-state; confirm deselect leaves neighbors unchanged.
4. Verify reduced motion, keyboard, 44px targets, light + dark.
5. Add the surface to the adopters table in [`patterns-registry.md`](./patterns-registry.md) and cite this doc in the surface's `design-direction-v6-*.md`.
6. Mobile: verify on a Release build via `pnpm mobile:ios:verify` (not Metro).
