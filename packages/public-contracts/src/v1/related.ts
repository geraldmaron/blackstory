/**
 * Public related-entity shapes — extracted from `apps/web/src/data/public-seed.ts`'s
 * `PublicRelatedEntry` and `RelatedNeighborView`.
 *
 * Deliberately NOT recursive: a `RelatedEntryV1`/`RelatedNeighborV1` never embeds another full
 * entity or another related-entry list — only ids, labels, and a direction/timespan. This is a
 * by-construction defense against the "recursive graph payloads" adversarial case (MOB-003
 * adversarial review): there is no self-referential schema anywhere in this package, so a client
 * parser can never be forced into unbounded recursion by a crafted response.
 */
import { z } from 'zod';
import { idString, nonEmptyText } from '../internal/primitives.js';

export const RELATION_DIRECTIONS = ['outgoing', 'incoming'] as const;
export const relationDirectionSchema = z.enum(RELATION_DIRECTIONS);
export type RelationDirectionV1 = (typeof RELATION_DIRECTIONS)[number];

export const relationTimespanV1Schema = z
  .object({
    label: z.string().max(200).optional(),
    validFrom: z.string().max(64).optional(),
    validTo: z.union([z.string().max(64), z.null()]).optional(),
  });

export type RelationTimespanV1 = z.infer<typeof relationTimespanV1Schema>;

/** A typed edge from the current entity to another entity id — the graph adjacency shape, not
 * the neighbor's own denormalized display fields (see `relatedNeighborV1Schema` for that). */
export const relatedEntryV1Schema = z
  .object({
    id: idString(200),
    type: nonEmptyText(100),
    direction: relationDirectionSchema,
    timespan: relationTimespanV1Schema.optional(),
  });

export type RelatedEntryV1 = z.infer<typeof relatedEntryV1Schema>;

/** A denormalized 1-hop (or capped 2-hop "continue learning") neighbor, carrying just enough of
 * the neighbor's own public fields to render a link card without a second round trip. */
export const relatedNeighborV1Schema = z
  .object({
    id: idString(200),
    displayName: nonEmptyText(300),
    kind: nonEmptyText(100),
    summary: z.string().max(2000),
    relationType: nonEmptyText(100),
    direction: relationDirectionSchema,
    timespan: relationTimespanV1Schema.optional(),
  });

export type RelatedNeighborV1 = z.infer<typeof relatedNeighborV1Schema>;
