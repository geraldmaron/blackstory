"""Deterministic relevance assessment types (BB-040)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from black_book_research.discovery.types import DiscoverySignal, GeographicHint

RELEVANCE_ASSESSMENT_SCHEMA_VERSION = "relevance-assessment.v1"
RELEVANCE_FIXTURE_SCHEMA_VERSION = "relevance-fixture.v1"

RelevanceDimension = Literal[
    "signal_strength",
    "thematic_alignment",
    "geographic_connection",
    "source_authority",
    "distinctiveness",
]

RelevanceDecision = Literal["include", "exclude", "supporting_context"]

RelevanceGateId = Literal[
    "signal_present",
    "weak_signal_independent",
    "negative_only",
    "threshold",
    "distinctiveness",
    "duplicate",
    "include_evidence",
]

RelevanceEvidenceKind = Literal["signal", "geographic", "thematic", "source", "gate", "override"]


@dataclass(frozen=True, slots=True)
class RelevanceFeatureValue:
    dimension: RelevanceDimension
    value: float
    weight: float
    contribution: float
    rationale: str


@dataclass(frozen=True, slots=True)
class RelevanceGateResult:
    gate_id: RelevanceGateId
    passed: bool
    reason: str


@dataclass(frozen=True, slots=True)
class RelevanceEvidence:
    kind: RelevanceEvidenceKind
    summary: str
    detail: str | None = None


@dataclass(frozen=True, slots=True)
class RelevanceOverride:
    decision: RelevanceDecision
    reason: str
    overridden_by: str
    overridden_at: str


@dataclass(frozen=True, slots=True)
class RelevanceCandidateInput:
    candidate_id: str
    identity_key: str
    classification: str
    signals: DiscoverySignal
    geographic_hints: tuple[GeographicHint, ...]


@dataclass(frozen=True, slots=True)
class RelevanceAssessment:
    schema_version: str
    candidate_id: str
    decision: RelevanceDecision
    composite_score: float
    policy_version: str
    passes: bool
    feature_values: tuple[RelevanceFeatureValue, ...]
    gates: tuple[RelevanceGateResult, ...]
    evidence: tuple[RelevanceEvidence, ...]
    why_this_appears: str
    distinctiveness_key: str
    is_duplicate: bool
    assessed_at: str
    exclusion_reason: str | None = None
    override: RelevanceOverride | None = None


@dataclass(frozen=True, slots=True)
class PublicRelevanceExplanation:
    why_this_appears: str
    decision: RelevanceDecision
