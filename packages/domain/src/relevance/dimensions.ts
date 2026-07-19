/**
 * Relevance scoring dimensions and feature-value extraction.
 */
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import type { RelevanceDimension, RelevanceFeatureValue } from './types.js';

export const RELEVANCE_DIMENSION_WEIGHTS: Readonly<Record<RelevanceDimension, number>> = {
  signal_strength: 0.35,
  thematic_alignment: 0.25,
  geographic_connection: 0.2,
  source_authority: 0.15,
  distinctiveness: 0.05,
};

const SIGNAL_STRENGTH_VALUES = {
  strong: 1,
  medium: 0.72,
  weak: 0.3,
} as const;

const SOURCE_AUTHORITY_VALUES: Readonly<Record<string, number>> = {
  primary_archival: 1,
  government_record: 0.9,
  peer_reviewed: 0.85,
  reputable_secondary: 0.7,
  news_reportage: 0.55,
  community_oral: 0.5,
  self_published: 0.3,
  unknown: 0.4,
};

function assertUnitInterval(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1`);
  }
  return value;
}

function buildFeature(
  dimension: RelevanceDimension,
  value: number,
  rationale: string,
): RelevanceFeatureValue {
  const weight = RELEVANCE_DIMENSION_WEIGHTS[dimension];
  const normalized = assertUnitInterval(value, dimension);
  return {
    dimension,
    value: normalized,
    weight,
    contribution: normalized * weight,
    rationale,
  };
}

function scoreThematicAlignment(candidate: DiscoveryCandidateRecord): RelevanceFeatureValue {
  const classes = new Set(candidate.signals.matchedClasses);
  const hasPositive = classes.has('positive');
  const hasHistorical = classes.has('historical');
  const hasModern = classes.has('modern');
  const hasGeographic = classes.has('geographic');
  const hasNegative = classes.has('negative');

  if (hasPositive && (hasHistorical || hasModern)) {
    return buildFeature(
      'thematic_alignment',
      1,
      'Positive thematic terms align with historical or modern period context.',
    );
  }
  if (hasPositive) {
    return buildFeature('thematic_alignment', 0.72, 'Positive thematic terms matched.');
  }
  if (hasHistorical || hasModern) {
    return buildFeature(
      'thematic_alignment',
      0.42,
      'Period terms matched without a positive thematic anchor.',
    );
  }
  if (hasGeographic && !hasNegative) {
    return buildFeature('thematic_alignment', 0.35, 'Geographic context only.');
  }
  if (hasNegative) {
    return buildFeature('thematic_alignment', 0.1, 'Negative or off-scope thematic signal.');
  }
  return buildFeature('thematic_alignment', 0, 'No thematic alignment detected.');
}

function scoreGeographicConnection(candidate: DiscoveryCandidateRecord): RelevanceFeatureValue {
  const hints = candidate.geographicHints;
  if (hints.length === 0) {
    const hasGeographicTerm = candidate.signals.matchedClasses.includes('geographic');
    if (hasGeographicTerm) {
      return buildFeature(
        'geographic_connection',
        0.45,
        'Geographic query term matched without structured place hints.',
      );
    }
    return buildFeature('geographic_connection', 0, 'No geographic connection detected.');
  }

  const best = hints.reduce((max, hint) => Math.max(max, hint.confidence), 0);
  return buildFeature(
    'geographic_connection',
    best,
    `Geographic hints include ${hints.map((hint) => hint.text).join(', ')}.`,
  );
}

function scoreSourceAuthority(candidate: DiscoveryCandidateRecord): RelevanceFeatureValue {
  const classification = candidate.adapterRecord.classification ?? 'unknown';
  const value = SOURCE_AUTHORITY_VALUES[classification] ?? SOURCE_AUTHORITY_VALUES.unknown!;
  return buildFeature('source_authority', value, `Source classified as ${classification}.`);
}

function scoreSignalStrength(candidate: DiscoveryCandidateRecord): RelevanceFeatureValue {
  const value = SIGNAL_STRENGTH_VALUES[candidate.signals.strength];
  return buildFeature(
    'signal_strength',
    value,
    `Discovery signal strength is ${candidate.signals.strength}.`,
  );
}

export function scoreDistinctiveness(isDuplicate: boolean): RelevanceFeatureValue {
  return buildFeature(
    'distinctiveness',
    isDuplicate ? 0 : 1,
    isDuplicate
      ? 'Candidate duplicates a prior inclusion by content identity.'
      : 'Candidate is distinct from prior inclusions.',
  );
}

/** Extract weighted feature values for all relevance dimensions. */
export function extractRelevanceFeatures(
  candidate: DiscoveryCandidateRecord,
  isDuplicate: boolean,
): readonly RelevanceFeatureValue[] {
  return [
    scoreSignalStrength(candidate),
    scoreThematicAlignment(candidate),
    scoreGeographicConnection(candidate),
    scoreSourceAuthority(candidate),
    scoreDistinctiveness(isDuplicate),
  ];
}

/** Sum weighted contributions into a composite score (private). */
export function composeCompositeScore(features: readonly RelevanceFeatureValue[]): number {
  const total = features.reduce((sum, feature) => sum + feature.contribution, 0);
  return assertUnitInterval(Number(total.toFixed(4)), 'composite relevance score');
}
