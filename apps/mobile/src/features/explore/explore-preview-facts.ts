/**
 * Builds RecordFactStrip items from Explore map features for list rows and preview sheets —
 * Kind / Where / Era / Evidence.
 *
 * Evidence is one fact, not two, and it is phrased by `@repo/public-contracts/evidence` — the
 * same module the site prints from. This file used to build its own: "3 claims" for the count and
 * "High confidence" for the tier, so a record the site called "Grade A · 3 sources" arrived on the
 * phone as two unrelated strings, neither of which named a grade.
 */
import { evidenceLabel } from '@repo/public-contracts/evidence';

import type { RecordFactStripItem } from '@/ui';
import { recordEraLabel, recordKindLabel } from '@/features/record-facts/record-facts';
import { kindFamilyEncodingFor, isKnownMapKindFamily } from '@/features/map/kind-encoding';

export type PreviewFactFeature = {
  readonly kind: string;
  readonly properties: {
    readonly stateName?: string;
    readonly statePostalCode?: string;
    readonly eraBuckets?: readonly string[];
    readonly evidenceCount?: number;
    readonly confidenceTier?: string;
    readonly kindFamily?: string;
  };
};

function whereLabel(feature: PreviewFactFeature): string | undefined {
  const place = feature.properties.stateName?.trim() || feature.properties.statePostalCode?.trim();
  if (place && place.length > 0) return place;
  return undefined;
}

/** The record's confidence tier, defaulted to `unrated` — the honest reading of "no tier". */
export function featureConfidenceTier(feature: PreviewFactFeature): string {
  return feature.properties.confidenceTier?.trim().toLowerCase() || 'unrated';
}

/** Source count when the feature carries one. Absent is not zero. */
export function featureSourceCount(feature: PreviewFactFeature): number | undefined {
  const count = feature.properties.evidenceCount;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return undefined;
  return count;
}

function featureEvidenceLabel(feature: PreviewFactFeature): string {
  return evidenceLabel(featureConfidenceTier(feature), featureSourceCount(feature));
}

function kindLabelFor(feature: PreviewFactFeature): string {
  const family = feature.properties.kindFamily;
  if (typeof family === 'string' && isKnownMapKindFamily(family)) {
    return kindFamilyEncodingFor(family).label;
  }
  return recordKindLabel(feature.kind);
}

/** Fact strip for records rail rows and preview sheets — sparse fields omitted. */
export function exploreRecordFacts(feature: PreviewFactFeature): readonly RecordFactStripItem[] {
  const facts: RecordFactStripItem[] = [
    { key: 'kind', label: 'Kind', value: kindLabelFor(feature) },
  ];

  const era = recordEraLabel({
    eraBuckets: feature.properties.eraBuckets,
    eventWindow: undefined,
    statusHistory: undefined,
  });
  if (era !== 'Undated') {
    facts.push({ key: 'era', label: 'Era', value: era });
  }

  const where = whereLabel(feature);
  if (where) {
    facts.push({ key: 'where', label: 'Where', value: where });
  }

  facts.push({ key: 'evidence', label: 'Evidence', value: featureEvidenceLabel(feature) });

  return facts;
}
