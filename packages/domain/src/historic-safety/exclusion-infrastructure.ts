/**
 * Layer 3 exclusion infrastructure: HOLC redlining grades (Mapping Inequality, University of
 * Richmond DSL, sourced from NARA) and racially restrictive covenant projects where digitized.
 *
 * HOLC/redlining grades are their OWN designation record type (A/B/C/D; see ./layer-record.ts's
 * `RedliningGradeDesignationRecord`) — a distinct vocabulary from the sundown-town taxonomy in
 * ./sundown-town.ts, never conflated with or dropped in favor of it. Covenant records are a
 * third, separate designation kind (`RestrictiveCovenantDesignationRecord`) folded into this same
 * layer because both document structural/legal exclusion infrastructure, not violence or
 * displacement (Layer 1) or presence (Layer 4).
 */
import {
  currentRedliningGrade,
  HOLC_GRADES,
  redliningGradeAsOf,
  type HolcGrade,
  type RedliningGradeDesignationRecord,
  type RestrictiveCovenantDesignationRecord,
} from './layer-record.js';
import { assertLayerCitationValid, type LayerCitation, type LayerSignal } from './types.js';

export const EXCLUSION_INFRASTRUCTURE_METHODOLOGY_VERSION =
  'exclusion-infrastructure-methodology.v1' as const;

/** Published HOLC-grade weights (methodology, versioned above) grade D ("Hazardous") is the
 * most exclusionary designation under the original HOLC scheme. */
export const HOLC_GRADE_WEIGHTS: Readonly<Record<HolcGrade, number>> = {
  A: 0,
  B: 0.33,
  C: 0.67,
  D: 1,
};

/** Published fixed contribution when >=1 digitized restrictive-covenant record exists for the place. */
export const RESTRICTIVE_COVENANT_PRESENCE_WEIGHT = 0.5;

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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export type ComputeExclusionInfrastructureLayerInput = {
  readonly placeEntityId: string;
  readonly redliningRecords: readonly RedliningGradeDesignationRecord[];
  readonly covenantRecords: readonly RestrictiveCovenantDesignationRecord[];
  readonly asOf?: string;
  readonly citationsByClaimId: ReadonlyMap<string, LayerCitation>;
};

/**
 * Never fabricates a signal when neither a redlining-grade nor a covenant record exists for the
 * place an absence of digitized HOLC/covenant data means "not documented," never "cleared."
 */
export function computeExclusionInfrastructureLayerSignal(
  input: ComputeExclusionInfrastructureLayerInput,
): LayerSignal | undefined {
  const redlining = input.redliningRecords.filter((r) => r.placeEntityId === input.placeEntityId);
  const covenants = input.covenantRecords.filter((r) => r.placeEntityId === input.placeEntityId);
  if (redlining.length === 0 && covenants.length === 0) return undefined;

  const grade = input.asOf ? redliningGradeAsOf(redlining, input.asOf) : currentRedliningGrade(redlining);
  const holcWeight = grade ? HOLC_GRADE_WEIGHTS[grade] : 0;
  const covenantWeight = covenants.length > 0 ? RESTRICTIVE_COVENANT_PRESENCE_WEIGHT : 0;
  const value = round4(clamp01(holcWeight + covenantWeight * (1 - holcWeight)));

  const activeRedliningRecord = grade
    ? redlining.find((record) =>
        input.asOf ? redliningGradeAsOf([record], input.asOf) === grade : currentRedliningGrade([record]) === grade,
      )
    : undefined;

  const basisClaimIds = [
    ...(activeRedliningRecord?.basisClaimIds ?? []),
    ...covenants.flatMap((record) => record.basisClaimIds),
  ];
  if (basisClaimIds.length === 0) return undefined;

  const citations = resolveCitations(basisClaimIds, input.citationsByClaimId);
  const asOf = input.asOf ?? activeRedliningRecord?.validFrom ?? covenants[0]?.validFrom ?? new Date().toISOString();

  const noteParts: string[] = [
    'HOLC Residential Security Map grades (Mapping Inequality, Univ. of Richmond DSL, source ' +
      `records held by NARA) as a distinct A-D designation \u2014 grade weights: ${HOLC_GRADES.map(
        (g) => `${g}=${HOLC_GRADE_WEIGHTS[g]}`,
      ).join(', ')}.`,
    'Digitized racially restrictive covenant projects contribute a fixed presence weight ' +
      `(${RESTRICTIVE_COVENANT_PRESENCE_WEIGHT}) when >=1 covenant record exists, combined with ` +
      'the HOLC grade via a saturating (never additive-over-1) combination.',
  ];

  return {
    layerId: 'exclusion_infrastructure',
    signalVersion: EXCLUSION_INFRASTRUCTURE_METHODOLOGY_VERSION,
    placeEntityId: input.placeEntityId,
    value,
    asOf,
    citations,
    methodologyNote: {
      layerId: 'exclusion_infrastructure',
      methodologyVersion: EXCLUSION_INFRASTRUCTURE_METHODOLOGY_VERSION,
      summary: noteParts.join(' '),
    },
    ...(grade ? { notes: `HOLC grade: ${grade}` } : {}),
  };
}
