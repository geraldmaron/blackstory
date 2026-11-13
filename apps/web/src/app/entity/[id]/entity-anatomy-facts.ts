/**
 * Build record anatomy inputs from a public entity view. Pure helpers for server
 * components and unit tests — no React nodes; callers wire links in JSX.
 */
import type { PublicEntityView } from '../../../data/public-seed';
import { recordConfidenceTier } from '../../../lib/map-experience/build-explore-map-source';
import { entityEraFact } from '../../../lib/map-experience/entity-era-facts';
import { displayEncodingFor } from '../../../lib/map-experience/kind-encoding';
import { resolvePublicAddressLine } from '../../../lib/geography/public-address';
import { livedDecadeHrefForEra } from '../../../components/evidence/editorial-links';
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

export function buildEntityAnatomyInputs(
  entity: PublicEntityView,
  mapTone: string | undefined,
): EntityAnatomyInputs {
  const kindLabel = displayEncodingFor(entity.kind, mapTone).label;
  const eraInput = {
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
    ...(entity.era !== undefined ? { era: entity.era } : {}),
    ...(entity.eventWindow !== undefined ? { eventWindow: entity.eventWindow } : {}),
    ...(entity.statusHistory !== undefined ? { statusHistory: entity.statusHistory } : {}),
    claims: entity.claims,
  };
  const era = entityEraFact(eraInput);
  const livedDecadeHref = livedDecadeHrefForEra(eraInput);
  const evidenceTier = recordConfidenceTier(entity.claims);
  const claimCount = entity.claims.length;
  const grade = CONFIDENCE_GRADE[evidenceTier];
  const evidenceLabel =
    claimCount === 0 ? grade : `${grade} · ${claimCount} claim${claimCount === 1 ? '' : 's'}`;

  return {
    kind: entity.kind,
    kindLabel,
    ...(mapTone !== undefined ? { mapTone } : {}),
    whereLabel: whereLabelFor(entity),
    eraLabel: era.label,
    ...(livedDecadeHref !== undefined
      ? { eraHref: livedDecadeHref }
      : era.href !== undefined
        ? { eraHref: era.href }
        : {}),
    evidenceLabel,
    evidenceTier,
    confidenceTier: evidenceTier,
  };
}
