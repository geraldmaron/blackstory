/**
 * Public supporting-content (Learn surface) shape — extracted from
 * `apps/web/src/data/stories-seed.ts`'s `StoryRecord`/`StorySection`, the longform editorial
 * article shape backing `/stories` and the pattern MOB-015 ("Learn and supporting public content
 * surfaces") follows for mobile. Every field on `StoryRecord` was already public-safe (it is
 * rendered directly on the public web app today); this schema adds bounds only.
 */
import { z } from 'zod';
import { boundedArray, idString, nonEmptyText } from '../internal/primitives.js';

export const contentSectionV1Schema = z
  .object({
    heading: z.string().max(300).optional(),
    paragraphs: boundedArray(nonEmptyText(10_000), 200),
  });

export type ContentSectionV1 = z.infer<typeof contentSectionV1Schema>;

export const contentPageV1Schema = z
  .object({
    slug: idString(200),
    title: nonEmptyText(300),
    dek: z.string().max(1000),
    publishedAt: z.string().max(64),
    eraLabel: z.string().max(100),
    placeLabel: z.string().max(200),
    body: boundedArray(contentSectionV1Schema, 200),
    relatedEntityIds: boundedArray(idString(200), 200),
    relatedFactIds: boundedArray(idString(200), 200),
  });

export type ContentPageV1 = z.infer<typeof contentPageV1Schema>;
