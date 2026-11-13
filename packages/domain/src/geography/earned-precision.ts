/**
 * Publish-time check that a point's stored precision is earned by evidence
 * (apps/web/PRODUCT.md: points render no sharper than stored precision, and the stored precision
 * must be earned). Pure; the release builder decides whether a failure blocks or only warns.
 */

/** Kinds that are not places: a point on one of these is only honest when a claim names a place. */
export const NON_PLACE_KINDS = ['law', 'case', 'publication', 'movement', 'invention'] as const;

/** Point precisions that need a place-bearing claim on a non-place kind. */
const POINT_PRECISIONS = new Set([
  'address',
  'site',
  'institution',
  'campus',
  'neighborhood',
  'city',
]);

/** Precisions that draw as an exact site and so need site-level provenance. */
const SITE_PRECISIONS = new Set(['address', 'site', 'institution']);

/**
 * A "place claim" has no field of its own in the data model; it is a claim whose predicate says
 * where the subject was, stood, or was issued from (`documented_site`, `commemorated_at`,
 * `published_from`, ...). Bare `held` or `founded` do not count: a court holds and an
 * organization is founded without either naming a location.
 */
const PLACE_CLAIM_PREDICATE =
  /\b(located (at|in)|documented site|commemorated at|published (from|in)|headquartered (at|in)|occurred (at|in)|site of|held at|venue)\b/;

export function isPlaceClaimPredicate(predicate: string): boolean {
  return PLACE_CLAIM_PREDICATE.test(predicate.toLowerCase().replaceAll('_', ' '));
}

export type EarnedPrecisionInput = {
  readonly kind: string;
  readonly precision: string;
  /** `manual_research` | `geocode_census` | `geocode_other` (GeographicMatchMethod). */
  readonly matchMethod: string;
  readonly claims: readonly { readonly predicate: string }[];
};

export type EarnedPrecisionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly rule: 'place_claim' | 'site_provenance';
      readonly message: string;
    };

export function evaluateEarnedPrecision(input: EarnedPrecisionInput): EarnedPrecisionResult {
  const precision = input.precision.trim().toLowerCase();

  if (
    (NON_PLACE_KINDS as readonly string[]).includes(input.kind) &&
    POINT_PRECISIONS.has(precision) &&
    !input.claims.some((claim) => isPlaceClaimPredicate(claim.predicate))
  ) {
    return {
      ok: false,
      rule: 'place_claim',
      message: `A ${input.kind} is pinned at "${precision}" precision but no claim names a place; store a coarser precision or add a sourced place claim.`,
    };
  }

  // `geocode_other` is the geocoder fallback; Census matches a street address and
  // `manual_research` is a person's sourced placement, so both are site-level provenance.
  if (SITE_PRECISIONS.has(precision) && input.matchMethod === 'geocode_other') {
    return {
      ok: false,
      rule: 'site_provenance',
      message: `"${precision}" precision rests on a fallback geocode (geocode_other), not a site-level source.`,
    };
  }
  return { ok: true };
}
