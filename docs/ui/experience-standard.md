# Public experience standard

**Status:** Binding for public web surfaces (2026-11-16). Sits under
[`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md) and [`brand.md`](./brand.md); where they
disagree, they win. Copy voice stays in [`story.md`](./story.md).

**Why it exists:** the 2026-11-16 rendered audit (35 routes, 390/768/1440, light and dark) found
37 distinct font sizes in use, row titles larger than their own section heads, a footer and menu
with no icons while the phone tab bar had them, and drawn art on 7 surfaces. Every one of those
came from a page choosing for itself. This file names the choice once so pages stop making it.

**How to check a surface:** `node scripts/surface-audit.mjs <outDir>` against the dev server. It
reports, it does not gate; read its flags against the rules below.

---

## 1. Pillars

The site has four reader-facing pillars. They come from the destination catalog
(`packages/public-contracts/src/destinations.ts`, grouped by `lib/nav/destination-registry.ts`),
and the footer, Rooms and the header are all rendered from that catalog. A new page joins a
pillar by getting a group there, never by being hand-listed in chrome.

| Pillar | Group | Destinations | The reader's question |
|---|---|---|---|
| **Find** | `find` | Map, Stories, Records, Rooms | Where is it, and what is there? |
| **Read deeper** | `read` | Law, Data, Lives, Banned books, Memorial | What does it mean, across time? |
| **How it decides** | `check` | About, Questions, Methodology, Source library, Errata | Why should I trust it? |
| **Add to it** | `take-part` | Submit, Corrections, Support | How do I fix or add something? |

Policy pages (Privacy, Terms) are a fifth family, `policy`: reachable from the footer's legal
row, never browsable.

## 2. Critical user journeys

Each journey names its success signal so a change can be judged against it. "Friction" is what
the 2026-11-16 audit observed; strike a line when it is fixed and verified on the rendered page.

| # | Actor and goal | Entry | Path | Success signal | Open friction |
|---|---|---|---|---|---|
| J1 | First-time visitor gets oriented | `/` | hero, five-record tour, "Open the record" | a record page opens | none open |
| J2 | Researcher finds a kind of place | header search | type, Enter, `/records?q=`, facet, row | the record opens within two facet changes | result count said three times on a query |
| J3 | Reader browses by time or place | `/records?layout=chronology`, `/explore` | timeline, decade; or map, state | the decade's or state's rows are on screen | "Jump to decade" sits only in the pager; phone map total (4,378) differs from Records (4,387) without the reason shown |
| J4 | Phone reader searches from a record | header search icon | sheet, type, suggestion or Enter | the record opens | none open |
| J5 | Reader moves to another room | tab bar More, or footer | `/rooms`, row | the room opens in two taps | footer says "Rooms" where the tab says "More" |
| J6 | Reader checks whether a law protects them | `/law` | era or topic, law, "Your rights today" | an agency complaint link is opened | rights block sits third, below two prose beats |
| J7 | Parent or teacher checks a book challenge | `/books` | state, title, challenge table | their state and district with a cited report | no title search on the page |
| J8 | Reader goes from a story to its evidence | `/stories` | cover, Contents, citation, Sources, records strip | a cited source or record opens | none open |
| J9 | Teacher looks up a published figure | `/data` | section nav, figure, Source/Limits | the agency table is reached | none open |
| J10 | Reader compares a region's lives | `/lives` | "By region" chips under the mast, or the explorer's Area tab | the region panel with cited tables | a bad `?area=` falls back to national silently |
| J11 | Family member finds a name | `/memorial` | past the wall, Find a name or letter strip | the name row with year and place | none open |
| J12 | Skeptic decides whether a record is citable | record, "How a record gets in" | Methodology, Sources, Errata | understands the grade and opens the publisher | Sources rows do not link to the records that cite them; three source taxonomies disagree (section 6) |
| J13 | Descendant reports an error | record or Support | `/corrections`, receipt, `/corrections/status` | receipt, outcome, an Errata entry | an unknown code is a noindex not-found, but its HTTP status stays 200 because the route's loading state streams first |
| J14 | Lost reader on a bad link | 404 | map, search, records or stories | lands on content in one click | none open |

## 3. Theme

- Every surface renders in light and dark from tokens. No color literal in a page stylesheet; the
  design-token lint (`scripts/lint-design-tokens.mjs`) ratchets this.
- Paper stays paper: in dark, anything read (a record, a story, a trust sheet) is a cream sheet on
  the ink table (`tokens.css`, "Anything read is a paper sheet"). That is the design, not a page
  stuck in light.
- Color bands (`Block tone`, `data-ground`) are fixed materials in both themes. Text on them uses
  the ground's own ink.
- Numerals: `--ds-numeral-accent` is a graphic token (3:1, large type only). Below display size
  use `--ds-numeral-soft-text` (4.5:1). `/sources` failed this.

## 4. Type

One ramp, by role. A surface picks the role; it never picks a size.

| Role | Token | Rule |
|---|---|---|
| Page title (the one h1) | `--ds-text-display` | One per page. Nothing else on the page reaches it. |
| Section head (h2) | `--ds-text-headline` or `--ds-text-display-2` | Under the h1. A band head uses headline; an in-sheet head uses display-1/2. |
| Group head (h3, room group) | `--ds-text-display-3` | Under its section head. |
| Row, card, list or pager title | `--ds-text-title` | Never above its group head. `/rooms`, `/errata`, the record pager and law years were above it and were brought down. |
| Display numeral | `DisplayNumeral` (`.ds-numeral`) | Decorative weight only. An in-page numeral (an era span, a day, a sparse decade) uses `--ds-text-display-1`, never the page-title step. |
| Body, lede, caption, meta | `--ds-text-body`, `--ds-text-editorial-lede`, `--ds-text-caption`, `--ds-text-meta` | Unchanged. |

Test: on the rendered page, list the h1 and every element 32px or larger. Each must be the h1, a
section head, or a display numeral. Anything else is oversize.

## 5. Spacing

- Gutters come from `--ds-gutter` (16px or more at 390) and content sits in `.ds-wrap`.
- Bands pad with `--ds-space-*` steps (`--ds-space-12`/`16` for a full band, `--ds-space-6` for a
  sparse one). A band with little in it shrinks; the records timeline does this by row count.
- Rows and targets are at least 44px tall in chrome and lists, and at least 24px anywhere a reader
  taps. Inline prose links are the WCAG 2.5.8 exception.
- A sheet that rises into a band uses the shared overlap (`TrustMast`, `RecordPage`), not a local
  negative margin.

## 6. Icons

Icons mark **where a link takes you**. They never stand in for the word and never decorate prose.

| Place | Icon | Source |
|---|---|---|
| Header tabs, phone tab bar | yes | `SHELL_TABS[].icon` through `DestinationIcon` |
| Footer destination links | yes | `FooterNavItem.icon` |
| Rooms rows and room cards | yes | `destination.icon` |
| Trust onward links (`TrustLinks`) | yes, derived from the href | `destinationFor(href).icon` |
| Command palette Go rows | yes | already shipped |
| Record chips (kind, place) and map CTAs | yes | already shipped |
| Column titles, group headings, numerals | no | the word or the numeral is the mark |
| Footer legal row, maker credit, staff sign-in | no | fine print stays plain |
| Prose, citations, record h1, breadcrumbs | no | |
| Memorial names and letter groups | no | see section 7 |

Every glyph is `aria-hidden`; the visible label is the accessible name. Only
`lib/nav/destination-icons.ts` may name a Font Awesome glyph.

## 7. Pattern and immersion

A surface's atmosphere matches its job. In order of preference: the historical material itself
(photo, map, document), a data figure, then drawn band art (`BandArt`, `BandRule`). Band art is
the floor, so no full-width band reads as a blank color field.

| Surface role | Motif |
|---|---|
| Rooms: Read deeper | `contours` |
| Rooms: How it decides, Errata, the Lives explorer | `ledger` |
| Rooms: Add to it | `weave` |
| Corrections, Submit | `tools` |
| Law eras, Data | `decades` |
| Books bands | `ledger` and `grain`, alternating |
| Sources | `mapline` |
| Terms, Privacy | `grain` |
| FAQ, Support, About | `weave` |
| 404 and error | `contours` |

Rules:

- A band opts in by rendering `<BandArt>` inside it; `band-art.css` makes any band holding art its
  own host. A section heading takes a drawn rule through `RoomSection rule`. No page re-implements
  a motif in local CSS.
- Art fades away from the text column, so the band's contrast is the ground's own. The corner
  drawings (`architecture`, `mapline`, `tools`) need a clear right side; a band with text on the
  right (Rooms rows) takes a full-band motif instead.
- **Memorial (P-01):** no band art, map imagery, symbolic icons (candle, flame, dove, flower,
  ribbon, fist, broken chain), display count numerals, photos of harm or novelty motion. The names
  wall is its atmosphere. The three onward cards are the ceiling.

## 8. States

Every list or search surface ships a designed empty, no-results, loading and error state, in the
house voice, with one way forward. The 404 is a real 404. A lookup that finds nothing
(`/corrections/status/[code]`) calls `notFound()` so it renders the not-found boundary and is
never indexed. Where a route has a `loading.tsx`, the stream has started before the lookup ends,
so the HTTP status stays 200; that is the accepted cost of the loading state.

## 9. Research Source Library

Today there are three layers and they do not share a taxonomy.

| Layer | Where | What it uses |
|---|---|---|
| Public library | `/sources` (`app/sources/*`, `source-library.ts`) | 716 publishers folded by domain; five kinds inferred from the address (government, university, organization, reference, other) |
| Public explanation | `/sources` section 03 (`methodology-copy.ts`) | six reader kinds (government archive, government agency, court or legal, academic library, museum or heritage, news and reference) |
| Grading | `packages/research-kernel/profiles/black-history.v1.json` `sourceFitness` | 25 source classes with claim-class fitness |
| Staff guidance | `/admin/sources` ([`patterns-source-library.md`](./patterns-source-library.md)) | versioned collection policies; no public view |

The grade is decided by the 25 kernel classes, so they are the one source of truth. The public
library should show the six reader kinds as a deterministic rollup of those classes, and the
address-derived chips should be renamed "Address type" or removed. Open reader gaps: no publisher
search, no link from a publisher to the records citing it, no download. This rollup is an owner
decision (it changes what the public page claims), so it is recorded here, not shipped.

## 10. Policy pages

| Page | States |
|---|---|
| `/privacy` | controller, no accounts or ads, one functional cookie, geocoder use, logs, measurement, submissions held privately and not used for training |
| `/terms` | notice not contract, CC BY 4.0 for own writing, corrections, record-about-you, copyright with a 72-hour acknowledgment, affiliate links |
| `/methodology` | intake stages, grades, editorial standards, precision, living-person protection, archiving |
| `/corrections`, `/errata` | correction process with receipt and appeal; append-only public change log |
| `/about`, `/faq` | who runs it, stance, protections, AI pipeline |

Gaps, each needing an owner decision on wording:

1. No accessibility statement (conformance target, known issues, response time).
2. No single AI-use statement. The FAQ's "Does AI read what I send?" does not say yes or no, and
   no page names the model providers.
3. The dignity rules in `PROTECTED-EXPERIENCES.md` have no public counterpart.
4. No takedown path for images of living people or descendants' privacy requests beyond email.
5. Privacy names no processors (hosting, database, CDN, AI) and no retention periods.
6. Privacy is dated August 2026 and Terms September 2026.
