"""Deterministic relevance engine orchestration (BB-040)."""

from __future__ import annotations

from black_book_constitution import evaluate_relevance, load_product_constitution

from .decisions import derive_provisional_decision
from .dimensions import compose_composite_score, extract_relevance_features
from .distinctiveness import compute_distinctiveness_key, detect_duplicate_candidate
from .gates import build_relevance_evidence, has_include_evidence, run_relevance_gates
from .override import validate_relevance_override
from .types import (
    RELEVANCE_ASSESSMENT_SCHEMA_VERSION,
    RelevanceAssessment,
    RelevanceCandidateInput,
    RelevanceEvidence,
    RelevanceGateResult,
    RelevanceOverride,
)
from .why import build_why_this_appears


def _finalize_include_evidence_gate(
    decision: str,
    candidate: RelevanceCandidateInput,
    evidence: tuple[RelevanceEvidence, ...],
    gates: tuple[RelevanceGateResult, ...],
) -> tuple[str, tuple[RelevanceGateResult, ...], str | None]:
    if decision != "include":
        return decision, gates, None

    include_evidence = has_include_evidence(candidate, evidence)
    include_gate = RelevanceGateResult(
        gate_id="include_evidence",
        passed=include_evidence,
        reason=(
            "Include decision has supporting relevance evidence."
            if include_evidence
            else "Include decision requires documented relevance evidence."
        ),
    )
    next_gates = tuple(
        gate for gate in gates if gate.gate_id != "include_evidence"
    ) + (include_gate,)
    if include_evidence:
        return decision, next_gates, None
    return "supporting_context", next_gates, include_gate.reason


def evaluate_candidate_relevance(
    candidate: RelevanceCandidateInput,
    *,
    existing_assessments: tuple[RelevanceAssessment, ...] = (),
    override: RelevanceOverride | None = None,
    assessed_at: str | None = None,
    policy: dict | None = None,
) -> RelevanceAssessment:
    document = policy if policy is not None else load_product_constitution()
    timestamp = assessed_at or "1970-01-01T00:00:00.000Z"
    validated_override = (
        validate_relevance_override(
            decision=override.decision,
            reason=override.reason,
            overridden_by=override.overridden_by,
            overridden_at=override.overridden_at,
        )
        if override is not None
        else None
    )

    is_duplicate = detect_duplicate_candidate(candidate, existing_assessments)
    feature_values = extract_relevance_features(candidate, is_duplicate=is_duplicate)
    composite_score = compose_composite_score(feature_values)

    preliminary_evidence = build_relevance_evidence(candidate, ())
    preliminary_include_evidence = has_include_evidence(candidate, preliminary_evidence)

    gates = run_relevance_gates(
        candidate=candidate,
        composite_score=composite_score,
        is_duplicate=is_duplicate,
        has_include_evidence=preliminary_include_evidence,
        policy=document,
    )

    decision, exclusion_reason = derive_provisional_decision(
        candidate=candidate,
        composite_score=composite_score,
        gates=gates,
        policy=document,
    )

    decision, gates, include_reason = _finalize_include_evidence_gate(
        decision,
        candidate,
        preliminary_evidence,
        gates,
    )
    exclusion_reason = include_reason or exclusion_reason

    if validated_override is not None:
        decision = validated_override.decision
        exclusion_reason = validated_override.reason if decision == "exclude" else None

    evidence = list(build_relevance_evidence(candidate, gates))
    if validated_override is not None:
        evidence.append(
            RelevanceEvidence(
                kind="override",
                summary="Manual relevance override applied.",
                detail=validated_override.reason,
            )
        )

    why_this_appears = build_why_this_appears(
        candidate=candidate,
        decision=decision,  # type: ignore[arg-type]
        evidence=tuple(evidence),
        exclusion_reason=exclusion_reason,
        override=validated_override,
    )

    evaluated = evaluate_relevance(composite_score, decision, document)
    return RelevanceAssessment(
        schema_version=RELEVANCE_ASSESSMENT_SCHEMA_VERSION,
        candidate_id=candidate.candidate_id,
        decision=decision,  # type: ignore[arg-type]
        composite_score=composite_score,
        policy_version=str(evaluated["policyVersion"]),
        passes=bool(evaluated["passes"]),
        feature_values=feature_values,
        gates=gates,
        evidence=tuple(evidence),
        why_this_appears=why_this_appears,
        distinctiveness_key=compute_distinctiveness_key(candidate),
        is_duplicate=is_duplicate,
        assessed_at=timestamp,
        exclusion_reason=exclusion_reason,
        override=validated_override,
    )


def evaluate_candidate_relevance_batch(
    candidates: tuple[RelevanceCandidateInput, ...],
    *,
    assessed_at: str | None = None,
    policy: dict | None = None,
) -> tuple[RelevanceAssessment, ...]:
    assessments: list[RelevanceAssessment] = []
    for candidate in candidates:
        assessments.append(
            evaluate_candidate_relevance(
                candidate,
                existing_assessments=tuple(assessments),
                assessed_at=assessed_at,
                policy=policy,
            )
        )
    return tuple(assessments)
