
/**
 * Firestore schemas for FBI UCR data (the related workstream) — hate crime bulk records plus the
 * two reference layers that make them interpretable and joinable.
 *
 * Three collections:
 *  - `ucrAgencies`      — ORI → county crosswalk. THE reusable join key for every UCR
 *                         dataset (hate crime today; LEOKA, cargo theft, human trafficking
 *                         all key on the same ORI). Not hate-crime-specific by design.
 *  - `hateCrimeCountyYears` — incidents aggregated by county + year with bias/offense/location
 *                         breakdowns. THE cross-reference surface: `fips5` joins directly to
 *                         `censusCountyDecades`, `acsCountyProfiles`, and (via county) the
 *                         tract collections.
 *  - `ucrStateParticipation` — reporting coverage by state + year.
 *
 * ─── NO-FALSE-ABSENCE (), the load-bearing caveat ───────────────────────────────
 * UCR hate crime reporting is VOLUNTARY. A county-year with no document, or a document with
 * a low `reportingAgencyCount`, means NO AGENCY REPORTED — never "no hate crime happened
 * here". Thousands of agencies submit zero reports annually; some large jurisdictions have
 * never participated. Every consumer of these counts MUST read them beside
 * `reportingAgencyCount` (county level) and `ucrStateParticipation` (state level), and any
 * surface that renders them must say so. This is the same rule the density layer follows in
 * refusing a false-absence tier: silence in this dataset is a fact about REPORTING, not
 * about safety.
 *
 * Public-numeric-policy: these are published government statistics (permitted category 3) —
 * counts carry the provenance quartet + artifact checksum. Do NOT derive per-capita rates or
 * any ranking numeric into a public payload from them; counts and explicit coverage only.
 *
 * Geographic attribution honesty: an agency's county comes from FBI's own `counties` field
 * where it resolves to exactly one county, else from point-in-county on the agency's
 * published coordinates (`fipsBasis` records which, per doc). Agencies spanning multiple
 * counties (NYPD, Columbus PD, Portland PD) have ALL their incidents attributed to the
 * agency's primary/HQ county — `approximatedAgencyIncidents` counts how many of a
 * county-year's incidents arrived that way, so the approximation is never invisible.
 */
import { z } from 'zod';
import { datasetArtifactProvenanceFields } from '../firestore/statistic-provenance.js';

/** How an agency's county assignment was determined — recorded per agency, never inferred. */
export const UCR_FIPS_BASES = [
  /** FBI `counties` field resolved to exactly one county AND the agency point agrees. */
  'name_match_confirmed_by_point',
  /** FBI `counties` field resolved to one county; no usable coordinates to confirm. */
  'name_match_only',
  /** FBI `counties` disagreed with the agency point; the FBI name assignment is kept. */
  'name_match_point_disagrees',
  /** Multi-county or unspecified `counties`; resolved by point-in-county on agency coords. */
  'agency_point_in_county',
] as const;

export const ucrFipsBasisSchema = z.enum(UCR_FIPS_BASES);

export const ucrAgencySchema = z.object({
  /** Doc id = the ORI (Originating Agency Identifier), e.g. `NY0303000`. */
  id: z.string().min(1),
  ori: z.string().min(1),
  agencyName: z.string().min(1),
  agencyType: z.string().optional(),
  stateAbbr: z.string().length(2),
  /** 5-digit county GEOID — the join key to every county-keyed collection. Absent for
   * federal/tribal/special agencies with no resolvable county (~1.4% of agencies). */
  fips5: z.string().regex(/^\d{5}$/).optional(),
  countyName: z.string().optional(),
  /** FBI's raw `counties` string, verbatim — may name several counties. */
  countyNameRaw: z.string().optional(),
  fipsBasis: ucrFipsBasisSchema.optional(),
  /** County resolved from the agency's own coordinates, kept even when it disagrees with
   * the name match so the disagreement stays inspectable rather than silently dropped. */
  fips5FromPoint: z.string().regex(/^\d{5}$/).optional(),
  /** True when FBI lists more than one county for this agency — incident attribution to a
   * single county is an approximation for these. */
  multiCounty: z.boolean(),
  isNibrs: z.boolean(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  ...datasetArtifactProvenanceFields,
});

export type UcrAgencyDoc = z.infer<typeof ucrAgencySchema>;

/** Bias-motivation / offense / location tallies: label → incident count, as published. */
const labelCounts = z.record(z.string(), z.number().int().nonnegative());

export const hateCrimeCountyYearSchema = z.object({
  /** Doc id `{fips5}_{year}`, e.g. `36061_2020`. */
  id: z.string().regex(/^\d{5}_\d{4}$/),
  fips5: z.string().regex(/^\d{5}$/),
  stateFips: z.string().regex(/^\d{2}$/),
  year: z.string().regex(/^\d{4}$/),
  /** Incidents attributed to this county-year. */
  incidents: z.number().int().nonnegative(),
  /** Incidents whose bias motivation includes Anti-Black or African American. */
  antiBlackIncidents: z.number().int().nonnegative(),
  /** Sum of published victim counts across those incidents. */
  victimCount: z.number().int().nonnegative(),
  /** Distinct agencies that reported ANY incident here this year. Read every count beside
   * this: a low or absent value means thin reporting, not a safe county (see module doc). */
  reportingAgencyCount: z.number().int().nonnegative(),
  /** How many of `incidents` came from an agency whose county is an approximation
   * (multi-county or point-resolved). */
  approximatedAgencyIncidents: z.number().int().nonnegative(),
  biasCounts: labelCounts,
  offenseCounts: labelCounts,
  locationCounts: labelCounts,
  ...datasetArtifactProvenanceFields,
});

export type HateCrimeCountyYearDoc = z.infer<typeof hateCrimeCountyYearSchema>;

export const ucrStateParticipationSchema = z.object({
  /** Doc id `{stateAbbrOrName}_{year}`. */
  id: z.string().min(1),
  stateName: z.string().min(1),
  year: z.string().regex(/^\d{4}$/),
  totalAgencies: z.number().int().nonnegative().optional(),
  participatingAgencies: z.number().int().nonnegative().optional(),
  /** Published participation percentage — a coverage denominator, never a quality score. */
  participatingAgenciesPct: z.number().optional(),
  coveredAgencies: z.number().int().nonnegative().optional(),
  coveredPct: z.number().optional(),
  totalPopulation: z.number().int().nonnegative().optional(),
  ...datasetArtifactProvenanceFields,
});

export type UcrStateParticipationDoc = z.infer<typeof ucrStateParticipationSchema>;

export function hateCrimeCountyYearId(fips5: string, year: string): string {
  return `${fips5}_${year}`;
}
