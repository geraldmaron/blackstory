/**
 * Layer 2 — sundown-town designation history: Tougaloo College Historical Database of Sundown
 * Towns taxonomy preserved verbatim (possible/probable/surely — never flattened to a boolean).
 * Their statuses are claims with confidence, exactly this product's own claims model.
 *
 * Designation storage (the taxonomy, the time-scoping, the area-geometry binding) lives in
 * ./layer-record.ts as BB-082's own record type. This module only turns a point-in-time query
 * against that record type into a composite-eligible `LayerSignal` — it adds published weights
 * for the taxonomy, nothing else.
 */
import {
  currentSundownTownConfidence,
  sundownTownConfidenceAsOf,
  SUNDOWN_TOWN_CONFIDENCE_LEVELS,
  type SundownTownConfidence,
  type SundownTownDesignationRecord,
} from './layer-record.js';
import { assertLayerCitationValid, type LayerCitation, type LayerSignal } from './types.js';

export const SUNDOWN_TOWN_METHODOLOGY_VERSION = 'sundown-town-methodology.v1' as const;

/**
 * Published confidence-to-signal weights (methodology, versioned above). The Tougaloo taxonomy
 * ITSELF is never collapsed to these numbers in storage or presentation — `layerSignal.notes`
 * always carries the verbatim confidence label alongside the numeric contribution.
 */
export const SUNDOWN_TOWN_CONFIDENCE_WEIGHTS: Readonly<Record<SundownTownConfidence, number>> = {
  possible: 0.35,
  probable: 0.7,
  surely: 1,
};

function resolveCitations(
  claimIds: readonly string[],
  citationsByClaimId: ReadonlyMap<string, LayerCitation>,
): LayerCitation[] {
  return claimIds.map((claimId) => {
    const citation = citationsByClaimId.get(claimId);
    if (!citation) {
      throw new Error(
        `No LayerCitation registered for basis claim "${claimId}" \u2014 a designation record's ` +
          'basis claims must all resolve to citations before it can produce a LayerSignal.',
      );
    }
    assertLayerCitationValid(citation);
    return citation;
  });
}

export type ComputeSundownTownLayerInput = {
  readonly placeEntityId: string;
  readonly records: readonly SundownTownDesignationRecord[];
  /** Point-in-time query date; when omitted, uses the current (open-ended) designation. */
  readonly asOf?: string;
  readonly citationsByClaimId: ReadonlyMap<string, LayerCitation>;
};

/**
 * Never fabricates a signal when no designation covers the requested point in time — an absent
 * Tougaloo entry means "no data," never "confirmed not a sundown town."
 */
export function computeSundownTownLayerSignal(
  input: ComputeSundownTownLayerInput,
): LayerSignal | undefined {
  const covering = input.records.filter((record) => record.placeEntityId === input.placeEntityId);
  if (covering.length === 0) return undefined;

  const confidence = input.asOf
    ? sundownTownConfidenceAsOf(covering, input.asOf)
    : currentSundownTownConfidence(covering);
  if (!confidence) return undefined;

  const activeRecord = covering.find((record) =>
    input.asOf
      ? sundownTownConfidenceAsOf([record], input.asOf) === confidence
      : currentSundownTownConfidence([record]) === confidence,
  );
  if (!activeRecord) return undefined;

  const citations = resolveCitations(activeRecord.basisClaimIds, input.citationsByClaimId);
  const asOf = input.asOf ?? activeRecord.validFrom ?? new Date().toISOString();

  return {
    layerId: 'sundown_town',
    signalVersion: SUNDOWN_TOWN_METHODOLOGY_VERSION,
    placeEntityId: input.placeEntityId,
    value: SUNDOWN_TOWN_CONFIDENCE_WEIGHTS[confidence],
    asOf,
    citations,
    methodologyNote: {
      layerId: 'sundown_town',
      methodologyVersion: SUNDOWN_TOWN_METHODOLOGY_VERSION,
      summary:
        'Tougaloo College Historical Database of Sundown Towns taxonomy ' +
        `(${SUNDOWN_TOWN_CONFIDENCE_LEVELS.join(' / ')}), preserved verbatim as a claim ` +
        'confidence, never a boolean. Published weights convert the taxonomy label to a ' +
        'composite-eligible signal; the verbatim label is always shown alongside the number.',
    },
    notes: `Tougaloo confidence: ${confidence}`,
  };
}
