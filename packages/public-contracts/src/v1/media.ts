/**
 * Public media (rights-cleared image) shape — extracted from `apps/web/src/data/public-seed.ts`'s
 * `PublicEntityPrimaryImageView`. Every field is already public-safe in the source type (a URL,
 * alt text, credit line, and rights status); this schema adds only bounds, not new fields.
 */
import { z } from 'zod';
import { httpUrl, nonEmptyText } from '../internal/primitives.js';

export const MEDIA_RIGHTS_STATUSES = ['public_domain', 'licensed', 'fair_use'] as const;
export const mediaRightsStatusSchema = z.enum(MEDIA_RIGHTS_STATUSES);
export type MediaRightsStatusV1 = (typeof MEDIA_RIGHTS_STATUSES)[number];

export const mediaV1Schema = z
  .object({
    url: httpUrl(2000),
    alt: nonEmptyText(500),
    credit: nonEmptyText(500),
    rightsStatus: mediaRightsStatusSchema,
    width: z.number().int().positive().max(20_000).optional(),
    height: z.number().int().positive().max(20_000).optional(),
    /** Storage object path (not a credential, not a bucket name) — used by the client only to
     * request a fresh signed/CDN URL if `url` has expired. Never a full `gs://` or bucket ARN. */
    objectPath: z.string().max(1000).optional(),
  });

export type MediaV1 = z.infer<typeof mediaV1Schema>;
