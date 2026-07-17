"""Signal-strength classification for query-pack matches (BB-038)."""

from __future__ import annotations

from .types import ClassifySignalResult, MatchOutcome, QueryTerm, SignalStrength, TermClass

STRONG_CLASSES: frozenset[TermClass] = frozenset({"positive", "historical", "modern"})
SUPPORTING_CLASSES: frozenset[TermClass] = frozenset({"geographic", "alias", "source_specific"})
WEAK_ONLY_CLASSES: frozenset[TermClass] = frozenset({"negative", "alias", "geographic"})


def _unique_classes(terms: tuple[QueryTerm, ...]) -> tuple[TermClass, ...]:
    seen: list[TermClass] = []
    for term in terms:
        if term.term_class not in seen:
            seen.append(term.term_class)
    return tuple(seen)


def classify_signal_strength(*, matched_terms: tuple[QueryTerm, ...]) -> ClassifySignalResult:
    matched_classes = _unique_classes(matched_terms)
    reasons: list[str] = []

    if not matched_terms:
        return ClassifySignalResult(
            strength="weak",
            outcome="candidate_only",
            matched_classes=matched_classes,
            reasons=("no_terms_matched",),
        )

    has_positive = "positive" in matched_classes
    has_historical_or_modern = "historical" in matched_classes or "modern" in matched_classes
    has_geographic = "geographic" in matched_classes
    has_alias = "alias" in matched_classes
    has_source_specific = "source_specific" in matched_classes
    has_negative = "negative" in matched_classes

    if has_positive and has_historical_or_modern:
        reasons.append("positive_with_period_term")
        return ClassifySignalResult("strong", "promotable", matched_classes, tuple(reasons))

    if has_positive and has_geographic:
        reasons.append("positive_with_geographic")
        return ClassifySignalResult("strong", "promotable", matched_classes, tuple(reasons))

    if has_positive and (has_alias or has_source_specific):
        reasons.append("positive_with_alias_or_source")
        return ClassifySignalResult("medium", "promotable", matched_classes, tuple(reasons))

    if has_positive:
        reasons.append("positive_only")
        return ClassifySignalResult("medium", "promotable", matched_classes, tuple(reasons))

    if has_historical_or_modern and not has_positive:
        reasons.append("period_term_without_positive")
        return ClassifySignalResult("weak", "candidate_only", matched_classes, tuple(reasons))

    if has_negative and len(matched_classes) == 1:
        reasons.append("negative_only")
        return ClassifySignalResult("weak", "candidate_only", matched_classes, tuple(reasons))

    if has_alias and all(value in WEAK_ONLY_CLASSES for value in matched_classes):
        reasons.append("alias_without_positive")
        return ClassifySignalResult("weak", "candidate_only", matched_classes, tuple(reasons))

    if has_geographic and not any(value in STRONG_CLASSES for value in matched_classes):
        reasons.append("geographic_without_positive")
        return ClassifySignalResult("weak", "candidate_only", matched_classes, tuple(reasons))

    if has_source_specific and any(value in SUPPORTING_CLASSES for value in matched_classes) and not has_positive:
        reasons.append("source_specific_without_positive")
        return ClassifySignalResult("weak", "candidate_only", matched_classes, tuple(reasons))

    reasons.append("residual_medium")
    return ClassifySignalResult("medium", "promotable", matched_classes, tuple(reasons))


def outcome_for_signal_strength(strength: SignalStrength) -> MatchOutcome:
    return "candidate_only" if strength == "weak" else "promotable"


def assert_may_promote_beyond_candidate(result: ClassifySignalResult) -> None:
    if result.outcome == "candidate_only":
        joined = ", ".join(result.reasons)
        raise ValueError(f"Weak signal ({result.strength}) produces candidates only: {joined}")


def may_promote_beyond_candidate(result: ClassifySignalResult) -> bool:
    return result.outcome == "promotable"
