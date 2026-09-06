/**
 * Visit block helpers: public address, maps search/directions URLs, and visit standing copy.
 */
import type { PlaceAdvisoryRecord } from '@repo/domain/advisory';
import { humanizeToken } from '../../components/entity/format';
import type { PublicClaimView, PublicEntityView, PublicVisitView } from '../../data/public-seed';
import {
  buildAppleMapsDirectionsUrl,
  buildAppleMapsSearchUrl,
  buildExternalMapsDirectionsUrl,
  buildExternalMapsSearchUrl,
  type ExternalMapsSearchInput,
} from './external-maps-url';
import { resolvePublicAddressLine } from './public-address';
import {
  resolvePublicVisitContact,
  type PublicVisitContact,
  type PublicVisitContactField,
  type PublicVisitContactInput,
} from './public-visit-contact';
import { resolveVisitStandingCopy } from './visit-advisory';

export type VisitHandoffInput = {
  readonly displayName: string;
  readonly locationLabel: string;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision: PublicEntityView['locationPrecision'];
  readonly kind: string;
  readonly status?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly livingStatus?: string;
  readonly sensitivityClass?: string;
  readonly claims?: readonly Pick<
    PublicClaimView,
    'id' | 'predicate' | 'object' | 'citationLabel' | 'citationHref'
  >[];
  readonly placeAdvisories?: readonly PlaceAdvisoryRecord[];
  /**
   * Release-shipped visit contract (repo-el9p WS3), already gated by `publicVisitForTier` at
   * publish time. When present, address/phone/website/hours/visitability derive from this
   * instead of claim-mining and label composition below.
   */
  readonly visit?: PublicVisitView;
};

/**
 * "county precision", "street address precision" — the archive's one phrasing for how finely a
 * location is known. Shared by the full record page and every compact card so the same fact never
 * reads as two different sentences depending on which surface drew the pin.
 */
export function precisionResolutionLabel(locationPrecision: string): string {
  return locationPrecision === 'address'
    ? 'street address precision'
    : `${locationPrecision.replace(/[_-]+/g, ' ')} precision`;
}

export type VisitHandoff = {
  readonly addressLine: string;
  /** Google Maps search and directions. */
  readonly mapsSearchHref?: string;
  readonly mapsDirectionsHref?: string;
  /** Apple Maps search and directions, same destination string. */
  readonly appleMapsSearchHref?: string;
  readonly appleMapsDirectionsHref?: string;
  readonly visitStanding?: string;
  readonly precisionLabel: string;
  readonly contact?: PublicVisitContact;
};

const NON_VISIT_KINDS = new Set(['person', 'law', 'case', 'publication', 'artifact', 'movement']);

/** Compose an address line from a release-shipped visit block; `undefined` when it has nothing. */
function addressLineFromVisit(visit: PublicVisitView | undefined): string | undefined {
  const address = visit?.address;
  if (!address) return undefined;
  if (address.line && address.line.trim().length > 0) return address.line.trim();
  const streetPart = address.street?.trim();
  if (!streetPart) return undefined;
  const cityState = [address.city, address.state].filter((part) => part && part.trim().length > 0);
  const tail = [cityState.join(', '), address.postalCode].filter(
    (part) => part && part.trim().length > 0,
  );
  return tail.length > 0 ? `${streetPart}, ${tail.join(' ')}` : streetPart;
}

/** Reader-facing copy for the release-shipped `visitability` enum. */
const VISITABILITY_COPY: Readonly<Record<NonNullable<PublicVisitView['visitability']>, string>> = {
  open_to_public: 'Open to the public',
  exterior_only: 'Exterior viewing only; interior is not open to visitors',
  private: 'Private property; not open to visitors',
  demolished: 'No longer standing',
  unknown: 'Visiting status unknown',
};

function visitabilityCopy(visit: PublicVisitView | undefined): string | undefined {
  return visit?.visitability ? VISITABILITY_COPY[visit.visitability] : undefined;
}

/** claimId/citationLabel are required on `PublicVisitContactField`; a release-shipped visit
 * block carries `sources` (evidence/claim ids) instead of a per-field citation, so synthesize
 * a stable field id and a generic-but-honest source label from it. */
function visitContactField(
  value: string,
  sources: readonly string[] | undefined,
): PublicVisitContactField {
  const firstSource = sources?.[0];
  const citationLabel = firstSource?.startsWith('wikidata:') ? 'Wikidata' : 'Verified record';
  return { value, claimId: firstSource ?? 'visit', citationLabel };
}

/** Contact block from a release-shipped visit contract, already gated at publish time. */
function contactFromVisit(visit: PublicVisitView | undefined): PublicVisitContact | undefined {
  if (!visit) return undefined;
  const website =
    visit.website !== undefined ? visitContactField(visit.website, visit.sources) : undefined;
  const phone =
    visit.phone !== undefined ? visitContactField(visit.phone.display, visit.sources) : undefined;
  const hours =
    visit.hours !== undefined ? visitContactField(visit.hours, visit.sources) : undefined;
  if (website === undefined && phone === undefined && hours === undefined) {
    return undefined;
  }
  return {
    ...(website !== undefined ? { website } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(hours !== undefined ? { hours } : {}),
  };
}

function mapsInput(input: VisitHandoffInput): ExternalMapsSearchInput {
  const query = addressLineFromVisit(input.visit) ?? resolvePublicAddressLine(input);
  return {
    ...(input.lat !== undefined && input.lng !== undefined
      ? { lat: input.lat, lng: input.lng }
      : {}),
    query,
  };
}

/** Visit standing for place-like records; omitted for people, laws, and pure events. */
export function visitStandingLabel(kind: string, status: string | undefined): string | undefined {
  if (NON_VISIT_KINDS.has(kind)) {
    return undefined;
  }
  if (kind === 'event') {
    return undefined;
  }
  const normalized = status?.trim();
  if (!normalized || normalized === 'unknown') {
    return undefined;
  }
  switch (normalized) {
    case 'active':
      return 'Still standing or operating today';
    case 'historic':
      return 'Historic site; verify what remains before you travel';
    case 'inactive':
      return 'No longer operating as documented';
    default:
      return humanizeToken(normalized);
  }
}

function visitContactInput(input: VisitHandoffInput): PublicVisitContactInput | undefined {
  if (!input.claims || input.claims.length === 0) {
    return undefined;
  }
  return {
    kind: input.kind,
    locationPrecision: input.locationPrecision,
    claims: input.claims,
    ...(input.livingStatus !== undefined ? { livingStatus: input.livingStatus } : {}),
    ...(input.sensitivityClass !== undefined ? { sensitivityClass: input.sensitivityClass } : {}),
  };
}

export function buildVisitHandoff(input: VisitHandoffInput): VisitHandoff {
  const addressLine = addressLineFromVisit(input.visit) ?? resolvePublicAddressLine(input);
  const handoff = mapsInput(input);
  const mapsSearchHref = buildExternalMapsSearchUrl(handoff);
  const mapsDirectionsHref = buildExternalMapsDirectionsUrl(handoff);
  const appleMapsSearchHref = buildAppleMapsSearchUrl(handoff);
  const appleMapsDirectionsHref = buildAppleMapsDirectionsUrl(handoff);
  const standing =
    visitabilityCopy(input.visit) ??
    resolveVisitStandingCopy({
      kind: input.kind,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.placeAdvisories !== undefined ? { advisories: input.placeAdvisories } : {}),
      ...(input.claims !== undefined ? { claims: input.claims } : {}),
    });
  const contact =
    contactFromVisit(input.visit) ??
    (() => {
      const contactInput = visitContactInput(input);
      return contactInput !== undefined ? resolvePublicVisitContact(contactInput) : undefined;
    })();
  return {
    addressLine,
    precisionLabel: precisionResolutionLabel(input.locationPrecision),
    ...(mapsSearchHref ? { mapsSearchHref } : {}),
    ...(mapsDirectionsHref ? { mapsDirectionsHref } : {}),
    ...(appleMapsSearchHref ? { appleMapsSearchHref } : {}),
    ...(appleMapsDirectionsHref ? { appleMapsDirectionsHref } : {}),
    ...(standing ? { visitStanding: standing } : {}),
    ...(contact !== undefined ? { contact } : {}),
  };
}

/** Build visit input from an explore map feature (address, standing, contact, maps). */
export function buildVisitHandoffFromMapFeature(input: {
  readonly displayName: string;
  readonly locationLabel?: string;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision: string;
  readonly kind: string;
  readonly status?: string;
  readonly lat: number;
  readonly lng: number;
  readonly livingStatus?: string;
  readonly sensitivityClass?: string;
  readonly claims?: VisitHandoffInput['claims'];
}): VisitHandoffInput {
  return {
    displayName: input.displayName,
    locationLabel: input.locationLabel?.trim() || input.displayName,
    locationPrecision: input.locationPrecision as PublicEntityView['locationPrecision'],
    kind: input.kind,
    lat: input.lat,
    lng: input.lng,
    ...(input.jurisdictionLabel !== undefined
      ? { jurisdictionLabel: input.jurisdictionLabel }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.livingStatus !== undefined ? { livingStatus: input.livingStatus } : {}),
    ...(input.sensitivityClass !== undefined ? { sensitivityClass: input.sensitivityClass } : {}),
    ...(input.claims !== undefined && input.claims.length > 0 ? { claims: input.claims } : {}),
  };
}

/** True when a record should render the visit block (geo or a resolvable address line). */
export function shouldShowVisitBlock(input: VisitHandoffInput): boolean {
  if (NON_VISIT_KINDS.has(input.kind)) {
    return false;
  }
  const hasCoords =
    input.lat !== undefined &&
    input.lng !== undefined &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  if (hasCoords) {
    return true;
  }
  if (addressLineFromVisit(input.visit) !== undefined) {
    return true;
  }
  return resolvePublicAddressLine(input) !== 'Place withheld';
}
