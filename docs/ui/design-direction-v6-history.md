# BlackStory design direction v6 — history edition

**Status:** binding layout pattern for `/history` — unified **Find in time** surface (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary).  
**Supersedes:** `design-direction-v5.md` § `/history` document rhythm only; **`design-direction-v6-search.md`** (search merged here).  
**Unchanged:** URL state machine, graph release snapshot contract, dignity rules, synchronized list peer.

---

## 0. Unified find-in-time surface (Search merge)

`/search` is **not** a separate public route. Legacy `/search` URLs redirect to `/history` with query params preserved (`q`, `kind`, `status`, `era`, `topic`, `offset`).

| Capability | Where on `/history` |
|---|---|
| Keyword search | Beat 02 instruments panel (`q` param) |
| Kind / Status / Era facets | Beat 02 facet rows + kind chips |
| Rip-list record facts | Beat 03 records panel (`HistoryRipRow`) |
| Decade timeline | Beat 01 (owner-loved temporal browse) |
| Composition + connections | Beat 03 composition panel |

**Era/status display rule:** show concrete era spans and lifecycle status from entity `eraBuckets`, legacy `era` text, `eventWindow`, or `statusHistory` before falling back to "Undated" or "Status not yet published". Never default to empty when release data exists under another field name.

---

## 1. Intent

History is the **temporal atlas**: decade-by-decade browse over published release artifacts with kind composition, documented connections, and a synchronized accessible list. Readers should feel they are still inside the same **archive edition** as `/` and `/explore`, not a legacy document page with ad hoc chrome.

Design goals:

- **Orient** through a sticky decade scrubber (same instrument register as explore line-decade control).
- **Summarize** coverage with a compact overview strip (counts + decade density sparkline).
- **Filter** through auto-applying facet rows and kind chips inside a Surface instruments panel.
- **Inspect** kind composition, connections, and archive framings in a Surface data panel.
- **Navigate** records through a hairline list peer with copper selection affordance.
- **Trust** through dignity framing, release metadata, and evidence-before-assertion copy.

Chrome is **opaque Surface**, theme-aware, flat matte. No fixed-ink bands, no blur, no decorative atmosphere on this route.

---

## 2. Canvas law — theme-aware edition

| Rule | Light theme | Dark theme |
|---|---|---|
| Page canvas | Archive Paper `#F4EFE5` (`--ds-canvas`) | Black Ink `#0A0A0A` |
| Edition panels | Surface `#FBF8F2` (`--ds-surface-raised`) | Charcoal mix on Surface |
| Deep variant | Paper-deep mix on overview stats | Canvas/rule mix |
| Ink / Charcoal bands | **Not on history** | **Not on history** |
| Copper | Text `#8E4F2A`, graphic `#B86B2A` | Text `#D07A32`, graphic `#D07A32` |
| Atmosphere | **None** — no gutter mosaic, no crumpled map |

**Banned on history (carried from brand + v6 home/explore):** shadows, gradients, glows, bevels, `backdrop-filter` blur, `--ds-fixed-*` panel stamps.

---

## 3. Page scaffold

```
┌─ main (max ~84rem, centered, page inset) ────────────────────────┐
│  [ Beat 00 — Intro Surface panel: edition header + framing ]     │
│  [ Beat 01 — Timeline Surface panel: decade scrubber + overview ]│
│  [ Beat 02 — Instruments Surface panel: search + facets ]        │
│  [ Beat 03 — Two-column desktop ]                                │
│      ├─ Composition panel (data panel)                           │
│      └─ Records panel (narrative + list peer)                      │
│  [ Framing footnotes — quiet Stone prose ]                       │
│  [ SiteFooter — Surface card (shell) ]                           │
└──────────────────────────────────────────────────────────────────┘
```

**Rhythm tokens (align with home v6):**

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` ( `1rem` ≤48rem ) | Horizontal padding of `main` |
| Card gap | `1.25rem` | Vertical stack gap between edition panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule borders, `--ds-radius-md` on panels, `--ds-radius-sm` on inputs/buttons. Flat matte only.

---

## 4. Beat 00 — Intro panel

| Element | Spec |
|---|---|
| Index | Mono copper numeral `00` (decorative; page `h1` remains in title) |
| Kicker | IBM Plex Mono uppercase copper slug: `Temporal browse` |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`<em>decade</em>`) |
| Lede | Source Serif 4, Stone, max ~54ch |
| Framing | Two quiet Stone paragraphs: dignity + decade status rules (existing copy constants) |

No copper CTA in intro — orientation copper is reserved for decade scrubber active stop and list selection.

---

## 5. Beat 01 — Timeline instrument

| Element | Spec |
|---|---|
| Panel kicker | Mono uppercase: `Timeline` |
| Decade scrubber | **Reuse explore classes** (`ds-explore-edition__decade-*`) — baseline rail, mono stops, copper underline on active |
| Sticky behavior | Scrubber sticks within panel; panel background opaque Surface |
| Overview strip | Record/connection counts + decade density sparkline; active decade bar uses copper graphic fill |

Decade scrubber is a **link tablist** on `/history` (no-JS safe via `Link` + GET hrefs). Explore uses buttons inside map settings — same visual register, different interaction host.

**Decade ceiling:** scrubber stops, density sparkline bars, and explore line-decade tabs all cap at the **current calendar decade** (`maxDecadeInclusive` from `@repo/domain/era`, e.g. `2020s` in mid-2026). Future decade labels never render even when a record span or release artifact carries a later `validTo`. URL `decade=` params for unstarted decades fall back to all-time.

---

## 6. Beat 02 — Instruments panel

| Element | Spec |
|---|---|
| Panel kicker | Mono uppercase: `Refine view` |
| Search | Native search input + quiet secondary submit (44px) |
| Kind filter | Horizontal chip radiogroup with kind glyphs (map encoding vocabulary) |
| Facet rows | Mono label + native select per row: Status · Topic · Connections · Sort |
| Auto-apply | Changes push URL state immediately (no Apply button) |
| Clear | Quiet secondary when any facet differs from default |
| Meta | Mono release id + count line |

Facet row layout mirrors explore compact facets (label column + control column).

---

## 7. Beat 03 — Composition + records

### 7.1 Composition panel (left / primary)

| Element | Spec |
|---|---|
| Panel kicker | Mono uppercase: `Composition & connections` |
| Body | `HistoryDataPanel`: kind composition bars, documented connections, archive framings |
| Surface | Raised panel fill; data sections separated by Rule hairlines |
| Selection | Copper border weight on active kind/edge/connected row (inset outline, no shadow) |

### 7.2 Records panel (right / peer)

| Element | Spec |
|---|---|
| Panel kicker | Mono uppercase: `Records in view` |
| Narrative card | Surface card with copper left rule when a node is selected |
| List | Hairline `ds-result-list` rows; selected row copper left rule + subtle accent wash (explore records rail register) |
| Sticky | Desktop: panel sticks below timeline clearance; internal scroll when tall |

List links always navigate to entity pages — selection mirrors graph focus without blocking navigation.

---

## 8. Home / explore pattern reuse

| Shared pattern | History adoption |
|---|---|
| Surface panel cards | All beats |
| Edition mono kickers | Panel headers |
| Hairline Rule separators | Overview, facets, list rows |
| Explore decade scrubber CSS | Beat 01 timeline (`explore-edition.css`) |
| Kind encoding glyphs | Kind chips + composition bars |
| Theme-aware canvas | Full route; no fixed-ink overrides |
| Copper discipline | Scrubber active, list selection, one narrative CTA |
| Site footer | Standard Surface card via shell (not omitted) |

Optional future: `EditionFactIcon` on narrative card facts when entity geo is available — not required for v6 history pass.

---

## 9. Rip list — v6 history vs v5 history

| Topic | v5 history (superseded for `/history`) | v6 history (binding) |
|---|---|---|
| Page rhythm | Flat `ds-page` mast + loose stack | Edition Surface card stack |
| Intro | `ds-page__eyebrow/title/lede` only | Numbered edition header + framing in panel |
| Decade scrubber | History-local CSS duplicate | Explore edition decade classes (shared register) |
| Overview / toolbar | Open sections on canvas | Grouped inside Surface panels |
| Data panel border | Canvas fill + rule box | Surface-raised panel card |
| List selection | Left border accent only | Explore records rail copper rule + wash |
| Theme | Mostly theme-aware already | Explicit v6 canvas law; no fixed-ink bands |
| Atmosphere | None | None (unchanged) |

**Carried forward:** URL state (`buildHistoryHref`), decade/all-time modes, facet filters, data panel fields, synchronized list, noscript GET form, release snapshot contract, dignity copy constants, sparse-decade empty states.

---

## 10. Implementation pointers

- CSS: `apps/web/src/app/history/history-edition.css` (edition scaffold), `history.css` (component internals), import `explore-edition.css` for decade scrubber.
- Chrome helpers: `history-panel-chrome.ts` (+ tests).
- Orchestrator: `HistoryExperience.tsx` (panel wrappers + kickers; preserve behavior).
- Decade control: `DecadeStepper.tsx` uses explore decade class constants.
- Page: `page.tsx` intro beat + CSS imports.
- Footer: shell `SiteFooter` (see [`patterns-site-footer.md`](./patterns-site-footer.md)).

---

## 11. Acceptance checklist

- [x] `/history` uses opaque Surface edition panels in light and dark theme
- [x] Decade scrubber reuses `ds-explore-edition__decade-*` classes
- [x] No `--ds-fixed-*` fills on history panels
- [x] Intro uses edition header vocabulary (index + copper kicker)
- [x] Facets auto-apply; noscript GET form preserved
- [x] List selection uses copper left rule register
- [x] URL state + graph/list sync unchanged
- [x] No em dashes in touched copy
- [x] Tests cover v6 panel class contracts
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px (manual QA)

---

## 12. Related docs

- [`design-direction-v6-home.md`](./design-direction-v6-home.md) — edition card stack origin
- [`design-direction-v6-explore.md`](./design-direction-v6-explore.md) — decade scrubber + facet row reference
- [`patterns-map-entity-encoding.md`](./patterns-map-entity-encoding.md) — kind chips and composition bars
- [`patterns-site-footer.md`](./patterns-site-footer.md) — footer on non-explore routes
- [`design-direction-v5.md`](./design-direction-v5.md) — non-history surfaces remain on v5 until superseded
