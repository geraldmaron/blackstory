# Record anatomy panel layout

**Status:** binding layout pattern (2026-07-23).  
**Scope:** full record anatomy panels with map preview + Kind / Where / Era / Evidence.  
**Icon + label contract:** [`patterns-edition-fact-icon.md`](./patterns-edition-fact-icon.md).  
**Binding surfaces:** home beat 02 (`design-direction-v6-home.md`), explore spotlight (`design-direction-v6-explore.md`), entity beat 01 (`design-direction-v6-entity.md`), mobile entity anatomy (`design-direction-v6-mobile.md` § entity detail).

---

## Intent

Record anatomy orients readers with four typed facts beside a compact map preview. **Where** values are often full place strings (campus names, county qualifiers, precision notes). A **2×2 label-over-value grid** beside a map column crushes **Where** into half-width cells with mid-word breaks.

Anatomy panels therefore use **inline fact rows**: each field is label → value on one horizontal line, with the four rows stacked in a single column beside (or below) the map. Never a multi-column fact grid inside the panel.

Compact browse rows (search rip lists, explore rail, history results) keep `RecordFactStrip` / `EditionFactCell` in a soft 2-column **label-over-value** wrap. Those surfaces omit the map preview and show shorter fact subsets.

---

## Composition

Prefer **side-by-side where possible**, wrap entire rows only when the viewport is narrow.

### Wide (web ≥ 36rem)

```
┌──────────────┬──────────────────────────────────────────┐
│              │ KIND      School                          │
│  Map preview │ WHERE     Carroll County, Tennessee …     │
│  (fixed h)   │ ERA       1910s                           │
│              │ EVIDENCE  Grade A · 2 sources             │
└──────────────┴──────────────────────────────────────────┘
│ Precision footnote (full width)                          │
└──────────────────────────────────────────────────────────┘
```

- **Place column:** fixed-width map frame (`7.5rem` min height on web). Hairline rule separates place from facts.
- **Facts column:** vertical list of inline rows on a **two-column grid** (label cluster | value). The label column width follows the widest field type (`Evidence`), so all values share one vertical start edge. Each row is mono label (icon + field type) then editorial value on the same baseline.
- **Precision footer:** full-width mono caption below the body row when place data exists.

### Narrow (web < 36rem; default mobile)

```
┌──────────────────────────────────────────────────────────┐
│ Map preview (full width)                                 │
├──────────────────────────────────────────────────────────┤
│ KIND      School                                         │
│ WHERE     The Lyceum, University of Mississippi, Oxford  │
│ ERA       1960s                                          │
│ EVIDENCE  2 accepted claims                              │
├──────────────────────────────────────────────────────────┤
│ Precision footnote                                       │
└──────────────────────────────────────────────────────────┘
```

Map stacks above the fact list. Each fact row stays **icon + label + value** on one horizontal line; long **Where** strings wrap at word boundaries inside the value column only. Rows do not wrap label above value.

---

## Fact row anatomy

Each inline fact row (`.ds-record-anatomy__fact--inline`):

1. **Label cluster (column 1):** `EditionFactIcon` + uppercase mono field type (`Kind`, `Where`, …) in `.ds-record-anatomy__fact-label`. Icon and label text are center-aligned within the cluster; the cluster sits in a shared label column (`grid-template-columns: max-content minmax(0, 1fr)` on `.ds-record-anatomy__facts`, `display: contents` on each row wrapper).
2. **Value (column 2, min-width 0):** editorial serif string beside the label on the same baseline. **Where** links to external maps when coordinates exist (web: `MapsExternalLink`; mobile: pressable copper text + Open in maps CTA).

Label text uses `white-space: nowrap` so field types never wrap; values use normal word wrapping (`overflow-wrap: break-word`) inside the value column only. Row wrappers never use `flex-wrap` (that stacks label over value when combined with `flex-grow`). Mobile mirrors the shared label column with a fixed-width label cluster (`anatomyFactLabelColumnWidth`).

This differs from compact `EditionFactCell` / `RecordFactStrip`, which stack label above value in a 2-column wrap for list density.

---

## Modules

| Platform | Module | Styles |
|---|---|---|
| Web | `apps/web/src/components/patterns/RecordAnatomyPanel.tsx` | `record-anatomy.css` (`ds-record-anatomy*`) |
| Web place frame | `RecordPlacePreview.tsx` | same |
| Mobile entity | `apps/mobile/src/features/entity/sections/AnatomySection.tsx` | inline `StyleSheet` mirroring web row contract |
| Mobile compact rows | `RecordFactStrip` + `EditionFactCell` | label-over-value 2-column wrap — **not** anatomy panels |

Import `record-anatomy.css` once per web route bundle that renders `RecordAnatomyPanel`.

---

## Accessibility

- Panel `aria-label`: `Record at a glance` (override via prop when needed).
- Map preview: `role="img"` with descriptive label; empty state copy `Place not pinned`.
- **Where** link: `aria-label` includes place string and maps hand-off intent.
- Label text remains visible beside every icon (WCAG 1.4.1). Confidence tier color never replaces evidence copy.

---

## Adoption checklist

- [ ] Use `RecordAnatomyPanel` on web — do not fork markup per surface.
- [ ] Facts are **inline rows** in one column beside or below the map — no 2×2 fact grids.
- [ ] Long **Where** strings sit beside the label and wrap at word boundaries at full facts-column width.
- [ ] Verify light + dark theme; focus rings on map and **Where** links.
- [ ] Compact list rows use `RecordFactStrip`, not this panel layout.

---

## Supersedes

- Soft **2×2 label-over-value fact grid** beside map preview (2026-07-23 and earlier). Equal four-column strips with vertical hairlines remain banned per v5 cognitive-accessibility law.
