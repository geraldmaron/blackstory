# BlackStory design direction v6 — search edition

**Status:** **SUPERSEDED** (2026-07-23) — merged into [`design-direction-v6-history.md`](./design-direction-v6-history.md). `/search` redirects to `/history`; rip-list and facet patterns live on the unified **Find in time** surface.  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary).  
**Supersedes:** `design-direction-v5.md` §6 `/search` ledger mast + numbered index rows (historical).  
**Redirect:** `/search?q=…&kind=…&status=…&era=…` → `/history?…` (same param names where applicable).

> **Do not implement new `/search` UI.** Read the History v6 doc § "Unified find-in-time surface" instead.

---

## 1. Intent

Search is the **archive index**: keyword entry, facet narrowing, and a scannable result rip list inside the same **edition Surface** language as home and explore. Readers should feel they are still in the institutional archive, not on a separate v5 atlas instrument page.

Design goals:

- **Find** through a compact query mast inside an opaque Surface panel (not a display-scale headline input).
- **Narrow** through auto-applying facet rows (Kind · Status · Era) with mono labels and native selects.
- **Scan** results as hairline rip rows with label-over-value facts (edition fact icons where the field maps to record anatomy).
- **Recover** from empty states with product voice, catalog recommendations, and hand-offs to map and browse.
- **Share** every query as a plain GET URL (preserve existing param contract).

Chrome is **opaque Surface**, theme-aware, flat matte. No ink-glass, no blur, no fixed-ink overrides.

---

## 2. Canvas law — document edition panels

| Layer | Rule |
|---|---|
| Page canvas | Archive Paper `#F4EFE5` / Black Ink `#0A0A0A` via reader `data-theme` |
| Edition panels | Opaque `--ds-surface`, 1px `--ds-rule`, `--ds-radius-md` |
| Panel padding | `1.25rem` (`--ds-space-5`) default; `1rem` on narrow viewports |
| Panel stack gap | `1.25rem` between mast and results cards |
| Copper | One copper submit CTA in mast; copper left rule on rip row hover/focus; facet links use copper-text |
| Atmosphere | **None** — no gutter mosaic on search |

**Banned on search:** shadows, gradients, glows, bevels, `backdrop-filter`, `--ds-fixed-*` panel stamps, v5 display-scale query mast (`.ds-search-mast__input` headline treatment).

---

## 3. Page scaffold

```
┌─ main.ds-search-edition (max content width, page inset) ────────┐
│  [ Mast panel — Surface card ]                                   │
│    Edition kicker + title + lede                                 │
│    Keywords row (label, input, copper Search)                    │
│    Facet rows (Kind · Status · Era) — auto-submit on change      │
│    Clear filters (when any param active)                         │
│  [ Results panel — Surface card ]                                │
│    Mono count line                                               │
│    Rip list (hairline rows, labeled facts)                       │
│    Quiet pagination                                              │
│    Recommendations strip (zero-result only)                      │
└──────────────────────────────────────────────────────────────────┘
```

**Regions:**

| Region | Job | v6 pattern |
|---|---|---|
| Mast header | Orient the reader | Mono copper kicker + Sora title + serif lede |
| Query row | Keyword entry | Compact input (`44px` min height), one copper CTA |
| Facet rows | Narrow catalog | Explore-style label + select grid; GET auto-submit |
| Count | Result cardinality | Mono uppercase slug |
| Rip list | Scan + open records | Hairline rows; no numbered ledger index |
| Fact strip | At-a-glance anatomy | Label-over-value with `EditionFactIcon` (Kind, Era); Status when present |
| Empty state | Recover gracefully | Suggest broader query; link map + clear filters |
| Recommendations | Catalog grounding | Same rip row anatomy under "From the archive" |

---

## 4. Mast panel

### 4.1 Header

| Part | Typography |
|---|---|
| Kicker | IBM Plex Mono uppercase, copper text — e.g. `Archive index` |
| Title | Sora SemiBold — *Search the **archive**.* (`<em>` in Source Serif copper) |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from form by bottom Rule hairline.

### 4.2 Query row

| Element | Spec |
|---|---|
| Label | Mono uppercase, Stone — `Keywords` |
| Input | Inter, `--ds-radius-sm`, Rule border, `44px` min height; **not** display-scale Sora |
| Submit | One copper CTA — `Search` |
| Method | GET `/search`; preserves `q` + facet params on submit |

### 4.3 Facet rows

Reuse explore facet rhythm (`label column · select column`), implemented as search-local classes:

1. **Kind** — options from live facet counts (`All kinds · Place (n) · …`).
2. **Status** — same contract as today.
3. **Era** — same contract as today.

Each select auto-submits the parent form on change (no Apply button). `Clear filters` links to `/search` when any param differs from default.

---

## 5. Results rip list

### 5.1 Row anatomy (binding)

Each result is a **hairline row**, not a numbered ledger entry (v5 `.ds-index` is retired for `/search`).

| Zone | Content |
|---|---|
| Title | Sora link to `/entity/{id}` |
| Summary | Source Serif 4, Stone, 1–2 line clamp |
| Fact strip | Soft horizontal grid of label-over-value cells |

**Fact strip fields (in order, skip when empty):**

| Field | Icon | Value source |
|---|---|---|
| Kind | `EditionFactIcon` record-kind (muted) | `displayEncodingFor(kind).label`; link to explore kind filter when useful |
| Era | `EditionFactIcon` record-era | `eraFactLink(eraBuckets)` label; optional explore era link |
| Status | (text label only) | `StatusMark` when status present |
| Match | (text label only) | `matchedText` when it differs from display name |

Do **not** render full `RecordAnatomyPanel` in list rows (no map preview in the index). Spotlight/detail pages own the full anatomy panel.

### 5.2 Row chrome

| State | Treatment |
|---|---|
| Default | Top Rule hairline separator |
| Hover / focus-within | Subtle surface-raised wash + 3px copper left rule |
| Selected | N/A (search navigates away; no in-page selection) |

### 5.3 Pagination

Quiet secondary CTAs (`Previous page` / `Next page`); preserve plain `offset` param contract.

---

## 6. Empty + recommendation states

### Zero results

- Title: `Nothing matched, yet`
- Body: suggest broader keyword or reset facets (no em dashes).
- Actions: `Clear filters` + inline link to `/explore`.
- When recommendations exist: second count line `From the archive` + rip list of catalog picks.

### Populated browse (no query)

- Results rip list only; no duplicate recommendation strip when `totalMatched > 0`.

---

## 7. Pattern reuse

| Pattern | Search adoption |
|---|---|
| Surface panel cards | Mast + results panels |
| Edition mono kickers | Mast header slug |
| `EditionFactIcon` | Rip row Kind + Era labels |
| Explore facet row rhythm | Mast facet grid (local CSS, same behavior) |
| Auto-submit GET selects | Facets (`SearchFacetField.tsx`) |
| Hairline rip list | Results + recommendations (explore rail vocabulary, document context) |
| Theme-aware canvas | Panels follow reader light/dark |

**Not adopted on search:** `RecordAnatomyPanel` (list density), `BrowseModeToggle` (no in-page carousel), map plate chrome.

---

## 8. Rip list — v6 search vs v5 search

| Topic | v5 search (superseded) | v6 search (binding) |
|---|---|---|
| Mast query | Display-scale Sora input over heavy ink rule | Compact labeled input inside Surface panel |
| Results container | Flat document stack | Opaque Surface results panel |
| Row layout | Numbered ledger index (`.ds-index`) | Hairline rip rows, no index numerals |
| Row meta | Inline slug badges | Label-over-value fact strip with edition icons |
| Facets | Pill selects inline | Facet row grid, auto-submit |
| Visual kinship | Atlas instrument | Home/explore edition Surface vocabulary |

**Carried forward:** GET URL params, `buildSearchViewModel` contract, pagination offsets, `EmptyState` voice, 44px control targets, WCAG focus rings.

---

## 9. Implementation pointers

- Route: `apps/web/src/app/search/page.tsx` (thin server shell).
- Sections: `SearchBrowseSections.tsx`, `SearchRipRow.tsx`, `SearchFacetField.tsx`.
- Facts helper: `search-entity-facts.ts` (era/kind labels from `SearchResultView`).
- CSS: `search-edition.css` (panels + rip list); retire v5 overrides in `search.css`.
- Patterns CSS: import `edition-fact-icon.css` once on the route.
- Tests: `search-page.test.ts` (CSS contracts), `search-entity-facts.test.ts`, existing `search-view-model.test.ts`.

---

## 10. Acceptance checklist

- [x] Mast + results use opaque Surface panels in light and dark theme
- [x] No v5 display-scale query mast on `/search`
- [x] Results use rip list (no `.ds-index` numbered rows)
- [x] Rip rows show label-over-value facts with `EditionFactIcon` for Kind and Era
- [x] Facets auto-submit on change; URL param contract unchanged
- [x] No em dashes in touched search copy
- [x] Empty state offers clear filters + explore hand-off
- [x] Pagination preserves `offset` behavior
- [x] Tests cover v6 surface class contracts + view model (unchanged)

---

## 11. Supersession

For **`/search` only**, this document supersedes:

- `design-direction-v5.md` §6 `/search` mast + ledger index bullets
- v5 "query IS the headline" search mast on this route

Home v6, explore v6, and brand tokens remain binding for shared vocabulary.
