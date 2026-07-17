"""Relevance scoring dimensions and feature-value extraction (BB-040)."""

from __future__ import annotations

from .types import RelevanceCandidateInput, RelevanceDimension, RelevanceFeatureValue

RELEVANCE_DIMENSION_WEIGHTS: dict[RelevanceDimension, float] = {
    "signal_strength": 0.35,
    "thematic_alignment": 0.25,
    "geographic_connection": 0.2,
    "source_authority": 0.15,
    "distinctiveness": 0.05,
}

SIGNAL_STRENGTH_VALUES = {"strong": 1.0, "medium": 0.72, "weak": 0.3}

SOURCE_AUTHORITY_VALUES = {
    "primary_archival": 1.0,
    "government_record": 0.9,
    "peer_reviewed": 0.85,
    "reputable_secondary": 0.7,
    "news_reportage": 0.55,
    "community_oral": 0.5,
    "self_published": 0.3,
    "unknown": 0.4,
}


def _assert_unit_interval(value: float, label: str) -> float:
    if not 0 <= value <= 1:
        raise ValueError(f"{label} must be between 0 and 1")
    return value


def _build_feature(
    dimension: RelevanceDimension,
    value: float,
    rationale: str,
) -> RelevanceFeatureValue:
    weight = RELEVANCE_DIMENSION_WEIGHTS[dimension]
    normalized = _assert_unit_interval(value, dimension)
    return RelevanceFeatureValue(
        dimension=dimension,
        value=normalized,
        weight=weight,
        contribution=normalized * weight,
        rationale=rationale,
    )


def _score_thematic_alignment(candidate: RelevanceCandidateInput) -> RelevanceFeatureValue:
    classes = set(candidate.signals.matched_classes)
    if "positive" in classes and ("historical" in classes or "modern" in classes):
        return _build_feature(
            "thematic_alignment",
            1.0,
            "Positive thematic terms align with historical or modern period context.",
        )
    if "positive" in classes:
        return _build_feature("thematic_alignment", 0.72, "Positive thematic terms matched.")
    if "historical" in classes or "modern" in classes:
        return _build_feature(
            "thematic_alignment",
            0.42,
            "Period terms matched without a positive thematic anchor.",
        )
    if "geographic" in classes and "negative" not in classes:
        return _build_feature("thematic_alignment", 0.35, "Geographic context only.")
    if "negative" in classes:
        return _build_feature("thematic_alignment", 0.1, "Negative or off-scope thematic signal.")
    return _build_feature("thematic_alignment", 0.0, "No thematic alignment detected.")


def _score_geographic_connection(candidate: RelevanceCandidateInput) -> RelevanceFeatureValue:
    hints = candidate.geographic_hints
    if not hints:
        if "geographic" in candidate.signals.matched_classes:
            return _build_feature(
                "geographic_connection",
                0.45,
                "Geographic query term matched without structured place hints.",
            )
        return _build_feature("geographic_connection", 0.0, "No geographic connection detected.")
    best = max(hint.confidence for hint in hints)
    joined = ", ".join(hint.text for hint in hints)
    return _build_feature(
        "geographic_connection",
        best,
        f"Geographic hints include {joined}.",
    )


def _score_source_authority(candidate: RelevanceCandidateInput) -> RelevanceFeatureValue:
    classification = candidate.classification or "unknown"
    value = SOURCE_AUTHORITY_VALUES.get(classification, SOURCE_AUTHORITY_VALUES["unknown"])
    return _build_feature(
        "source_authority",
        value,
        f"Source classified as {classification}.",
    )


def _score_signal_strength(candidate: RelevanceCandidateInput) -> RelevanceFeatureValue:
    value = SIGNAL_STRENGTH_VALUES[candidate.signals.strength]
    return _build_feature(
        "signal_strength",
        value,
        f"Discovery signal strength is {candidate.signals.strength}.",
    )


def score_distinctiveness(is_duplicate: bool) -> RelevanceFeatureValue:
    return _build_feature(
        "distinctiveness",
        0.0 if is_duplicate else 1.0,
        "Candidate duplicates a prior inclusion by content identity."
        if is_duplicate
        else "Candidate is distinct from prior inclusions.",
    )


def extract_relevance_features(
    candidate: RelevanceCandidateInput,
    *,
    is_duplicate: bool,
) -> tuple[RelevanceFeatureValue, ...]:
    return (
        _score_signal_strength(candidate),
        _score_thematic_alignment(candidate),
        _score_geographic_connection(candidate),
        _score_source_authority(candidate),
        score_distinctiveness(is_duplicate),
    )


def compose_composite_score(features: tuple[RelevanceFeatureValue, ...]) -> float:
    total = sum(feature.contribution for feature in features)
    return _assert_unit_interval(round(total, 4), "composite relevance score")
