# BlackStory design direction v6 — mobile foundation (full rebuild)

**Status:** binding rebuild contract (2026-07-23).  
**Polish direction:** **Ledger Line** (adopted 2026-07-23) — dense index first; hierarchy from type and hairlines, not stacked cards. Mockup: [`mobile-polish-mockups.html`](./mobile-polish-mockups.html) approach `ledger`.  
**Scope:** native shell, chrome, design-system primitives, and browse-surface patterns. Sibling agents own Explore map instruments and entity detail stacks.  
**Parent docs:** [`brand.md`](./brand.md), web v6 surface directions, [`patterns-browse-mode.md`](./patterns-browse-mode.md), [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md), [`patterns-utility-edition.md`](./patterns-utility-edition.md).

---

## 1. Intent

Mobile must read as the same **archive product** as the website: Archive Paper / Black Ink canvas, copper as navigational signal only (~10–15%), flat matte everywhere except the ADR-013 map plate. Browse tabs are **indexes on canvas** — not v6 “edition object” stacks of bordered Surface cards with `00` / `01` panel headers.

This document is the **foundation contract** siblings must import from — not a polish checklist.

---

## 2. Ledger Line (adopted polish)

**Thesis:** Dense index first. Hierarchy from type and hairlines, not stacked cards.

### Type scale (exact — medium weight, not semibold monument)

| Role | Size | Face / weight | Token |
|---|---|---|---|
| Tab masthead | **16px** | Inter Medium (500) | `masthead` |
| Entity title | **17px** | Inter Medium (500) | `entityTitle` |
| Section label | **10–11px** | IBM Plex Mono, stone, uppercase tracked | `sectionLabel` |
| Row title | **13px** | Inter Medium (500) | `rowTitle` |
| Caption / meta | **11–12px** | Inter Medium/Regular, Stone | `caption` |

Larger Sora display / Inter subtitle roles remain for sparse utility heroes when `dense={false}`; browse defaults are Ledger tokens above.

### Surface strategy

- **Tab browse** (History, Stories, More, Data, learn indexes): Archive Paper canvas; sections split with full-width hairline rules + `LedgerSectionLabel` — not stacked `LiftedSurface` / `EditionSurfacePanel` cards-in-cards.
- **One Surface panel max** per scroll viewport only when essential (filter block, utility form). No nested `LiftedSurface` inside panels on History.
- **Entity:** intro on canvas + bottom rule; anatomy/body as flat stacks with mono section labels (`00 · Intro`) + 1px dividers. No nested card shells. Entity title 17 Inter Medium.
- **Press feedback:** `surfacePressed` fill; no elevation/shadows on browse.

### Explore chrome (Pin Pulse)

- **Signature:** Copper count chip over a near-full dark map plate; ghost icons stay muted paper-on-map. Copper ~10–15% of composition.
- **Detents:** peek **11%** / half **34%** / full **52%** of sheet container (above tab bar). Peek is handle + invite line so the map owns first glance.
- **Scope vocabulary:** `Nearby` (camera reported) / `All pinned` (pre-viewport). Mast shows compact `712 / 1,365` or `N pinned`. Peek rail invite: **Pull up for places** (count stays in the floating chip).
- **Sparse viewport:** when the release still has pins but the current viewport/filter intersection is empty, a compact coach under the mast (**No pins in this view. Pan, zoom out, or clear a filter.**) — never a full-screen empty plate.
- **Filters (instruments):** Kind chips always show icons; selected state is copper border + copper caption on Surface (not ink fill). One job per chip. Active strip **"On now"** lists removable copper chips + **Clear all**. Mast instruments ghost shows a copper count badge when any facet is on (kind/tone/era/theme/status/confidence/where). Copy: **Open map filters**.
- **Preview:** kind glyph + **Pinned here** / kind (+ status) caption; title at `entityTitle` (17 Medium); one story line; icon meta chips (where / era / evidence / confidence); optional **Linked** theme hooks; CTA **Open place**.
- **Records rail:** kind glyph + `rowTitle` + one caption (`where · era`) — not a fact-grid wall on every row.
- **Sheet motion:** `durationFast` snaps; `durationInstant` when reduce-motion is on. Compact handle pill; ≥44dp touch target via wrap height.
- **Floating instruments:** Surface/ghost + Rule border, radius 8; no decorative shadows.
- **Insets:** 16px side gutters aligned with tab content (`exploreContentInset` = `screenScrollInsets.paddingHorizontal`).

### Explore map plate (ADR-013 / dignity)

Fixed dark archive basemap (does not flip with OS theme). Extend the existing dignity palette + MapLibre style — do not invent a parallel language.

| Concern | Contract |
|---|---|
| Basemap | OpenFreeMap dark plate: **land background** (warm charcoal) + ocean water fill + sand coastline stroke + landcover texture + zoom-scaled state bounds + street casing/fill; place-state / place-city / street-label with flat matte halos. Land/ocean must stay distinct at national zoom (Pacific coastline readable). Cluster count symbols ignore placement so they do not drop California / west-coast state labels. |
| Pins | Kind-family shade + glyph stroke signatures; evidence/confidence size; national zoom scale ≥ ~0.55 so CONUS is not dust. Fill opacity readable (~0.68) while geography still shows through. |
| Clusters | Copper aggregate discs; size (not heat color) by count; zoom-scaled radius + count type. |
| Selection | Dual ring: Archive Paper inner + Copper Pin outer orientation ring; `easeTo` with `EXPLORE_MAP_VIEW_PADDING` (chrome top / peek sheet bottom); instant jump when reduce-motion. |
| Dignity | No heatmap / density color ramps; confidence not color-alone; zoom ceiling `MAP_MAX_ZOOM` (12); points no sharper than redacted precision. |
| Camera | Named presets (`national` / `state` / `locality` / `point`); first-open CONUS uses padded `initialViewState`. Portrait national floor is `MAP_MIN_ZOOM` 2 (not desktop z3) so California / west coast stay in the clear band between Pin Pulse mast and peek sheet; `US_BOUNDS` matches domain CONUS with Pacific west margin. |

### Entity detail

- Flat section stacks on canvas (intro → anatomy → trust → narrative → claims → timeline → connected → provenance).
- Footer **Previous / Random / Next** (`EntitySessionNav`) matches web session semantics: Previous prefers session stack then catalog previous; Next advances release map-source order (or random when toggle is on); Random is a secondary pressed toggle (copper never fills body label). Catalog from cached `/v1/map` entity ids, demo map in `__DEV__`, else related neighbors.
- Title 17 Inter Medium; anatomy via `RecordFactStrip` / `EditionFactCell`.

### History (find-in-time)

- **Filter chips:** horizontal scroll of icon + caption pills (copper border/text when selected). Consistent `caption` sizing — not mixed Button primary/secondary weights.
- **Results:** kind glyph + `KIND · ERA · Status` slug + `rowTitle` + one story line. No numbered `01` index, no fact-grid wall. Ghost **Show on map** under the row.
- **Search field:** caption-sized input aligned with Ledger density.

### Remove on browse tabs (v6 edition language)

- Indexed `00` / `01` panel headers on History / Stories / More / Data
- Nested `LiftedSurface` on History results
- More triple header stack (masthead + per-section `EditionSurfacePanel` headers)

### Keep

- Copper-tick kickers on tab mastheads only
- `LedgerRow` / `ListRow` compact density (13 Medium titles)
- `RecordFactStrip` / `EditionFactCell` on entity
- `UtilityScreenShell` for corrections (single Surface form plate OK)

---

## 3. What was ripped (2026-07-23)

| Removed | Reason |
|---|---|
| `BrandLinearGradient.tsx` | Gradients violate flat-matte brand rule |
| `GradientPanel.tsx` / `GradientBackdrop` | Same |
| `getGradient` / `useGradient` / `GradientName` | Same |
| Dark-first theme default (`null` → dark) | v5 cockpit; replaced with OS-aware + light fallback |
| Default `LiftedSurface` shadow (`sm`) | Browse surfaces are flat; shadow default is `none` |
| `getExploreCockpitColors()` | Fixed-ink v5 explore chrome |
| Explore toolbar shadow wash | Flat hairline border only |
| `@/ui` gradient exports | Prevents accidental reintroduction |
| Browse-tab indexed `EditionSurfacePanel` stacks | Ledger Line — canvas + hairlines |

**Kept (narrow exception):** `getShadowStyle('sm'|'md'|'lg')` for map floating instruments only when ADR-013 truly requires lift. Prefer bordered Surface/ghost with `shadow="none"`. Browse/tab/stack surfaces must pass `shadow="none"` or omit (default).

---

## 4. Theme tokens

Generated from `brand/tokens` via `pnpm --filter @repo/mobile tokens:generate` (run from `apps/mobile`). Hand-written resolution in `src/ui/tokens/index.ts`. Ledger type roles live in `scripts/tokens/supplementary-source.ts` → `typeScale`.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#F4EFE5` Archive Paper | `#0A0A0A` Black Ink |
| Surface | `#FBF8F2` | `#161616` Charcoal |
| Surface raised | `#FDFBF8` (warm near-white above Surface) | `#1C1B18` |
| Surface pressed | `#F4EFE5` (step down for press feedback) | `#0A0A0A` |
| Ink | `#0A0A0A` | `#F4EFE5` |
| Stone (muted) | `#6D675F` | `#BDB5A9` |
| Ink subtle (tertiary meta) | `#726C64` | `#8B857D` |
| Rule (border) | `#D7D0C4` | `#34302C` |
| Copper text | `#8E4F2A` | `#D07A32` |
| Copper graphic | `#B86B2A` | `#D07A32` |

**Resolution:** explicit OS `dark` → dark palette; everything else (including `null`) → light. Matches web bootstrap (`prefers-color-scheme` with light fallback).

**Typography:** Sora SemiBold display (sparse); Inter UI (Ledger Medium mastheads/rows); Source Serif 4 editorial; IBM Plex Mono data/section labels — from `typeScale` / `resolveFontFamily`.

---

## 5. Shell chrome

| Module | Role |
|---|---|
| `src/shell/mobile-nav.ts` | Tab IA + More menu parity with web `shell-nav` |
| `src/shell/edition-chrome.ts` | `useEditionTabBarOptions`, `useEditionStackScreenOptions`, `editionTabIcon` |
| `src/shell/navigate-back.ts` / `use-edition-stack-back.tsx` | Reliable stack `headerLeft` via `BackControl` — `router.back()` or replace to tab/section root |
| `src/app/(tabs)/_layout.tsx` | Four tabs via edition tab bar (no inline tint literals) |
| `src/app/_layout.tsx` | Stack routes via edition stack headers |

Tab bar: matte Surface plate, rule hairline top border, copper active label/icon, stone idle. Stack: canvas header fill, ink title, copper back/actions, no header shadow. **Tab roots never show a back control.** Stack/modals always install `useEditionStackBack` so deep links and cold starts still have an exit.

---

## 6. Layout primitives (required)

Screens must compose from these — no one-off chrome.

| Module | Use when |
|---|---|
| `ScreenCanvas` | Full-bleed canvas behind every route |
| `ScreenHeader` | Tab-root masthead (kicker + 16 Medium title + dek); `dense` default |
| `EditionBrandHeader` | Masthead + compact official BlackStory lockup (Stories / Themes); light/dark artwork via `Logo` |
| `Logo` | Approved lockup/symbol rasters from `assets/brand/` — never typed wordmark + bare symbol |
| `LedgerSectionLabel` | Mono uppercase section splits on browse indexes |
| `BrowseScreenShell` | Tab-root browse pages (History, Stories home, More) — uses `useScreenScrollInsets()` |
| `UtilityScreenShell` | Trust/discover utilities (corrections, status) — one Surface form plate |
| `EditionPanelHeader` / `EditionSurfacePanel` | Prefer **not** on browse tabs; utility/legacy only |
| `EditionSurfaceStack` | Prefer **not** on browse tabs |
| `LiftedSurface` | Low-level Surface card when a single plate is essential (`shadow` defaults `none`) |
| `ListRow` | Settings / menu / navigation rows (`density="compact"`, `rowTitle`) |
| `LedgerRow` | Rip-list search/history/story density (`rowTitle`) |
| `EditionFactCell` | Label-over-value fact cell |
| `RecordFactStrip` | 2-column wrap grid of fact cells |
| `Button` | Primary (ink), secondary (surface + rule), ghost (copper text), accent (ink + copper rule) |
| `SectionHeader` | In-page section labels (defaults to `sectionLabel`) |
| `NavIcon` | Tab and menu glyphs; copper when selected |

Import era/kind/status labels from `src/features/record-facts/record-facts.ts`. Replace unicode dashes in displayed ranges with plain ` to `.

Scroll content above the tab bar must use `useScreenScrollInsets()` (not a static 48 bottom pad).

---

## 7. Screen inventory

| Surface | Mobile route | Shell | Web binding | Status |
|---|---|---|---|---|
| **Explore** | `(tabs)/explore` | Map-led + outline count chip | `design-direction-v6-explore.md` | Native (Pin Pulse) |
| **History / find-in-time** | `(tabs)/history` | Canvas + `ScreenHeader` + ledger sections | `design-direction-v6-history.md` | Native |
| **Stories** | `(tabs)/learn` | Canvas + `EditionBrandHeader` (lockup) + ledger sections | `design-direction-v6-stories.md` | Native |
| **More** | `(tabs)/more` | `BrowseScreenShell` + section labels + rows | web overflow nav | Native index |
| **Data** | `/data` | Canvas masthead + ledger sections + viz | `design-direction-v6-data.md` | Native (fixture indicators + model frames) |
| **Banned books** | `/books`, `/books/[slug]` | Canvas masthead + catalog ledger + detail stacks | `design-direction-v6-books.md` | Native (curated on-device seed; source/release labeled; live API deferred) |
| **Law** | `/law`, `/law/[slug]` | Canvas masthead + catalog ledger + explainer stacks | `design-direction-v6-law.md` | Native (on-device legal seed) |
| **Memorial** | `/memorial` | Canvas masthead + alphabetical name ledger | `design-direction-v6-memorial.md` | Native (names list; wall atmosphere web-only) |
| **Themes** | `/themes`, `/themes/[themeId]` | `EditionBrandHeader` + P0/P1 ledger + packet stacks | `design-direction-v6-themes.md` | Native (on-device researched fixture) |
| **Methodology / About / errata** | `/learn/*` | Canvas ledger or `UtilityScreenShell` | per surface doc | Native (About = storytelling ledger; longform stories use brand lockup header) |
| **Corrections** | `/corrections/*` | `UtilityScreenShell` | `patterns-utility-edition.md` | Native |
| **Entity detail** | `/entity/[id]` | Intro brand lockup + flat section stacks + session nav | `design-direction-v6-entity.md` | Native + `openExternalMaps` + map-catalog session nav |
| **Submit** | `/submit` | Canvas contribute shell | utility / web submit | Native shell (corrections primary; lead form secondary web) |
| **Legacy search** | `(tabs)/search` | Redirect → `/history` | merged per v6 history | Redirect |

### Books (native)

- **Browse:** Ledger search + pulse facts (titles / authors / states / **source**) + icon-led catalog rows. Catalog ships as curated on-device JSON (`features/books/catalog-seed.json`) exported from the web seed. Pulse labels `Curated seed` vs `Live snapshot`; caption shows release version + export date.
- **Detail:** Context, challenges, citations, purchase/lookup links, optional `canonicalEntityId` → entity route, same-author related rows.
- **More:** Banned books row is `kind: 'native'` → `/books` (never Safari as primary path).
- **API:** No mobile `bannedBooksListing` endpoint yet — live warehouse refresh is a deferred bead. Do not claim live parity until that lands.
- **Maps:** `openExternalMaps({ lat, lng, label? })` on entity anatomy and Explore preview when public coords exist.

### Law (native)

- **Browse:** Ledger search + kind chips + catalog pulse + not-legal-advice notice + icon-led rows. Catalog ships as on-device JSON (`features/law/catalog-seed.json`) exported from web `legal-seed`.
- **Detail:** Anatomy strip, disclaimer, explainer sections when published, primary sources, archive/official links. Seed-only `ent_seed_*` ids are omitted (no dead entity routes).
- **More:** Law row is `kind: 'native'` → `/law`.

### Memorial (native)

- **List:** Names-forward alphabetical ledger with search; dignity-first copy; incomplete-by-design note. No handwritten wall animation on mobile (web wall remains decorative/`aria-hidden`; list is the accessible record).
- **Links:** Where memorial milestones publish an entity id, rows open `/entity/[id]`. Where public coords exist, **Open in Maps** uses `openExternalMaps`.
- **More:** Memorial row is `kind: 'native'` → `/memorial`.

### Themes (native)

- **Browse:** Method notice (juxtaposition, not causation) + catalog pulse + search + P0 / P1 ledger rows. Catalog + packets ship as on-device JSON (`features/themes/catalog-seed.json`) from domain researched packets + web browse titles/ledes.
- **Detail:** Theme intro, method hand-off to Methodology, stacked packet sections (observations, derived, artifacts, gap labels). Question-level deep routes deferred.
- **Brand:** Compact official lockup via `EditionBrandHeader` (light/dark approved artwork). Mosaic header superseded; collage assets retained unused. Copper reserved for nav only.
- **More:** Themes row is `kind: 'native'` → `/themes`.

### Stories (native)

- **Home + longform:** `EditionBrandHeader` with BlackStory lockup above Ledger masthead. Non-longform documents keep text-only `ScreenHeader`.
- **Brand:** Official lockup artwork only — never reconstruct wordmark + symbol in type.

### Entity (native)

- **Intro:** Compact BlackStory lockup above beat 00 plus existing primary image / EntityMark media block. Brand marks product ownership; record media stays the documentary image.
### About (native storytelling)

- **Route:** `/learn/about` renders dedicated `AboutScreen` (not generic prose `ContentPageScreen`).
- **Ledger beats:** Intro + one copper CTA + quiet Methodology; icon pillar tiles (Presence / Evidence / Dignity); numbered mission beats; publish posture Notice + methodology/corrections/errata rows; destination ledger; no-account close.
- **Binding:** `design-direction-v6-about.md` adapted to Ledger (no gutter mosaic, no indexed Surface stack, flat matte). Copy mirrors web `about-copy.ts`.
- **More:** About row remains `kind: 'native'` → `/learn/about`.

### Data (native modeling room)

- **Route:** `/data` — canvas masthead + ledger sections with visual structure, not a text-only ledger.
- **Viz:** Coverage pulse (fixture / deferred / catalog); Census model frame (ghost decade axis + honest empty); race-pair `ProportionBar` (copper on primary only); grouped `SparklineStrip` + text rows; method callouts for juxtaposition / Themes hand-off.
- **Fixtures:** Phase 1 indicator bundle ships on-device (`features/data/indicator-snapshot.ts`) matching web fixture figures. Census national timeline remains deferred until mobile warehouse API.
- **Binding:** `design-direction-v6-data.md` adapted to Ledger; mosaic atmosphere web-only.
- **More:** Data row is `kind: 'native'` → `/data`.

### Submit (native shell)

- **Shell:** `/submit` explains corrections vs leads; primary CTA opens native `/corrections/submit`.
- **Leads:** Moderated lead form remains web secondary (`Open lead form on web`) until a native lead intake API exists.
- **More:** Submit row is `kind: 'native'` → `/submit` (not Safari-primary).

---

## 8. Layout rules

- **Density:** `ListRow` / `LedgerRow` with `density="compact"` on browse indexes; titles at `rowTitle` (13 Medium).
- **Facts:** mono label row above editorial value; never equal 4-column grids with vertical rules.
- **Cards:** avoid on browse tabs; when used, `LiftedSurface tone="surface"` flat, no gradients/glows/elevation.
- **Copy:** no em dashes in user-facing strings on touched surfaces.
- **Touch:** 44dp minimum targets on interactive controls.
- **Themes:** verify light and dark before calling UI done.
- **Map plate:** fixed dark archive basemap (ADR-013); does not flip with OS theme. Place/street labels + street casing on OpenFreeMap; copper selection ring; padded CONUS camera. Floating instruments follow OS theme via `useThemeColors` / explore chrome helpers.

---

## 9. Deferred gaps

| Gap | Reason | Track |
|---|---|---|
| Full history edition (decade scrubber, graph) | Requires release graph API + native timeline | Follow web `HistoryExperience` |
| Native Law / Memorial / Themes / Submit | Shipped on-device (Themes/Submit Wave 3); live API refresh later | Deferred listing APIs |
| Books live snapshot / API refresh | Seed embedded + source/release labeled | Deferred mobile `bannedBooksListing` API |
| Full web gutter mosaic scatter | Pixel-perfect CSS polaroid gutters | Mobile edition headers use brand lockup instead; collage tiles retained unused; Explore map plate excluded |
| Census decade charts on Data | Warehouse timeline not on mobile API | Honest model frame + empty state; fixture indicators ship |

---

## 10. Adoption checklist (siblings)

When building or rebuilding a mobile surface:

1. Start from `BrowseScreenShell`, `UtilityScreenShell`, or `ScreenCanvas` + `ScreenHeader` / `EditionBrandHeader` — never raw `View` chrome.
2. On browse tabs, split sections with `LedgerSectionLabel` + hairlines — do **not** wrap every section in `LiftedSurface` / indexed `EditionSurfacePanel`.
3. Use `RecordFactStrip` for Kind / Era / Status — not inline slug lines.
4. Route actions through `Button` variants; copper only for ghost links and accent CTAs.
5. Import tab/stack options from `edition-chrome.ts` — no local `tabBarActiveTintColor` literals.
6. Brand mark: use `Logo` / `EditionBrandHeader` with approved light/dark lockup (or symbol in tight spaces). Never type the wordmark next to a bare symbol render; never recolor, stretch, or add effects to the mark.
7. Update this doc if scope or inventory changes.

---

## Related

- [`docs/ui/README.md`](./README.md) pattern index
- [`docs/ui/mobile-polish-mockups.html`](./mobile-polish-mockups.html) Ledger Line mockup
- [`apps/mobile/src/shell/mobile-nav.ts`](../../apps/mobile/src/shell/mobile-nav.ts)
- [`apps/mobile/src/shell/edition-chrome.ts`](../../apps/mobile/src/shell/edition-chrome.ts)
- Web pattern registry: [`patterns-registry.md`](./patterns-registry.md)
