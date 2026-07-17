"""Public relevance projection without numeric scores (BB-040)."""

from __future__ import annotations

import json
from dataclasses import asdict

from .types import PublicRelevanceExplanation, RelevanceAssessment
from .why import assert_explanation_has_no_numeric_score


def to_public_relevance_explanation(assessment: RelevanceAssessment) -> PublicRelevanceExplanation:
    assert_explanation_has_no_numeric_score(assessment.why_this_appears)
    return PublicRelevanceExplanation(
        why_this_appears=assessment.why_this_appears,
        decision=assessment.decision,
    )


def assert_public_relevance_has_no_score(
    public_explanation: PublicRelevanceExplanation,
    assessment: RelevanceAssessment,
) -> None:
    serialized = json.dumps(asdict(public_explanation))
    if str(assessment.composite_score) in serialized:
        raise ValueError("Public relevance projection must not expose composite score.")
    assert_explanation_has_no_numeric_score(public_explanation.why_this_appears)
