# Utility edition pattern

**Status:** reusable site pattern (2026-07-23).  
**Scope:** compact public pages that need v6 Surface stack + gutter mosaic without a full surface direction doc.  
**Binding:** shares atmosphere + header vocabulary with [`design-direction-v6-about.md`](./design-direction-v6-about.md) §2.

---

## Intent

Locate, submit, corrections, status lookup, not-found, and error pages are trust/discover utilities — not browse editions. They still deserve the v6 atmosphere (grain, gutter mosaic, Surface panels) without copying an entire surface-specific CSS file per route.

---

## Components

| Module | Role |
|---|---|
| `utility-edition-chrome.ts` | Class-name helpers (`utilityEditionRootClassName`, panel variants) |
| `utility-edition.css` | Surface stack, intro header, body panel, `:focus-visible` |
| `UtilityEditionShell.tsx` | Root wrapper + `EditionAtmosphereMosaic` + `main#main` |
| `UtilityEditionIntro.tsx` | Indexed kicker + display title + editorial lede |
| `UtilityEditionBodyPanel.tsx` | Content panel for forms, notices, fail-states |

Import `utility-edition.css` once via `UtilityEditionShell` (the shell imports it).

---

## Adopters

| Route | `editionKey` | Mosaic seed |
|---|---|---|
| `/locate` | `locate` | `locate-edition-v6` |
| `/submit` | `submit` | `submit-edition-v6` |
| `/corrections` | `corrections` | `corrections-edition-v6` |
| `/corrections/status/[receiptCode]` | `correction-status` | `correction-status-edition-v6` |
| Global not-found | `not-found` | `not-found-edition-v6` |
| Segment error | `error` | `error-edition-v6` |

Planned (`repo-49wc`): `/errata`, `/support`, `/privacy`.

---

## Accessibility

- `main#main` landmark on every route (skip link in root layout targets `#main`).
- Intro panel uses a single `<h1>`; in-page sections keep their own `<h2>` hierarchy.
- `scroll-margin-top: var(--ds-island-clearance)` on `[id]` anchors inside the edition root.
- Visible `:focus-visible` rings on links and buttons inside `.ds-utility-edition`.
- Mosaic is `aria-hidden`; attribution remains in adjacent copy on story/about routes.

---

## Tests

| Module | Test file |
|---|---|
| Chrome helpers + CSS contract | `utility-edition-chrome.test.ts` |
| Page wiring (no legacy mast) | `app/utility-edition-pages.test.ts` |
