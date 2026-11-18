/**
 * Published stories on the wire: `/v1/stories` (the list) and `/v1/stories/{slug}` (one piece).
 *
 * The site renders stories from the release projection directly; the phone reads this. The shape
 * is a reading contract, not a copy of the authoring schema:
 *
 * - INLINE MARKUP IS PARSED ON THE SERVER. Prose arrives as flat runs (`text` with optional
 *   `strong`/`em`/`href`/`entityId`, `cite` with its source number, `break`), so a client never
 *   carries a second parser for `[ref:id]`, `[[entityId|Label]]` or `**bold**`. Flat rather than
 *   nested because a native text view styles spans, not trees.
 * - BLOCKS A CLIENT CANNOT DRAW YET ARE NAMED, NOT DROPPED. Charts, timelines, document excerpts
 *   and videos need data the site hydrates from its own packets; they arrive as `webOnly` with a
 *   caption, so a reader is told something is there and can open the site for it. A map inset
 *   becomes a `record` link, since the phone can open the record itself.
 * - `webPath` is the story's canonical site path (`/stories/{slug}`, or a collection's own path
 *   such as `/presidents/{slug}`; see `storyPath` in `../destinations.ts`).
 *
 * Bounds are explicit on every string and list, per this package's rule.
 */
import { z } from 'zod';
import { boundedArray, httpUrl, idString, nonEmptyText } from '../internal/primitives.js';

const slug = () =>
  z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const storyFormatV1Schema = z.enum(['chapter', 'entry']);
export type StoryFormatV1 = z.infer<typeof storyFormatV1Schema>;

export const storyImageV1Schema = z.object({
  url: httpUrl(2048),
  alt: z.string().max(400),
  credit: nonEmptyText(600),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});
export type StoryImageV1 = z.infer<typeof storyImageV1Schema>;

export const storyCollectionV1Schema = z.object({
  id: slug(),
  label: nonEmptyText(120),
  position: z.number().int().min(0).max(100_000),
  positionLabel: nonEmptyText(80).optional(),
});
export type StoryCollectionV1 = z.infer<typeof storyCollectionV1Schema>;

export const storyContributorV1Schema = z.object({
  name: nonEmptyText(120),
  kind: z.enum(['person', 'editorial']),
  roles: boundedArray(z.enum(['author', 'researcher', 'editor']), 3),
});
export type StoryContributorV1 = z.infer<typeof storyContributorV1Schema>;

export const storyListItemV1Schema = z.object({
  slug: slug(),
  title: nonEmptyText(160),
  summary: nonEmptyText(600),
  format: storyFormatV1Schema,
  eraLabel: nonEmptyText(80),
  placeLabel: nonEmptyText(120),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  collection: storyCollectionV1Schema.optional(),
  heroImage: storyImageV1Schema.optional(),
  webPath: nonEmptyText(300),
});
export type StoryListItemV1 = z.infer<typeof storyListItemV1Schema>;

/** Upper bound on the list. Far above the catalog today; low enough to bound a hostile payload. */
export const MAX_STORIES = 2_000;

export const storiesResponseV1Schema = z.object({
  releaseId: idString(200),
  stories: boundedArray(storyListItemV1Schema, MAX_STORIES),
});
export type StoriesResponseV1 = z.infer<typeof storiesResponseV1Schema>;

/* ---------- inline runs ---------- */

export const storyRunV1Schema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('text'),
    text: z.string().max(20_000),
    strong: z.literal(true).optional(),
    em: z.literal(true).optional(),
    href: httpUrl(2048).optional(),
    entityId: idString(200).optional(),
  }),
  /** `n` is the 1-based position of `refId` in the story's `references`. */
  z.object({ t: z.literal('cite'), n: z.number().int().min(1).max(1_000), refId: slug() }),
  z.object({ t: z.literal('break') }),
]);
export type StoryRunV1 = z.infer<typeof storyRunV1Schema>;

const runs = (max = 2_000) => boundedArray(storyRunV1Schema, max);

/* ---------- blocks ---------- */

export const storyBlockV1Schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3)]),
    text: nonEmptyText(240),
  }),
  z.object({ type: z.literal('paragraph'), runs: runs() }),
  z.object({
    type: z.literal('list'),
    style: z.enum(['bullet', 'number']),
    items: boundedArray(runs(400), 24),
  }),
  z.object({
    type: z.literal('quote'),
    runs: runs(400),
    attribution: nonEmptyText(240).optional(),
  }),
  z.object({
    type: z.literal('dispute'),
    label: nonEmptyText(240),
    sides: boundedArray(
      z.object({ sourceLabel: nonEmptyText(600), claim: nonEmptyText(4_000) }),
      2,
    ),
  }),
  z.object({
    type: z.literal('image'),
    image: storyImageV1Schema,
    caption: nonEmptyText(400).optional(),
  }),
  z.object({
    type: z.literal('table'),
    caption: nonEmptyText(400),
    header: z.boolean(),
    rows: boundedArray(boundedArray(runs(200), 12), 60),
  }),
  /** A map inset on the site: on a client, a link to the record it pins. */
  z.object({ type: z.literal('record'), entityId: idString(200), label: nonEmptyText(240) }),
  /** Something only the site can draw today (chart, timeline, document excerpt, video). */
  z.object({
    type: z.literal('webOnly'),
    kind: z.enum(['figure', 'stat', 'document', 'timeline', 'video']),
    caption: nonEmptyText(400).optional(),
  }),
  z.object({ type: z.literal('divider') }),
]);
export type StoryBlockV1 = z.infer<typeof storyBlockV1Schema>;

export const storyReferenceV1Schema = z.object({
  id: slug(),
  label: nonEmptyText(240),
  url: httpUrl(2048),
  locator: nonEmptyText(240).optional(),
});
export type StoryReferenceV1 = z.infer<typeof storyReferenceV1Schema>;

export const storyV1Schema = storyListItemV1Schema.extend({
  releaseId: idString(200),
  body: boundedArray(storyBlockV1Schema, 1_000),
  references: boundedArray(storyReferenceV1Schema, 1_000),
  contributors: boundedArray(storyContributorV1Schema, 24),
});
export type StoryV1 = z.infer<typeof storyV1Schema>;
