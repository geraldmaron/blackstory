# Living archive: the visual system

Binding for new and touched surfaces from 2026-11-15. The owner asked for more depth and more
life ("soul without feeling old", bold type that meshes with the brand fonts) and lifted the old
bans on gradients, glow, glass, backdrop blur, shadow and grain for this redesign. This file is
the system that replaced the flat "archive table" material. Flagships: the home page (`/`) and
the record page (`/entity/[id]`, `/place/[slug]`, `/invention/[slug]`, and the law and book
pages that share `RecordPage`).

One line: ink grounds, records keeping their receipts in front, the map as the spine, and the
records' own sourced photographs shown large as plates.

Critique pass (owner decisions, 2026-11-15, after the critique in
`.impeccable/critique/2026-11-15T06-28-11Z__apps-web-src-app-door-home-tsx.md`): the home page
leads with a claim, the decade histogram is the walk, and the template pieces are gone (count-up,
three-card rows, grade letters in boxes, lamplight, the footer slogan and its logo card). A glow,
vignette or grain that carries no information is decoration and stays out.

Still binding, and not brand rules: no point sharper than stored precision, living-person
protection, AA contrast in both themes, color never the only signal, reduced motion, 44px touch
targets, no hate-movement emblems as decoration.

## Depth planes

Four planes, deepest first. Tokens and utilities live in `packages/ui/src/styles/tokens.css`
and `components.css`.

| Plane | What it is | How to use it |
|---|---|---|
| Field | The masthead ground a plate stands in: plain, its own stacking context | `.ds-field` on the record masthead; `data-quiet` marks a quiet record (no plate) |
| Ground | Section bands: ink, paper, sand, copper | `data-ground` (or `<Block tone>`); hard edges, or a gradient edge where an image sinks into the ground below it (the home story cover) |
| Sheet | Reading paper with page bands and a real layered shadow | `<Sheet>`; `.ds-sheet--lift` rises on hover for a sheet that is one link; `--ds-shadow-sheet`, `--ds-shadow-lift` |
| Float | Glass chrome over the map: header, dock, map chrome, dialogs | `.ds-float` (or the same recipe on the bar); solid under `prefers-reduced-transparency` and without `backdrop-filter`; `--ds-shadow-float` |

The light grounds (paper, sand, copper) keep light-table depth in both themes; a dark-theme
vignette on paper reads as dirt.

**Rule:** never more than about two screens on one plane before the ground changes. The record
page runs field (masthead, with its plate), sheet (record), sand (record file), table (pager and
footer). On a desktop the rail sticks only beside the body: lede to body sit in
`.ds-recpage__main`, so its sticky run ends above the record file. On a phone the summary comes
before the map and photo, and the map frame is a short plate with the place in words until its
tiles paint.

**Dark theme:** paper is for reading sheets only. A band that follows the dark map (the home's
first band after the tour) stands on the table's ground (`data-ground="ink"`: ink in the dark
theme, Archive Paper in the light one), never a bright sheet. Inside the sheet, depth comes from type and rules, not boxes: the citation line
is ruled type between two ink rules and the sources beat sits under a heavy ink rule with its
copper numerals. No card shadows inside a sheet.

Shadows always carry an offset and a soft blur. A zero-offset colored halo is decoration, not
depth, and stays out (door-home.test.ts asserts it).

## Type roles

Seven roles; weight is an axis. Full table in [`brand.md`](../brand.md#type).

- **Display** `--ds-text-display`, Schibsted 800, once per surface (the home opening, a record's
  name). Ceiling 6.5rem.
- **Headline** `--ds-text-headline`, 700: chapter and section titles, the footer line.
- **Title** `--ds-text-title`, 650.
- **Body** Geist; **editorial** Newsreader `--ds-text-editorial`; **meta** Geist Mono caps
  `--ds-text-meta` with `--ds-tracking-meta`.
- **Numeral** `--ds-text-numeral` (cap 5.5rem), weight 800. On a record the era numeral is secondary: headline size, beside the meta
  line, never beside the name.

The legacy display names alias onto these roles.

## Plates

Owner decision 2026-11-15: real photographs, never generated imagery. `/about` makes a public,
enforced promise that a plate is never a generated image or a stock photo, so no AI-generated
image ships anywhere on the site, and nothing here is drawn or illustrated in a photograph's
place.

A plate is a record's own `primary_image` (sourced, licensed, credited) shown large and toned
to the page. `<RecordImage plate>` (`apps/web/src/components/entity/RecordImage.tsx`) renders it;
`.ds-plate` (`packages/ui/src/styles/components.css`) tones it.

- **Real and sourced only.** Only the record's own photograph, from the data the archive already
  has. No stand-in when a record has none: no plate at all. No new image files, no server
  processing.
- **One photo language.** Every photograph shown large or as a record's media is a toned plate
  through `<RecordImage plate>`, with its credit. There are no raw color thumbnails on home.
- **A rendering is not a photograph.** An image whose own alt text calls it an artist's
  impression or rendering (`isRenderedImage`, `components/entity/rendered-image.ts`) is never a
  plate and never on home; on its record it shows plain, captioned "Artist's rendering, not a
  photograph" above its credit. The African Burial Ground record's image is one (Rodney Leon's
  memorial design).
- **Sized to the slot.** `<RecordImage width>` asks Commons for the nearest thumbnail step
  (`storyImageSrc`). Images mirrored to our own bucket (`storage.googleapis.com/.../primary.jpg`)
  have no resize path and ship at their stored size.
- **Toned, still a photograph.** A duotone by blend modes: shadows in `--ds-plate-lo` (ink),
  lights in `--ds-plate-hi` (warm paper in the light theme, copper in the dark). No halftone or
  posterizing that would make it read as an illustration. Forced colors show it untoned.
- **Credit always visible.** The record's credit line (`RecordPhotoCredit`) sits beside every
  plate, unaltered, never on the photograph.
- **No type on the photograph.** A plate stands beside the name (record page, desktop), above it
  (record page, phone) or above the label (home), so every text keeps its ground's contrast.
- **Exempt.** The memorial and any sensitive or violence-adjacent record (a sensitivity flag, a
  trauma content note, or a massacre or plantation tone; `isQuietRecord` in
  `app/entity/[id]/adapters.ts`) get no plate and no motion: `RecordPage` takes `quiet`, and the
  photograph, if any, stays plain in the rail. Home never shows a quiet record at all.

## The map and the plate

The map says where; the plate shows what it looks like. They always refer to the same place.

- **Home.** The headline leads, then one primary action into the lead story ("Read" and its
  title), then (desktop only) the record the map points at, shown the way its record page shows it
  (`DoorRecordBlock`): its name, its plate with credit, and one claim in the claims block's
  language (`EvidenceList`: copper numeral, the statement in the serif, its source as a link, its
  grade as a glyph and a word), with an "Another record" control, then "Walk the decades" and
  "Browse all records". The headline ("History" fades to "Black Story" once, whole words, static
  under reduced motion) has one accessible name. On a phone the first screen is the headline and
  the story action and "Walk the decades", the map is the second beat below them, the spotlight record and the
  browse link are dropped (the Records tab is the same door) and the callout card is not drawn:
  the record is marked by its copper pin at 1.6x. The record is pinned for the browser session
  (sessionStorage) so a reload keeps it. A map that has not painted says "Loading the map", and
  one that never paints is replaced by the plain list of states with record counts. Records come
  from `app/door-decade-walk.ts`: never quiet, never a rendering as a plate, a claim with a
  linked source that reads as a whole sentence, photographed records first.
- **The walk is the decade histogram.** "Walk the decades" turns the same column into the
  histogram (the register's records per decade on a true time scale, its prose caption kept).
  Each step is a decade with a record to show: the map holds every record documented through that
  decade (it fills, it never flies), the callout moves to that decade's record, and the column
  shows its name, plate and claim. The histogram is the progress (walked bars ink, the current one
  copper, the rest a rule) and the control (a native range input over the bars, thumb on the
  current bar). Back / Next and the arrow keys step; Escape returns to the opening.
- **Tour.** Between the opening and the first band, three to six real records (five when the
  catalog allows) walk the reader across the country while the map follows. Chosen by rule, on
  the server (`door-tour.ts`): the door's own eligibility (never quiet, never a rendering,
  photographed, a claim with a linked source that reads as a sentence), safe to put a camera on
  (a person only with a recorded death, no sensitivity class), a stored precision finer than a
  county, and never the opening's records or the lead story's subject. The pick is greedy and
  deterministic: a stable hash order, each pick adding a new state, then a new region
  (Northeast, Southeast, Midwest, Southwest, West), then the most distance in time, with at least
  one record outside the Southeast when one exists. Steps read oldest first. With fewer than
  three eligible records there is no tour.
  Each step is a `<section>` with a copper numeral, the record's name as an h3, its place in words
  with the precision word, its photograph as a plate with credit, one sourced claim in the claims
  block's language and an "Open the record" link. A visible heading ("Five records, five
  places"), "Scroll, and the map follows." and a "Skip the tour" link to the grade band come
  first. It is complete without JavaScript, a plain list of records.
  With JavaScript, IntersectionObserver (a thin probe line across the screen, no scroll
  listener, no scroll hijack) names the step in front of the reader. One flight per step change
  (an in-flight move is stopped first) to the record at its precision's zoom, never tighter than
  z12, and the plate's own selection (copper pin, 1.6x) marks it. Leaving the tour returns the
  camera to the national frame the opening uses; reduced motion jumps instead of flying. Focus
  never moves, and the map and the "2 of 5 · Atlanta, Georgia" echo are aria-hidden.
  Wide: the steps are glass cards in the opening card's column, the opening card steps aside, and
  the map frames each record in the window to their right. Phone and portrait tablet: the map
  window becomes a band under the header (38dvh) and the steps scroll on the page's ground
  beneath it; where scroll-driven animations exist the ground is clipped at the band's edge,
  elsewhere it slides over the map like the bands.
- **Below the tour.** Two bands over the fixed map: how evidence is graded, as one ruled row in
  the claims block's language (glyph, word, exact count as a copper numeral) on the table's
  ground with an underlined link to the method, then the lead story on copper: its years are the
  cover (numeral role, ink), and a toned plate with credit stands beside the text only when the
  chapter has a real cover image, so there is never an empty cover. The map meets the first band
  on a hard edge, and both bands use `--ds-section-sm` padding. Then the footer: plain navigation on the table's ground with the
  AI-help disclosure, no slogan, no card.
- **Record page.** The plate leads the masthead field beside the name; the map in the rail shows
  the same place, and its place token links into `/explore?place=`.
- **Explore.** The chrome (column, histogram strip, controls, attribution chip), the record inspector, the selection flag and the record embeds are on the float plane and use the plate language (the inspector photo is a plate with its credit beneath); the map marks, grouping and precision are unchanged.

## Motion

Few moves, each played once, from an already-visible default; all collapse under
`prefers-reduced-motion`. Plates do not animate. Home runs no animation at rest (measured with
`document.getAnimations()` after load: zero running).

- **Headline.** "History" becomes "Black Story" once (`HeroHeadlineMorph`); under reduced motion it
  is "Black Story" from the first paint. The heading's accessible name is always the settled line.
- **Ground slide.** `<Block wipe>` slides a band in; `.ds-reveal` lifts a block of content into
  place, scroll-linked where the browser supports `animation-timeline: view()`. `<Block wipe>`
  starts fully clipped, so keep it off a band whose text must read before it scrolls in.
- **No count-up.** A number is printed at its value. `CountUp` was removed.

## Where it lives

| Piece | File |
|---|---|
| Plane and type tokens, motion tokens | `packages/ui/src/styles/tokens.css` |
| `.ds-field`, `.ds-float`, `.ds-reveal`, `.ds-plate`, sheet shadow and lift | `packages/ui/src/styles/components.css` |
| The claims block (numeral, serif statement, source, grade), one stylesheet for record and home | `apps/web/src/components/evidence/EvidenceList.tsx`, `evidence-list.css` |
| Home records: the opening, one per decade, the histogram | `apps/web/src/app/door-decade-walk.ts`, `door-record-block.tsx`, `door-walk.tsx` |
| Plate tones `--ds-plate-lo` / `--ds-plate-hi` | `packages/ui/src/styles/tokens.css` |
| A record's photograph, plain or as a plate, with its credit | `apps/web/src/components/entity/RecordImage.tsx` |
| Home | `apps/web/src/app/door-home.tsx`, `door-immersive.tsx`, `door-chapters.tsx`, `door-home.css`, `door-tour.ts`, `door-tour-section.tsx`, `door-tour-scroll.tsx`, `door-tour.css` |
| Record page | `apps/web/src/components/patterns/RecordPage.tsx`, `apps/web/src/app/record-page.css` |
| Glass header | `apps/web/src/components/shell/command-bar.css` |
