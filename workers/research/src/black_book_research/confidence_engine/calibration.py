"""Schema-compatible calibration dataset export for confidence assessments."""

from __future__ import annotations

from dataclasses import dataclass

from .models import ConfidenceResult

CONFIDENCE_CALIBRATION_DATASET_VERSION = "confidence-calibration-dataset.v1"


@dataclass(frozen=True, slots=True)
class ConfidenceCalibrationCase:
    claim_id: str
    claim_version_id: str
    claim_class: str
    confidence: ConfidenceResult
    observed_outcome: bool | None = None
    outcome_source: str | None = None


def _components(result: ConfidenceResult) -> dict[str, float]:
    value = result.components
    return {
        "sourceAuthority": value.source_authority,
        "directness": value.directness,
        "lineageIndependence": value.lineage_independence,
        "temporalProximity": value.temporal_proximity,
        "geographicPrecision": value.geographic_precision,
        "entityMatchQuality": value.entity_match_quality,
        "extractionQuality": value.extraction_quality,
        "contradictionPenalty": value.contradiction_penalty,
    }


def export_confidence_calibration_dataset(
    cases: tuple[ConfidenceCalibrationCase, ...],
    *,
    exported_at: str,
) -> dict[str, object]:
    """Export deterministic camel-case rows accepted by the shared JSON Schema."""
    rows: list[dict[str, object]] = []
    for case in sorted(
        cases, key=lambda value: (value.claim_id, value.claim_version_id)
    ):
        result = case.confidence
        row: dict[str, object] = {
            "claimId": case.claim_id,
            "claimVersionId": case.claim_version_id,
            "claimClass": case.claim_class,
            "score": result.score,
            "threshold": result.threshold,
            "passesPublishThreshold": result.passes_publish_threshold,
            "components": _components(result),
            "policyVersion": result.policy_version,
            "engineVersion": result.audit.engine_version,
            "componentVersions": result.audit.component_versions,
            "independentLineageCount": result.independent_lineage_count,
            "supportingEvidenceCount": result.supporting_evidence_count,
            "contradictingEvidenceCount": result.contradicting_evidence_count,
            "inputFingerprints": result.audit.input_fingerprints,
            "calculatedAt": result.calculated_at,
        }
        if case.observed_outcome is not None:
            row["observedOutcome"] = case.observed_outcome
        if case.outcome_source is not None:
            row["outcomeSource"] = case.outcome_source
        rows.append(row)
    return {
        "schemaVersion": CONFIDENCE_CALIBRATION_DATASET_VERSION,
        "exportedAt": exported_at,
        "rows": rows,
    }
