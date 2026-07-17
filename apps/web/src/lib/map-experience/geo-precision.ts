/**
 * Bridges the public-precision vocabulary (`PublicEntityView.locationPrecision`, defined by
 * `@black-book/security`'s redaction policy) to the `GeoPrecisionTier` display-radius
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
  US_STATES,
  type GeoPrecisionTier,
  type JurisdictionBBox,
} from '@black-book/domain';

/** Finest-known public precision -> the GeoPrecisionTier its radius circle should render at.  */
const PUBLIC_PRECISION_TO_GEO_TIER: Readonly<Record<string, GeoPrecisionTier>> = {
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
 * publish-time redaction decision itself is `@black-book/security`'s, untouched here. */
export function geoPrecisionTierForPublicPrecision(publicPrecision: string): GeoPrecisionTier {
  return PUBLIC_PRECISION_TO_GEO_TIER[publicPrecision] ?? 'locality';
}

/**
 * District of Columbia has no separate city/locality boundary layer in this repo's reference data
 * (`@black-book/domain`'s `US_STATES` bbox IS the city extent for D.C. it is a consolidated
 * city-state, the one case where "state bbox" and "locality bbox" are the same real boundary).
 * This is the ONLY locality bbox this module resolves without a real jurisdiction polygon;
 * every other state/locality combination fails closed (see `resolveDisplayRadiusMeters` below)
 * rather than guessing, matching fail-closed radius policy (`precision.ts` module doc).
 */
const DC_BBOX: JurisdictionBBox | undefined = US_STATES.find((state) => state.postalCode === 'DC')?.bbox;

export type RadiusResolution =
  | { readonly ok: true; readonly radiusMeters: number }
  | { readonly ok: false; readonly reason: 'jurisdiction_bbox_unresolved' | 'state_bbox_unresolved' };

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
