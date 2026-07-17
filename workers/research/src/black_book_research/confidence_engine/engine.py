"""Deterministic Python mirror of the versioned TypeScript confidence engine."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from black_book_constitution import (
    evaluate_claim_confidence,
    evaluate_procedural_language,
    load_product_constitution,
)

from .models import (
    ConfidenceAudit,
    ConfidenceComponents,
    ConfidenceEvidence,
    ConfidenceInputKind,
    ConfidenceResult,
    PublicLanguageEvaluation,
)

CONFIDENCE_ENGINE_VERSION = "confidence-engine.v1"
CONFIDENCE_COMPONENT_VERSION = "confidence-components.v1"
CONFIDENCE_AUDIT_VERSION = "confidence-audit.v1"

COMPONENT_WEIGHTS = {
    "sourceAuthority": 0.25,
    "directness": 0.15,
    "lineageIndependence": 0.15,
    "temporalProximity": 0.1,
    "geographicPrecision": 0.1,
    "entityMatchQuality": 0.1,
    "extractionQuality": 0.15,
}
COMPONENT_VERSIONS = {
    "sourceAuthority": CONFIDENCE_COMPONENT_VERSION,
    "directness": CONFIDENCE_COMPONENT_VERSION,
    "lineageIndependence": CONFIDENCE_COMPONENT_VERSION,
    "temporalProximity": CONFIDENCE_COMPONENT_VERSION,
    "geographicPrecision": CONFIDENCE_COMPONENT_VERSION,
    "entityMatchQuality": CONFIDENCE_COMPONENT_VERSION,
    "extractionQuality": CONFIDENCE_COMPONENT_VERSION,
    "contradictionPenalty": CONFIDENCE_COMPONENT_VERSION,
    "threshold": "constitution-policy.v1",
}
SOURCE_AUTHORITY = {
    "primary_archival": 1.0,
    "government_record": 0.95,
    "peer_reviewed": 0.9,
    "reputable_secondary": 0.75,
    "news_reportage": 0.55,
    "community_oral": 0.5,
    "self_published": 0.3,
    "unknown": 0.2,
}
INPUT_KINDS: tuple[ConfidenceInputKind, ...] = (
    "source",
    "evidence",
    "contradiction",
    "policy",
)
CRIMINAL_PROCEDURAL_STRENGTH = {
    "unknown_procedural": 0,
    "alleged": 1,
    "charged": 2,
    "indicted": 3,
    "arraigned": 3,
    "convicted": 4,
}


def _round4(value: float) -> float:
    return round(value + 0.0, 4)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _assert_unit_interval(value: float, name: str) -> None:
    if not 0 <= value <= 1:
        raise ValueError(f"{name} must be between 0 and 1")


def _fingerprint(value: object) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode()
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


def _ordered(evidence: tuple[ConfidenceEvidence, ...]) -> tuple[ConfidenceEvidence, ...]:
    return tuple(
        sorted(
            evidence,
            key=lambda item: (item.lineage_root_id, item.evidence_id, item.id),
        )
    )


def confidence_input_fingerprints(
    evidence: tuple[ConfidenceEvidence, ...],
    policy: dict[str, Any],
) -> dict[str, str]:
    """Fingerprint source, evidence, contradiction, and policy inputs separately."""
    ordered = _ordered(evidence)
    source_rows = [
        {
            "credible": item.credible,
            "evidenceId": item.evidence_id,
            "lineageRootId": item.lineage_root_id,
            "sourceClassification": item.source_classification,
        }
        for item in ordered
    ]
    evidence_rows = [
        {
            "id": item.id,
            "claimId": item.claim_id,
            "claimVersionId": item.claim_version_id,
            "evidenceId": item.evidence_id,
            "role": item.role,
            "lineageRootId": item.lineage_root_id,
            "credible": item.credible,
            "sourceClassification": item.source_classification,
            "directness": item.directness,
            "temporalProximity": item.temporal_proximity,
            "geographicPrecision": item.geographic_precision,
            "entityMatchQuality": item.entity_match_quality,
            "extractionQuality": item.extraction_quality,
            **(
                {"assertedValue": item.asserted_value}
                if item.asserted_value is not None
                else {}
            ),
        }
        for item in ordered
    ]
    contradiction_rows = [
        {
            "evidenceId": item.evidence_id,
            "lineageRootId": item.lineage_root_id,
            "credible": item.credible,
            **(
                {"assertedValue": item.asserted_value}
                if item.asserted_value is not None
                else {}
            ),
        }
        for item in ordered
        if item.role == "contradicting"
    ]
    return {
        "source": _fingerprint(source_rows),
        "evidence": _fingerprint(evidence_rows),
        "contradiction": _fingerprint(contradiction_rows),
        "policy": _fingerprint(policy),
    }


def _lineage_independence(count: int) -> float:
    if count <= 0:
        return 0.0
    if count == 1:
        return 0.4
    if count == 2:
        return 0.7
    if count == 3:
        return 0.9
    return _clamp(0.9 + min(0.1, (count - 3) * 0.02))


def _quality(item: ConfidenceEvidence) -> float:
    return (
        SOURCE_AUTHORITY.get(item.source_classification, SOURCE_AUTHORITY["unknown"])
        + item.directness
        + item.temporal_proximity
        + item.geographic_precision
        + item.entity_match_quality
        + item.extraction_quality
    ) / 6


def _unique_lineages(
    evidence: tuple[ConfidenceEvidence, ...],
    role: str,
    *,
    block_syndicated: bool,
) -> tuple[ConfidenceEvidence, ...]:
    by_root: dict[str, ConfidenceEvidence] = {}
    for item in _ordered(evidence):
        if item.role != role or not item.credible:
            continue
        key = (
            item.lineage_root_id
            if block_syndicated
            else f"{item.lineage_root_id}::{item.evidence_id}"
        )
        current = by_root.get(key)
        if current is None or _quality(item) > _quality(current):
            by_root[key] = item
    return tuple(sorted(by_root.values(), key=lambda item: item.lineage_root_id))


def _mean(values: tuple[float, ...]) -> float:
    return sum(values) / len(values) if values else 0.0


def recalculate_confidence(
    *,
    claim_class: str,
    evidence: tuple[ConfidenceEvidence, ...],
    calculated_at: str,
    policy: dict[str, Any] | None = None,
    previous: ConfidenceResult | None = None,
) -> ConfidenceResult:
    """Recalculate a score and record which audited input classes changed."""
    if claim_class not in {"standard", "high_impact"}:
        raise ValueError(f"Unknown claim class: {claim_class}")
    for item in evidence:
        for name in (
            "directness",
            "temporal_proximity",
            "geographic_precision",
            "entity_match_quality",
            "extraction_quality",
        ):
            _assert_unit_interval(getattr(item, name), name)

    document = policy if policy is not None else load_product_constitution()
    block_syndicated = bool(
        document["publicationRestrictions"]["blockSyndicatedCopiesAsIndependent"]
    )
    supporting = _unique_lineages(
        evidence, "supporting", block_syndicated=block_syndicated
    )
    contradicting = _unique_lineages(
        evidence, "contradicting", block_syndicated=block_syndicated
    )
    components = ConfidenceComponents(
        source_authority=_round4(
            _mean(
                tuple(
                    SOURCE_AUTHORITY.get(
                        item.source_classification, SOURCE_AUTHORITY["unknown"]
                    )
                    for item in supporting
                )
            )
        ),
        directness=_round4(_mean(tuple(item.directness for item in supporting))),
        lineage_independence=_round4(_lineage_independence(len(supporting))),
        temporal_proximity=_round4(
            _mean(tuple(item.temporal_proximity for item in supporting))
        ),
        geographic_precision=_round4(
            _mean(tuple(item.geographic_precision for item in supporting))
        ),
        entity_match_quality=_round4(
            _mean(tuple(item.entity_match_quality for item in supporting))
        ),
        extraction_quality=_round4(
            _mean(tuple(item.extraction_quality for item in supporting))
        ),
        contradiction_penalty=_round4(min(0.45, len(contradicting) * 0.12)),
    )
    weighted = (
        components.source_authority * COMPONENT_WEIGHTS["sourceAuthority"]
        + components.directness * COMPONENT_WEIGHTS["directness"]
        + components.lineage_independence
        * COMPONENT_WEIGHTS["lineageIndependence"]
        + components.temporal_proximity * COMPONENT_WEIGHTS["temporalProximity"]
        + components.geographic_precision * COMPONENT_WEIGHTS["geographicPrecision"]
        + components.entity_match_quality * COMPONENT_WEIGHTS["entityMatchQuality"]
        + components.extraction_quality * COMPONENT_WEIGHTS["extractionQuality"]
    )
    score = _round4(_clamp(weighted - components.contradiction_penalty))
    threshold = evaluate_claim_confidence(score, claim_class, document)
    fingerprints = confidence_input_fingerprints(evidence, document)
    previous_fingerprints = (
        previous.audit.input_fingerprints if previous is not None else None
    )
    reasons = tuple(
        kind
        for kind in INPUT_KINDS
        if previous_fingerprints is None
        or fingerprints[kind] != previous_fingerprints[kind]
    )

    return ConfidenceResult(
        score=score,
        components=components,
        policy_version=str(threshold["policyVersion"]),
        independent_lineage_count=len(supporting),
        supporting_evidence_count=sum(item.role == "supporting" for item in evidence),
        contradicting_evidence_count=sum(
            item.role == "contradicting" for item in evidence
        ),
        contributing_evidence_ids=tuple(item.evidence_id for item in supporting),
        calculated_at=calculated_at,
        passes_publish_threshold=bool(threshold["passesPublishThreshold"]),
        threshold=float(threshold["threshold"]),
        claim_class=claim_class,  # type: ignore[arg-type]
        audit=ConfidenceAudit(
            audit_version=CONFIDENCE_AUDIT_VERSION,
            engine_version=CONFIDENCE_ENGINE_VERSION,
            component_versions=dict(COMPONENT_VERSIONS),
            component_weights=dict(COMPONENT_WEIGHTS),
            input_fingerprints=fingerprints,
            recalculation_reasons=reasons,
        ),
    )


def evaluate_public_language(
    *,
    text: str,
    requested_procedural_status: str,
    evidence_procedural_status: str,
    policy: dict[str, Any] | None = None,
) -> PublicLanguageEvaluation:
    """Cap public wording at the exact procedural status supported by evidence."""
    document = policy if policy is not None else load_product_constitution()
    evaluated = evaluate_procedural_language(
        text, evidence_procedural_status, document
    )
    enforce_cap = bool(
        document["publicationRestrictions"][
            "publicLanguageCannotExceedProceduralStatus"
        ]
    )
    requested_strength = CRIMINAL_PROCEDURAL_STRENGTH.get(
        requested_procedural_status
    )
    evidence_strength = CRIMINAL_PROCEDURAL_STRENGTH.get(
        evidence_procedural_status
    )
    status_supported = (
        requested_procedural_status == evidence_procedural_status
        or requested_procedural_status == "unknown_procedural"
        or (
            requested_strength is not None
            and evidence_strength is not None
            and requested_strength <= evidence_strength
        )
    )
    violations = tuple(str(value) for value in evaluated["violations"]) + (
        ("procedural_status_exceeds_evidence",)
        if enforce_cap and not status_supported
        else ()
    )
    return PublicLanguageEvaluation(
        allowed=bool(evaluated["supported"])
        and (not enforce_cap or status_supported),
        requested_procedural_status=requested_procedural_status,
        evidence_procedural_status=evidence_procedural_status,
        effective_procedural_status=evidence_procedural_status,
        procedural_status_recognized=bool(
            evaluated["proceduralStatusRecognized"]
        ),
        violations=violations,
        policy_version=str(evaluated["policyVersion"]),
    )
