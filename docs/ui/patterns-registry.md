# Patterns registry

Reusable UI modules under `apps/web/src/components/patterns/`. Each row links to its binding pattern doc. Import CSS once per route bundle that renders the pattern.

| Pattern | Doc | Modules | Primary exports |
|---|---|---|---|
| Browse mode | [`patterns-browse-mode.md`](./patterns-browse-mode.md) | `browse-mode.ts`, `BrowseModeToggle.tsx`, `RecordBrowseControls.tsx`, `browse-mode.css` | `BrowseMode`, `stepIndex`, `pickRandomIndex`, `formatBrowsePosition`, `initialBrowseIndex`, `browseModeLabel`, `BrowseModeToggle`, `RecordBrowseControls` |
| Edition fact icon + record anatomy | [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md), [`patterns-record-anatomy.md`](./patterns-record-anatomy.md) | `edition-fact-icon.ts`, `EditionFactIcon.tsx`, `edition-fact-icon.css`, `RecordAnatomyPanel.tsx`, `RecordPlacePreview.tsx`, `record-anatomy.css` | `EditionFactIcon`, `RecordAnatomyPanel`, `RecordPlacePreview`, icon helpers |
| Edition atmosphere (gutter mosaic) | [`design-direction-v6-home.md`](./design-direction-v6-home.md) §2, [`design-direction-v6-stories.md`](./design-direction-v6-stories.md) §2 | `edition-atmosphere/*` | `EditionAtmosphereMosaic`, `computeScatteredMosaicLayout`, `editionAtmosphereCanvasClassName`, `edition-atmosphere-config` |
| Memorial wall | [`design-direction-v6-memorial.md`](./design-direction-v6-memorial.md) | `memorial-wall/*` | `MemorialWallAtmosphere`, `packMemorialNames`, `MEMORIAL_NAMES` |
| Utility edition (compact pages) | [`patterns-utility-edition.md`](./patterns-utility-edition.md) | `utility-edition/*` | `UtilityEditionShell`, `UtilityEditionIntro`, `UtilityEditionBodyPanel`, chrome helpers |
| Map entity encoding | [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) | `kind-encoding.ts`, `marker-size.ts`, `explore-style.ts`, `MapExperienceLegend.tsx` | `kindFamilyFor`, `KIND_FAMILY_ENTRIES`, `displayEncodingFor`, legend Color key |
| Map canvas lifecycle | [`patterns-map-canvas.md`](./patterns-map-canvas.md) | `map-libre-lifecycle.ts`, `hero-map-inset.ts`, `MapStage.tsx`, `EntityLocationMap.tsx` | `bindMapResizeLifecycle`, `waitForContainerLayout`, `isWebGlAvailable` |
| Home featured set | (home v6) [`design-direction-v6-home.md`](./design-direction-v6-home.md) § beat 02 | `home-featured-set.ts` | `toHomeFeaturedEntity`, `buildHomeFeaturedCarouselSet` |

## Import paths

```tsx
// Browse mode helpers
import {
  stepIndex,
  pickRandomIndex,
  formatBrowsePosition,
  initialBrowseIndex,
  type BrowseMode,
} from '@/components/patterns/browse-mode';

// Browse mode UI (import browse-mode.css once on the route)
import { BrowseModeToggle } from '@/components/patterns/BrowseModeToggle';
import { RecordBrowseControls } from '@/components/patterns/RecordBrowseControls';
import '@/components/patterns/browse-mode.css';

// Edition fact icons + record anatomy (import CSS once on the route)
import { EditionFactIcon } from '@/components/patterns/EditionFactIcon';
import { RecordAnatomyPanel } from '@/components/patterns/RecordAnatomyPanel';
import '@/components/patterns/edition-fact-icon.css';
import '@/components/patterns/record-anatomy.css';

// Edition atmosphere — grain + grid + gutter mosaic (import CSS once on the route)
import { EditionAtmosphereMosaic } from '@/components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { editionAtmosphereCanvasClassName } from '@/components/patterns/edition-atmosphere/edition-atmosphere-canvas';
import '@/components/patterns/edition-atmosphere/edition-atmosphere.css';

// Memorial wall — names-only full-canvas atmosphere (import CSS via MemorialWallAtmosphere)
import { MemorialWallAtmosphere } from '@/components/patterns/memorial-wall/MemorialWallAtmosphere';
import { MEMORIAL_NAMES } from '@/components/patterns/memorial-wall/memorial-names';

// Utility edition — compact v6 pages (import CSS via UtilityEditionShell)
import { UtilityEditionShell } from '@/components/patterns/utility-edition/UtilityEditionShell';
import { UtilityEditionIntro } from '@/components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionBodyPanel } from '@/components/patterns/utility-edition/UtilityEditionBodyPanel';

// Home carousel set builder
import { buildHomeFeaturedCarouselSet } from '@/components/patterns/home-featured-set';
```

Relative imports from `apps/web/src` use the paths above without the `@/` alias where the app does not configure it; prefer the same folder layout as existing call sites (`components/patterns/...`).

## Current adopters

| Surface | Patterns used |
|---|---|
| `/` home edition | `RecordBrowseControls`, `EditionFactIcon`, `RecordAnatomyPanel`, `home-featured-set`, `browse-mode` helpers (grain/grid canvas; no gutter mosaic) |
| `HomeFeaturedRecord` | `RecordBrowseControls`, `RecordAnatomyPanel` |
| `HomeAbout` | `EditionFactIcon` (entry steps) |
| `/explore` spotlight + instruments | `RecordBrowseControls`, `BrowseModeToggle`, `EditionFactIcon`, edition segmented tabs (`explore-edition.css`), decade stepper rail |
| `/history` find-in-time | Explore decade scrubber classes, `HistoryRipRow`, `EditionFactIcon`, edition Surface panels |
| `/about` product thesis | `EditionAtmosphereMosaic`, edition Surface panels (`about-edition.css`) |
| `/stories` longform edition | `EditionAtmosphereMosaic`, edition Surface panels, story rail ledger |
| `/books` challenged titles | `EditionAtmosphereMosaic`, `BooksRipRow`, `EditionFactIcon`, `BooksCoverArt`, `RecordAnatomyPanel` (detail place), `books-edition.css` |
| `/themes` impact browse | `EditionAtmosphereMosaic`, edition Surface panels, theme-impact packet cards |
| `/entity/[id]` record detail | `EditionAtmosphereMosaic`, `RecordAnatomyPanel`, `EditionFactIcon`, `EntityMastMedia` fail-closed, session nav |
| `/search` | Redirect only → `/history` (legacy URLs preserved) |
| `/explore` `NarrativeCard` | `RecordAnatomyPanel`, `RecordBrowseControls` browse toolbar |
| `/explore` shell | Footer omitted by design (`design-direction-v6-explore.md` §3); other routes use [`patterns-site-footer.md`](./patterns-site-footer.md) |
| `/locate`, `/submit`, `/corrections`, status, 404, error | `UtilityEditionShell`, `UtilityEditionIntro`, `UtilityEditionBodyPanel` |

Planned adopters (same modules, no new chrome): `/errata`, `/support`, `/privacy` (`repo-49wc`). Entity detail session nav keeps `EntitySessionNav` (explicit back stack); see browse-mode doc.

## Fail-state hardening

Shared fail-closed patterns — never render broken decorative or record media.

| Surface | Module | Behavior |
|---|---|---|
| Entity mast photo | `EntityMastMedia.tsx` | URL candidate chain → `EntityRecordMark` on exhaustion; Save-Data prefers mark |
| Story/atmosphere mosaic | `AtmospherePlane.tsx`, `LivingAtmosphereMosaic.tsx` | `onError` hides mosaic; geometric plate remains |
| Edition gutter mosaic | `EditionAtmosphereMosaic.tsx` | Per-tile `onError` removes failed paths; grain/grid canvas remains |
| Kind / confidence badges | `KindBadge.tsx`, `ConfidenceMark.tsx`, `EditionFactIcon.tsx` | `iconWithFallback()` → `faCircle`; label text always visible (WCAG 1.4.1) |
| Bare embeds | `EntityPrimaryImage.tsx` | No fallback — callers must use `EntityMastMedia` or own policy |

Helper: `apps/web/src/lib/map-experience/icon-fallback.ts` (`iconWithFallback`).

## Tests

| Module | Test file |
|---|---|
| Browse mode helpers + controls | `apps/web/src/components/patterns/browse-mode.test.tsx` |
| Record anatomy panel | `apps/web/src/components/patterns/record-anatomy.test.ts` |
| History v6 panel chrome | `apps/web/src/app/history/history-panel-chrome.test.ts` |
| About v6 panel chrome + page wiring | `apps/web/src/app/about/about-panel-chrome.test.ts`, `apps/web/src/app/about/about-page.test.ts` |
| Stories v6 panel chrome | `apps/web/src/app/stories/stories-panel-chrome.test.ts` |
| Edition atmosphere mosaic layout | `apps/web/src/components/patterns/edition-atmosphere/compute-scattered-mosaic-layout.test.ts` |
| Entity era/status facts | `apps/web/src/lib/map-experience/entity-era-facts.test.ts` |
| Entity v6 panel chrome + page wiring | `apps/web/src/app/entity/[id]/entity-panel-chrome.test.ts`, `apps/web/src/app/entity/[id]/entity-page.test.ts`, `apps/web/src/app/entity/[id]/entity-anatomy-facts.test.ts` |
| History rip rows | `apps/web/src/components/history/HistoryResultList.test.tsx` |
| Search → history redirect | `apps/web/src/lib/history/search-redirect.test.ts`, `apps/web/src/app/search/search-page.test.ts` |
| Utility edition chrome + page wiring | `apps/web/src/components/patterns/utility-edition/utility-edition-chrome.test.ts`, `apps/web/src/app/utility-edition-pages.test.ts` |
| Icon fallback helper | `apps/web/src/lib/map-experience/icon-fallback.test.ts` |

## Related (not in `patterns/`)

These live outside the registry folder but share vocabulary with patterns:

| Module | Path | Notes |
|---|---|---|
| Kind / confidence icons | `apps/web/src/lib/map-experience/kind-icons.ts`, `confidence-icons.ts`, `kind-encoding.ts`, `icon-fallback.ts` | Used by map, legend, `EditionFactIcon`; do not duplicate glyphs |
| `@repo/ui` kit | `packages/ui` | Cards, buttons, tokens — prefer over bespoke controls |

When adding a row here, add or update the matching `patterns-*.md` and a line in [`README.md`](./README.md).
