/**
 * Visit block helpers: whether a record gets a visit block at all.
 */
import type { PlaceAdvisoryRecord } from '@repo/domain/advisory';
import type { PublicClaimView, PublicEntityView, PublicVisitView } from '../../data/public-seed';
import { recordMarkFor } from '../map-experience/geo-precision';

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
   * Release-shipped visit contract, already gated by `publicVisitForTier` at
   * publish time. When present, address/phone/website/hours/visitability derive from this
   * instead of claim-mining and label composition below.
   */
  readonly visit?: PublicVisitView;
};

/*
 * Kinds that are not a site a reader can stand at. An invention or another work is made
 * somewhere, but the record documents the work, not a building that still stands: the Striking
 * Clock page once offered Directions to a destroyed 1750s clock.
 */
const NON_VISIT_KINDS = new Set([
  'person',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'invention',
  'event',
]);

/**
 * True only when the record's own data carries a visitable site: a site kind, a stored point at
 * site precision (the same test that draws a solid dot on the map), and no release visit block
 * saying the site is private or gone. A city-precision record never gets directions, because a
 * route to the middle of a city is a place the archive never claimed (P-03).
 */
export function shouldShowVisitBlock(input: VisitHandoffInput): boolean {
  if (NON_VISIT_KINDS.has(input.kind)) return false;
  if (recordMarkFor(input.locationPrecision) !== 'dot') return false;
  if (
    input.lat === undefined ||
    input.lng === undefined ||
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng)
  ) {
    return false;
  }
  const visitability = input.visit?.visitability;
  return visitability !== 'private' && visitability !== 'demolished';
}
