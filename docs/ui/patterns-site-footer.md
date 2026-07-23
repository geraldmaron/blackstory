# Site footer pattern

**Status:** reusable site pattern (2026-07-23).  
**Scope:** public shell footer on every route except `/explore` (map-first surface omits footer).  
**Home binding:** `design-direction-v6-home.md` §7 — Surface card, not v5 fixed-ink band.

---

## Intent

The footer closes the document with real navigation jobs (explore, trust, contribute), not fine-print-only chrome. It matches the home edition card stack: theme-aware Surface, hairline rules, flat matte, copper reserved for column headings and link hover — never a full-width ink band.

---

## Implementation

| Module | Role |
|---|---|
| `apps/web/src/components/SiteFooter.tsx` | Footer landmark markup + shared `FOOTER_NAV_COLUMNS` IA |
| `apps/web/src/components/SiteShellFooter.tsx` | Route gate — omits footer on explore map shell |
| `apps/web/src/app/shell.css` | `.ds-shell-footer*` Surface card tokens |
| `packages/config/src/shell-nav.ts` | Three-column footer IA (Explore · Trust · Contribute) |

Styles live in `shell.css` (not a separate CSS module). Home alignment uses `.ds-shell:has(.ds-home-hero) .ds-shell-footer` to match edition card width and `1.25rem` stack gap.

---

## Anatomy

```
┌─ .ds-shell-footer (outer — scroll margin, home width align) ─────────┐
│  ┌─ .ds-shell-footer__card (Surface + Rule border + radius-md) ─────┐  │
│  │  Mast: typographic wordmark (Sora) + support tagline (Serif)     │  │
│  │  Nav: three columns — mono copper headings, hairline link rows   │  │
│  │  Meta: mono copyright + core line · maker credit                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

| Zone | Typography | Color |
|---|---|---|
| Wordmark | Sora SemiBold display (`PRODUCT_NAME`) | `--ds-ink` |
| Tagline | Source Serif 4 | `--ds-ink-muted` |
| Column title | IBM Plex Mono uppercase | `--ds-accent` (copper text) |
| Links | Inter 15px effective | `--ds-ink-muted` default; `--ds-accent` hover |
| Meta | IBM Plex Mono | `--ds-ink-muted` |

---

## Brand constraints

- **Surface card** — `background: var(--ds-surface)`, `border: 1px var(--ds-rule)`, `border-radius: var(--ds-radius-md)`. No fixed-ink (`--ds-fixed-*`) band.
- **Theme-aware** — follows `[data-theme]` light and dark like header and home beats.
- **Typographic sign-off** — Sora wordmark text, not the PNG lockup at mega scale (header/symbol paths still use official artwork).
- **Hairline lists** — each link row separated by Rule; meta row capped with top Rule.
- **Copper discipline** — column headings and link hover only; no copper button fill in footer.
- **Touch targets** — link rows `min-height: 2.75rem` (44px).
- **Flat matte** — no shadows, gradients, glows, or bevels.

---

## Route behavior

| Route | Footer |
|---|---|
| `/` (home) | Surface card aligned to edition stack width |
| Document routes (`/about`, `/search`, …) | Surface card centered in gutter |
| `/explore` | Omitted (`SiteShellFooter` returns null) |

Map homepage keeps footer above the fixed MapLibre plate via `map-surfaces.css` z-index on `.ds-shell-footer`.

---

## Adoption checklist

When extending footer IA or styling:

1. Column items come from `FOOTER_NAV_COLUMNS` in `@repo/config` — keep web/admin in sync.
2. Do not reintroduce `--ds-fixed-charcoal` / `--ds-fixed-paper` on `.ds-shell-footer`.
3. Preserve `scroll-margin-top: var(--ds-island-clearance)` for skip/anchor clearance under sticky header.
4. Maker credit uses `MakerCredit variant="footer"` with theme-swapping GD marks (same as inline).
5. Run `shell-layout.test.ts` and `SiteFooter.test.tsx` after CSS/markup changes.

---

## Related patterns

- Home edition card stack — `design-direction-v6-home.md` §3 scaffold
- Shell header Surface card on home — `shell.css` `.ds-shell:has(.ds-home-hero) .ds-shell-header__inner`
- v5 fixed-ink footer — superseded for home in v6; sitewide footer now follows v6 Surface law
