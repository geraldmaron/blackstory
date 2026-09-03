# BlackStory design direction v9: chapters

**Status:** binding (2026-07-30).
**Scope:** `/chapters` and `/chapters/[slug]`, the archive's long form publication surface. `/chapters/mosaic-credits` is a Utility surface and is covered in [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) section 4.4, not here.
**Surface class:** Reading room. Chrome and exits are governed by [`patterns-reading-room.md`](./patterns-reading-room.md); the plate by [`patterns-plate-posture.md`](./patterns-plate-posture.md); the Atlas handoff by [`patterns-lens-handoff.md`](./patterns-lens-handoff.md).
**Supersedes:** the `/chapters` rows in `design-direction-v6-stories.md` and `design-direction-v6-themes.md`, whose routes no longer exist. Neither file is deleted: both are the provenance record for how four publication surfaces became one.
**Unchanged and still binding:** [`brand.md`](./brand.md), [`story.md`](./story.md) voice, [`neo-voice.md`](../content/neo-voice.md) chapter voice, [`patterns-record-anatomy.md`](./patterns-record-anatomy.md).

---

## 0. Why this document exists

`/chapters` is the largest publication surface on the site and it had no binding doc. It was built by collapsing four routes (`/articles`, `/stories`, `/themes`, `/topics`) into one, and the design law stayed behind on the docs for the routes that were removed. `README.md`'s pattern index still pointed at `app/stories` and `app/themes`, neither of which exists.

This document describes what is actually in `apps/web/src/app/chapters/` today, then resolves it into the Reading room class.

---

## 1. What is actually there

Three page files, one route-level stylesheet, one shared article component set.

| Path | What it is |
|---|---|
| `app/chapters/page.tsx` | The index. Server component, 71 lines. Loads thin list items from the active release article projection and renders a card grid. |
| `app/chapters/[slug]/page.tsx` | Chapter detail. Server component, 127 lines. `generateStaticParams` from published slugs, `generateMetadata` with title, description and canonical, Article JSON-LD, then header, hero figure, body, references, footer link. |
| `app/chapters/mosaic-credits/page.tsx` | Rights clearance for the atmosphere tiles. Utility class. Still on the v6 stories edition chrome, including its own local `stories-edition.css` and `stories-panel-chrome.ts`. |
| `app/chapters/articles-edition.css` | Route stylesheet. Fifteen classes, all `ds-articles-edition__*` or `ds-article-card__*`. |
| `components/article/` | `ArticleBody.tsx`, `ArticleProse.tsx`, `ArticleReferences.tsx`, `article.css`. Shared by the detail page. |

### 1.1 Data

`lib/articles/source.ts` exposes three cached readers: `listPublicArticleListItems`, `resolveArticle` and `listPublishedArticleSlugs`. Every one of them returns a `source` discriminant of `'live'` or `'unavailable'`, and both pages branch on it. That discriminant is why the index has three states and not two, and it is correct: an archive that cannot reach its own record says so rather than showing an empty grid.

A list item carries `slug`, `title`, `summary`, `eraLabel`, `placeLabel` and an optional `heroImage` with `url`, `alt` and `credit`. A hydrated chapter adds ordered body blocks and numbered references.

### 1.2 The body block vocabulary

`ArticleBody` dispatches nine block types, in document order:

| Block | Renders as |
|---|---|
| `heading` | `h2` or `h3` |
| `paragraph` | Prose through `ArticleProse` |
| `pullquote` | `blockquote` with optional `cite` |
| `figure` | A theme impact metric chart with a caption and citation marks |
| `stat` | Never standalone. Consecutive stats coalesce into one stat rail |
| `primaryDocument` | An artifact drawer holding a dated document, an optional quote and a summary |
| `timeline` | An artifact drawer holding an era timeline with policy eras |
| `mapInset` | An artifact drawer holding a map moment at an entity's coordinate and precision |
| `dispute` | An artifact drawer holding two sources side by side |
| `image` | Figure with caption and credit |

`ArticleProse` does one pass over two inline markup forms, so a paragraph carrying both resolves each in document order: `[ref:<id>]` becomes a superscript reference number linking to the references section, and `[[entityId|Label]]` becomes an entity record link through the shared `ENTITY_PROSE_LINK_RE` from `@repo/domain/editorial`. **Unknown citation markers are dropped from the output**, which is the right failure: a superscript pointing at nothing is worse than no superscript.

### 1.3 What is right about it already

- Cards are real `Link` elements in document order, not divs with click handlers.
- The index distinguishes "temporarily unavailable" from "none published yet", in different sentences.
- The detail page emits Article JSON-LD through `assertNeverClaimReview`, so a chapter can never claim a review rating.
- References are numbered, and inline citations link to them.
- Every stat, figure, primary document and dispute carries its source numbers.
- `generateStaticParams` runs, so published chapters are static.

### 1.4 What is wrong with it

| Defect | Evidence |
|---|---|
| The canonical is hand rolled and relative | `alternates: { canonical: '/chapters/' + slug }` on the detail page, against the absolute convention everywhere else |
| No per route OG image on either page | `metadata` on the index carries title and description only |
| No slug is in the sitemap | `STATIC_PUBLIC_ROUTES` carries `/chapters` and nothing under it |
| The map moment mounts a second MapLibre instance | `MapInsetMoment` calls `EntityLocationMap`, which builds its own map |
| The grid does not window | It renders every published chapter as a card, which holds today and will not at fifty |
| No reading progress, no crumb, no right rail, no records off ramp | The detail page's only exit is "All chapters" |
| No page chrome tests | `apps/web/package.json`'s test list carries `ArticleProse.test.ts` and `mosaic-credits/stories-panel-chrome.test.ts`, and nothing for either chapter page |
| `mosaic-credits` still carries v6 stories chrome under a `/chapters` path | `stories-edition.css`, `stories-panel-chrome.ts`, `data-stories-edition="v6"` |

---

## 2. `/chapters`, the index

**Class:** Reading room. **Plate:** Parked. **Canonical:** absolute, self referential. **In the sitemap:** yes, and every slug joins it.

Keeps the published article grid, on the v9 card. What changes:

- **Right rail on wide viewports**, grouping chapters BY ERA and BY PLACE as links **to chapters**, staying inside the index. A reader who wants a different chapter is not sent out to the map to find one.
- **One Atlas handoff, at the foot**, worded "See every place these chapters touch", built through the lens handoff builder with its reason string.
- **The grid adopts the Results rail windowing law**, so it holds at fifty chapters.
- **The two notices stay distinct** and keep their own sentences.
- Absolute canonical and a per route OG image.

Card anatomy is unchanged: optional hero media, mono era and place meta line, Sora title, serif summary. Hero media is decorative and carries the accessible name in the title, not the image.

---

## 3. `/chapters/[slug]`, the chapter

**Class:** Reading room. **Plate:** Parked, with one Framed slot at a time. **Canonical:** absolute. **In the sitemap:** every slug. **Keeps `generateStaticParams`.**

### 3.1 Anatomy

1. Command bar, then the **reading progress rule** under it.
2. **Crumb:** Atlas / Chapters / this chapter.
3. **Header:** mono era and place kicker, Sora title, serif standfirst, mono byline carrying published and updated dates.
4. **Hero figure** with its credit.
5. **The article column**, roughly a 66 character measure, Source Serif 4 body, mono inline citation chips, the nine block types above.
6. **Numbered references**, each with a return control back to the sentence that cited it.
7. **"The records behind this chapter"**, handing a named collection to the Atlas.
8. **Prev and next chapter.**
9. Site footer.

### 3.2 Map moments

Each `mapInset` block is a bounded in-flow frame that borrows the persistent plate on scroll in and releases it on exit. **Never full bleed behind prose**, enforced in CSS with a test rather than left to authors.

`MapInsetMoment` is the component that becomes this. It already builds its Atlas href through `buildExploreHref` with `selected=<entityId>`, which is the right convention; what changes is that it stops mounting `EntityLocationMap` and starts borrowing the persistent plate. **Extend it. Do not build a second map moment beside it.**

Author several moments far enough apart that the plate is not thrashed. One Framed slot is live at a time, a second request while one is live is refused at runtime, and a moment whose plate is unavailable keeps its caption and says so in words.

### 3.3 Entity mentions

An entity mention in prose opens the record sheet in its **in-document posture**: anchored in the reading column rather than floating over the plate, with "Fly to place" swapping to "Open on the Atlas". `ESC` closes it and returns focus to the chip that opened it.

The sheet is the same component the Atlas renders. No surface forks the preview.

### 3.4 Citations are the source of truth

**This chapter's inline citations are what the chapter-cites-record edge is built from.** The edge is emitted as a release build artifact and rendered in reverse on record pages and in the Atlas sheet as "Chapters that cite this record".

That is the half of the v9 thesis with no implementation today. Until the edge exists, a record has no path back to the editorial that cites it, and folding `/history` would remove the only other browse path from a record to a chapter.

---

## 4. Voice

Unchanged from [`neo-voice.md`](../content/neo-voice.md) and [`story.md`](./story.md), restated because it is load bearing on this surface:

- Immersion with sourced buildup. A named year and place, the rules in force, the measured odds under them.
- Plain everyday voice, contractions fine. Not a lecture and not a brochure.
- Every figure and quotation cites the record it rests on. At least two sources for a fact claim.
- Collapsed drawers for artifacts, so the primary document, timeline, map and dispute are available without breaking the read.
- A person is always identified with role, place and year, never anonymous decoration.
- **No em dashes.** Sentence case body, mono uppercase for slugs only.

---

## 5. URL law

| Rule | Detail |
|---|---|
| Canonical | Absolute, through the shared metadata builder. The hand rolled relative canonical on the detail page is replaced. |
| Sitemap | `/chapters` plus every published slug, built from the destination registry. |
| Redirects in | `/articles/:slug` to `/chapters/:slug` 1:1; `/articles`, `/stories`, `/stories/:path*`, `/themes`, `/topics` and `/topics/:path*` all to `/chapters`. All 308. |
| Theme aliases | `/themes/redlining` to `/chapters/buying-a-home` and `/themes/wealth_gap` to `/chapters/the-gap-that-never-closed`, each with a `:path*` twin, both preceding the `/themes/:path*` catch-all. These hand-maintained pairs are replaced by a generated alias table. |
| Credits | `/stories/mosaic-credits` keeps its permanent redirect to `/chapters/mosaic-credits`, and that rule must keep preceding the `/stories/:path*` catch-all. |
| Middleware | `/chapters` is not in the matcher today. It takes no params, so an empty allowlist would be correct, but nothing needs adding. |
| Deep anchors | URL fragments, never query params. |

---

## 6. Accessibility

- One `h1` per page, then `h2` and `h3` from the heading blocks with no skipped levels.
- Hero and card media are decorative; the title carries the accessible name.
- Artifact drawers are real disclosures with a labeled control naming what is inside.
- Citation superscripts are links with an accessible name that says what they point at, not a bare number.
- Every reference has a return control back to the sentence.
- `scroll-margin` under the fixed bar on every anchored heading.
- `:focus-visible`, 2px `--copper` at 2px offset.
- 44px targets on every control, including the drawer summaries.
- A map moment never intercepts the scroll gesture.

---

## 7. Modules

| Concern | Module | Status |
|---|---|---|
| Index page | `app/chapters/page.tsx` | Built, v6 chrome |
| Detail page | `app/chapters/[slug]/page.tsx` | Built, v6 chrome |
| Route stylesheet | `app/chapters/articles-edition.css` | Built, replaced by the reading room stylesheet in SP-11 |
| Body blocks | `components/article/ArticleBody.tsx` | Built |
| Inline prose | `components/article/ArticleProse.tsx` | Built, tested |
| References | `components/article/ArticleReferences.tsx` | Built |
| Map moment | `components/theme-spine/MapInsetMoment.tsx` | Built, tested, converted to the Framed posture in SP-08 |
| Readers | `lib/articles/source.ts`, `lib/articles/hydrate.ts` | Built |
| Credits page | `app/chapters/mosaic-credits/` | Built, v6 stories chrome, moves to the Utility class in SP-13 |
| Cites edge | `lib/release/build-cites-edge.ts` | Pending (SP-20) |

---

## 8. Acceptance checklist

- [ ] Both pages emit `data-surface="reading"` server side
- [ ] The plate never sits behind the article column, asserted by a CSS test
- [ ] Only one map moment is Framed at a time; a second request while one is live is refused
- [ ] A map moment with no plate keeps its caption and states that the map is unavailable
- [ ] Entity mentions open the record sheet in its in-document posture, and `ESC` returns focus to the chip
- [ ] Every chapter ends with "The records behind this chapter" and prev and next
- [ ] The index right rail groups by era and by place as links to chapters
- [ ] The index grid windows, and holds at fifty chapters
- [ ] Both pages carry an absolute canonical and a per route OG image
- [ ] `/chapters` and every published slug are in the sitemap exactly once
- [ ] `/articles/:slug` reaches `/chapters/:slug` in exactly one hop
- [ ] The theme alias pairs are generated, not hand maintained
- [ ] Page chrome tests exist for both pages and are registered in `apps/web/package.json`'s test list
- [ ] No em dashes in chapter copy
