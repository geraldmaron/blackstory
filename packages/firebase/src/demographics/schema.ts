/**
 * Firestore document schema for the `censusCountyDecades` collection — one doc per county per
 * decennial vintage: total + Black ("Black or African American alone") population counts.
 *
 * Policy reading (public-numeric-policy.ts, permitted category 3, referenced there by this
 * schema's name): decennial census counts are published government statistics and are
 * permitted public numerics ONLY because this schema makes the provenance quartet
 * (`source`, `sourceUrl`, `retrievedAt`, `contentHash`) required — a count without provenance
 * is an assertion, not a statistic. Writers additionally call
 * `assertPublishedStatisticProvenance` before persisting (see ./load-cli.ts).
 *
 * `contentHash` is computed over the stable statistic fields only (see
 * `censusCountyDecadeContentFields` in ./load-cli.ts) — `retrievedAt` is deliberately
 * excluded so re-fetching unchanged data hashes identically and re-runs are no-ops.
 *
 * Lives in its own `demographics/` directory for the same reason `jurisdictions/` does:
 * schema, loader, and tests for this collection stay self-contained.
 */
import { z } from 'zod';
import { FREE_ENSLAVED_SPLIT_DECADES, HISTORICAL_NATIONAL_DECADES } from '@repo/domain';
import {
  datasetArtifactProvenanceFields,
  publishedStatisticProvenanceFields,
} from '../firestore/statistic-provenance.js';

/** Decade labels this collection carries — matches `CENSUS_DECENNIAL_VINTAGES` in @repo/domain. */
export const censusCountyDecadeDecadeSchema = z.enum(['2000', '2010', '2020']);

export type CensusCountyDecadeDecade = z.infer<typeof censusCountyDecadeDecadeSchema>;

export const censusCountyDecadeSchema = z.object({
  /** Deterministic id: `{fips5}_{decade}`, e.g. `01001_2020`. */
  id: z.string().regex(/^\d{5}_(2000|2010|2020)$/),
  /** 5-digit county GEOID (stateFips + countyFips) — the county join key used map-wide. */
  fips5: z.string().regex(/^\d{5}$/),
  stateFips: z.string().regex(/^\d{2}$/),
  countyFips: z.string().regex(/^\d{3}$/),
  /** Census `NAME` column as published, e.g. "Autauga County, Alabama". */
  countyName: z.string().min(1),
  decade: censusCountyDecadeDecadeSchema,
  totalPopulation: z.number().int().nonnegative(),
  /** "Black or African American alone" count for the vintage's race table. */
  blackPopulation: z.number().int().nonnegative(),
  ...publishedStatisticProvenanceFields,
});

export type CensusCountyDecadeDoc = z.infer<typeof censusCountyDecadeSchema>;

/** Deterministic doc id: `{fips5}_{decade}`. */
export function censusCountyDecadeId(fips5: string, decade: CensusCountyDecadeDecade): string {
  return `${fips5}_${decade}`;
}

export function parseCensusCountyDecadeDoc(data: unknown): CensusCountyDecadeDoc {
  return censusCountyDecadeSchema.parse(data);
}

/**
 * National decennial population doc — one per decade 1790–1990 from twps0056 Table 1 (the
 * historical lane; the modern 2000–2020 national number comes from `censusCountyDecades` sums,
 * so this collection deliberately stops at 1990). `freeBlackPopulation` /
 * `enslavedBlackPopulation` are present only for the 1790–1860 decades that carried the
 * free/enslaved split — both or neither, and (within twps0056's independent per-column
 * rounding) they reconstitute the Black total.
 *
 * Decade grammar is imported from the @repo/domain registry (HISTORICAL_NATIONAL_DECADES) so a
 * new historical decade is a one-line registry edit, never a copy edited here.
 */
export const censusNationalDecadeDecadeSchema = z.enum(
  HISTORICAL_NATIONAL_DECADES as unknown as [string, ...string[]],
);

export type CensusNationalDecadeDecade = z.infer<typeof censusNationalDecadeDecadeSchema>;

const FREE_ENSLAVED_TOLERANCE = 5;

export const censusNationalDecadeSchema = z
  .object({
    /** Deterministic id equal to the decade label, e.g. `1790`. */
    id: z.string().regex(/^\d{4}$/),
    decade: censusNationalDecadeDecadeSchema,
    totalPopulation: z.number().int().nonnegative(),
    /** twps0056-harmonized "Black" total for the decade. */
    blackPopulation: z.number().int().nonnegative(),
    /** Free Black population — 1790–1860 only. */
    freeBlackPopulation: z.number().int().nonnegative().optional(),
    /** Enslaved Black population — 1790–1860 only. */
    enslavedBlackPopulation: z.number().int().nonnegative().optional(),
    // Parsed from a single bulk CSV artifact → carries the artifact digest + license, not just
    // the per-row quartet (data-ingestion-methodology.md step 6, bulk-derived lane).
    ...datasetArtifactProvenanceFields,
  })
  .superRefine((doc, ctx) => {
    if (doc.id !== doc.decade) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'id must equal decade', path: ['id'] });
    }
    const hasFree = doc.freeBlackPopulation !== undefined;
    const hasEnslaved = doc.enslavedBlackPopulation !== undefined;
    if (hasFree !== hasEnslaved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'freeBlackPopulation and enslavedBlackPopulation must both be present or both absent',
        path: ['freeBlackPopulation'],
      });
    }
    const splitDecade = (FREE_ENSLAVED_SPLIT_DECADES as readonly string[]).includes(doc.decade);
    if (hasFree && !splitDecade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `decade ${doc.decade} must not carry a free/enslaved split`,
        path: ['freeBlackPopulation'],
      });
    }
    if (hasFree && hasEnslaved) {
      const discrepancy =
        doc.freeBlackPopulation! + doc.enslavedBlackPopulation! - doc.blackPopulation;
      if (Math.abs(discrepancy) > FREE_ENSLAVED_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `free + enslaved (${doc.freeBlackPopulation! + doc.enslavedBlackPopulation!}) must equal Black total (${doc.blackPopulation}) within ±${FREE_ENSLAVED_TOLERANCE}`,
          path: ['blackPopulation'],
        });
      }
    }
  });

export type CensusNationalDecadeDoc = z.infer<typeof censusNationalDecadeSchema>;

/** Deterministic doc id: the decade label itself. */
export function censusNationalDecadeId(decade: CensusNationalDecadeDecade): string {
  return decade;
}

export function parseCensusNationalDecadeDoc(data: unknown): CensusNationalDecadeDoc {
  return censusNationalDecadeSchema.parse(data);
}

/**
 * ACS 5-year estimate fields (the starter comparison set — `ACS5_STARTER_VARIABLES` in
 * @repo/domain). Every field optional: a suppressed cell is OMITTED here and its field name
 * recorded in `suppressed` — a negative ACS sentinel value must never be persisted.
 */
export const acsEstimatesSchema = z
  .object({
    totalPopulation: z.number().nonnegative(),
    raceUniverse: z.number().nonnegative(),
    blackPopulation: z.number().nonnegative(),
    medianHouseholdIncome: z.number().nonnegative(),
    medianHouseholdIncomeBlack: z.number().nonnegative(),
    tenureUniverse: z.number().nonnegative(),
    ownerOccupied: z.number().nonnegative(),
    renterOccupied: z.number().nonnegative(),
    educationUniverse25Plus: z.number().nonnegative(),
    bachelorsDegree: z.number().nonnegative(),
    mastersDegree: z.number().nonnegative(),
    professionalDegree: z.number().nonnegative(),
    doctorateDegree: z.number().nonnegative(),
  })
  .partial();

export type AcsEstimatesDoc = z.infer<typeof acsEstimatesSchema>;

/** One county's ACS 5-year starter estimates for one vintage. Doc id `{fips5}_{vintage}`. */
export const acsCountyProfileSchema = z.object({
  id: z.string().regex(/^\d{5}_\d{4}$/),
  fips5: z.string().regex(/^\d{5}$/),
  stateFips: z.string().regex(/^\d{2}$/),
  countyFips: z.string().regex(/^\d{3}$/),
  /** Census `NAME` column as published. */
  name: z.string().min(1),
  /** ACS 5-year end year, e.g. '2024' = 2020–2024 estimates. */
  vintage: z.string().regex(/^\d{4}$/),
  estimates: acsEstimatesSchema,
  /** Field names whose cells were suppressed/uncomputable upstream. */
  suppressed: z.array(z.string()),
  ...publishedStatisticProvenanceFields,
});

export type AcsCountyProfileDoc = z.infer<typeof acsCountyProfileSchema>;

/**
 * One tract's ACS 5-year starter estimates for one vintage. Doc id `{geoid11}_{vintage}`.
 *
 * ACCESS DISCIPLINE: ~85k docs per vintage — clients must NEVER full-scan this collection.
 * Reads are county-bounded (`where('fips5','==',...)`) or served by server-side aggregates;
 * firestore.rules keeps client read closed until such a surface exists.
 */
export const acsTractProfileSchema = z.object({
  id: z.string().regex(/^\d{11}_\d{4}$/),
  /** 11-digit tract GEOID: stateFips + countyFips + tractCode. */
  geoid11: z.string().regex(/^\d{11}$/),
  /** Parent county GEOID — the bounded-query key. */
  fips5: z.string().regex(/^\d{5}$/),
  stateFips: z.string().regex(/^\d{2}$/),
  countyFips: z.string().regex(/^\d{3}$/),
  tractCode: z.string().regex(/^\d{6}$/),
  /** Tract boundary vintage this GEOID refers to — 2020+ ACS5 uses 2020 tracts; other
   * tract-keyed collections (e.g. Opportunity Atlas, 2010 tracts) differ. Always explicit. */
  tractVintage: z.enum(['2010', '2020']),
  name: z.string().min(1),
  vintage: z.string().regex(/^\d{4}$/),
  estimates: acsEstimatesSchema,
  suppressed: z.array(z.string()),
  ...publishedStatisticProvenanceFields,
});

export type AcsTractProfileDoc = z.infer<typeof acsTractProfileSchema>;

export function acsCountyProfileId(fips5: string, vintage: string): string {
  return `${fips5}_${vintage}`;
}

export function acsTractProfileId(geoid11: string, vintage: string): string {
  return `${geoid11}_${vintage}`;
}
