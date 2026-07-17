"""Immutable contracts for the deterministic confidence-engine mirror."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ClaimClass = Literal["standard", "high_impact"]
EvidenceRole = Literal["supporting", "contradicting", "contextual"]
ConfidenceInputKind = Literal["source", "evidence", "contradiction", "policy"]


@dataclass(frozen=True, slots=True)
class ConfidenceEvidence:
    id: str
    claim_id: str
    claim_version_id: str
    evidence_id: str
    role: EvidenceRole
    lineage_root_id: str
    credible: bool
    source_classification: str
    directness: float
    temporal_proximity: float
    geographic_precision: float
    entity_match_quality: float
    extraction_quality: float
    asserted_value: str | None = None


@dataclass(frozen=True, slots=True)
class ConfidenceComponents:
    source_authority: float
    directness: float
    lineage_independence: float
    temporal_proximity: float
    geographic_precision: float
    entity_match_quality: float
    extraction_quality: float
    contradiction_penalty: float


@dataclass(frozen=True, slots=True)
class ConfidenceAudit:
    audit_version: str
    engine_version: str
    component_versions: dict[str, str]
    component_weights: dict[str, float]
    input_fingerprints: dict[str, str]
    recalculation_reasons: tuple[ConfidenceInputKind, ...]


@dataclass(frozen=True, slots=True)
class ConfidenceResult:
    score: float
    components: ConfidenceComponents
    policy_version: str
    independent_lineage_count: int
    supporting_evidence_count: int
    contradicting_evidence_count: int
    contributing_evidence_ids: tuple[str, ...]
    calculated_at: str
    passes_publish_threshold: bool
    threshold: float
    claim_class: ClaimClass
    audit: ConfidenceAudit


@dataclass(frozen=True, slots=True)
class PublicLanguageEvaluation:
    allowed: bool
    requested_procedural_status: str
    evidence_procedural_status: str
    effective_procedural_status: str
    procedural_status_recognized: bool
    violations: tuple[str, ...]
    policy_version: str
