"""Include / exclude / supporting-context decision logic (BB-040)."""

from __future__ import annotations

from black_book_constitution import evaluate_relevance, load_product_constitution

from .gates import gate_failed
from .types import RelevanceCandidateInput, RelevanceDecision, RelevanceGateResult


def _is_weak_only_signal(candidate: RelevanceCandidateInput) -> bool:
    return (
        candidate.signals.strength == "weak"
        and candidate.signals.outcome == "candidate_only"
    )


def derive_provisional_decision(
    *,
    candidate: RelevanceCandidateInput,
    composite_score: float,
    gates: tuple[RelevanceGateResult, ...],
    policy: dict | None = None,
) -> tuple[RelevanceDecision, str | None]:
    document = policy if policy is not None else load_product_constitution()
    thresholds = document["relevanceThresholds"]

    duplicate_gate = gate_failed(gates, "duplicate")
    if duplicate_gate:
        return "exclude", duplicate_gate.reason

    signal_gate = gate_failed(gates, "signal_present")
    if signal_gate:
        return "exclude", signal_gate.reason

    negative_gate = gate_failed(gates, "negative_only")
    if negative_gate:
        return "exclude", negative_gate.reason

    capped_score = composite_score
    if _is_weak_only_signal(candidate):
        capped_score = min(capped_score, thresholds["weakSignalIndependentCeiling"])

    if capped_score < thresholds["excludeBelow"]:
        failed = next((gate for gate in gates if not gate.passed), None)
        return (
            "exclude",
            failed.reason
            if failed
            else (
                f"Composite score {capped_score:.2f} is below exclusion threshold "
                f"{thresholds['excludeBelow']}."
            ),
        )

    weak_gate = gate_failed(gates, "weak_signal_independent")
    can_include = (
        capped_score >= thresholds["includeMinimum"]
        and candidate.signals.outcome == "promotable"
        and weak_gate is None
    )
    if can_include:
        return "include", None

    if capped_score >= thresholds["supportingContextMinimum"]:
        return "supporting_context", None

    return (
        "exclude",
        f"Composite score {capped_score:.2f} did not reach supporting-context minimum.",
    )


def evaluate_decision_passes(
    composite_score: float,
    decision: RelevanceDecision,
    policy: dict | None = None,
) -> bool:
    return bool(evaluate_relevance(composite_score, decision, policy)["passes"])
