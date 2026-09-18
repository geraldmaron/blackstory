/** Jurisdiction records with bounded geometry and source provenance. */
import { z } from 'zod';

/** Mirrors domain `JurisdictionKind`. This loader only ever writes `country|state|county`. */
export const jurisdictionKindSchema = z.enum([
  'country',
  'state',
  'county',
  'city',
  'district',
  'school_district',
  'other',
]);

export type JurisdictionKindDoc = z.infer<typeof jurisdictionKindSchema>;

/** [west, south, east, north] in decimal degrees same shape used throughout this repo. */
export const jurisdictionBBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export type JurisdictionBBoxDoc = z.infer<typeof jurisdictionBBoxSchema>;

export const jurisdictionCentroidSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type JurisdictionCentroidDoc = z.infer<typeof jurisdictionCentroidSchema>;

/**
 * Where the bbox came from, so a coarse Gazetteer-only approximation is never confused with a
 * precise cartographic-boundary-derived box. See `docs/decisions-carryover.md`,
 * "Jurisdiction reference data".
 */
export const JURISDICTION_BBOX_SOURCES = [
  'us-geography-module',
  'census-gazetteer-area-approximated',
  'census-cartographic-boundary',
  'manual',
] as const;

export const jurisdictionBBoxSourceSchema = z.enum(JURISDICTION_BBOX_SOURCES);

export type JurisdictionBBoxSourceDoc = z.infer<typeof jurisdictionBBoxSourceSchema>;

export const jurisdictionSchema = z.object({
  /** Deterministic id: `us`, `us-{stateFips}`, or `us-{stateFips}-{countyFips3}`. */
  id: z.string().min(1),
  kind: jurisdictionKindSchema,
  name: z.string().min(1),
  /** Parent jurisdiction id (state's parent is `us`; county's parent is its state's id). */
  parentId: z.string().min(1).optional(),
  /** 2-digit state or 5-digit county FIPS/GEOID (Census); absent for the country row. */
  fipsCode: z
    .string()
    .regex(/^\d{2}(\d{3})?$/)
    .optional(),
  /** 2-letter USPS postal code; states only. */
  postalCode: z.string().length(2).optional(),
  /** Parent state's 2-digit FIPS; counties only, a denormalized convenience for querying. */
  stateFips: z.string().length(2).optional(),
  bbox: jurisdictionBBoxSchema.optional(),
  bboxSource: jurisdictionBBoxSourceSchema.optional(),
  centroid: jurisdictionCentroidSchema.optional(),
  /** Inclusive start of historical validity (ISO date or year); on-demand, not backfilled here. */
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  /** e.g. `us-geography-module`, `census-gazetteer-2020`. Provenance of this doc's fields. */
  sourceDataset: z.string().min(1),
  sourceVersion: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type JurisdictionDoc = z.infer<typeof jurisdictionSchema>;

/** Deterministic id for the single country-level row. */
export function countryJurisdictionId(): string {
  return 'us';
}

/** Deterministic id for a state row: `us-{2-digit FIPS}`. */
export function stateJurisdictionId(stateFips: string): string {
  return `us-${stateFips}`;
}

/** Deterministic id for a county row: `us-{2-digit state FIPS}-{3-digit county FIPS}`. */
export function countyJurisdictionId(stateFips: string, countyFips3: string): string {
  return `us-${stateFips}-${countyFips3}`;
}

export function parseJurisdictionDoc(data: unknown): JurisdictionDoc {
  return jurisdictionSchema.parse(data);
}
