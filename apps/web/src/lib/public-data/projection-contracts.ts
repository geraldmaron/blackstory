/** Storage-neutral parsers for Postgres release rows and portable release artifacts. */
import {
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  publicSearchProjectionSchema,
  publicStoryListItemSchema,
  publicStoryProjectionSchema,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
  type PublicSearchProjectionDoc,
  type PublicStoryListItemDoc,
  type PublicStoryProjectionDoc,
} from '@repo/schemas';

export type {
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  PublicSearchProjectionDoc,
  PublicStoryListItemDoc,
  PublicStoryProjectionDoc,
};

export function parseActiveRelease(data: unknown): PublicActiveReleaseDoc | undefined {
  const parsed = publicActiveReleaseSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseEntityProjection(data: unknown): PublicEntityProjectionDoc | undefined {
  const parsed = publicEntityProjectionSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseSearchProjection(data: unknown): PublicSearchProjectionDoc | undefined {
  const parsed = publicSearchProjectionSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseStoryProjection(data: unknown): PublicStoryProjectionDoc | undefined {
  const parsed = publicStoryProjectionSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseStoryListItem(data: unknown): PublicStoryListItemDoc | undefined {
  const parsed = publicStoryListItemSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function toStoryListItem(story: PublicStoryProjectionDoc): PublicStoryListItemDoc {
  return {
    id: story.id,
    releaseId: story.releaseId,
    slug: story.slug,
    title: story.title,
    dek: story.dek,
    publishedAt: story.publishedAt,
    eraLabel: story.eraLabel,
    placeLabel: story.placeLabel,
  };
}
