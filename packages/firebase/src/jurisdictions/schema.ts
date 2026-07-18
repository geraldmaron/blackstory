
/**
 * Firestore document schema for the `jurisdictions` collection.
 *
 * Instantiates the existing `Jurisdiction` domain type
 * (packages/domain/src/geography/location.ts `id`, `kind`, `name`, `parentId`, `validFrom`,
 * `validTo`) as real storage, extended with the fields the collection actually needs to be
 * useful (FIPS code, bbox, centroid, source dataset provenance). This mirrors the existing
 * convention in packages/firebase/src/firestore/types.ts of a Firestore doc schema that
 * "aligns with @blap/domain" without being a 1:1 re-export of the domain type (see e.g.
 * `entityKindSchema` there, a local zod enum mirroring domain's `EntityKind`).
 *
 * `jurisdictionKindSchema` mirrors `packages/domain/src/geography/location.ts`'s
 * `JurisdictionKind` values. Kept in sync by hand because importing from the domain barrel
 * would also pull GeoGeometry-adjacent types across the package boundary. If a future pass
 * adds `city`-kind values here (on-demand place docs, see the ADR), update this enum and the
 * domain enum together.
 *
 * This module lives in its own `jurisdictions/` directory rather than being folded into
 * `firestore/types.ts` / `firestore/converters.ts` / `firestore/index.ts`, so the schema,
 * converter, loader, and resolver for this collection stay self-contained. Barrel exports
 * can be wired from those files when ready.
 */
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
 * precise cartographic-boundary-derived box. See docs/adr/ADR-016 "County bbox precision."
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
  fipsCode: z.string().regex(/^\d{2}(\d{3})?$/).optional(),
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


/**
 * Minimal Firestore data-converter shape, duplicated locally (not imported from
 * `firestore/converters.ts`'s private `createConverter` helper, which is not exported and
 * whose file this does not own) so this module has no dependency on files outside its
 * own directory.
 */
export type MinimalFirestoreConverter<T> = {
  toFirestore(modelObject: T): Record<string, unknown>;
  fromFirestore(snapshot: { data(): unknown }): T;
};

export const jurisdictionConverter: MinimalFirestoreConverter<JurisdictionDoc> = {
  toFirestore(modelObject: JurisdictionDoc) {
    return jurisdictionSchema.parse(modelObject) as Record<string, unknown>;
  },
  fromFirestore(snapshot: { data(): unknown }): JurisdictionDoc {
    return jurisdictionSchema.parse(snapshot.data());
  },
};

export function parseJurisdictionDoc(data: unknown): JurisdictionDoc {
  return jurisdictionSchema.parse(data);
}
