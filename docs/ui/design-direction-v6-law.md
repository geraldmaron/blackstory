# BlackStory design direction v6 — law edition

**Status:** binding layout pattern for `/law` and `/law/*` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** `design-direction-v5.md` § law browse document rhythm only.  
**Unchanged:** law seed/catalog contract, browse URL params (`q`, `kind`, `topic`, `status`), explainer section semantics, legal disclaimer copy.

---

## 1. Intent

Law is the **plain-language reference room** for landmark civil-rights statutes, regulations, and court decisions. Readers browse a compact catalog, open explainers with official sources, and trust the standing not-legal-advice disclaimer.

Design goals:

- **Arrive** through beat 00 intro: Reference kicker, warm title, lede, mosaic credit.
- **Trust** through beat 01 disclaimer panel (Notice tone warning).
- **Browse** beat 02 catalog: search mast + auto-submit kind/topic facets + hairline ledger rows.
- **Understand** detail intro anatomy strip with EditionFactIcon labels (Kind, Status, Jurisdiction, Citation, Topics).
- **Read** explainer sections inside opaque Surface panels.
- **Verify** provenance panel with archived capture metadata.
- **Depart** through quiet footer links.

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **page gutters only** (same register as home/stories/about v6).

---

## 2. Canvas law — theme-aware edition + shared atmosphere

Law shares the **home mosaic atmosphere stack** via `EditionAtmosphereMosaic` and `edition-atmosphere.css`:

| Layer | Spec |
|---|---|
| Fixed grain + archive grid | `ds-edition-atmosphere-canvas::before` on route root |
| Gutter mosaic | `EditionAtmosphereMosaic` with seed `law-edition-v6` (index) or `law-edition-v6:{slug}` (detail) |
| Surface panels | Opaque `ds-law-edition__panel` cards; no text atop mosaic without Surface |
| Ink / Charcoal bands | **Not on law** |
| Legacy ds-page mast | **Banned** — superseded v5 browse/detail chrome |

Mosaic tiles are **decorative only** in left/right gutter bands. `prefers-reduced-motion` hides live mosaic tiles. Dark theme scales mosaic opacity down.

Intro panel carries a quiet **mosaic credits** link to `/stories/mosaic-credits`.

---

## 3. Page scaffold

### 3.1 Index (`/law`)

```
┌─ ds-law-edition + ds-edition-atmosphere-canvas ─────────────────┐
│  [ EditionAtmosphereMosaic — seed: law-edition-v6 ]             │
│  ┌─ main (ds-container) ──────────────────────────────────────┐ │
│  │  [ Beat 00 — Intro Surface: edition header + lede ]         │ │
│  │  [ Beat 01 — Disclaimer Surface ]                           │ │
│  │  [ Beat 02 — Catalog Surface: search + facets + ledger ]  │ │
│  │  [ Beat 03 — About Surface: legal guidance + links ]        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

### 3.2 Detail (`/law/[slug]`)

```
┌─ ds-law-edition + atmosphere canvas ────────────────────────────┐
│  [ Beat 00 — Intro: title + LawAnatomyStrip + mosaic credit ]   │
│  [ Beat 01 — Disclaimer ]                                       │
│  [ On-page nav — when explainer exists ]                        │
│  [ Beat 02 — Explainer sections panel ]                         │
│  [ Beat 03 — Provenance panel ]                                 │
│  [ Beat 04 — Keep going links ]                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Reading order (DOM + a11y):** intro → disclaimer → nav → explainer → provenance → depart links.

---

## 4. Rhythm tokens (align with home v6)

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` (`1rem` ≤48rem) | `main` horizontal padding |
| Card gap | `1.25rem` | Vertical stack gap between panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule borders, `--ds-radius-md` on panels, `--ds-radius-sm` on inputs/buttons/chips. Flat matte only.

---

## 5. Beat 00 — Intro panel

| Element | Spec |
|---|---|
| Index | Mono copper numeral `00` (decorative; page `h1` remains in title) |
| Kicker | IBM Plex Mono uppercase copper slug: `Reference` |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper (`<em>law</em>` on index; entry title on detail) |
| Lede | Source Serif 4, Stone, max ~54ch (index only) |
| Detail anatomy | `LawAnatomyStrip` — EditionFactIcon + visible labels for Kind, Status, Jurisdiction, Citation, Topics |
| Mosaic credit | Mono footnote with link to mosaic credits |

No copper CTA in intro — copper reserved for active filters and primary search submit.

---

## 6. Beat 02 — Catalog panel (index)

| Element | Spec |
|---|---|
| Panel kicker | Mono uppercase: `Catalog` |
| Search | `ds-search-mast` GET form to `/law` with `q` param |
| Facets | `AutoSubmitSelect` for `kind` and `topic`; Clear link to `/law` |
| Count | Mono label (`N law entries`) |
| Ledger | Hairline rows via `LegalBrowseList`; kind/topic chips; status badge |

Preserve URL contract: empty params mean "all"; facets auto-submit on change.

---

## 7. Detail explainer panel

Five editorial sections unchanged in semantics:

1. What the law says  
2. What it means (+ terms of art nav when present)  
3. Why it matters for Black Americans  
4. Your rights today  
5. Primary sources  

Sections render inside `ds-law__section-card` cards within the explainer Surface panel. Review line shows date, citation, and status badge.

On-page nav lists section anchors when explainer exists.

---

## 8. Copper discipline

Roughly 10–15% of composition. Copper on:

- Edition index numerals and kickers (graphic/text pairs)
- Active nav underline on focus/hover
- Search submit uses ink CTA; copper stays on kickers and facet focus

Raw Copper Pin never carries body-size text on light canvas.

---

## 9. Implementation map

| Module | Role |
|---|---|
| `app/law/law-panel-chrome.ts` | Root/panel class helpers + mosaic seed constant |
| `app/law/law-edition.css` | Surface stack + ledger + anatomy + explainer styles |
| `app/law/page.tsx` | Browse route wiring |
| `app/law/[slug]/page.tsx` | Detail route wiring |
| `app/law/LawBrowseSections.tsx` | Disclaimer, catalog, about panels |
| `app/law/LawDetailSections.tsx` | Detail panels + intro export |
| `app/law/LawAnatomyStrip.tsx` | EditionFactIcon anatomy grid |
| `app/law/law-view-model.ts` | Browse/detail view models (unchanged contract) |
| `components/legal/*` | Shared legal copy, ledger list, explainer sections |
| `components/patterns/edition-atmosphere/*` | Shared gutter mosaic |

---

## 10. Acceptance checklist

- [ ] `/law` and `/law/*` use `ds-law-edition` + atmosphere canvas + gutter mosaic  
- [ ] No `ds-page__*` mast bands on law routes  
- [ ] Browse GET params and auto-submit facets preserved  
- [ ] Detail anatomy strip uses EditionFactIcon with visible labels  
- [ ] Light + dark theme verified; 44px controls; flat matte only  
- [ ] No em dashes in law-route user-facing copy  
- [ ] Tests: `law-panel-chrome.test.ts`, `law-page.test.ts`, `law-view-model.test.ts`

---

## 11. Superseded patterns

| Prior | Replacement |
|---|---|
| v5 `ds-page__eyebrow` / `ds-page__title` mast on `/law` | Beat 00 intro Surface panel |
| Boxed browse ledger cards with full borders | Hairline ledger rows inside catalog panel |
| On-page nav as page-level band outside panels | Detail nav inside edition stack |
| Standalone `law.css` document rhythm | `law-edition.css` Surface stack |
