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
import { isDisplayableJurisdictionLabel } from '../../../lib/public-data/map-projection';
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
  if (isDisplayableJurisdictionLabel(entity.jurisdictionLabel)) {
    return entity.jurisdictionLabel.trim();
  }
  const location = entity.locationLabel.trim();
  if (location.length > 0 && !/^unknown$/iu.test(location)) {
    return location;
  }
  return 'Place withheld';
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
    label: entity.locationLabel,
    precision: entity.locationPrecision,
    precisionCaption: radiusAffordanceLabel(tier, undefined),
  };
}
