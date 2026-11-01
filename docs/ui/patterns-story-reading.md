# Story reading: contents and linked records

Binding scope: `/stories/[slug]`. Extends [`patterns-reading-room.md`](./patterns-reading-room.md);
the kit wins on tokens.

## Contents ("In this chapter / entry")

- One server component, `components/story/story-contents.tsx`, rendered twice from the same
  `extractChapterHeadings` result: `variant="inline"` (native `<details>`/`<summary>`, collapsed,
  above the prose) and `variant="rail"` (the existing sticky rail group, markup unchanged).
- Exactly one is displayed per viewport. `story.css` hides the inline one from 68rem up and the rail
  one below 67.9375rem (`display: none`, so it is also not announced). The rail's "Next in this
  collection" block stays at every width.
- DOM ids differ: `story-toc` (rail), `story-toc-inline` (inline). Link targets are the h2 ids from
  `extractChapterHeadings`, byte for byte; `StoryBody` and `#ref-N` anchors are untouched.
- No h2 headings: neither placement renders.
- Targets: summary and links are at least 44px (`--ds-reading-target`, 2.75rem); `:focus-visible`
  uses the 2px accent outline. The `+` / `–` cue matches the evidence drawers.
- The global `ReadingProgress` is mounted by the shell. Do not add another.

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

## Byline

The count links to `#about-this-chapter` and reads "References (n)". It counts bibliography
references, not historical records.

## Tests

`story-contents.test.tsx` and `story-records.test.tsx` (SSR with fixtures plus source/CSS contract
checks). Browser acceptance at narrow and desktop widths in both themes is pending.
