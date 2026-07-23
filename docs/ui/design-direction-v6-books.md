# BlackStory design direction v6 — books edition

**Status:** binding layout pattern for `/books` and `/books/*` (2026-07-23, redesign pass).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** `design-direction-v5.md` § books browse cards + entity mast detail; prior v6 hairline grid rail.  
**Unchanged:** banned-books data contract, browse URL params (`q`, `state`, `author`, `sort`, `dir`, `page`), Bookshop affiliate links.

---

## 1. Intent

Books is the **challenged-titles reference catalog** inside the same archive edition as `/`, `/stories`, and `/law`. Readers search and filter reported school and library restrictions, open a title for jurisdiction evidence, and follow purchase or archive off-ramps.

Design goals:

- **Arrive** through beat 00 intro with **catalog pulse** (corpus size, author breadth, state coverage, snapshot date).
- **Browse** a **rip list** with cover thumbnails, EditionFactIcon fact stacks, and removable active filter chips.
- **Inspect** detail intro with **BooksAnatomyStrip**, large cover, and optional **RecordAnatomyPanel** when a linked entity has geo.
- **Read** primary context story first; related titles and depart links stay **below** evidence panels.
- **Trust** through provenance, affiliate disclosure, fail-closed cover placeholders, and USPS-validated state codes.

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **page gutters only** (shared register with home/stories/about).

---

## 2. Canvas law — theme-aware edition + shared atmosphere

| Rule | Light theme | Dark theme |
|---|---|---|
| Page canvas | Archive Paper `#F4EFE5` (`--ds-canvas`) | Black Ink `#0A0A0A` |
| Edition panels | Surface `#FBF8F2` (`--ds-surface-raised`) | Charcoal mix on Surface |
| Ink / Charcoal bands | **Not on books** | **Not on books** |
| Copper | Text `#8E4F2A`, graphic `#B86B2A` | Text `#D07A32`, graphic `#D07A32` |
| Atmosphere | **Home-aligned gutter mosaic** — grain + archive grid + scattered collage tiles | Same; tile opacity scales down in dark |

**Atmosphere stack (shared):**

1. Fixed pseudo-element texture via `.ds-edition-atmosphere-canvas`.
2. `EditionAtmosphereMosaic` with seed `books-edition-v6` (browse); `books-edition-v6:{slug}` on detail.
3. `prefers-reduced-motion` hides live mosaic tiles.

**Banned on books:** fixed-ink mast bands, entity-layout aside column, three-column card grid, shadows, gradients, glows, bevels, blur.

---

## 3. Page scaffold

### 3.1 Browse (`/books`)

```
┌─ ds-books-edition + ds-edition-atmosphere-canvas ───────────────┐
│  [ EditionAtmosphereMosaic — seed: books-edition-v6 ]          │
│  ┌─ main (max ~84rem, centered) ─────────────────────────────┐ │
│  │  [ Beat 00 — Intro: header + catalog pulse + crosslinks ]  │ │
│  │  [ Beat 01 — Catalog: search + facets + rip list ]         │ │
│  │  [ Beat 02 — About: how to read this list ]                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Detail (`/books/[slug]`)

```
┌─ ds-books-edition + atmosphere canvas ──────────────────────────┐
│  [ Beat 00 — Intro: cover + title + anatomy strip + Buy ]      │
│  [ Beat 01 — Context: primary description ]                     │
│  [ Beat 02 — Challenges: states + jurisdiction evidence ]       │
│  [ Beat 03 — Evidence: citation ledger ]                        │
│  [ Beat 04 — Lookup: purchase + identifiers + provenance ]      │
│  [ Beat 05 — Place: RecordAnatomyPanel when entity geo exists ] │
│  [ Beat 06 — Related: same-author / same-state rip rows ]        │
│  [ Beat 07 — Connected: depart links ]                          │
└─────────────────────────────────────────────────────────────────┘
```

**Reading order (DOM + a11y):** intro → context (primary story) → challenges → evidence → lookup → place (optional) → related → connected.

Detail uses a **single-column Surface stack** only. Entity aside and at-a-glance band are superseded by intro anatomy strip + lookup panel.

---

## 4. Rhythm tokens (align with home/stories v6)

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` ( `1rem` ≤48rem ) | Horizontal padding of `main` |
| Card gap | `1.25rem` | Vertical stack gap between edition panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule borders, `--ds-radius-md` on panels, `--ds-radius-sm` on buttons/inputs. Flat matte only.

---

## 5. Beat 00 — Intro panel (browse)

| Element | Spec |
|---|---|
| Index | Mono copper numeral `00` |
| Kicker | IBM Plex Mono uppercase copper slug: `Reference` |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`Banned <em>books</em>.`) |
| Lede | Source Serif 4, Stone, max ~54ch |
| Pulse | Mono fact strip: titles · authors · states cited · snapshot date |
| Crosslinks | Quiet `ds-cta-link` to History publications, Stories, Methodology |
| Mosaic credit | Mono footnote with link to mosaic credits |

No copper CTA in browse intro.

---

## 6. Beat 01 — Catalog panel

| Element | Spec |
|---|---|
| Index | `01` |
| Kicker | `Catalog` |
| Search | `BooksSearchTypeahead` (local corpus suggest; GET `q` param) |
| Facets | Auto-submit State + Author selects; Clear link resets to `/books` |
| Active filters | Removable chips when `q`, `state`, or `author` active |
| Sort | Pill links preserve active filters; toggle `dir` on re-activate |
| Count | Mono label (`N titles · page X of Y`) |
| Rip list | Single column; each row: **cover thumbnail** (Open Library ISBN or initials placeholder), title link, editorial summary, **EditionFactIcon fact stack** (Author · Year · Citations · States), quiet Details + copper Buy |
| Empty | `EmptyState` with clear-filters CTA |
| Pagination | Previous / numbered pages / Next; preserves filters |

Browse URL contract is **unchanged** from v5: `q`, `state`, `author`, `sort`, `dir`, `page`.

---

## 7. Beat 02 — About panel

| Element | Spec |
|---|---|
| Index | `02` |
| Kicker | `About` |
| Title | How to read this list |
| Lede | Citation scope, USPS state code meaning, Bookshop affiliate disclosure |
| Actions | Quiet Methodology + Search publications |

---

## 8. Detail beats

| Beat | Kicker | Content |
|---|---|---|
| 00 Intro | `Challenged book` | Large cover, title, state tags, **one copper Buy** when Bookshop link exists, **BooksAnatomyStrip** |
| 01 Context | `Context` | Description (primary reading) |
| 02 Challenges | `Challenges` | State tags, jurisdiction evidence list |
| 03 Evidence | `Evidence` | Citation ledger |
| 04 Lookup | `Lookup` | Other purchase links, identifiers, provenance |
| 05 Place | `Place` | **RecordAnatomyPanel** when `canonicalEntityId` resolves with geo (optional) |
| 06 Related | `Related` | Same-author / overlapping-state rip rows; entity link when present |
| 07 Connected | `Connected` | All titles, History, Methodology |

---

## 9. Copper discipline

| Surface | Copper allowed |
|---|---|
| Browse intro | Indices, kickers, link hover only |
| Catalog rip rows | One copper Buy per row (when Bookshop present); active sort border; active filter chip border |
| Detail intro | **One copper Buy on Bookshop** |
| Connected / About | Quiet CTAs only |

Never two copper-filled buttons in the same row competing for primary action.

---

## 10. Shared modules

| Module | Path | Role |
|---|---|---|
| Edition atmosphere CSS | `components/patterns/edition-atmosphere/edition-atmosphere.css` | Grain + grid + tile placement |
| Edition atmosphere mosaic | `components/patterns/edition-atmosphere/EditionAtmosphereMosaic.tsx` | Client gutter tiles |
| Edition fact icon | `components/patterns/EditionFactIcon.tsx` | Rip row + anatomy labels |
| Record anatomy | `components/patterns/RecordAnatomyPanel.tsx` | Optional place panel on detail |
| Books panel chrome | `app/books/books-panel-chrome.ts` | Class-name helpers + mosaic seed |
| Books edition CSS | `app/books/books-edition.css` | Surface stack + rip list + anatomy |
| Books copy | `app/books/books-copy.ts` | Centralized route copy |
| Books cover | `app/books/books-cover.ts`, `BooksCoverArt.tsx` | Open Library cover + fail-closed placeholder |
| Books rip row | `app/books/BooksRipRow.tsx` | Browse + related list rows |
| Books anatomy strip | `app/books/BooksAnatomyStrip.tsx` | Detail intro fact strip |
| Books catalog pulse | `app/books/BooksCatalogPulse.tsx` | Browse intro corpus stats |
| Books typeahead | `app/books/BooksSearchTypeahead.tsx` | Local corpus suggest |

---

## 11. Adoption checklist

- [ ] Route wrapper uses `booksEditionRootClassName()` (includes atmosphere canvas).
- [ ] `EditionAtmosphereMosaic` mounted with `books-edition-v6` (browse) or per-slug seed (detail).
- [ ] All beats are opaque Surface panels; no entity mast or aside column.
- [ ] Browse rip rows use `BooksRipRow` with cover fail-closed and EditionFactIcon stacks.
- [ ] Detail reading order: context before related/connected.
- [ ] Light + dark theme verified; mosaic tiles subdued in dark.
- [ ] `prefers-reduced-motion`: mosaic hidden.
- [ ] Browse GET params preserved (`q`, `state`, `author`, `sort`, `dir`, `page`).
- [ ] No em dashes in touched copy.
- [ ] Tests: `books-panel-chrome.test.ts`, `books-page.test.ts`, `books-view-model.test.ts`, `books-cover.test.ts`.

---

## 12. Superseded patterns

| v5 / prior v6 pattern | v6 redesign replacement |
|---|---|
| `.ds-books-page` flat document page | `.ds-books-edition` Surface stack |
| `.ds-page__eyebrow` / `.ds-page__title` mast | Edition header (`ds-books-edition__*`) |
| Three-column `.ds-books-grid` cards | Compact **rip list** with cover + fact stacks |
| Two-column hairline grid rail | Single-column rip list (history-style) |
| Entity mast + aside on detail | Intro anatomy strip + lookup panel |
| `.ds-at-a-glance` band | `BooksAnatomyStrip` inside intro panel |
| Entity link in context panel | Related panel below primary story |
