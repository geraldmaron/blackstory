/**
 * Storage-neutral parsers for Postgres `bb_public` release rows.
 * Same schemas as `apps/web/src/lib/public-data/projection-contracts.ts`.
 */
import {
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  publicSearchProjectionSchema,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
  type PublicSearchProjectionDoc,
} from '@repo/schemas';

export type {
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  PublicSearchProjectionDoc,
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
