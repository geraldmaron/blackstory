/**
 * Public visit contact: institution-only phone, website, and hours from sourced claims.
 * Never publishes residential street contact or living-person addresses.
 */
import type { PublicClaimView } from '../../data/public-seed';

export type PublicVisitContactField = {
  readonly value: string;
  readonly claimId: string;
  readonly citationLabel: string;
  readonly citationHref?: string;
};

export type PublicVisitContact = {
  readonly website?: PublicVisitContactField;
  readonly phone?: PublicVisitContactField;
  readonly hours?: PublicVisitContactField;
};

export type PublicVisitContactInput = {
  readonly kind: string;
  readonly locationPrecision: string;
  readonly livingStatus?: string;
  readonly sensitivityClass?: string;
  readonly claims: readonly Pick<
    PublicClaimView,
    'id' | 'predicate' | 'object' | 'citationLabel' | 'citationHref'
  >[];
};

const ELIGIBLE_KINDS = new Set(['place', 'school', 'institution', 'organization']);

const ELIGIBLE_PRECISION = new Set(['campus', 'institution']);

const VISIT_CONTACT_PREDICATES: Readonly<Record<keyof PublicVisitContact, readonly string[]>> = {
  website: ['official_website', 'officialWebsite', 'visitor_website'],
  phone: ['visitor_phone', 'visitorPhone', 'public_phone'],
  hours: ['public_hours', 'publicHours', 'visitor_hours', 'hours_note'],
};

const ALL_VISIT_CONTACT_PREDICATES = new Set(
  Object.values(VISIT_CONTACT_PREDICATES)
    .flat()
    .map((predicate) => predicate.toLowerCase()),
);

/**
 * Claims that may feed visit contact on compact map surfaces. Keeps the explore payload lean
 * (website / phone / hours only) instead of shipping every accepted claim per pin.
 */
export function visitContactClaimsForMap(
  claims: PublicVisitContactInput['claims'],
): PublicVisitContactInput['claims'] {
  return claims.filter((claim) =>
    ALL_VISIT_CONTACT_PREDICATES.has(normalizePredicate(claim.predicate).toLowerCase()),
  );
}

function normalizePredicate(predicate: string): string {
  return predicate.trim();
}

function claimFieldFor(
  claims: PublicVisitContactInput['claims'],
  predicates: readonly string[],
): PublicVisitContactField | undefined {
  const wanted = new Set(predicates.map((entry) => entry.toLowerCase()));
  for (const claim of claims) {
    if (!wanted.has(normalizePredicate(claim.predicate).toLowerCase())) {
      continue;
    }
    const value = claim.object.trim();
    if (value.length === 0) {
      continue;
    }
    return {
      value,
      claimId: claim.id,
      citationLabel: claim.citationLabel,
      ...(claim.citationHref !== undefined ? { citationHref: claim.citationHref } : {}),
    };
  }
  return undefined;
}

/** True when public visit contact may render for this record. */
export function canPublishPublicVisitContact(input: PublicVisitContactInput): boolean {
  if (!ELIGIBLE_KINDS.has(input.kind)) {
    return false;
  }
  if (!ELIGIBLE_PRECISION.has(input.locationPrecision)) {
    return false;
  }
  if (input.livingStatus === 'living') {
    return false;
  }
  return true;
}

/** Resolve institution visit contact from claim predicates; omitted when policy blocks or empty. */
export function resolvePublicVisitContact(
  input: PublicVisitContactInput,
): PublicVisitContact | undefined {
  if (!canPublishPublicVisitContact(input)) {
    return undefined;
  }

  const website = claimFieldFor(input.claims, VISIT_CONTACT_PREDICATES.website);
  const phone = claimFieldFor(input.claims, VISIT_CONTACT_PREDICATES.phone);
  const hours = claimFieldFor(input.claims, VISIT_CONTACT_PREDICATES.hours);

  if (website === undefined && phone === undefined && hours === undefined) {
    return undefined;
  }

  return {
    ...(website !== undefined ? { website } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(hours !== undefined ? { hours } : {}),
  };
}

export function hasPublicVisitContact(contact: PublicVisitContact | undefined): boolean {
  if (!contact) {
    return false;
  }
  return (
    contact.website !== undefined || contact.phone !== undefined || contact.hours !== undefined
  );
}
