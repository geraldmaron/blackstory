/**
 * Public release/revision provenance metadata — extracted from
 * `apps/web/src/data/public-seed.ts`'s `PublicRevisionMetadata`. Every `v1/entity` response
 * carries one of these per ADR-004 ("public API responses include release/revision metadata").
 */
import { z } from 'zod';
import { idString } from '../internal/primitives.js';

export const revisionMetadataV1Schema = z
  .object({
    releaseId: idString(200),
    /** When the release/projection was generated. May be `''` on pre-release-builder bootstrap
     * stubs (honest "unknown", never a fabricated "now") — see
     * `apps/web/src/lib/public-data/map-projection.ts`. */
    generatedAt: z.string().max(64),
    recordUpdatedAt: z.string().max(64),
  });

export type RevisionMetadataV1 = z.infer<typeof revisionMetadataV1Schema>;
