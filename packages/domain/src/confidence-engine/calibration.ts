/**
 * Calibration dataset export for later model calibration and BB-047 evaluation.
 * Exports only deterministic, versioned confidence records with optional observed outcomes.
 */
import type { ClaimClass } from '@black-book/schemas';
import type { AuditedConfidenceResult } from './engine.js';

export const CONFIDENCE_CALIBRATION_DATASET_VERSION =
  'confidence-calibration-dataset.v1' as const;

export type ConfidenceCalibrationCase = {
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly claimClass: ClaimClass;
  readonly confidence: AuditedConfidenceResult;
  readonly observedOutcome?: boolean;
  readonly outcomeSource?: string;
};

export type ConfidenceCalibrationRow = {
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly claimClass: ClaimClass;
  readonly score: number;
  readonly threshold: number;
  readonly passesPublishThreshold: boolean;
  readonly components: AuditedConfidenceResult['components'];
  readonly policyVersion: string;
  readonly engineVersion: string;
  readonly componentVersions: AuditedConfidenceResult['audit']['componentVersions'];
  readonly independentLineageCount: number;
  readonly supportingEvidenceCount: number;
  readonly contradictingEvidenceCount: number;
  readonly inputFingerprints: AuditedConfidenceResult['audit']['inputFingerprints'];
  readonly calculatedAt: string;
  readonly observedOutcome?: boolean;
  readonly outcomeSource?: string;
};

export type ConfidenceCalibrationDataset = {
  readonly schemaVersion: typeof CONFIDENCE_CALIBRATION_DATASET_VERSION;
  readonly exportedAt: string;
  readonly rows: readonly ConfidenceCalibrationRow[];
};

/** Export stable row order so the same cases and timestamp serialize identically. */
export function exportConfidenceCalibrationDataset(input: {
  readonly cases: readonly ConfidenceCalibrationCase[];
  readonly exportedAt: string;
}): ConfidenceCalibrationDataset {
  return {
    schemaVersion: CONFIDENCE_CALIBRATION_DATASET_VERSION,
    exportedAt: input.exportedAt,
    rows: [...input.cases]
      .sort(
        (left, right) =>
          left.claimId.localeCompare(right.claimId) ||
          left.claimVersionId.localeCompare(right.claimVersionId),
      )
      .map(({ claimId, claimVersionId, claimClass, confidence, observedOutcome, outcomeSource }) => ({
        claimId,
        claimVersionId,
        claimClass,
        score: confidence.score,
        threshold: confidence.threshold,
        passesPublishThreshold: confidence.passesPublishThreshold,
        components: confidence.components,
        policyVersion: confidence.policyVersion,
        engineVersion: confidence.audit.engineVersion,
        componentVersions: confidence.audit.componentVersions,
        independentLineageCount: confidence.independentLineageCount,
        supportingEvidenceCount: confidence.supportingEvidenceCount,
        contradictingEvidenceCount: confidence.contradictingEvidenceCount,
        inputFingerprints: confidence.audit.inputFingerprints,
        calculatedAt: confidence.calculatedAt,
        ...(observedOutcome !== undefined ? { observedOutcome } : {}),
        ...(outcomeSource !== undefined ? { outcomeSource } : {}),
      })),
  };
}
