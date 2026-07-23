# BlackStory design direction v6 — entity edition

**Status:** binding layout pattern for `/entity/[id]` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** `design-direction-v5.md` § entity mast, at-a-glance band, and two-column aside layout.  
**Unchanged:** entity data contract, `force-dynamic` routing, session nav stack, evidence/claims pipeline, `RecordGapNotice` copy.

---

## 1. Intent

Entity detail is the **full record receipt** inside the same archive edition as `/`, `/explore`, and `/history`. Readers open a place-connected record from the map, search, or links; inspect anatomy, evidence, and connected graph; and depart through map CTAs or session navigation.

Design goals:

- **Arrive** through a theme-aware Surface intro with editorial media (photo or kind mark), not a v5 ink-bordered mast band.
- **Orient** with `RecordAnatomyPanel` (kind / where / era / evidence) and compact map preview when geo exists.
- **Read** sustained sections inside opaque Surface panels with mono index + kicker rhythm.
- **Trust** through fail-closed media, honest geo precision, and approved gap notices.
- **Depart** through Open in maps, View on national map, and `EntitySessionNav` (Back / Next / Random).

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **page gutters only** (shared register with home/stories/about).

---

## 2. Canvas law — theme-aware edition + shared atmosphere

| Rule | Light theme | Dark theme |
|---|---|---|
| Page canvas | Archive Paper `#F4EFE5` (`--ds-canvas`) | Black Ink `#0A0A0A` |
| Edition panels | Surface `#FBF8F2` (`--ds-surface-raised`) | Charcoal mix on Surface |
| Ink / Charcoal bands | **Not on entity** | **Not on entity** |
| Copper | Text `#8E4F2A`, graphic `#B86B2A` | Text `#D07A32`, graphic `#D07A32` |
| Atmosphere | **Home-aligned gutter mosaic** — grain + archive grid + scattered collage tiles | Same; tile opacity scales down in dark |

**Atmosphere stack (shared):**

1. Fixed pseudo-element texture via `.ds-edition-atmosphere-canvas`.
2. `EditionAtmosphereMosaic` with seed `entity-edition-v6:{id}` (per-record scatter).
3. `prefers-reduced-motion` hides live mosaic tiles.

**Banned on entity:** v5 `ds-entity-mast` ink border, two-column `ds-entity-layout` aside, fixed-ink bands, shadows, gradients, glows, bevels, blur.

---

## 3. Page scaffold

```
┌─ ds-entity-edition + ds-edition-atmosphere-canvas ──────────────┐
│  [ EditionAtmosphereMosaic — seed: entity-edition-v6:{id} ]     │
│  ┌─ main (max ~84rem, centered) ──────────────────────────────┐ │
│  │  [ Beat 00 — Intro: media, kind meta, title, lede, tags ]  │ │
│  │  [ Beat 01 — Anatomy: RecordAnatomyPanel + map CTAs ]      │ │
│  │  [ HowToReadThisRecord compact ]                            │ │
│  │  [ Sensitivity banner when present ]                        │ │
│  │  [ Beat 02 — Relevance / Why this appears ]                 │ │
│  │  [ Beat 03 — Historical context ]                           │ │
│  │  [ Beat 04 — Further reading (optional) ]                   │ │
│  │  [ Beat 05 — Status and history ]                           │ │
│  │  [ Beat 06 — Accepted claims ]                            │ │
│  │  [ Beat 07 — Timeline (when dated spans exist) ]            │ │
│  │  [ Beat 08 — Connected records ]                          │ │
│  │  [ Beat 09 — Record maturity + revision ]                 │ │
│  │  [ EntitySessionNavClient ]                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Single-column Surface stack only. The v5 aside column is superseded by anatomy map preview + CTAs in beat 01.

**Reading order (DOM + a11y):** intro → anatomy → trust off-ramp → relevance → context → status → claims → timeline → connected → provenance → session nav.

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

## 5. Beat 00 — Intro panel

| Element | Spec |
|---|---|
| Index | Mono copper numeral `00` |
| Kicker | IBM Plex Mono uppercase copper slug: `Record` |
| Meta | `KindBadge` · jurisdiction (when displayable) · historical/present-day framing |
| Title | Sora SemiBold entity `displayName` |
| Lede | Source Serif 4 summary via `LinkedProse` |
| Media | `EntityMastMedia` (photo chain or `EntityRecordMark`) |
| Tags | `EntityTopicTags` when topics exist |

Framing label derives from status lifecycle (`deriveHistoricalFraming`), never hand-authored prose.

---

## 6. Beat 01 — Anatomy panel

| Element | Spec |
|---|---|
| Index | `01` |
| Kicker | `Anatomy` |
| Body | `RecordAnatomyPanel` with `EditionFactIcon` on every fact label |
| Facts | Kind · Where · Era · Evidence (same contract as home/explore) |
| Place slot | `RecordPlacePreview` when geo exists; **Place not pinned** empty state when absent |
| CTAs | Copper **Open in maps** (when href resolves) + quiet **View on national map** |
| Precision | Mono footnote: location precision + public label |

Era uses `entityEraFact` / `resolveEntityEraBuckets` — show **Undated** only when all structured and legacy fields are absent.

---

## 7. Content beats (02–08)

Each beat is a Surface panel with:

- Mono copper index (`02`–`08`)
- Uppercase kicker slug
- Section title (Sora SemiBold)
- Body in Source Serif 4 or component-specific typography

| Beat | Kicker | Section | Empty state |
|---|---|---|---|
| 02 | Relevance | Why this appears | `RecordGapNotice kind="relevance"` |
| 03 | Context | Historical context | `RecordGapNotice kind="context"` |
| 04 | Reading | Further reading | Omitted when absent |
| 05 | Status | When this happened / Status and history | `RecordGapNotice kind="statusHistory"` when no status or event window |
| 06 | Claims | Accepted claims | `RecordGapNotice kind="claims"` or `EntityEvidencePanel` |
| 07 | Chronology | Timeline | Omitted when no dated spans |
| 08 | Connected | Connected records | `EntityRelatedList` + optional continue-learning nested block |

---

## 8. Beat 09 — Provenance panel

| Element | Spec |
|---|---|
| Index | `09` |
| Kicker | `Provenance` |
| Maturity | `recordMaturity` + `researchCoverage` in humanized tokens |
| Revision | Release id, record updated, generated timestamps |

---

## 9. Safe fail states (binding)

| Failure | Behavior |
|---|---|
| Missing / broken primary photo | `EntityMastMedia` → `EntityRecordMark` (never broken `<img>`) |
| Missing Font Awesome glyph | `EditionFactIcon` falls back to visible text label (icon `aria-hidden`) |
| Missing geo | Anatomy place slot: **Place not pinned**; no false pin on national map frame |
| Missing era | `entityEraFact` → **Undated** only when buckets, spans, and legacy era are all absent |
| Missing status (non-event) | `RecordGapNotice kind="statusHistory"` — not a silent empty |
| MapLibre / WebGL fail | `EntityLocationMap` `role="status"` message; maps external link remains |

**Cross-browser:** Mini-map mounts wait for non-zero layout (`waitForContainerLayout`), call `map.resize()` on orientation and tab visibility changes, and probe WebGL before construction. Record anatomy frames use explicit `7.5rem` height. See [`patterns-map-canvas.md`](./patterns-map-canvas.md).
| Why-this-appears throws | Fail-closed: section renders gap notice, page does not crash |

---

## 10. Accessibility (WCAG 2.2 AA)

- `main` landmark with `id="main"`; each panel `article` with `aria-labelledby`.
- `:focus-visible` on all links and session nav controls.
- Confidence and status never color-alone (`ConfidenceMark`, `StatusMark` labeled).
- Map preview: `role="img"` + visually hidden title; fallback `role="status"`.
- Photo alt from `entityPrimaryImageAlt`; mark uses reason-accurate copy.
- Touch targets ≥44px on session nav and CTAs.

---

## 11. Session navigation

`EntitySessionNavClient` stays at stack foot. Shares Back stack and Random toggle with explore spotlight via `sessionStorage`. Full public catalog order from search index for Next/Random.

---

## 12. Code map

| Concern | Location |
|---|---|
| Page RSC | `apps/web/src/app/entity/[id]/page.tsx` |
| Panel chrome | `entity-panel-chrome.ts`, `entity-edition.css` |
| Anatomy facts | `entity-anatomy-facts.ts` |
| Content sections | `EntityEditionSections.tsx` |
| View-model | `entity-view-model.ts` |
| Media fail-closed | `EntityMastMedia.tsx`, `EntityRecordMark.tsx` |
| Map fail-closed | `EntityLocationMap.tsx`, `RecordPlacePreview.tsx` |
| Patterns | `RecordAnatomyPanel`, `EditionFactIcon`, `EditionAtmosphereMosaic` |

---

## 13. Superseded (v5 entity)

- `ds-entity-mast` ink bottom border as page hero
- `ds-at-a-glance` four-row band (replaced by anatomy panel)
- `ds-entity-layout` two-column aside (map + maturity moved into anatomy + provenance beats)
- Loading full `entity-page.css` mast/aside rules without edition stack

Retain `entity-page.css` only for section-specific typography (`ds-entity-status`, evidence footnotes) until migrated.
