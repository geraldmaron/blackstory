"""Sequential relevance gates (BB-040)."""

from __future__ import annotations

from black_book_constitution import evaluate_relevance, load_product_constitution

from .types import RelevanceCandidateInput, RelevanceEvidence, RelevanceGateResult


def _is_weak_only_signal(candidate: RelevanceCandidateInput) -> bool:
    return (
        candidate.signals.strength == "weak"
        and candidate.signals.outcome == "candidate_only"
    )


def _is_negative_only_signal(candidate: RelevanceCandidateInput) -> bool:
    classes = candidate.signals.matched_classes
    return len(classes) == 1 and classes[0] == "negative"


def _has_corroborating_context(candidate: RelevanceCandidateInput) -> bool:
    classes = set(candidate.signals.matched_classes)
    has_positive = "positive" in classes
    has_period = "historical" in classes or "modern" in classes
    has_strong_geography = any(
        hint.confidence >= 0.7 for hint in candidate.geographic_hints
    ) and bool(classes.intersection({"geographic", "historical", "modern"}))
    return has_positive or (has_period and "geographic" in classes) or has_strong_geography


def run_relevance_gates(
    *,
    candidate: RelevanceCandidateInput,
    composite_score: float,
    is_duplicate: bool,
    has_include_evidence: bool,
    policy: dict | None = None,
) -> tuple[RelevanceGateResult, ...]:
    document = policy if policy is not None else load_product_constitution()
    thresholds = document["relevanceThresholds"]
    gates: list[RelevanceGateResult] = []

    signal_present = len(candidate.signals.matched_terms) > 0
    gates.append(
        RelevanceGateResult(
            gate_id="signal_present",
            passed=signal_present,
            reason=(
                "At least one query-pack term matched."
                if signal_present
                else "No query-pack terms matched — candidate lacks discoverable relevance signals."
            ),
        )
    )

    weak_only = _is_weak_only_signal(candidate)
    corroborated = _has_corroborating_context(candidate)
    weak_gate_passed = (not weak_only) or corroborated
    gates.append(
        RelevanceGateResult(
            gate_id="weak_signal_independent",
            passed=weak_gate_passed,
            reason=(
                "Signal strength is medium or strong."
                if not weak_only
                else (
                    "Weak signal corroborated by additional thematic or geographic context."
                    if corroborated
                    else "Weak signals cannot independently pass relevance without corroboration."
                )
            ),
        )
    )

    negative_only = _is_negative_only_signal(candidate)
    gates.append(
        RelevanceGateResult(
            gate_id="negative_only",
            passed=not negative_only,
            reason=(
                "Negative-only off-scope signal cannot support inclusion."
                if negative_only
                else "Candidate is not negative-only."
            ),
        )
    )

    gates.append(
        RelevanceGateResult(
            gate_id="duplicate",
            passed=not is_duplicate,
            reason=(
                "Candidate duplicates a prior included record."
                if is_duplicate
                else "Candidate is distinct from prior inclusions."
            ),
        )
    )
    gates.append(
        RelevanceGateResult(
            gate_id="distinctiveness",
            passed=not is_duplicate,
            reason=(
                "Distinctiveness check failed due to duplication."
                if is_duplicate
                else "Candidate passes distinctiveness check."
            ),
        )
    )
    gates.append(
        RelevanceGateResult(
            gate_id="include_evidence",
            passed=has_include_evidence,
            reason=(
                "Include decision has supporting relevance evidence."
                if has_include_evidence
                else "Include decision requires documented relevance evidence."
            ),
        )
    )

    threshold_passed = composite_score >= thresholds["supportingContextMinimum"] or (
        composite_score < thresholds["excludeBelow"] and not signal_present
    )
    gates.append(
        RelevanceGateResult(
            gate_id="threshold",
            passed=threshold_passed,
            reason=(
                "Composite score meets minimum threshold band."
                if threshold_passed
                else (
                    f"Composite score {composite_score:.2f} is below supporting-context "
                    f"minimum {thresholds['supportingContextMinimum']}."
                )
            ),
        )
    )
    return tuple(gates)


def gate_failed(gates: tuple[RelevanceGateResult, ...], gate_id: str) -> RelevanceGateResult | None:
    for gate in gates:
        if gate.gate_id == gate_id and not gate.passed:
            return gate
    return None


def build_relevance_evidence(
    candidate: RelevanceCandidateInput,
    gates: tuple[RelevanceGateResult, ...],
) -> tuple[RelevanceEvidence, ...]:
    evidence: list[RelevanceEvidence] = []
    if candidate.signals.matched_terms:
        evidence.append(
            RelevanceEvidence(
                kind="signal",
                summary=f"Matched {candidate.signals.strength} discovery signal.",
                detail=", ".join(candidate.signals.matched_terms),
            )
        )
    if candidate.signals.matched_classes:
        evidence.append(
            RelevanceEvidence(
                kind="thematic",
                summary="Thematic term classes matched.",
                detail=", ".join(candidate.signals.matched_classes),
            )
        )
    if candidate.geographic_hints:
        evidence.append(
            RelevanceEvidence(
                kind="geographic",
                summary="Geographic place connection detected.",
                detail=", ".join(hint.text for hint in candidate.geographic_hints),
            )
        )
    if candidate.classification:
        evidence.append(
            RelevanceEvidence(
                kind="source",
                summary="Source authority considered.",
                detail=candidate.classification,
            )
        )
    for gate in gates:
        if not gate.passed:
            evidence.append(
                RelevanceEvidence(
                    kind="gate",
                    summary=f"Gate {gate.gate_id} failed.",
                    detail=gate.reason,
                )
            )
    return tuple(evidence)


def has_include_evidence(
    candidate: RelevanceCandidateInput,
    evidence: tuple[RelevanceEvidence, ...],
) -> bool:
    if not candidate.signals.matched_terms:
        return False
    has_substantive = candidate.signals.strength != "weak" or any(
        value in candidate.signals.matched_classes for value in ("positive", "historical", "modern")
    )
    has_geographic = any(entry.kind == "geographic" for entry in evidence)
    return has_substantive or has_geographic
