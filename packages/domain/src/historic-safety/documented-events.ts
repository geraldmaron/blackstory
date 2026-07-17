/**
 * Layer 1 — documented historic events: proximity/density of events already in our corpus plus
 * vetted external datasets (EJI/Seguin-Rigby lynching records; massacres and race riots;
 * documented displacement such as urban renewal or highway construction), time-banded by era.
 *
 * "Never decayed to zero — history does not expire" (bead design note): deliberately, NO
 * time-decay function exists anywhere in this module. An event's contribution depends only on
 * its documented category weight and proximity/density to the place, never on how long ago it
 * happened. `eraBandsForEvents` groups events into decade bands purely for presentation
 * (methodology-note context, "this place has documented events in the 1920s and 1950s"), never
 * to reduce a weight toward zero as a band gets older.
 */
import { deriveEraBuckets, type EraSpan } from '../era.js';
import type { LayerCitation } from './types.js';
import { assertLayerCitationValid, type LayerSignal } from './types.js';

export const DOCUMENTED_EVENT_CATEGORIES = [
  'lynching',
  'massacre_or_riot',
  'documented_displacement',
] as const;

export type DocumentedEventCategory = (typeof DOCUMENTED_EVENT_CATEGORIES)[number];

export function isDocumentedEventCategory(value: string): value is DocumentedEventCategory {
  return (DOCUMENTED_EVENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Published category weights (part of the versioned methodology — a change here is a
 * methodology-version bump, never a silent tuning edit). Displacement is weighted lower than
 * direct violence because it documents a different, though still significant, historical harm.
 */
export const DOCUMENTED_EVENT_CATEGORY_WEIGHTS: Readonly<Record<DocumentedEventCategory, number>> = {
  lynching: 1,
  massacre_or_riot: 1,
  documented_displacement: 0.7,
};

export const DOCUMENTED_EVENTS_METHODOLOGY_VERSION = 'documented-events-methodology.v1' as const;

export type DocumentedEventRecord = {
  readonly id: string;
  readonly placeEntityId: string;
  readonly category: DocumentedEventCategory;
  readonly eraSpan: EraSpan;
  /** How directly/closely this event ties to the place, in [0,1] — not a time-decay factor. */
  readonly proximityWeight: number;
  readonly citation: LayerCitation;
};

export function assertDocumentedEventRecordValid(record: DocumentedEventRecord): void {
  if (!record.id.trim()) throw new Error('DocumentedEventRecord.id is required');
  if (!record.placeEntityId.trim()) throw new Error('DocumentedEventRecord.placeEntityId is required');
  if (!isDocumentedEventCategory(record.category)) {
    throw new Error(`Unknown documented-event category: ${record.category}`);
  }
  if (
    !Number.isFinite(record.proximityWeight) ||
    record.proximityWeight < 0 ||
    record.proximityWeight > 1
  ) {
    throw new RangeError('DocumentedEventRecord.proximityWeight must be a finite number in [0,1]');
  }
  assertLayerCitationValid(record.citation);
}

/** Decade-band grouping for presentation only — see module doc: never used to decay a weight. */
export function eraBandsForEvents(
  events: readonly DocumentedEventRecord[],
): ReadonlyMap<string, readonly DocumentedEventRecord[]> {
  const bands = new Map<string, DocumentedEventRecord[]>();
  for (const event of events) {
    const buckets = deriveEraBuckets(event.eraSpan);
    const key = buckets[0] ?? 'undated';
    const existing = bands.get(key) ?? [];
    existing.push(event);
    bands.set(key, existing);
  }
  return bands;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Saturating (probabilistic-OR) density aggregation: each event's weighted proximity contributes
 * independently and the combined value approaches 1 as density increases, but a single event
 * never automatically maxes out the signal. Deterministic, no arbitrary tuning constant beyond
 * the published category weights above.
 */
function aggregateEventWeights(events: readonly DocumentedEventRecord[]): number {
  const complement = events.reduce((product, event) => {
    const weight = clamp01(DOCUMENTED_EVENT_CATEGORY_WEIGHTS[event.category] * event.proximityWeight);
    return product * (1 - weight);
  }, 1);
  return clamp01(1 - complement);
}

export type ComputeDocumentedEventsLayerInput = {
  readonly placeEntityId: string;
  readonly events: readonly DocumentedEventRecord[];
  readonly asOf: string;
};

/**
 * Never fabricates a zero-value signal with no citations: when no documented events exist for a
 * place, this returns `undefined` rather than a hollow LayerSignal (a layer signal is always a
 * claim about something documented, not an absence-of-evidence score).
 */
export function computeDocumentedEventsLayerSignal(
  input: ComputeDocumentedEventsLayerInput,
): LayerSignal | undefined {
  if (input.events.length === 0) return undefined;
  for (const event of input.events) {
    assertDocumentedEventRecordValid(event);
    if (event.placeEntityId !== input.placeEntityId) {
      throw new Error('All events passed to computeDocumentedEventsLayerSignal must match placeEntityId');
    }
  }

  const value = round4(aggregateEventWeights(input.events));
  const eraBands = [...eraBandsForEvents(input.events).keys()].sort();

  return {
    layerId: 'documented_events',
    signalVersion: DOCUMENTED_EVENTS_METHODOLOGY_VERSION,
    placeEntityId: input.placeEntityId,
    value,
    asOf: input.asOf,
    citations: input.events.map((event) => event.citation),
    methodologyNote: {
      layerId: 'documented_events',
      methodologyVersion: DOCUMENTED_EVENTS_METHODOLOGY_VERSION,
      summary:
        'Proximity/density of documented historic events (lynchings, massacres/riots, documented ' +
        'displacement) drawn from EJI/Seguin-Rigby lynching records and vetted corpus sources. ' +
        'Combines each event\'s published category weight with its proximity to this place using ' +
        'a saturating aggregation; NEVER time-decayed \u2014 an event from any era counts fully. ' +
        `Era bands present: ${eraBands.join(', ')}.`,
    },
  };
}
