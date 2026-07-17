/**
 * Layer 4 — presence/affirmation: the counterweight layer. This engine must show life, not only
 * harm — Green Book sites, historic Black churches/schools/business districts, HBCUs, and
 * heritage markers already in our corpus. Structurally mirrors ./documented-events.ts (a
 * saturating density aggregation over cited records, no time decay) but scores presence rather
 * than harm, and is the fourth and final layer eligible for the composite.
 */
import type { LayerCitation } from './types.js';
import { assertLayerCitationValid, type LayerSignal } from './types.js';

export const PRESENCE_AFFIRMATION_CATEGORIES = [
  'green_book_site',
  'historic_black_church',
  'historic_black_school',
  'historic_black_business_district',
  'hbcu',
  'heritage_marker',
] as const;

export type PresenceAffirmationCategory = (typeof PRESENCE_AFFIRMATION_CATEGORIES)[number];

export function isPresenceAffirmationCategory(value: string): value is PresenceAffirmationCategory {
  return (PRESENCE_AFFIRMATION_CATEGORIES as readonly string[]).includes(value);
}

/** Published category weights (methodology, versioned below). HBCUs and churches/schools are
 *  weighted as strong, durable community anchors; a single heritage marker is weighted lower
 *  because a marker documents remembrance of a site rather than an ongoing institution. */
export const PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS: Readonly<Record<PresenceAffirmationCategory, number>> = {
  green_book_site: 0.7,
  historic_black_church: 0.85,
  historic_black_school: 0.85,
  historic_black_business_district: 0.8,
  hbcu: 1,
  heritage_marker: 0.5,
};

export const PRESENCE_AFFIRMATION_METHODOLOGY_VERSION = 'presence-affirmation-methodology.v1' as const;

export type PresenceAffirmationRecord = {
  readonly id: string;
  readonly placeEntityId: string;
  readonly category: PresenceAffirmationCategory;
  /** How directly/closely this documented presence ties to the place, in [0,1]. */
  readonly proximityWeight: number;
  readonly citation: LayerCitation;
};

export function assertPresenceAffirmationRecordValid(record: PresenceAffirmationRecord): void {
  if (!record.id.trim()) throw new Error('PresenceAffirmationRecord.id is required');
  if (!record.placeEntityId.trim()) throw new Error('PresenceAffirmationRecord.placeEntityId is required');
  if (!isPresenceAffirmationCategory(record.category)) {
    throw new Error(`Unknown presence-affirmation category: ${record.category}`);
  }
  if (!Number.isFinite(record.proximityWeight) || record.proximityWeight < 0 || record.proximityWeight > 1) {
    throw new RangeError('PresenceAffirmationRecord.proximityWeight must be a finite number in [0,1]');
  }
  assertLayerCitationValid(record.citation);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function aggregatePresenceWeights(records: readonly PresenceAffirmationRecord[]): number {
  const complement = records.reduce((product, record) => {
    const weight = clamp01(PRESENCE_AFFIRMATION_CATEGORY_WEIGHTS[record.category] * record.proximityWeight);
    return product * (1 - weight);
  }, 1);
  return clamp01(1 - complement);
}

export type ComputePresenceAffirmationLayerInput = {
  readonly placeEntityId: string;
  readonly records: readonly PresenceAffirmationRecord[];
  readonly asOf: string;
};

/** Never fabricates a zero-value signal when no presence/affirmation records exist \u2014 absence
 *  of a documented Green Book site, church, school, HBCU, or marker is not itself a claim. */
export function computePresenceAffirmationLayerSignal(
  input: ComputePresenceAffirmationLayerInput,
): LayerSignal | undefined {
  const records = input.records.filter((r) => r.placeEntityId === input.placeEntityId);
  if (records.length === 0) return undefined;
  for (const record of records) {
    assertPresenceAffirmationRecordValid(record);
  }

  const categories = [...new Set(records.map((r) => r.category))].sort();

  return {
    layerId: 'presence_affirmation',
    signalVersion: PRESENCE_AFFIRMATION_METHODOLOGY_VERSION,
    placeEntityId: input.placeEntityId,
    value: round4(aggregatePresenceWeights(records)),
    asOf: input.asOf,
    citations: records.map((record) => record.citation),
    methodologyNote: {
      layerId: 'presence_affirmation',
      methodologyVersion: PRESENCE_AFFIRMATION_METHODOLOGY_VERSION,
      summary:
        'The counterweight layer: documented Black presence and community life (Green Book sites, ' +
        'historic Black churches/schools/business districts, HBCUs, heritage markers) drawn from ' +
        'our own corpus. Combines each record\'s published category weight with its proximity to ' +
        `this place using the same saturating aggregation as Layer 1. Categories present: ${categories.join(', ')}.`,
    },
  };
}
