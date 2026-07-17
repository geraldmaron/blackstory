"""Distinctiveness and duplication checks (BB-040)."""

from __future__ import annotations

from .types import RelevanceAssessment, RelevanceCandidateInput


def compute_distinctiveness_key(candidate: RelevanceCandidateInput) -> str:
    return candidate.identity_key


def detect_duplicate_candidate(
    candidate: RelevanceCandidateInput,
    existing_assessments: tuple[RelevanceAssessment, ...],
) -> bool:
    key = compute_distinctiveness_key(candidate)
    return any(
        prior.decision == "include"
        and prior.candidate_id != candidate.candidate_id
        and prior.distinctiveness_key == key
        for prior in existing_assessments
    )
