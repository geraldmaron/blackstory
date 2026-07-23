# Browse mode pattern

**Status:** reusable site pattern (2026-07-23).  
**Scope:** record carousels and session lists that need prev/next with an ordered/random toggle.  
**Home binding:** beat 02 on `/` (`design-direction-v6-home.md`).

---

## Intent

Readers should be able to walk a release set sequentially or sample it randomly without rebuilding bespoke controls on every surface. The pattern keeps navigation, mode, and position counter in one toolbar so Explore, Search, Themes, and entity session chrome can adopt the same affordances later.

---

## Components

| Module | Role |
|---|---|
| `apps/web/src/components/patterns/browse-mode.ts` | Pure helpers: `stepIndex`, `pickRandomIndex`, `formatBrowsePosition` |
| `apps/web/src/components/patterns/BrowseModeToggle.tsx` | Segmented Ordered / Random toggle (`aria-pressed`) |
| `apps/web/src/components/patterns/RecordBrowseControls.tsx` | Toolbar: arrows, optional dots, toggle, position |
| `apps/web/src/components/patterns/browse-mode.css` | `ds-browse-mode-toggle*` and `ds-record-browse*` tokens |
| `apps/web/src/components/patterns/home-featured-set.ts` | Home-only release set builder (curated ids first, then full release) |

Import `browse-mode.css` once per route bundle that renders the controls (home imports it from `app/(map)/page.tsx`).

---

## Behavior

### Ordered mode

- Previous / next step through the full set with wraparound.
- Position counter: `n / total` (mono, tabular nums).
- Dot rail renders when `total ≤ 12` and `onGoTo` + `itemIds` are provided.

### Random mode

- Previous / next pick a different index at random (never repeats the current slide when `total > 1`).
- Position counter: `Random · N records` (still exposes total available).
- Dot rail hidden (direct index jumps conflict with random sampling).

### Accessibility

- 44px minimum touch targets on arrows and toggle segments.
- `:focus-visible` rings on all interactive controls.
- ArrowLeft / ArrowRight on the toolbar focus target.
- Toggle uses `role="group"` + `aria-pressed` per segment (not a checkbox styled as a switch).
- Copper signals active toggle segment only (border/text accent, flat matte fill).

---

## Brand constraints

- Flat matte surfaces; no shadows, gradients, glows, or bevels.
- Theme-aware via `--ds-*` tokens (light Archive Paper / dark charcoal).
- No em dashes in user-facing copy.
- Copper budget: toggle active state uses `--ds-accent` text + inset rule, not a copper plate under body-size labels.

---

## Adoption checklist

When wiring on a new surface:

1. Parent owns `index`, `BrowseMode`, and the entity id list.
2. Call `stepIndex` / `pickRandomIndex` from `browse-mode.ts` inside prev/next handlers.
3. Render `RecordBrowseControls` in the surface toolbar.
4. Import `browse-mode.css` from the route or layout that ships the surface.
5. Keep one copper primary CTA per visible record card (home beat 02 law).

---

## Related patterns

- Entity detail session nav (`EntitySessionNav`) uses the same random/ordered semantics with Back/Next buttons instead of a carousel toolbar. Prefer `RecordBrowseControls` when the surface is index-based; prefer `EntitySessionNav` when the surface maintains an explicit back stack.
