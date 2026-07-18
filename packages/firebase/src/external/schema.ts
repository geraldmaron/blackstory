
/**
 * Firestore document schemas for tier-1 external datasets (see
 * @blap/domain's `external-data-sources.ts` for the acquisition registry):
 *
 * - `opportunityAtlasTracts` — curated starter subset of the Opportunity Atlas tract
 *   outcomes (Opportunity Insights; attribution required). 2010 tract geography.
 * - `holcAreas` — Mapping Inequality HOLC graded-area records (Univ. of Richmond DSL;
 *   the vector dataset is CC BY-NC-SA — noncommercial gate, see launch-corpora.ts).
 *
 * Both carry the provenance quartet (public-numeric-policy category 3 discipline — these are
 * published research/archival statistics, provenance is structurally required) plus a
 * `license` string so the restriction travels with every doc. Both collections stay
 * client-CLOSED in firestore.rules until a rights-reviewed public surface exists.
 *
 * Opportunity Atlas values are rates/percentile ranks in [0,1]-ish space, NOT counts —
 * a value is retained only when its reliability count (`*_n`) clears the ingest threshold;
 * dropped cells are listed in `suppressed` (same convention as ACS docs).
 */
import { z } from 'zod';

const provenanceFields = {
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  /** sha256 hex digest of this doc's canonical stable-field JSON. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  /** sha256 hex digest of the whole acquired artifact this doc was parsed from. */
  datasetChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  license: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

/** Outcome estimates retained from the tract_outcomes_early release. All optional — a cell
 * below the reliability threshold is omitted and recorded in `suppressed`. */
export const opportunityAtlasOutcomesSchema = z
  .object({
    /** Mean household income rank (adulthood) for children of parents at p25, pooled race/sex. */
    kfrPooledP25: z.number(),
    /** Same for parents at p75. */
    kfrPooledP75: z.number(),
    /** Income rank for Black children, parents at p25 — the race-gap core of the dataset. */
    kfrBlackP25: z.number(),
    /** Income rank for white children, parents at p25. */
    kfrWhiteP25: z.number(),
    /** Incarceration rate for Black children, parents at p25. */
    jailBlackP25: z.number(),
    /** Incarceration rate pooled, parents at p25. */
    jailPooledP25: z.number(),
    /** Reliability counts backing the retained estimates. */
    kfrPooledN: z.number().nonnegative(),
    kfrBlackN: z.number().nonnegative(),
    kfrWhiteN: z.number().nonnegative(),
    jailPooledN: z.number().nonnegative(),
    jailBlackN: z.number().nonnegative(),
  })
  .partial();

export const opportunityAtlasTractSchema = z.object({
  /** Doc id = 11-digit 2010 tract GEOID. */
  id: z.string().regex(/^\d{11}$/),
  geoid11: z.string().regex(/^\d{11}$/),
  fips5: z.string().regex(/^\d{5}$/),
  stateFips: z.string().regex(/^\d{2}$/),
  countyFips: z.string().regex(/^\d{3}$/),
  tractCode: z.string().regex(/^\d{6}$/),
  /** Opportunity Atlas uses 2010 tract boundaries — never join to 2020-tract collections
   * without a crosswalk. */
  tractVintage: z.literal('2010'),
  outcomes: opportunityAtlasOutcomesSchema,
  /** Outcome field names dropped by the reliability threshold or absent upstream. */
  suppressed: z.array(z.string()),
  ...provenanceFields,
});

export type OpportunityAtlasTractDoc = z.infer<typeof opportunityAtlasTractSchema>;

export const holcGradeSchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export const holcAreaSchema = z.object({
  /** Doc id: `holc_{area_id}` (DSL's stable area id — `dsl-mapping-inequality-area-id`). */
  id: z.string().regex(/^holc_\d+$/),
  areaId: z.number().int().nonnegative(),
  city: z.string().min(1),
  state: z.string().length(2),
  /** HOLC security grade; absent for ungraded/industrial areas in the DSL dataset. */
  grade: holcGradeSchema.optional(),
  /** DSL category label, e.g. "Best", "Hazardous", "Industrial". */
  category: z.string().min(1),
  /** Map label, e.g. "A1", "D5"; absent for some areas. */
  label: z.string().optional(),
  residential: z.boolean(),
  commercial: z.boolean(),
  industrial: z.boolean(),
  /** Whether the area belonged to a formal city survey. */
  citySurvey: z.boolean(),
  /** Polygon geometry stays in the raw GeoJSON in Storage (Firestore 1MB doc limit; the
   * map-tile follow-up consumes the file directly). This reference locates it exactly. */
  geometryRef: z.object({
    storagePath: z.string().min(1),
    featureIndex: z.number().int().nonnegative(),
  }),
  ...provenanceFields,
});

export type HolcAreaDoc = z.infer<typeof holcAreaSchema>;
