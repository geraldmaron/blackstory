
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

/** Decade labels this collection carries — matches `CENSUS_DECENNIAL_VINTAGES` in @blap/domain. */
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
  /** Provenance quartet — required, per public-numeric-policy category 3. */
  source: z.string().min(1),
  /** Keyless public data URL (buildProvenanceSourceUrl) — never contains an API key. */
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  /** sha256 hex digest of the canonical stable-field JSON. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
 * ACS 5-year estimate fields (the starter comparison set — `ACS5_STARTER_VARIABLES` in
 * @blap/domain). Every field optional: a suppressed cell is OMITTED here and its field name
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

const acsProvenanceFields = {
  /** Provenance quartet — required, per public-numeric-policy category 3. */
  source: z.string().min(1),
  /** Keyless public data URL — never contains an API key. */
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  /** sha256 hex digest of the canonical stable-field JSON. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

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
  ...acsProvenanceFields,
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
  ...acsProvenanceFields,
});

export type AcsTractProfileDoc = z.infer<typeof acsTractProfileSchema>;

export function acsCountyProfileId(fips5: string, vintage: string): string {
  return `${fips5}_${vintage}`;
}

export function acsTractProfileId(geoid11: string, vintage: string): string {
  return `${geoid11}_${vintage}`;
}
