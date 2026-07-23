# BlackStory design direction v6 — themes edition

**Status:** binding layout pattern for `/themes` and `/themes/*` (2026-07-23).  
**Parent:** `design-direction-v6-home.md` (shared edition vocabulary + atmosphere).  
**Supersedes:** `design-direction-v5.md` § themes browse mast and flat container layout only.  
**Unchanged:** theme-impact data contract, packet fixtures, URL shape (`/themes/[themeId]/questions/[questionId]`), juxtaposition method stance.

---

## 1. Intent

Themes is the **policy-impact reading room**: canonical questions with cited warehouse packets, gap labels, and explicit juxtaposition-not-causation method notes. Readers browse live P0 themes, see P1 coming soon without overstating coverage, and open question-level provenance.

Design goals:

- **Arrive** through beat 00 intro: impact framing, lede, quiet books crosslink, mosaic credits.
- **Trust** through beat method panel: juxtaposition bar + methodology hand-off.
- **Browse** P0 and P1 catalogs as hairline ledger rows inside opaque Surface panels.
- **Open** theme detail with per-theme mosaic scatter, storytelling panels when enabled, and packet cards.
- **Verify** question pages with full packet provenance quartet.

Chrome is **opaque Surface**, theme-aware, flat matte. Atmosphere lives in **gutters only** (same register as home/stories/about).

---

## 2. Canvas law — theme-aware edition + shared atmosphere

Themes shares the **home mosaic atmosphere stack** via `EditionAtmosphereMosaic` and `edition-atmosphere.css`:

| Layer | Spec |
|---|---|
| Fixed grain + archive grid | `ds-edition-atmosphere-canvas::before` on route root |
| Gutter mosaic | `EditionAtmosphereMosaic` with seed `themes-edition-v6` (index) or `themes-edition-v6:{themeId}` (detail/question) |
| Surface panels | Opaque `ds-themes-edition__panel` cards; no text atop mosaic without Surface |
| Ink / Charcoal bands | **Not on themes** |
| Crumpled map / fixed-ink mast | **Banned** |

Mosaic tiles are **decorative only** in left/right gutter bands. `prefers-reduced-motion` hides live mosaic tiles. Dark theme scales mosaic opacity down.

Intro panel carries a quiet **mosaic credits** link (not interactive tile navigation).

---

## 3. Page scaffold

### 3.1 Index (`/themes`)

```
┌─ ds-themes-edition + ds-edition-atmosphere-canvas ──────────────┐
│  [ EditionAtmosphereMosaic — seed: themes-edition-v6 ]         │
│  ┌─ main (max ~84rem, centered) ─────────────────────────────┐ │
│  │  [ Beat 00 — Intro Surface: edition header + crosslink ]   │ │
│  │  [ Beat method — Juxtaposition panel ]                     │ │
│  │  [ Beat 01 — P0 catalog ledger ]                           │ │
│  │  [ Beat 02 — P1 coming soon ledger ]                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
     ↑ archive texture + scattered mosaic in outer gutters only ↑
```

Deep-link anchors `#p0-themes` and `#p1-themes` preserved for shell nav and bookmarks.

### 3.2 Theme detail (`/themes/[themeId]`)

```
┌─ ds-themes-edition + atmosphere canvas ─────────────────────────┐
│  [ Beat 00 — Intro: priority, title, lede ]                      │
│  [ Beat method — juxtaposition + optional live source badge ]    │
│  [ Storytelling panels when question in storytelling series ]      │
│  [ Redlining pilot consumers when themeId === redlining ]        │
│  [ Packets panel — canonical questions + packet cards ]          │
│  [ Footer — All themes ]                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Question (`/themes/[themeId]/questions/[questionId]`)

Intro (theme breadcrumb + question title) → optional storytelling → full packet card → footer links.

---

## 4. Rhythm tokens (align with home/history v6)

| Token | Value | Use |
|---|---|---|
| Page inset | `1.5rem` (`1rem` ≤48rem) | Horizontal padding of `main` |
| Card gap | `1.25rem` | Vertical stack gap between edition panels |
| Panel padding | `1.25rem` | Default inside Surface cards |
| Control min height | `44px` | All tappable controls |

**Structure primitives:** hairline Rule borders, `--ds-radius-md` on panels, `--ds-radius-sm` on chips. Flat matte only.

---

## 5. Edition headers

Each numbered beat uses the shared edition header register (history/stories/about aligned):

| Part | Typography |
|---|---|
| Index numeral | Mono copper graphic — `00` … `03` |
| Kicker | Mono uppercase copper slug |
| Title | Sora SemiBold; warm word in Source Serif 4 italic copper on index (`<em>evidence</em>`) |
| Lede | Source Serif 4, Stone, max ~54ch |

Header separated from body by bottom Rule hairline.

---

## 6. Catalog ledger (P0 / P1)

Reuse existing `ds-theme-impact__catalog*` hairline rows inside edition panels:

| Element | Spec |
|---|---|
| Row index | Mono numeral in first column |
| Title | Sans/display link when available |
| Chip | P0 live (copper border) or P1 coming soon (muted) |
| Lede | Editorial serif, clamped width |
| CTA | Quiet `ds-cta-link` "Open theme" when live |

No card-per-row chrome; ledger sits inside opaque Surface panel.

---

## 7. Copper discipline

| Surface | Copper allowed |
|---|---|
| Beat 00 intro | Crosslink text hover only (no second copper button) |
| Method panel | Title accent text + methodology link |
| Catalog chips | P0 live chip border/text |
| Packet cards | Method stance chip, meta dt labels, question links |

Never two copper-filled buttons in the same above-the-fold viewport.

---

## 8. Reusable patterns

| Pattern | Use on themes |
|---|---|
| `EditionAtmosphereMosaic` | All routes — required |
| `edition-atmosphere.css` | Canvas grain + grid |
| `theme-impact/*` | Packet cards, storytelling, map strip, embed (unchanged data contract) |
| `theme-impact-copy.ts` | Gap banners + empty-state copy (no em dashes in UI chrome) |
| `ThemeImpactEmptyNotice` | Safe fails for missing indicators, provenance, observations |
| `EditionFactIcon` / `RecordAnatomyPanel` | Not required on browse; reserved for future entity cross-links |
| `browse-mode` | Not on themes index (carousel semantics); entity session nav unchanged |

---

## 9. Rip list — v5 themes vs v6 themes

| Topic | v5 themes (superseded) | v6 themes (binding) |
|---|---|---|
| Hero | Flat `ds-page__*` mast in container | Beat 00 Surface intro panel |
| Method notice | Standalone bordered aside | Method Surface panel (paper-deep variant) |
| Body rhythm | Sections flush in page container | Continuous Surface card stack |
| Atmosphere | None | Shared grain + grid + gutter mosaic |
| Theme | Paper container only | Theme-aware edition throughout |

**Carried forward:** P0/P1 catalog data, `#p0-themes` / `#p1-themes` anchors, packet URL shape, juxtaposition copy intent.

---

## 10. Implementation pointers

- Routes: `apps/web/src/app/themes/**`
- CSS: `themes-edition.css`; atmosphere: `components/patterns/edition-atmosphere/`
- Mosaic: `EditionAtmosphereMosaic` with `themes-edition-v6` or `themes-edition-v6:{themeId}`
- Panel chrome: `themes-panel-chrome.ts` (class helpers + tests)
- Safe fails: `theme-impact-copy.ts`, `ThemeImpactEmptyNotice.tsx`
- Packet UI: `components/theme-impact/*` (scoped under `.ds-themes-edition`)

---

## 11. Acceptance checklist

- [ ] `/themes` renders theme-aware canvas + Surface panels — no ink/charcoal bands
- [ ] Paper grain + archive grid in gutters; scattered mosaic via shared component
- [ ] Beat 00 has mosaic credits link; no em dashes in shipped themes copy
- [ ] Method panel cites `/methodology`; P0/P1 anchors preserved
- [ ] Theme detail + question routes use per-theme mosaic seed
- [ ] Packet cards and provenance unchanged functionally; empty indicators/provenance show safe-fail notices
- [ ] Theme-impact UI chrome (gap banners, storytelling lede, era notes) avoids em dashes
- [ ] Copper review passes: no duplicate copper CTAs per viewport fold
- [ ] Responsive verified at 375 / 768 / 1280; touch targets ≥44px
- [ ] `prefers-reduced-motion`: mosaic hidden
- [ ] v5 themes mast superseded — this file cited in PR / bead close notes
