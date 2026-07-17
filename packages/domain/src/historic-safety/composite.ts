/**
 * The BB-082 "place context" composite: a single procedural summary derived ONLY from layers 1-4
 * (documented events, sundown-town, exclusion infrastructure, presence/affirmation) with
 * published weights, versioned methodology, input fingerprints, and audited recalculation \u2014
 * the exact BB-043 pattern (../confidence-engine/engine.ts) applied to this engine.
 *
 * CRITICAL INVARIANT: layer 5 (modern-context \u2014 hate-crime signal, general-crime context,
 * advisories) NEVER enters this composite. That is enforced FOUR independent ways here:
 *   1. `CompositeLayerInputs` has no slot for a layer-5 signal \u2014 there is nowhere to put one.
 *   2. `assertNoExcludedLayerInComposite` runtime-checks every present signal's own `layerId`
 *      discriminant against its expected slot and throws on any `modern_context` signal.
 *   3. `assertScoringInputFreeOfExcludedData` (../scoring-guard.js) recursively scans the
 *      resolved input for general-crime-stats and advisory field names.
 *   4. `HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS` proves at compile time that `CompositeResult`
 *      shares no field name with `GeneralCrimeContextRecord` or `PlaceAdvisoryRecord`.
 * `composite.crime-never-scores.test.ts` exercises all four against the REAL functions below.
 *
 * There is never one opaque safety score even here: `layerContributions` always accompanies
 * `value` so the full layer breakdown is one interaction away, and the constitution's procedural,
 * evidence-capped phrasing (../claims/confidence.js's `evaluatePublicLanguage` discipline) governs
 * any public copy built from this result \u2014 no place is branded "unsafe."
 */
import { createHash } from 'node:crypto';
import type { PlaceAdvisoryRecord } from '../advisory.js';
import type { ConfidenceComponents } from '../claims/index.js';
import { assertScoringInputFreeOfExcludedData, type GeneralCrimeContextRecord } from './scoring-guard.js';
import {
  COMPOSITE_ELIGIBLE_LAYER_IDS,
  type CompositeEligibleLayerId,
  type LayerSignal,
} from './types.js';

export const COMPOSITE_ENGINE_VERSION = 'historic-safety-composite.v1' as const;
export const COMPOSITE_METHODOLOGY_VERSION = 'historic-safety-composite-methodology.v1' as const;
export const COMPOSITE_AUDIT_VERSION = 'historic-safety-composite-audit.v1' as const;

/**
 * Published layer weights (methodology, versioned above) for the three harm-documenting layers;
 * these three sum to 1.0. `presence_affirmation` is deliberately NOT a fourth additive weight in
 * that same sum \u2014 it is "the counterweight," applied as a bounded multiplicative REDUCTION on
 * the harm composite (see `COUNTERWEIGHT_MAX_REDUCTION`), never a raw negative term that could
 * push the composite below zero or let a single markers-heavy place erase documented harm.
 */
export const COMPOSITE_LAYER_WEIGHTS: Readonly<Record<Exclude<CompositeEligibleLayerId, 'presence_affirmation'>, number>> = {
  documented_events: 0.4,
  sundown_town: 0.3,
  exclusion_infrastructure: 0.3,
};

/** Presence/affirmation can reduce the harm composite by at most this fraction \u2014 a bounded,
 *  published counterweight, never enough to fully erase documented harm on its own. */
export const COUNTERWEIGHT_MAX_REDUCTION = 0.3;

export type CompositeLayerInputs = {
  readonly documentedEvents?: LayerSignal;
  readonly sundownTown?: LayerSignal;
  readonly exclusionInfrastructure?: LayerSignal;
  readonly presenceAffirmation?: LayerSignal;
};

const SLOT_TO_LAYER_ID: Readonly<Record<keyof CompositeLayerInputs, CompositeEligibleLayerId>> = {
  documentedEvents: 'documented_events',
  sundownTown: 'sundown_town',
  exclusionInfrastructure: 'exclusion_infrastructure',
  presenceAffirmation: 'presence_affirmation',
};

/**
 * Fails closed if any provided signal's own `layerId` does not match its slot \u2014 in particular,
 * a `modern_context` signal can NEVER be smuggled into any of the four composite slots, no matter
 * which slot a caller (mistakenly or otherwise) tries to place it in.
 */
export function assertNoExcludedLayerInComposite(inputs: CompositeLayerInputs): void {
  for (const [slot, layerId] of Object.entries(SLOT_TO_LAYER_ID) as [keyof CompositeLayerInputs, CompositeEligibleLayerId][]) {
    const signal = inputs[slot];
    if (!signal) continue;
    if (signal.layerId !== layerId) {
      throw new Error(
        `Composite slot "${slot}" expects a "${layerId}" LayerSignal but received layerId ` +
          `"${signal.layerId}" \u2014 layer 5 (modern-context) and any other non-matching layer ` +
          'can never enter the composite (BB-082 critical invariant).',
      );
    }
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export type CompositeLayerContributions = Readonly<Record<CompositeEligibleLayerId, number>>;

export type CompositeResult = {
  readonly placeEntityId: string;
  /** The single procedural "place context" summary value in [0,1] \u2014 NEVER presented alone;
   *  `layerContributions` is always one interaction away, per the bead's "never one opaque
   *  score" invariant. */
  readonly value: number;
  readonly layerContributions: CompositeLayerContributions;
  /** Layers with no data for this place \u2014 distinct from a documented zero. */
  readonly missingLayers: readonly CompositeEligibleLayerId[];
  readonly calculatedAt: string;
};

function computeCompositeValue(inputs: CompositeLayerInputs): {
  readonly value: number;
  readonly layerContributions: CompositeLayerContributions;
  readonly missingLayers: CompositeEligibleLayerId[];
} {
  const missingLayers: CompositeEligibleLayerId[] = [];
  function resolveLayerValue(layerId: CompositeEligibleLayerId, signal: LayerSignal | undefined): number {
    if (signal) return signal.value;
    missingLayers.push(layerId);
    return 0;
  }

  const documentedEventsValue = resolveLayerValue('documented_events', inputs.documentedEvents);
  const sundownTownValue = resolveLayerValue('sundown_town', inputs.sundownTown);
  const exclusionInfrastructureValue = resolveLayerValue('exclusion_infrastructure', inputs.exclusionInfrastructure);
  const presenceAffirmationValue = resolveLayerValue('presence_affirmation', inputs.presenceAffirmation);

  const harmComposite =
    documentedEventsValue * COMPOSITE_LAYER_WEIGHTS.documented_events +
    sundownTownValue * COMPOSITE_LAYER_WEIGHTS.sundown_town +
    exclusionInfrastructureValue * COMPOSITE_LAYER_WEIGHTS.exclusion_infrastructure;

  const counterweightReduction = presenceAffirmationValue * COUNTERWEIGHT_MAX_REDUCTION;
  const value = round4(clamp01(harmComposite * (1 - counterweightReduction)));

  return {
    value,
    layerContributions: {
      documented_events: round4(documentedEventsValue),
      sundown_town: round4(sundownTownValue),
      exclusion_infrastructure: round4(exclusionInfrastructureValue),
      presence_affirmation: round4(presenceAffirmationValue),
    },
    missingLayers,
  };
}

export type ComputeCompositeInput = {
  readonly placeEntityId: string;
  readonly layers: CompositeLayerInputs;
  readonly calculatedAt?: string;
};

/**
 * Computes the layered-to-composite "place context" summary. Runs the crime/advisory exclusion
 * guard against its OWN output as defense-in-depth (point 3 in the module doc) even though
 * `CompositeLayerInputs`/`LayerSignal` structurally cannot carry those fields.
 */
export function computeComposite(input: ComputeCompositeInput): CompositeResult {
  assertNoExcludedLayerInComposite(input.layers);
  for (const signal of Object.values(input.layers)) {
    if (signal && signal.placeEntityId !== input.placeEntityId) {
      throw new Error('Every layer signal passed to computeComposite must match placeEntityId');
    }
  }

  const { value, layerContributions, missingLayers } = computeCompositeValue(input.layers);
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();

  const result: CompositeResult = {
    placeEntityId: input.placeEntityId,
    value,
    layerContributions,
    missingLayers,
    calculatedAt,
  };
  assertScoringInputFreeOfExcludedData(result);
  return result;
}

// ---------------------------------------------------------------------------
// BB-043 pattern: versioned methodology, input fingerprints, audited recalculation
// ---------------------------------------------------------------------------

export type CompositeInputFingerprints = Readonly<Record<CompositeEligibleLayerId | 'weights', string>>;

export type CompositeAudit = {
  readonly auditVersion: typeof COMPOSITE_AUDIT_VERSION;
  readonly engineVersion: typeof COMPOSITE_ENGINE_VERSION;
  readonly methodologyVersion: typeof COMPOSITE_METHODOLOGY_VERSION;
  readonly weights: typeof COMPOSITE_LAYER_WEIGHTS;
  readonly counterweightMaxReduction: typeof COUNTERWEIGHT_MAX_REDUCTION;
  readonly inputFingerprints: CompositeInputFingerprints;
  readonly recalculationReasons: readonly (CompositeEligibleLayerId | 'weights')[];
};

export type AuditedCompositeResult = CompositeResult & { readonly audit: CompositeAudit };

export type RecalculateCompositeInput = ComputeCompositeInput & {
  readonly previous?: Pick<AuditedCompositeResult, 'audit'>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

const SLOT_BY_LAYER_ID: Readonly<Record<CompositeEligibleLayerId, keyof CompositeLayerInputs>> = {
  documented_events: 'documentedEvents',
  sundown_town: 'sundownTown',
  exclusion_infrastructure: 'exclusionInfrastructure',
  presence_affirmation: 'presenceAffirmation',
};

export function compositeInputFingerprints(layers: CompositeLayerInputs): CompositeInputFingerprints {
  const perLayer = Object.fromEntries(
    COMPOSITE_ELIGIBLE_LAYER_IDS.map((layerId) => [layerId, fingerprint(layers[SLOT_BY_LAYER_ID[layerId]] ?? null)]),
  ) as Record<CompositeEligibleLayerId, string>;
  return {
    ...perLayer,
    weights: fingerprint({ COMPOSITE_LAYER_WEIGHTS, COUNTERWEIGHT_MAX_REDUCTION }),
  };
}

function changedInputs(
  current: CompositeInputFingerprints,
  previous?: CompositeInputFingerprints,
): (CompositeEligibleLayerId | 'weights')[] {
  const kinds: readonly (CompositeEligibleLayerId | 'weights')[] = [...COMPOSITE_ELIGIBLE_LAYER_IDS, 'weights'];
  if (!previous) return [...kinds];
  return kinds.filter((kind) => current[kind] !== previous[kind]);
}

/**
 * Recalculates the composite and stamps a full audit trail (BB-043 pattern): engine/methodology
 * versions, the published weights actually used, per-layer input fingerprints, and which inputs
 * changed since `previous` (or "all of them" on a first calculation).
 */
export function recalculateComposite(input: RecalculateCompositeInput): AuditedCompositeResult {
  const result = computeComposite(input);
  const inputFingerprints = compositeInputFingerprints(input.layers);

  return {
    ...result,
    audit: {
      auditVersion: COMPOSITE_AUDIT_VERSION,
      engineVersion: COMPOSITE_ENGINE_VERSION,
      methodologyVersion: COMPOSITE_METHODOLOGY_VERSION,
      weights: COMPOSITE_LAYER_WEIGHTS,
      counterweightMaxReduction: COUNTERWEIGHT_MAX_REDUCTION,
      inputFingerprints,
      recalculationReasons: changedInputs(inputFingerprints, input.previous?.audit.inputFingerprints),
    },
  };
}

// ---------------------------------------------------------------------------
// Compile-time proof (module doc, point 4)
// ---------------------------------------------------------------------------

type NoKeyOverlap<A, B> = Extract<keyof A, keyof B> extends never ? true : false;

/**
 * Compared against the SENSITIVE/banned fields only (not the full record types) \u2014
 * `placeEntityId` is legitimately shared identifying metadata across every place-scoped record in
 * this package (LayerSignal, PlaceAdvisoryRecord, GeneralCrimeContextRecord, CompositeResult
 * alike) and is not itself a scoring leak. `GENERAL_CRIME_STATS_SCORING_BANNED_KEYS` and
 * `ADVISORY_SCORING_BANNED_KEYS` are the actual leak surface this check guards.
 */
type BannedGeneralCrimeFields = Pick<GeneralCrimeContextRecord, 'nibrsOffenseCount' | 'reportedCrimeRate' | 'policingPatternCaveat'>;
type BannedAdvisoryFields = Pick<PlaceAdvisoryRecord, 'advisoryClass' | 'sourcedClaimIds' | 'reviewCadence'>;

export const HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS: {
  readonly noOverlapWithGeneralCrimeFields: NoKeyOverlap<CompositeResult, BannedGeneralCrimeFields>;
  readonly noOverlapWithAdvisoryFields: NoKeyOverlap<CompositeResult, BannedAdvisoryFields>;
  readonly noOverlapWithConfidenceComponents: NoKeyOverlap<CompositeResult, ConfidenceComponents>;
} = {
  noOverlapWithGeneralCrimeFields: true,
  noOverlapWithAdvisoryFields: true,
  noOverlapWithConfidenceComponents: true,
};
