/**
 * Builds RecordFactStrip items from Explore map features for list rows and preview
 * sheets — Kind / Where / Era / Evidence anatomy aligned with web v6 result meta.
 */
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
  const place =
    feature.properties.stateName?.trim() ||
    feature.properties.statePostalCode?.trim();
  if (place && place.length > 0) return place;
  return undefined;
}

function evidenceLabel(feature: PreviewFactFeature): string | undefined {
  const count = feature.properties.evidenceCount;
  if (typeof count !== 'number' || count < 0) return undefined;
  return count === 1 ? '1 claim' : `${count} claims`;
}

function confidenceLabel(feature: PreviewFactFeature): string | undefined {
  const tier = feature.properties.confidenceTier?.trim().toLowerCase();
  if (!tier) return undefined;
  if (tier === 'high') return 'High confidence';
  if (tier === 'medium') return 'Medium confidence';
  if (tier === 'low') return 'Low confidence';
  if (tier === 'unrated') return 'Unrated';
  return undefined;
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

  const evidence = evidenceLabel(feature);
  if (evidence) {
    facts.push({ key: 'evidence', label: 'Evidence', value: evidence });
  }

  const confidence = confidenceLabel(feature);
  if (confidence) {
    facts.push({ key: 'confidence', label: 'Confidence', value: confidence });
  }

  return facts;
}
