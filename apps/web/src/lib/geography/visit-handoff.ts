/**
 * Visit block helpers: public address, maps search/directions URLs, and visit standing copy.
 */
import type { PlaceAdvisoryRecord } from '@repo/domain/advisory';
import { humanizeToken } from '../../components/entity/format';
import type { PublicClaimView, PublicEntityView } from '../../data/public-seed';
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
};

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

function mapsInput(input: VisitHandoffInput): ExternalMapsSearchInput {
  const query = resolvePublicAddressLine(input);
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
  const addressLine = resolvePublicAddressLine(input);
  const handoff = mapsInput(input);
  const mapsSearchHref = buildExternalMapsSearchUrl(handoff);
  const mapsDirectionsHref = buildExternalMapsDirectionsUrl(handoff);
  const appleMapsSearchHref = buildAppleMapsSearchUrl(handoff);
  const appleMapsDirectionsHref = buildAppleMapsDirectionsUrl(handoff);
  const standing = resolveVisitStandingCopy({
    kind: input.kind,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.placeAdvisories !== undefined ? { advisories: input.placeAdvisories } : {}),
    ...(input.claims !== undefined ? { claims: input.claims } : {}),
  });
  const contactInput = visitContactInput(input);
  const contact = contactInput !== undefined ? resolvePublicVisitContact(contactInput) : undefined;
  return {
    addressLine,
    precisionLabel: `${input.locationPrecision.replace(/[_-]+/g, ' ')} precision`,
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
  return resolvePublicAddressLine(input) !== 'Place withheld';
}
