# Patterns registry

Reusable UI modules under `apps/web/src/components/patterns/` and the surface-law patterns that govern them. Each row links to its binding pattern doc. Import CSS once per route bundle that renders the pattern.

Verified against `apps/web/src` on 2026-07-30.

## Surface law patterns (v9)

These carry no folder of their own. They are law about how routes, the shell and the map plate relate, and they are read before any component pattern below.

| Pattern | Doc | Modules | Status |
|---|---|---|---|
| Surface classes | [`patterns-surface-classes.md`](./patterns-surface-classes.md) | `app/layout.tsx`, `app/shell.css`, `components/SiteShell.tsx`, `lib/keyboard/bindings.ts`, `lib/nav/destination-registry.ts` | Binding. `data-surface` emission pending (SP-07) |
| Plate posture | [`patterns-plate-posture.md`](./patterns-plate-posture.md) | `app/(map)/MapStage.tsx`, `lib/map-experience/map-libre-lifecycle.ts`, `components/theme-spine/MapInsetMoment.tsx`, `components/patterns/RecordPlacePreview.tsx`; `lib/motion/use-reduced-motion.ts` is new in SP-18 | Binding. Postures pending (SP-07, SP-08) |
| Reading room | [`patterns-reading-room.md`](./patterns-reading-room.md) | `components/article/*`, `components/SiteFooter.tsx`; `app/reading-room.css` and `components/shell/SiteFooter.tsx` are new in SP-11 and SP-15 | Binding. Stylesheet pending (SP-11) |
| Record page | [`patterns-record-page.md`](./patterns-record-page.md) | `components/patterns/RecordAnatomyPanel.tsx`, `RecordPlacePreview.tsx`, `lib/citation/format.ts`; `app/record-page.css` is new in SP-12 | Binding. Page class pending (SP-12) |
| Lens handoff | [`patterns-lens-handoff.md`](./patterns-lens-handoff.md) | `lib/map-experience/url-state.ts`, `lib/share/deep-link.ts`, `lib/runtime-hardening/{constants,query-normalization,edge-query-normalization}.ts`, `middleware.ts` | Binding. Typed builder pending (SP-15, SP-16) |

## Component patterns

| Pattern | Doc | Modules | Primary exports |
|---|---|---|---|
| Browse mode | [`patterns-browse-mode.md`](./patterns-browse-mode.md) | `browse-mode.ts`, `BrowseModeToggle.tsx`, `RecordBrowseControls.tsx`, `browse-mode.css` | `BrowseMode`, `stepIndex`, `pickRandomIndex`, `formatBrowsePosition`, `initialBrowseIndex`, `browseModeLabel`, `BrowseModeToggle`, `RecordBrowseControls` |
| Edition fact icon + record anatomy | [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md), [`patterns-record-anatomy.md`](./patterns-record-anatomy.md) | `edition-fact-icon.ts`, `EditionFactIcon.tsx`, `edition-fact-icon.css`, `RecordAnatomyPanel.tsx`, `RecordPlacePreview.tsx`, `record-anatomy.css` | `EditionFactIcon`, `RecordAnatomyPanel`, `RecordPlacePreview`, icon helpers |
| Edition atmosphere (gutter mosaic) | [`design-direction-v6-home.md`](./design-direction-v6-home.md) §2 (superseded, kept for provenance) | `edition-atmosphere/*` | `EditionAtmosphereMosaic`, `computeScatteredMosaicLayout`, `editionAtmosphereCanvasClassName`, `edition-atmosphere-config` |
| Memorial wall | [`design-direction-v6-memorial.md`](./design-direction-v6-memorial.md) (superseded by v9 surfaces §4.2) | `memorial-wall/*` | `MemorialWallAtmosphere`, `packMemorialNames`, `MEMORIAL_NAMES` |
| Utility edition (compact pages) | [`patterns-utility-edition.md`](./patterns-utility-edition.md) | `utility-edition/*` | `UtilityEditionShell`, `UtilityEditionIntro`, `UtilityEditionBodyPanel`, `UtilityEditionErrorView`, chrome helpers |
| Map entity encoding | [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) | `kind-encoding.ts`, `marker-size.ts`, `explore-style.ts`, `MapExperienceLegend.tsx` | `kindFamilyFor`, `KIND_FAMILY_ENTRIES`, `displayEncodingFor`, legend Color key |
| Map canvas lifecycle | [`patterns-map-canvas.md`](./patterns-map-canvas.md) | `map-libre-lifecycle.ts`, `hero-map-inset.ts`, `MapStage.tsx`, `EntityLocationMap.tsx` | `bindMapResizeLifecycle`, `waitForContainerLayout`, `isWebGlAvailable` |
| Atlas instrument (v9) | [`patterns-atlas-instrument.md`](./patterns-atlas-instrument.md) | `components/shell/CommandBar.tsx`, `map-experience/{TimePanel,LensPanel,ResultsRail,CameraConsole,RecordSheet}.tsx`, `time-panel.css`, `patterns/Toast.tsx`, `toast.ts`, `toast.css`, `patterns/EmptyState.tsx`, `empty-state.ts`, `empty-state.css`, `patterns/skeleton.css`, `lib/map-experience/{camera-moves,camera-dignity,chrome-padding,label-expression,migration-corridors,decade-density,decade-transition}.ts`, `lib/citation/format.ts`, `lib/share/deep-link.ts`, `lib/keyboard/bindings.ts`, `lib/collections/store.ts` | `TimePanel`, `ToastStack`, `useToasts`, `EmptyState`, `createCamera`, `allowedMovesFor`, `chromePadding`, `MAP_LABEL_NAME_FIELD`, `MIGRATION_CORRIDORS`, `decadeDensityBars`, `formatCitation`, `buildShareHref` |
| Cinematic map backdrop | [`patterns-cinematic-map.md`](./patterns-cinematic-map.md) | `cinematic-map/*` (`CinematicMapProvider.tsx`, `useCinematicMap.ts`, `ExploreMapControl.tsx`, `CinematicScrim.tsx`, `CinematicMapClose.tsx`, `MapIntroBeat.tsx`, `cinematic-map.css`) | `CinematicMapProvider`, `useCinematicMap`, `ExploreMapControl`, `CinematicScrim`, `MapIntroBeat` |
| Home featured set | [`design-direction-v6-home.md`](./design-direction-v6-home.md) § beat 02 (superseded by v9 Atlas) | `home-featured-set.ts` | `toHomeFeaturedEntity`, `buildHomeFeaturedCarouselSet` |

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

// Record page: the place frame and the citation formatter the sheet also uses
import { RecordPlacePreview } from '@/components/patterns/RecordPlacePreview';
import { formatCitation } from '@/lib/citation/format';

// Reading room: chapter prose blocks, inline citations and numbered references
import { ArticleBody } from '@/components/article/ArticleBody';
import { ArticleProse } from '@/components/article/ArticleProse';
import { ArticleReferences } from '@/components/article/ArticleReferences';
import '@/components/article/article.css';

// Plate posture: the map moment a reading room frames (import theme-spine.css once)
import { MapInsetMoment } from '@/components/theme-spine/MapInsetMoment';
import '@/components/theme-spine/theme-spine.css';

// Lens handoff: never hand write an Atlas href, build it
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '@/lib/map-experience/url-state';
import { DEFAULT_EXPLORE_FILTERS } from '@/lib/map-experience/filters';

// Atlas instrument: the shared instrument parts
import { TimePanel } from '@/components/map-experience/TimePanel';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ToastStack } from '@/components/patterns/Toast';
import '@/components/map-experience/time-panel.css';
import '@/components/patterns/toast.css';
import '@/components/patterns/empty-state.css';
import '@/components/patterns/skeleton.css';

// Edition atmosphere: grain + grid + gutter mosaic (import CSS once on the route)
import { EditionAtmosphereMosaic } from '@/components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { editionAtmosphereCanvasClassName } from '@/components/patterns/edition-atmosphere/edition-atmosphere-canvas';
import '@/components/patterns/edition-atmosphere/edition-atmosphere.css';

// Memorial wall: names-only full-canvas atmosphere (import CSS via MemorialWallAtmosphere)
import { MemorialWallAtmosphere } from '@/components/patterns/memorial-wall/MemorialWallAtmosphere';
import { MEMORIAL_NAMES } from '@/components/patterns/memorial-wall/memorial-names';

// Utility edition: compact pages (import CSS via UtilityEditionShell)
import { UtilityEditionShell } from '@/components/patterns/utility-edition/UtilityEditionShell';
import { UtilityEditionIntro } from '@/components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionBodyPanel } from '@/components/patterns/utility-edition/UtilityEditionBodyPanel';

// Home carousel set builder
import { buildHomeFeaturedCarouselSet } from '@/components/patterns/home-featured-set';

// Cinematic map backdrop: locked-until-invited map behind content (import CSS once on the route)
import { CinematicMapProvider, useCinematicMap } from '@/components/patterns/cinematic-map/CinematicMapProvider';
import { ExploreMapControl } from '@/components/patterns/cinematic-map/ExploreMapControl';
import { CinematicScrim } from '@/components/patterns/cinematic-map/CinematicScrim';
import { MapIntroBeat } from '@/components/patterns/cinematic-map/MapIntroBeat';
import '@/components/patterns/cinematic-map/cinematic-map.css';
```

Relative imports from `apps/web/src` use the paths above without the `@/` alias where the app does not configure it; prefer the same folder layout as existing call sites (`components/patterns/...`).

## Current adopters

| Surface | Patterns used |
|---|---|
| `/` home edition | `CinematicMapProvider`, `useCinematicMap`, `ExploreMapControl`, `CinematicScrim`, `MapIntroBeat` (Rest → Invite → Engaged); `RecordBrowseControls`, `EditionFactIcon`, `RecordAnatomyPanel`, `home-featured-set`, `browse-mode` helpers |
| `HomeFeaturedRecord` | `RecordBrowseControls`, `RecordAnatomyPanel` |
| `HomeAbout` | `EditionFactIcon` (entry steps) |
| `/explore` spotlight + instruments | `RecordBrowseControls`, `BrowseModeToggle`, `EditionFactIcon`, edition segmented tabs (`explore-edition.css`), decade stepper rail |
| `/explore` `NarrativeCard` | `RecordAnatomyPanel`, `RecordBrowseControls` browse toolbar |
| `/explore` shell | Footer omitted by design; other routes use [`patterns-site-footer.md`](./patterns-site-footer.md) |
| `/history` find-in-time | Explore decade scrubber classes, `HistoryRipRow`, `EditionFactIcon`, edition Surface panels |
| `/chapters`, `/chapters/[slug]` | `ArticleBody`, `ArticleProse`, `ArticleReferences`, `MapInsetMoment`, `EraTimeline`, `DisputeBlock`, theme-impact charts, `articles-edition.css` |
| `/chapters/mosaic-credits` | v6 stories edition chrome, local to that folder (`stories-edition.css`, `stories-panel-chrome.ts`) |
| `/about` product thesis | `EditionAtmosphereMosaic`, edition Surface panels (`about-edition.css`) |
| `/books` challenged titles | `EditionAtmosphereMosaic`, `BooksRipRow`, `EditionFactIcon`, `BooksCoverArt`, `RecordAnatomyPanel` (detail place), `books-edition.css` |
| `/law`, `/data`, `/methodology`, `/memorial` | `EditionAtmosphereMosaic`, edition Surface panels |
| `/entity/[id]` record detail | `EditionAtmosphereMosaic`, `RecordAnatomyPanel`, `EditionFactIcon`, `EntityMastMedia` fail-closed, session nav; `CinematicMapProvider`, `useCinematicMap`, `ExploreMapControl`, `CinematicMapClose`, `CinematicScrim` around the place-context locator map (`EntityLocationCinematicMap`, Rest → Engaged, no Invite) |
| `/locate`, `/submit`, `/corrections`, `/corrections/status/[receiptCode]`, 404, error | `UtilityEditionShell`, `UtilityEditionIntro`, `UtilityEditionBodyPanel`, `UtilityEditionErrorView` |
| `/search` | Redirect only, to `/history`, per the `next.config.mjs` rule |

`app/stories` and `app/themes` no longer exist. Both folded into `app/chapters`, and their design docs are provenance only. See [`design-direction-v9-chapters.md`](./design-direction-v9-chapters.md).

**Cinematic map backdrop** adoption status: `/` home shipped (Rest → Invite → Engaged); mobile Explore tab shipped (Rest → Engaged, reference implementation); `/explore` shipped (Rest → Engaged, dense surface); `/entity/[id]` place-context locator shipped (Rest → Engaged, supplementary-surface shape, no auto-engage or Invite because the map sits inside other record content rather than being the page's point). See [`patterns-cinematic-map.md`](./patterns-cinematic-map.md) §1.

**On web this pattern is being replaced.** v9 gives every non-instrument surface a Framed or Parked plate borrowed from the single persistent `MapStage`, which removes the second MapLibre instance the backdrop mounts on `/entity/[id]` and inside chapter map moments. The mobile adoption is unaffected. See [`patterns-plate-posture.md`](./patterns-plate-posture.md).

## Fail-state hardening

Shared fail-closed patterns. Never render broken decorative or record media.

| Surface | Module | Behavior |
|---|---|---|
| Entity mast photo | `EntityMastMedia.tsx` | URL candidate chain, then `EntityRecordMark` on exhaustion; Save-Data prefers the mark |
| Story/atmosphere mosaic | `AtmospherePlane.tsx`, `LivingAtmosphereMosaic.tsx` | `onError` hides the mosaic; the geometric plate remains |
| Edition gutter mosaic | `EditionAtmosphereMosaic.tsx` | Per-tile `onError` removes failed paths; the grain and grid canvas remains |
| Kind / confidence badges | `KindBadge.tsx`, `ConfidenceMark.tsx`, `EditionFactIcon.tsx` | `iconWithFallback()` to `faCircle`; label text always visible (WCAG 1.4.1) |
| Bare embeds | `EntityPrimaryImage.tsx` | No fallback; callers must use `EntityMastMedia` or own the policy |
| Framed map plate | see [`patterns-plate-posture.md`](./patterns-plate-posture.md) §6 | A slot with no plate keeps its caption and states that the map is unavailable; never a blank rectangle |

Helper: `apps/web/src/lib/map-experience/icon-fallback.ts` (`iconWithFallback`).

## Tests

| Module | Test file |
|---|---|
| Browse mode helpers + controls | `apps/web/src/components/patterns/browse-mode.test.tsx` |
| Record anatomy panel | `apps/web/src/components/patterns/record-anatomy.test.ts` |
| Citation formatter | `apps/web/src/lib/citation/format.test.ts` |
| Share deep link (no viewport key) | `apps/web/src/lib/share/deep-link.test.ts` |
| Atlas URL state | `apps/web/src/lib/map-experience/url-state.test.ts` |
| Camera vocabulary, dignity, padding clamp | `apps/web/src/lib/map-experience/{camera-moves,camera-dignity,chrome-padding}.test.ts` |
| Map plate contrast, both themes | `packages/ui/src/tokens/map-contrast.test.ts` |
| Chapter inline prose and citations | `apps/web/src/components/article/ArticleProse.test.ts` |
| Chapter map moment | `apps/web/src/components/theme-spine/MapInsetMoment.test.tsx` |
| Mosaic credits chrome | `apps/web/src/app/chapters/mosaic-credits/stories-panel-chrome.test.ts` |
| History v6 panel chrome | `apps/web/src/app/history/history-panel-chrome.test.ts` |
| About v6 panel chrome + page wiring | `apps/web/src/app/about/about-panel-chrome.test.ts`, `about-page.test.ts` |
| Edition atmosphere mosaic layout | `apps/web/src/components/patterns/edition-atmosphere/compute-scattered-mosaic-layout.test.ts` |
| Entity era/status facts | `apps/web/src/lib/map-experience/entity-era-facts.test.ts` |
| Entity v6 panel chrome + page wiring | `apps/web/src/app/entity/[id]/{entity-panel-chrome,entity-page,entity-anatomy-facts}.test.ts` |
| History rip rows | `apps/web/src/components/history/HistoryResultList.test.tsx` |
| Search to history redirect | `apps/web/src/lib/history/search-redirect.test.ts`, `apps/web/src/app/search/search-page.test.ts` |
| Utility edition chrome + page wiring | `apps/web/src/components/patterns/utility-edition/utility-edition-chrome.test.ts`, `apps/web/src/app/utility-edition-pages.test.ts` |
| Icon fallback helper | `apps/web/src/lib/map-experience/icon-fallback.test.ts` |
| Explore panel chrome (test style reference) | `apps/web/src/app/(map)/explore/explore-panel-chrome.test.ts` |

**No test covers `/chapters` or `/chapters/[slug]` page chrome.** That gap is recorded in [`README.md`](./README.md) § Known gaps and owned by SP-11.

New test files under `apps/web` must be registered in `apps/web/package.json`'s `test` script. It is a hand-maintained file list, not a glob, and an unregistered test silently never runs.

## Related (not in `patterns/`)

These live outside the registry folder but share vocabulary with patterns:

| Module | Path | Notes |
|---|---|---|
| Kind / confidence icons | `apps/web/src/lib/map-experience/{kind-icons,confidence-icons,kind-encoding,icon-fallback}.ts` | Used by map, legend and `EditionFactIcon`. Do not duplicate glyphs |
| Chapter article renderers | `apps/web/src/components/article/*` | The Reading room's prose layer |
| Chapter artifacts | `apps/web/src/components/theme-spine/*` | `MapInsetMoment`, `EraTimeline`, `DisputeBlock` |
| Command bar and palette | `apps/web/src/components/shell/CommandBar.tsx`, `components/patterns/command-palette/*` | Mounted above every route under v9 |
| `@repo/ui` kit | `packages/ui` | Cards, buttons, tokens. Prefer over bespoke controls |
| Brand assets | `packages/config` `BRAND_ASSETS` | Official artwork only. Never reconstruct the lockup; see [`brand.md`](./brand.md) and [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md) §5.1 |

When adding a row here, add or update the matching `patterns-*.md` and a line in [`README.md`](./README.md).
