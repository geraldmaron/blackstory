"""Deterministic relevance engine (BB-040)."""

from __future__ import annotations

from .decisions import derive_provisional_decision, evaluate_decision_passes
from .dimensions import (
    RELEVANCE_DIMENSION_WEIGHTS,
    compose_composite_score,
    extract_relevance_features,
    score_distinctiveness,
)
from .distinctiveness import compute_distinctiveness_key, detect_duplicate_candidate
from .engine import evaluate_candidate_relevance, evaluate_candidate_relevance_batch
from .gates import build_relevance_evidence, gate_failed, has_include_evidence, run_relevance_gates
from .override import assert_override_reason_present, validate_relevance_override
from .public import assert_public_relevance_has_no_score, to_public_relevance_explanation
from .types import (
    RELEVANCE_ASSESSMENT_SCHEMA_VERSION,
    RELEVANCE_FIXTURE_SCHEMA_VERSION,
    PublicRelevanceExplanation,
    RelevanceAssessment,
    RelevanceCandidateInput,
    RelevanceOverride,
)
from .why import assert_explanation_has_no_numeric_score, build_why_this_appears

__all__ = [
    "RELEVANCE_ASSESSMENT_SCHEMA_VERSION",
    "RELEVANCE_DIMENSION_WEIGHTS",
    "RELEVANCE_FIXTURE_SCHEMA_VERSION",
    "PublicRelevanceExplanation",
    "RelevanceAssessment",
    "RelevanceCandidateInput",
    "RelevanceOverride",
    "assert_explanation_has_no_numeric_score",
    "assert_override_reason_present",
    "assert_public_relevance_has_no_score",
    "build_relevance_evidence",
    "build_why_this_appears",
    "compose_composite_score",
    "compute_distinctiveness_key",
    "derive_provisional_decision",
    "detect_duplicate_candidate",
    "evaluate_candidate_relevance",
    "evaluate_candidate_relevance_batch",
    "evaluate_decision_passes",
    "extract_relevance_features",
    "gate_failed",
    "has_include_evidence",
    "run_relevance_gates",
    "score_distinctiveness",
    "to_public_relevance_explanation",
    "validate_relevance_override",
]
