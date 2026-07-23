# BlackStory design direction v6 — mobile foundation (full rebuild)

**Status:** binding rebuild contract (2026-07-23).  
**Scope:** native shell, chrome, design-system primitives, and browse-surface patterns. Sibling agents own Explore map instruments and entity detail stacks.  
**Parent docs:** [`brand.md`](./brand.md), web v6 surface directions, [`patterns-browse-mode.md`](./patterns-browse-mode.md), [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md), [`patterns-utility-edition.md`](./patterns-utility-edition.md).

---

## 1. Intent

Mobile must read as the same **archive edition product** as the website: Archive Paper / Black Ink canvas, Surface panels with hairline rules, label-over-value facts, copper as navigational signal only (~10–15%), flat matte everywhere except the ADR-013 map plate. No v5 dark-cockpit chrome, no Expo template tints, no gradient elevation wash.

This document is the **foundation contract** siblings must import from — not a polish checklist.

---

## 2. What was ripped (2026-07-23)

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

**Kept (narrow exception):** `getShadowStyle('sm'|'md'|'lg')` for map floating instruments only (ADR-013 explore chrome). Browse/tab/stack surfaces must pass `shadow="none"` or omit (default).

---

## 3. Theme tokens

Generated from `brand/tokens` via `pnpm --filter @repo/mobile tokens:generate`. Hand-written resolution in `src/ui/tokens/index.ts`.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#F4EFE5` Archive Paper | `#0A0A0A` Black Ink |
| Surface | `#FBF8F2` | `#161616` Charcoal |
| Surface raised | `#FBF8F2` | `#1C1B18` |
| Ink | `#0A0A0A` | `#F4EFE5` |
| Stone (muted) | `#6D675F` | `#BDB5A9` |
| Rule (border) | `#D7D0C4` | `#34302C` |
| Copper text | `#8E4F2A` | `#D07A32` |
| Copper graphic | `#B86B2A` | `#D07A32` |

**Resolution:** explicit OS `dark` → dark palette; everything else (including `null`) → light. Matches web bootstrap (`prefers-color-scheme` with light fallback).

**Typography:** Sora SemiBold display; Inter UI; Source Serif 4 editorial; IBM Plex Mono data — from `typeScale` / `resolveFontFamily`.

---

## 4. Shell chrome

| Module | Role |
|---|---|
| `src/shell/mobile-nav.ts` | Tab IA + More menu parity with web `shell-nav` |
| `src/shell/edition-chrome.ts` | `useEditionTabBarOptions`, `useEditionStackScreenOptions`, `editionTabIcon` |
| `src/app/(tabs)/_layout.tsx` | Four tabs via edition tab bar (no inline tint literals) |
| `src/app/_layout.tsx` | Stack routes via edition stack headers |

Tab bar: matte Surface plate, rule hairline top border, copper active label/icon, stone idle. Stack: canvas header fill, ink title (Inter SemiBold 17), copper back/actions, no header shadow.

---

## 5. Layout primitives (required)

Screens must compose from these — no one-off chrome.

| Module | Use when |
|---|---|
| `ScreenCanvas` | Full-bleed canvas behind every route |
| `ScreenHeader` | Tab-root masthead (kicker + title + dek) |
| `EditionPanelHeader` | Indexed utility/browse panel header (00, 01…) |
| `BrowseScreenShell` | Tab-root browse pages (History, Stories home, More) |
| `UtilityScreenShell` | Trust/discover utilities (corrections, status) |
| `EditionSurfacePanel` | Single indexed Surface card with optional panel label/meta |
| `EditionSurfaceStack` | Vertical gap stack between edition panels |
| `LiftedSurface` | Low-level Surface card (`shadow` defaults `none`) |
| `ListRow` | Settings / menu / navigation rows (`density="compact"`) |
| `LedgerRow` | Rip-list search/history result density |
| `EditionFactCell` | Label-over-value fact cell |
| `RecordFactStrip` | 2-column wrap grid of fact cells |
| `Button` | Primary (ink), secondary (surface + rule), ghost (copper text), accent (ink + copper rule) |
| `SectionHeader` | In-page section labels inside browse shells |
| `NavIcon` | Tab and menu glyphs; copper when selected |

Import era/kind/status labels from `src/features/record-facts/record-facts.ts`. Replace unicode dashes in displayed ranges with plain ` to `.

---

## 6. Screen inventory

| Surface | Mobile route | Shell | Web binding |
|---|---|---|---|
| **Explore** | `(tabs)/explore` | Map-led (sibling) | `design-direction-v6-explore.md` |
| **History / find-in-time** | `(tabs)/history` | `BrowseScreenShell` + rip rows | `design-direction-v6-history.md` |
| **Stories** | `(tabs)/learn` | `BrowseScreenShell` | `design-direction-v6-stories.md` |
| **More** | `(tabs)/more` | `BrowseScreenShell` + sectioned `LiftedSurface` | web overflow nav |
| **Data** | `/data` | `BrowseScreenShell` (stack push) | `design-direction-v6-data.md` |
| **Methodology / About / errata** | `/learn/*` | `BrowseScreenShell` or `UtilityScreenShell` | per surface doc |
| **Corrections** | `/corrections/*` | `UtilityScreenShell` | `patterns-utility-edition.md` |
| **Entity detail** | `/entity/[id]` | Stack (sibling) | `design-direction-v6-entity.md` |
| **Legacy search** | `(tabs)/search` | Redirect → `/history` | merged per v6 history |

---

## 7. Layout rules

- **Density:** `ListRow` / `LedgerRow` with `density="compact"` on browse indexes.
- **Facts:** mono label row above editorial value; never equal 4-column grids with vertical rules.
- **Cards:** `LiftedSurface tone="surface"`; no gradients, glows, or elevation on browse surfaces.
- **Copy:** no em dashes in user-facing strings on touched surfaces.
- **Touch:** 44dp minimum targets on interactive controls.
- **Themes:** verify light and dark before calling UI done.
- **Map plate:** fixed dark archive basemap (ADR-013); does not flip with OS theme. Floating instruments follow OS theme via `useThemeColors`.

---

## 8. Deferred gaps

| Gap | Reason | Track |
|---|---|---|
| Full history edition (decade scrubber, graph) | Requires release graph API + native timeline | Follow web `HistoryExperience` |
| Native Themes / Law / Books editions | Catalog size + web browse controls | More tab web handoffs |
| Gutter mosaic atmosphere | Web-only CSS stack | Flat Surface panels on mobile |
| Census decade charts on Data | Warehouse timeline not on mobile API | Honest empty state |

---

## 9. Adoption checklist (siblings)

When building or rebuilding a mobile surface:

1. Start from `BrowseScreenShell`, `UtilityScreenShell`, or `ScreenCanvas` + `ScreenHeader` — never raw `View` chrome.
2. Wrap content sections in `LiftedSurface` (default flat).
3. Use `RecordFactStrip` for Kind / Era / Status — not inline slug lines.
4. Route actions through `Button` variants; copper only for ghost links and accent CTAs.
5. Import tab/stack options from `edition-chrome.ts` — no local `tabBarActiveTintColor` literals.
6. Update this doc if scope or inventory changes.

---

## Related

- [`docs/ui/README.md`](./README.md) pattern index
- [`apps/mobile/src/shell/mobile-nav.ts`](../../apps/mobile/src/shell/mobile-nav.ts)
- [`apps/mobile/src/shell/edition-chrome.ts`](../../apps/mobile/src/shell/edition-chrome.ts)
- Web pattern registry: [`patterns-registry.md`](./patterns-registry.md)
