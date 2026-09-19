/**
 * Shared Zod provenance fragments for statistics and dataset records. Collection schemas
 * compose these fields instead of restating independent variants.
 */
import { z } from 'zod';

/** The provenance quartet + write timestamps every published-statistic doc carries. */
export const publishedStatisticProvenanceFields = {
  /** Source identifier, e.g. `us-census-decennial-2020-pl`. */
  source: z.string().min(1),
  /** Keyless public data URL — an API key must never be persisted here. */
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  /** sha256 hex digest of the doc's canonical stable-field JSON (excludes timestamps). */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

/** Extension for docs derived from a bulk artifact: the artifact-level digest and the
 * license restriction that travels with every derived record. */
export const datasetArtifactProvenanceFields = {
  ...publishedStatisticProvenanceFields,
  /** sha256 hex digest of the whole acquired artifact this doc was parsed from. */
  datasetChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  license: z.string().min(1),
} as const;
