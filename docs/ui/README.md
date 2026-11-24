# Design system and UI docs

**Start with [`DESIGN.md`](./DESIGN.md).** It is the one binding design system (v13, The Exhibit,
2026-11-23): grounds, type, the exhibit frame, components, anchor pages, acceptance gates and
the build phases. Shared kit: `@repo/ui` (`packages/ui`). Brand source: root `brand/`.

## What binds, in order

When two documents disagree, the one higher in this list wins.

| # | Document | Governs |
| - | -------- | ------- |
| 1 | [`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md) | Memorial, evidence honesty, precision, dignity, public access. Overrides aesthetics |
| 2 | [`DESIGN.md`](./DESIGN.md) | Everything visual and structural on public surfaces, web and app |
| 3 | [`brand.md`](./brand.md) | Marks, brand colors, the accessibility floor. Its visual rules defer to `DESIGN.md` |
| 4 | [`story.md`](./story.md), [`neo-voice.md`](../content/neo-voice.md) | All user-facing copy |
| 5 | `packages/ui/src/styles/tokens.css` | Token values. A value in a document is a copy; the kit is the source |
| 6 | [`experience-standard.md`](./experience-standard.md) | Critical journeys and state rules. Where it names a look, `DESIGN.md` wins |

## Behavior references

These describe how live code behaves. They are not design direction. Use them to understand
what exists before changing it; do not build a new look from them.

| Area | Documents |
| ---- | --------- |
| Map | [`patterns-map-canvas.md`](./patterns-map-canvas.md), [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md), [`patterns-place-map.md`](./patterns-place-map.md), [`patterns-lens-handoff.md`](./patterns-lens-handoff.md), [`patterns-plate-posture.md`](./patterns-plate-posture.md) (how the one map is covered, framed or live under a page), [`patterns-cinematic-map.md`](./patterns-cinematic-map.md) (the camera) |
| Records | [`patterns-record-page.md`](./patterns-record-page.md), [`learning-index-entity.md`](./learning-index-entity.md) |
| Stories, data, lives | [`patterns-story-reading.md`](./patterns-story-reading.md), [`patterns-lives-scene.md`](./patterns-lives-scene.md) |
| Handoffs and shell | [`patterns-visit-handoff.md`](./patterns-visit-handoff.md), [`patterns-internet-archive-handoff.md`](./patterns-internet-archive-handoff.md), [`patterns-site-footer.md`](./patterns-site-footer.md), [`patterns-destination-icon.md`](./patterns-destination-icon.md), [`official-properties.md`](./official-properties.md) |
| Admin | [`patterns-admin-intake.md`](./patterns-admin-intake.md), [`patterns-admin-editorial.md`](./patterns-admin-editorial.md), [`patterns-source-library.md`](./patterns-source-library.md), [`patterns-work-review.md`](./patterns-work-review.md), [`patterns-ground-investigation.md`](./patterns-ground-investigation.md) |
| Components | The kit's own index, `packages/ui/src/components/index.ts`, drawn at `/design-system` (staff), which is generated from it. The page kit (frame, section, contents list, prose) is `apps/web/src/components/page` |
| Product model | [`v10/`](./v10/): discovery state, place anatomy, schema and cost. Reference until `DESIGN.md` phase 4a writes the Archive contract |
| App | [`design-direction-v6-mobile.md`](./design-direction-v6-mobile.md): the app's earlier shell, superseded in part by `DESIGN.md` phase 9 (its header says which parts) |

## Retired in phase 8

The documents that described a deleted look went to [`archive/`](./archive/) on 2026-11-23, each
with a line at its top saying so: the room kit and reading room, the surface classes, the
utility edition, the edition fact icon, browse mode, the relationship tree, record anatomy,
collection context, the Atlas instrument and the hand-kept component registry. Some of the
behavior references above still name files that earlier phases deleted
(`patterns-record-page.md`, `patterns-lives-scene.md`, `patterns-ground-investigation.md`,
`patterns-internet-archive-handoff.md`); read them for behavior, and trust the code for paths.

## History, not instruction

- [`archive/`](./archive/): design directions v4 to v12 and the living-archive pattern. They
  record what was tried and why it was dropped (`DESIGN.md` section 4 is the summary). Code
  comments that cite a section there are citing where a behavior was first specified.
- [`../redesign/`](../redesign/): the 2026-10 GROUND proposal, its prototype and its receipts.
- [`prototypes/`](./prototypes/), [`spikes/`](./spikes/), `mobile-polish-mockups.html`,
  [`expo-tamagui-migration-plan.md`](./expo-tamagui-migration-plan.md): earlier experiments.
  `apps/site` is out of scope for v13 by owner decision.

## Changing the system

1. A page may not introduce a color, radius, shadow, type size or button the kit lacks. Add it
   to the kit and to `DESIGN.md` in the same change, or do not add it.
2. Whatever a change replaces is deleted in the phase that removes its last caller.
3. `pnpm lint:tokens` only falls. New test files under `apps/web` are registered in
   `apps/web/package.json`'s `test` script, which is a hand-kept list.
4. Every anchor passes `DESIGN.md` section 12 before sign-off.

```tsx
import '@repo/ui/styles.css';
import { Button, Notice } from '@repo/ui';
```
