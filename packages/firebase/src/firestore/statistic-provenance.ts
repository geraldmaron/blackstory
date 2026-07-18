
/**
 * THE canonical zod fragments for provenance-carrying statistic/dataset documents
 * (public-numeric-policy.ts category 3). Every statistics collection schema composes these
 * instead of restating the quartet — consolidated 2026-07-18 from three near-identical
 * copies (censusCountyDecadeSchema, demographics acsProvenanceFields, external
 * provenanceFields).
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
