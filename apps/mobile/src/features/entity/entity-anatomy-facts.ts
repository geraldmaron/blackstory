/**
 * Build record anatomy inputs from a normalized mobile Entity — pure helpers for
 * AnatomySection and unit tests. Mirrors web `entity-anatomy-facts.ts` without
 * React or `@repo/domain` imports.
 */
import { humanizeToken } from './format';
import type { Claim, Entity, LocationPrecision } from './types';

export type ConfidenceTierKey = 'high' | 'medium' | 'low' | 'unrated';

export type EntityAnatomyInputs = {
  readonly kind: string;
  readonly kindLabel: string;
  readonly whereLabel: string;
  readonly eraLabel: string;
  readonly evidenceLabel: string;
  readonly evidenceTier: ConfidenceTierKey;
};

export type RecordAnatomyPlace = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly precision?: LocationPrecision;
  readonly precisionCaption?: string;
};

const CONFIDENCE_GRADE: Readonly<Record<ConfidenceTierKey, string>> = {
  high: 'Grade A',
  medium: 'Grade B',
  low: 'Grade C',
  unrated: 'Unrated',
};

function isDisplayableJurisdictionLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  return lower !== 'unknown jurisdiction' && lower !== 'unknown';
}

function whereLabelFor(entity: Entity): string {
  if (isDisplayableJurisdictionLabel(entity.jurisdictionLabel)) {
    return entity.jurisdictionLabel.trim();
  }
  const location = entity.locationLabel.trim();
  if (location.length > 0 && !/^unknown$/iu.test(location) && location.toLowerCase() !== 'unknown location') {
    return location;
  }
  return 'Place withheld';
}

function decadeFromIsoDate(iso: string | undefined): string | undefined {
  if (!iso?.trim()) return undefined;
  const year = Number.parseInt(iso.trim().slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1000 || year > 9999) return undefined;
  return `${Math.floor(year / 10) * 10}s`;
}

/** Resolve era bucket labels from structured fields before showing Undated. */
export function resolveEntityEraBuckets(entity: Entity): readonly string[] {
  const explicit = (entity.eraBuckets ?? [])
    .map((bucket) => bucket.trim())
    .filter((bucket) => bucket.length > 0);
  if (explicit.length > 0) return explicit;

  const fromEvent = decadeFromIsoDate(entity.eventWindow?.startAt);
  if (fromEvent) return [fromEvent];

  const buckets = new Set<string>();
  for (const entry of entity.statusHistory ?? []) {
    const decade = decadeFromIsoDate(entry.validFrom);
    if (decade) buckets.add(decade);
  }
  if (buckets.size > 0) return [...buckets].sort((a, b) => a.localeCompare(b));

  return [];
}

export function entityEraFact(entity: Entity): { readonly label: string } {
  const buckets = resolveEntityEraBuckets(entity);
  if (buckets.length === 1) {
    return { label: humanizeToken(buckets[0]!) };
  }
  if (buckets.length > 1) {
    return {
      label: `${humanizeToken(buckets[0]!)} to ${humanizeToken(buckets[buckets.length - 1]!)}`,
    };
  }
  return { label: 'Undated' };
}

/** Highest confidence tier among accepted claims — never a numeric score. */
export function highestConfidence(claims: readonly Claim[]): ConfidenceTierKey {
  if (claims.some((claim) => claim.confidenceLevel === 'high')) return 'high';
  if (claims.some((claim) => claim.confidenceLevel === 'medium')) return 'medium';
  if (claims.some((claim) => claim.confidenceLevel === 'low')) return 'low';
  return 'unrated';
}

export function buildEntityAnatomyInputs(entity: Entity): EntityAnatomyInputs {
  const kindLabel = humanizeToken(entity.kind);
  const era = entityEraFact(entity);
  const evidenceTier = highestConfidence(entity.claims);
  const claimCount = entity.claims.length;
  const grade = CONFIDENCE_GRADE[evidenceTier];
  const evidenceLabel =
    claimCount === 0 ? grade : `${grade} · ${claimCount} source${claimCount === 1 ? '' : 's'}`;

  return {
    kind: entity.kind,
    kindLabel,
    whereLabel: whereLabelFor(entity),
    eraLabel: era.label,
    evidenceLabel,
    evidenceTier,
  };
}

function precisionCaption(entity: Entity): string | undefined {
  if (!entity.locationPrecision) return undefined;
  const place = entity.locationLabel.trim() || entity.jurisdictionLabel.trim() || 'This record';
  return `Location precision: ${humanizeToken(entity.locationPrecision)}. Showing ${place}. Exact residential addresses are never shown.`;
}

export function buildEntityAnatomyPlace(entity: Entity): RecordAnatomyPlace | undefined {
  const anchor = entity.geoAnchor;
  if (
    anchor === undefined ||
    !Number.isFinite(anchor.lat) ||
    !Number.isFinite(anchor.lng)
  ) {
    return undefined;
  }
  return {
    lat: anchor.lat,
    lng: anchor.lng,
    label: entity.locationLabel.trim() || entity.displayName,
    ...(entity.locationPrecision !== undefined ? { precision: entity.locationPrecision } : {}),
    ...(precisionCaption(entity) !== undefined ? { precisionCaption: precisionCaption(entity) } : {}),
  };
}
