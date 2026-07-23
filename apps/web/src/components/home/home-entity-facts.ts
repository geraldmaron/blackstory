/**
 * Format featured-record facts for the homepage One Story carousel (kind, place, era, evidence).
 * Client-safe: no server-only map-projection or build-explore-map-source imports.
 */

import { displayEncodingFor } from '../../lib/map-experience/kind-encoding';
import { entityEraFact } from '../../lib/map-experience/entity-era-facts';
import type { PublicClaimView } from '../../data/public-seed';

type ClaimConfidence = Pick<PublicClaimView, 'confidenceLevel'>;

export type HomeFeaturedEntity = {
  readonly id: string;
  readonly kind: string;
  readonly jurisdictionLabel: string;
  readonly displayName: string;
  readonly summary: string;
  readonly era?: string;
  readonly eraBuckets?: readonly string[];
  readonly claims?: readonly ClaimConfidence[];
  readonly locationPrecision?: 'city' | 'neighborhood' | 'campus' | 'institution';
  readonly geoAnchor?: { readonly lat: number; readonly lng: number };
};

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unrated';

const CONFIDENCE_GRADE: Record<ConfidenceTier, string> = {
  high: 'Grade A',
  medium: 'Grade B',
  low: 'Grade C',
  unrated: 'Unrated',
};

function isDisplayableJurisdictionLabel(label: string | undefined): boolean {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return false;
  return !/^unknown$/iu.test(trimmed);
}

function highestConfidence(claims: readonly ClaimConfidence[]): ConfidenceTier {
  if (claims.some((claim) => claim.confidenceLevel === 'high')) return 'high';
  if (claims.some((claim) => claim.confidenceLevel === 'medium')) return 'medium';
  if (claims.some((claim) => claim.confidenceLevel === 'low')) return 'low';
  return 'unrated';
}

export function kindLabelFor(kind: string): string {
  return displayEncodingFor(kind).label;
}

export function jurisdictionFactFor(jurisdictionLabel: string): string | undefined {
  if (!isDisplayableJurisdictionLabel(jurisdictionLabel)) return undefined;
  const trimmed = jurisdictionLabel.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function eraFactFor(entity: Pick<HomeFeaturedEntity, 'eraBuckets' | 'era'>): string {
  return entityEraFact({
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
    ...(entity.era !== undefined ? { era: entity.era } : {}),
  }).label;
}

export function evidenceTierFor(claims: readonly ClaimConfidence[] | undefined): ConfidenceTier {
  return highestConfidence(claims ?? []);
}

export function evidenceFactFor(claims: readonly ClaimConfidence[] | undefined): string {
  const count = claims?.length ?? 0;
  const tier = evidenceTierFor(claims);
  const grade = CONFIDENCE_GRADE[tier];
  if (count === 0) return grade;
  return `${grade} · ${count} source${count === 1 ? '' : 's'}`;
}
