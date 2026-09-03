/**
 * Build record anatomy inputs from a public entity view. Pure helpers for server
 * components and unit tests — no React nodes; callers wire links in JSX.
 */
import type { RecordAnatomyPlace } from '../../../components/patterns/RecordAnatomyPanel';
import type { PublicEntityView } from '../../../data/public-seed';
import { highestConfidence } from '../../../lib/map-experience/build-explore-map-source';
import { entityEraFact } from '../../../lib/map-experience/entity-era-facts';
import { displayEncodingFor } from '../../../lib/map-experience/kind-encoding';
import {
  geoPrecisionTierForPublicPrecision,
  radiusAffordanceLabel,
} from '../../../lib/map-experience/geo-precision';
import { resolvePublicAddressLine } from '../../../lib/geography/public-address';
import type { ConfidenceTierKey } from '../../../lib/map-experience/confidence-icons';

const CONFIDENCE_GRADE: Record<ConfidenceTierKey, string> = {
  high: 'Grade A',
  medium: 'Grade B',
  low: 'Grade C',
  unrated: 'Unrated',
};

export type EntityAnatomyInputs = {
  readonly kind: string;
  readonly kindLabel: string;
  readonly mapTone?: string;
  readonly whereLabel: string;
  readonly eraLabel: string;
  readonly eraHref?: string;
  readonly evidenceLabel: string;
  readonly evidenceTier: ConfidenceTierKey;
  readonly confidenceTier: ConfidenceTierKey;
};

function whereLabelFor(entity: PublicEntityView): string {
  return resolvePublicAddressLine({
    displayName: entity.displayName,
    locationLabel: entity.locationLabel,
    jurisdictionLabel: entity.jurisdictionLabel,
    locationPrecision: entity.locationPrecision,
    kind: entity.kind,
  });
}

/**
 * The longest a Where value may be before a fact tile shows the jurisdiction instead.
 *
 * A tile is one of five in a row, so it gets about a fifth of the measure. A composed address
 * such as "Broward Health Medical Center (formerly Broward General Hospital), 1600 S Andrews
 * Ave, Fort Lauderdale, FL" does not wrap in that column, it stacks one word per line and drags
 * the whole row to several hundred pixels tall. The number is the point where that starts.
 */
const WHERE_TILE_MAX = 42;

/**
 * What the Where tile shows: the full address when it fits, the jurisdiction when it does not.
 *
 * Nothing is lost by the swap. The full line stays on the maps link's title, and a visitable
 * record prints it in full in the visit block further down the page. The tile's job is the
 * glance, and "Fort Lauderdale, FL" answers the glance better than a hospital's former name.
 */
export function whereTileLabel(entity: PublicEntityView, whereLabel: string): string {
  if (whereLabel.length <= WHERE_TILE_MAX) return whereLabel;
  const jurisdiction = entity.jurisdictionLabel?.trim();
  if (jurisdiction && jurisdiction.length > 0 && jurisdiction.length < whereLabel.length) {
    return jurisdiction;
  }
  return whereLabel;
}

export function buildEntityAnatomyInputs(
  entity: PublicEntityView,
  mapTone: string | undefined,
): EntityAnatomyInputs {
  const kindLabel = displayEncodingFor(entity.kind, mapTone).label;
  const era = entityEraFact({
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
    ...(entity.era !== undefined ? { era: entity.era } : {}),
    ...(entity.eventWindow !== undefined ? { eventWindow: entity.eventWindow } : {}),
    ...(entity.statusHistory !== undefined ? { statusHistory: entity.statusHistory } : {}),
    claims: entity.claims,
  });
  const evidenceTier = highestConfidence(entity.claims);
  const claimCount = entity.claims.length;
  const grade = CONFIDENCE_GRADE[evidenceTier];
  const evidenceLabel =
    claimCount === 0 ? grade : `${grade} · ${claimCount} source${claimCount === 1 ? '' : 's'}`;

  return {
    kind: entity.kind,
    kindLabel,
    ...(mapTone !== undefined ? { mapTone } : {}),
    whereLabel: whereLabelFor(entity),
    eraLabel: era.label,
    ...(era.href !== undefined ? { eraHref: era.href } : {}),
    evidenceLabel,
    evidenceTier,
    confidenceTier: evidenceTier,
  };
}

export function buildEntityAnatomyPlace(
  entity: PublicEntityView,
  geoAnchor: { readonly lat: number; readonly lng: number } | undefined,
): RecordAnatomyPlace | undefined {
  if (!geoAnchor) {
    return undefined;
  }
  const tier = geoPrecisionTierForPublicPrecision(entity.locationPrecision);
  return {
    lat: geoAnchor.lat,
    lng: geoAnchor.lng,
    label: resolvePublicAddressLine({
      displayName: entity.displayName,
      locationLabel: entity.locationLabel,
      jurisdictionLabel: entity.jurisdictionLabel,
      locationPrecision: entity.locationPrecision,
      kind: entity.kind,
    }),
    precision: entity.locationPrecision,
    precisionCaption: radiusAffordanceLabel(tier, undefined),
  };
}
