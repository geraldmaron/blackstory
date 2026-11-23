# Story reading: the page, position, exhibits and linked records

Binding scope: `/stories/[slug]` and `/presidents/[slug]` (`components/story/StoryDetail.tsx`).
[`DESIGN.md`](./DESIGN.md) section 9.3 is the design; this file says how the code does it.

## The page

- One paper ground: no sheet, shadow, band or rounded corner. Prose sits on `--ds-content-max`;
  every exhibit breaks the measure onto the wide track (`.ds-story-wide`).
- The story routes have no `loading.tsx`, and neither does any segment above them (the index
  pages keep theirs in `(index)` route groups), so a story reads with JavaScript off and a missing
  story answers 404. `public-route-loading.test.tsx` holds this.

## Position

- One client component, `StorySpine`, renders the chapter rail and the section bar from the same
  `extractChapterHeadings` result. `story.css` shows the rail from 64rem and the bar below it
  (`display: none`, so only one is announced).
- Below 64rem the shell's `ReadingProgress` line is the gauge and the bar under it names the
  current section, with a Contents button that opens the same list as a native popover. From
  64rem the progress line is hidden, because the rail carries the place. Do not add another.
- Link targets are the h2 ids from `extractChapterHeadings`. No h2 headings: neither renders.
- The kit's `ChapterRail` (phase 6a) replaces `StorySpine`; until then it is the story's own.

## Exhibits

- An image is `StoryFigure`: an `ExhibitFrame` with the credit and rights as its `Receipt`, whole
  and in its own color. `story-exhibit.ts` reads its kind, its date line and whether it is quiet
  from the alt text and credit, because a story image has no field for any of them. An image whose
  words do not say what it is (a painting) takes the compact frame, which prints no kind.
- A `primaryDocument` block is a document exhibit dated by the artifact's own date; a `mapInset`
  is a map exhibit on ink labeled with its precision, still and quiet for a massacre or
  plantation site.
- Addresses come from stored values: the image file's name, the artifact's `refId`, the entity id.
  Paragraphs have no anchors, because story blocks store no ids and position must not supply one.
- A `figure` block is still the story's own packet chart. `StoryBody.tsx` marks the seam where
  phase 6c embeds a pinned `Figure`.
- A cover is shown outside its own story only when `lib/stories/cover-safety.ts` lists it.

## Linked records

- `components/story/story-records.tsx` renders the explicit linked set from
  `storyCitedEntities(doc)` only: `mapInset` blocks ("mapped in") and `relatedEntityIds`
  ("referenced in"). No inference from names, proximity, packet ids or bibliography references.
- The read is `listPublicEntityViewsByIds`; its `source` is passed through. One batched read, no
  per-record queries, no catalog read.
- States (`data-state`): `complete`, `partial` (resolved records listed, remainder counted),
  `unavailable` (linked, none resolved: stated, not an empty state), `empty` (nothing linked; says
  that is not a claim about the sources).
- Unresolved ids are never rendered as ids or names. The heading is "Records linked to this
  chapter"; the copy never claims the list is every record the chapter draws on.
- Item hrefs stay `/entity/<id>`.

## Header strip

Years or term, place, a link to `#sources` with the count of bibliography references (not
historical records), the byline with a link to `/about#neo`, the page's `Cite` control
(`RecordCite`, dated by the page's last revision) and the corrections link.

## Tests

`story-exhibit.test.ts`, `story-records.test.tsx`, `StoryBody.test.ts`, `StoryProse.test.ts`,
`heading-anchors.test.ts` and `public-route-loading.test.tsx`. Rendered checks are recorded in the
phase 5 row of `DESIGN.md` section 13.
