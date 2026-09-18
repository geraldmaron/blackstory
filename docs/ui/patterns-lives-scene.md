# Lives scene pattern

**Status:** reusable surface pattern (2026-09-16).
**Scope:** hand-drawn street and sourced decade material on `/lives`, bound to published Lives cells. Not destination wayfinding.

## Intent

A reader choosing region, decade, and emphasis sees housing, school, work, and era vehicles change with published rates. Only published, wide-margin, modeled, or clearly labeled era-costume layers render. Captions name universe and status. The SVG is `aria-hidden`; the caption list is the accessible equivalent. `LivesCountSight` explains census absences without turning them into empty scenery. Authored archive beats appear only when they carry sourced content. Missing future beats do not render as a catalog of construction states.

## Components

| Module | Role |
|---|---|
| `components/patterns/sketch/sketch-path.ts` | Deterministic wobble rects, hatch, house/school/vehicle paths |
| `components/lives/scene/lives-scene-model.ts` | Maps cells → layer density and captions |
| `components/lives/scene/LivesScene.tsx` | Renders the street + captions |
| `components/lives/LivesPlaceAnchors.tsx` | Two or three illustration places per region (never city rates) |
| `app/lives/lives.css` | Scene, anchors, and world-beat styles |

## Rules

- Cover-lock hand: hatch fills, no shadows, glows, or gradients.
- Emphasis is weight and a copper inset rule, never color alone.
- Pending, suppressed, not-measured, and absent cells do not render as scene objects.
- Vehicles are era costume unless a race-crossed commute table is ingested and labeled as commute.
- Modeled affordance hatch only when a same-year formula ran.
- DestinationIcon stays wayfinding; it is not the decade picture.
- Place anchors are two or three complementary catalog places. Do not soften a region into one metro.
- Unit and class tier are not reader controls. The figures already state their universes and show every class band.
- The archive-beat area is additive. Render sourced beats; omit generic domain gaps. An explicit historical absence belongs in an authored panel with evidence of what was searched.
- Controls and decade links keep a 44px minimum target, a visible focus ring, and a text label beside every icon.

## Related

Method: `docs/methodology/lives-across-decades.md`. Gaps: `docs/research/lives-gap-and-sourcing.md`.
Destination icon: `patterns-destination-icon.md`.
