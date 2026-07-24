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

### Explore chrome

- **Count chip:** hairline-outline pill, transparent center, mono/caption — not opaque Surface slab.
- **Floating instruments:** Surface/ghost + Rule border, radius 8; no decorative shadows.
- **Insets:** 16px side gutters aligned with tab content (`exploreContentInset` = `screenScrollInsets.paddingHorizontal`).

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

| Surface | Mobile route | Shell | Web binding |
|---|---|---|---|
| **Explore** | `(tabs)/explore` | Map-led + outline count chip | `design-direction-v6-explore.md` |
| **History / find-in-time** | `(tabs)/history` | Canvas + `ScreenHeader` + ledger sections | `design-direction-v6-history.md` |
| **Stories** | `(tabs)/learn` | Canvas + `ScreenHeader` + ledger sections | `design-direction-v6-stories.md` |
| **More** | `(tabs)/more` | `BrowseScreenShell` + section labels + rows | web overflow nav |
| **Data** | `/data` | Canvas masthead + ledger sections | `design-direction-v6-data.md` |
| **Methodology / About / errata** | `/learn/*` | Canvas ledger or `UtilityScreenShell` | per surface doc |
| **Corrections** | `/corrections/*` | `UtilityScreenShell` | `patterns-utility-edition.md` |
| **Entity detail** | `/entity/[id]` | Flat section stacks on canvas | `design-direction-v6-entity.md` |
| **Legacy search** | `(tabs)/search` | Redirect → `/history` | merged per v6 history |

---

## 8. Layout rules

- **Density:** `ListRow` / `LedgerRow` with `density="compact"` on browse indexes; titles at `rowTitle` (13 Medium).
- **Facts:** mono label row above editorial value; never equal 4-column grids with vertical rules.
- **Cards:** avoid on browse tabs; when used, `LiftedSurface tone="surface"` flat, no gradients/glows/elevation.
- **Copy:** no em dashes in user-facing strings on touched surfaces.
- **Touch:** 44dp minimum targets on interactive controls.
- **Themes:** verify light and dark before calling UI done.
- **Map plate:** fixed dark archive basemap (ADR-013); does not flip with OS theme. Floating instruments follow OS theme via `useThemeColors` / explore chrome helpers.

---

## 9. Deferred gaps

| Gap | Reason | Track |
|---|---|---|
| Full history edition (decade scrubber, graph) | Requires release graph API + native timeline | Follow web `HistoryExperience` |
| Native Themes / Law / Books editions | Catalog size + web browse controls | More tab web handoffs |
| Gutter mosaic atmosphere | Web-only CSS stack | Flat canvas ledger on mobile |
| Census decade charts on Data | Warehouse timeline not on mobile API | Honest empty state |

---

## 10. Adoption checklist (siblings)

When building or rebuilding a mobile surface:

1. Start from `BrowseScreenShell`, `UtilityScreenShell`, or `ScreenCanvas` + `ScreenHeader` — never raw `View` chrome.
2. On browse tabs, split sections with `LedgerSectionLabel` + hairlines — do **not** wrap every section in `LiftedSurface` / indexed `EditionSurfacePanel`.
3. Use `RecordFactStrip` for Kind / Era / Status — not inline slug lines.
4. Route actions through `Button` variants; copper only for ghost links and accent CTAs.
5. Import tab/stack options from `edition-chrome.ts` — no local `tabBarActiveTintColor` literals.
6. Update this doc if scope or inventory changes.

---

## Related

- [`docs/ui/README.md`](./README.md) pattern index
- [`docs/ui/mobile-polish-mockups.html`](./mobile-polish-mockups.html) Ledger Line mockup
- [`apps/mobile/src/shell/mobile-nav.ts`](../../apps/mobile/src/shell/mobile-nav.ts)
- [`apps/mobile/src/shell/edition-chrome.ts`](../../apps/mobile/src/shell/edition-chrome.ts)
- Web pattern registry: [`patterns-registry.md`](./patterns-registry.md)
