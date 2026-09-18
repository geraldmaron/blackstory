# Lives scene pattern

**Status:** reusable surface pattern (2026-09-16).
**Scope:** hand-drawn street on `/lives` bound to published Lives cells. Not destination wayfinding.

## Intent

A reader choosing region, lens, decade, and unit sees housing, school, work, and era vehicles change with published rates. Empty cells stay empty hatch. Captions name universe, unit, and status. The SVG is `aria-hidden`; the caption list is the accessible equivalent.

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
- Vehicles are era costume unless a race-crossed commute table is ingested and labeled as commute.
- Modeled affordance hatch only when a same-year formula ran.
- DestinationIcon stays wayfinding; it is not the decade picture.
- Place anchors are two or three complementary catalog places. Do not soften a region into one metro.

## Related

Method: `docs/methodology/lives-across-decades.md`. Gaps: `docs/research/lives-gap-and-sourcing.md`.
Destination icon: `patterns-destination-icon.md`.
