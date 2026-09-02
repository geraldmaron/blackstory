/**
 * Public "go visit this place" contact contract (repo-el9p / WS3).
 *
 * A reader who wants to physically go somewhere needs a structured address (at the precision
 * the location-precision standard allows), phone, website, hours, and a visitability signal.
 * This module is the single pure gate that decides which of those a public projection may
 * actually carry, given the record's location precision tier, entity kind, and living status.
 *
 * `locationPrecision` here is consumed as an opaque string tier. The location-precision
 * standard (docs/security/location-precision-standard.md) is being implemented in parallel by
 * another workstream in packages/security and packages/domain-core/geography/precision.ts; this
 * module does not import or duplicate that work. It treats `'site'` and `'address'` as the two
 * fine-grained tiers at which a street-level address may be shown — anything coarser (locality,
 * county, state, campus/institution/city/etc.) never gets a street or composed address line.
 *
 * Redaction policy (packages/security/src/redaction.ts) remains the sole authority for what a
 * stored EntityLocation may resolve to publicly; this function is a second, independent gate
 * applied to visit contact fields specifically; it never widens what redaction already narrowed.
 */

export type PublicVisitAddress = {
  readonly street?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  /** Pre-composed single-line address, when the source material only offers one string. */
  readonly line?: string;
};

export type PublicVisitPhone = {
  readonly e164: string;
  readonly display: string;
};

export const PUBLIC_VISITABILITY_VALUES = [
  'open_to_public',
  'exterior_only',
  'private',
  'demolished',
  'unknown',
] as const;

export type PublicVisitability = (typeof PUBLIC_VISITABILITY_VALUES)[number];

export function isPublicVisitability(value: string): value is PublicVisitability {
  return (PUBLIC_VISITABILITY_VALUES as readonly string[]).includes(value);
}

export type PublicVisit = {
  readonly address?: PublicVisitAddress;
  readonly phone?: PublicVisitPhone;
  readonly website?: string;
  readonly hours?: string;
  readonly visitability?: PublicVisitability;
  /** Claim ids or evidence ids the visit fields rest on. */
  readonly sources?: readonly string[];
};

/** Location precision tiers fine enough to publish a street address or composed line. */
const STREET_LEVEL_TIERS = new Set(['site', 'address']);

/** Entity kinds a visitor phone/website may ever attach to. Never a person. */
const CONTACT_ELIGIBLE_KINDS = new Set(['place', 'institution', 'school', 'organization']);

/** Visitability values that justify surfacing a public phone/website. */
const CONTACT_ELIGIBLE_VISITABILITY = new Set<PublicVisitability>([
  'open_to_public',
  'exterior_only',
]);

function filterAddress(
  address: PublicVisitAddress | undefined,
  streetLevelAllowed: boolean,
): PublicVisitAddress | undefined {
  if (!address) return undefined;
  const { street, line, city, state, postalCode } = address;
  const filtered: PublicVisitAddress = {
    ...(city !== undefined ? { city } : {}),
    ...(state !== undefined ? { state } : {}),
    ...(postalCode !== undefined ? { postalCode } : {}),
    ...(streetLevelAllowed && street !== undefined ? { street } : {}),
    ...(streetLevelAllowed && line !== undefined ? { line } : {}),
  };
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Reduce a raw visit record to what the public projection may actually carry, given the
 * record's location precision tier, entity kind, and living status.
 *
 * - `street`/`line` are emitted only when `locationPrecision` is `'site'` or `'address'`.
 * - `phone`/`website` are emitted only when `kind` is one of place/institution/school/
 *   organization, `visitability` is `'open_to_public'` or `'exterior_only'`, and
 *   `livingStatus` is not `'living'`.
 * - `city`/`state`/`postalCode`/`hours`/`visitability`/`sources` are not tier- or kind-gated by
 *   this function; they carry through when present (jurisdiction-level geography is already
 *   public elsewhere on the projection).
 *
 * Returns `undefined` when there is nothing left to publish.
 */
export function publicVisitForTier(
  visit: PublicVisit | undefined,
  locationPrecision: string,
  kind: string,
  livingStatus?: string,
): PublicVisit | undefined {
  if (!visit) return undefined;

  const streetLevelAllowed = STREET_LEVEL_TIERS.has(locationPrecision);
  const address = filterAddress(visit.address, streetLevelAllowed);

  const contactEligible =
    CONTACT_ELIGIBLE_KINDS.has(kind) &&
    visit.visitability !== undefined &&
    CONTACT_ELIGIBLE_VISITABILITY.has(visit.visitability) &&
    livingStatus !== 'living';

  const phone = contactEligible ? visit.phone : undefined;
  const website = contactEligible ? visit.website : undefined;

  const sources = visit.sources && visit.sources.length > 0 ? visit.sources : undefined;

  const result: PublicVisit = {
    ...(address !== undefined ? { address } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(website !== undefined ? { website } : {}),
    ...(visit.hours !== undefined ? { hours: visit.hours } : {}),
    ...(visit.visitability !== undefined ? { visitability: visit.visitability } : {}),
    ...(sources !== undefined ? { sources } : {}),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}
