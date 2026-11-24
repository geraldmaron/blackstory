/**
 * Bridges the public-precision vocabulary (`PublicEntityView.locationPrecision`, defined by
 * `@repo/security`'s redaction policy) to the `GeoPrecisionTier` display-radius
 * scale, and resolves the radius-affordance circle for a rendered map point.
 *
 * These are deliberately different vocabularies (see
 * `packages/domain/src/geography/precision.ts`'s module doc): the public-precision scale governs
 * what may be PUBLISHED; `GeoPrecisionTier` governs the map's display-radius circle. This module
 * is the one place that translates between them — no other map-experience file should invent a
 * second mapping.
 */
import {
  displayRadiusMeters,
  FIXED_TIER_RADIUS_METERS,
  type GeoPrecisionTier,
  type JurisdictionBBox,
} from '@repo/domain/geography/display-radius';
import { US_STATES, findUsStateFromJurisdictionLabel } from '@repo/domain/map/geography';
import {
  CLASSIFIED_PRECISIONS,
  precisionBandFor,
  type PrecisionBand,
} from '@repo/domain/map/place-groups';

/** Finest-known public precision -> the GeoPrecisionTier its radius circle should render at.  */
const PUBLIC_PRECISION_TO_GEO_TIER: Readonly<Record<string, GeoPrecisionTier>> = {
  address: 'exact-site',
  site: 'exact-site',
  institution: 'exact-site',
  campus: 'block',
  neighborhood: 'locality',
  city: 'locality',
  county: 'county',
  state: 'state',
  country: 'state',
};

/** Falls back to `locality` (a mid-scale radius, never a sharpened point) for any public
 * precision this table has not classified fail-soft on the RENDER-RADIUS side only; the
 * publish-time redaction decision itself is `@repo/security`'s, untouched here. */
export function geoPrecisionTierForPublicPrecision(publicPrecision: string): GeoPrecisionTier {
  return PUBLIC_PRECISION_TO_GEO_TIER[publicPrecision] ?? 'locality';
}

export type LocationPrecision =
  'state' | 'county' | 'city' | 'neighborhood' | 'campus' | 'institution' | 'site' | 'address';

/**
 * How a record is drawn on any map, decided by its stored public precision and nothing else.
 *
 * `dot` is a solid point (the archive holds the site), `ring` a hollow ring (it holds the
 * neighborhood or city, never a street corner), and `none` draws no point at all (county or state
 * precision: the record is counted in its jurisdiction tag instead). Kind never changes the mark.
 * An unclassified precision fails soft to `ring`, the same posture as the radius tier above.
 */
export type RecordMark = 'dot' | 'ring' | 'none';

const MARK_BY_BAND: Readonly<Record<PrecisionBand, RecordMark>> = {
  site: 'dot',
  // A campus is block precision (the tier table above): an area, never one site.
  area: 'ring',
  county: 'none',
  state: 'none',
};

/** The precisions the shared band table classifies, each with its mark. */
const PRECISION_MARKS: Readonly<Record<string, RecordMark>> = Object.fromEntries(
  CLASSIFIED_PRECISIONS.map((precision) => [precision, MARK_BY_BAND[precisionBandFor(precision)]]),
);

export function recordMarkFor(precision: string): RecordMark {
  return MARK_BY_BAND[precisionBandFor(precision)];
}

/** The precisions that draw each mark, for MapLibre `match` expressions built from this table. */
export function precisionsWithMark(mark: RecordMark): string[] {
  return Object.entries(PRECISION_MARKS)
    .filter(([, value]) => value === mark)
    .map(([precision]) => precision);
}

/**
 * The precision as a reader reads it: where the archive can place this record. The one wording
 * set every surface prints (record pages, the inspector, RecordMap).
 */
export function precisionInWords(precision: string): string {
  const mark = recordMarkFor(precision);
  if (mark === 'dot') return 'Exact site';
  if (precision === 'campus') return 'Campus-level location, not an exact address';
  if (precision === 'neighborhood') return 'Neighborhood-level location';
  if (precision === 'county') return 'County-level location';
  if (precision === 'state' || precision === 'country') return 'State-level location';
  return 'City-level location';
}

/**
 * Camera zoom matched to a record's public precision: the zoom `frameRecord` lands on and the
 * zoom every embedded RecordMap opens at. Exact 14 (the map's ceiling), campus 13, neighborhood 12,
 * city 10, county 8, state 6. A county-precision record framed at z13 would show a street corner the
 * archive never claimed.
 */
export function zoomForLocationPrecision(precision: string): number {
  const mark = recordMarkFor(precision);
  if (mark === 'dot') return 14;
  if (precision === 'campus') return 13;
  if (precision === 'neighborhood') return 12;
  if (precision === 'county') return 8;
  if (precision === 'state' || precision === 'country') return 6;
  return 10;
}

/**
 * District of Columbia has no separate city/locality boundary layer in this repo's reference data
 * (`@repo/domain`'s `US_STATES` bbox IS the city extent for D.C. it is a consolidated
 * city-state, the one case where "state bbox" and "locality bbox" are the same real boundary).
 * This is the ONLY locality bbox this module resolves without a real jurisdiction polygon;
 * every other state/locality combination fails closed (see `resolveDisplayRadiusMeters` below)
 * rather than guessing, matching fail-closed radius policy (`precision.ts` module doc).
 */
const DC_BBOX: JurisdictionBBox | undefined = US_STATES.find(
  (state) => state.postalCode === 'DC',
)?.bbox;

export type RadiusResolution =
  | { readonly ok: true; readonly radiusMeters: number }
  | {
      readonly ok: false;
      readonly reason: 'jurisdiction_bbox_unresolved' | 'state_bbox_unresolved';
    };

/**
 * Resolves the display-radius affordance for a rendered point. Never guesses: a
 * locality/county/state-tier point outside the one documented D.C. exception, without a
 * resolvable jurisdiction bbox, reports `ok: false` rather than fabricating a radius callers
 * must render that point with no radius affordance (a plain pin) in that case, the same
 * fail-closed posture as `displayRadiusMeters` itself.
 */
export function resolveDisplayRadiusMeters(
  tier: GeoPrecisionTier,
  options: { readonly statePostalCode?: string } = {},
): RadiusResolution {
  if (tier === 'exact-site' || tier === 'block') {
    return { ok: true, radiusMeters: FIXED_TIER_RADIUS_METERS[tier] };
  }
  if (tier === 'locality' && options.statePostalCode === 'DC' && DC_BBOX) {
    return { ok: true, radiusMeters: displayRadiusMeters({ tier, jurisdictionBBox: DC_BBOX }) };
  }
  if (tier === 'state') {
    const state = US_STATES.find((candidate) => candidate.postalCode === options.statePostalCode);
    if (!state) {
      return { ok: false, reason: 'state_bbox_unresolved' };
    }
    return { ok: true, radiusMeters: displayRadiusMeters({ tier, jurisdictionBBox: state.bbox }) };
  }
  return { ok: false, reason: 'jurisdiction_bbox_unresolved' };
}

/**
 * The precision the record's map is drawn at. A law has a jurisdiction, not a site: the catalog
 * stores the building it was passed or signed in, and drawing that as an exact site says the law
 * happened at one address. The record page and the Archive map both draw through this. A state's law is drawn as its state; any other law (federal ones sit
 * in Washington) is drawn no sharper than its city. Every other record keeps its stored
 * precision. This only ever coarsens (P-03).
 */
export function mapPrecisionFor<P extends string>(entity: {
  readonly kind: string;
  readonly locationPrecision: P;
  readonly jurisdictionLabel: string;
}): P | 'state' | 'city' {
  if (String(entity.kind) !== 'law') return entity.locationPrecision;
  const state = findUsStateFromJurisdictionLabel(entity.jurisdictionLabel)?.postalCode;
  if (state && state !== 'DC') return 'state';
  return recordMarkFor(entity.locationPrecision) === 'dot' ? 'city' : entity.locationPrecision;
}
