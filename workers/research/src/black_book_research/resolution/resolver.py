"""Deterministic resolution scoring that queues ambiguity and never merges silently."""

from __future__ import annotations

from dataclasses import replace

from .models import (
    DuplicateReviewQueueItem,
    EntityProfile,
    Jurisdiction,
    MatchFactor,
    RankedEntityMatch,
    ResolutionCandidate,
    ResolutionDecision,
    ResolutionResult,
)
from .normalization import name_similarity, normalize_alias, parse_address

PROPOSE_THRESHOLD = 0.86
REVIEW_THRESHOLD = 0.55
AMBIGUITY_MARGIN = 0.12
ORGANIZATION_SUFFIXES = frozenset(
    {
        "association",
        "company",
        "corporation",
        "inc",
        "incorporated",
        "llc",
        "organization",
        "society",
    }
)


def _active(year: int, valid_from: int | None, valid_to: int | None) -> bool:
    return (valid_from is None or year >= valid_from) and (
        valid_to is None or year <= valid_to
    )


def _organization_name(value: str) -> str:
    tokens = normalize_alias(value).split()
    while len(tokens) > 1 and tokens[-1] in ORGANIZATION_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def _score_name(candidate: ResolutionCandidate, entity: EntityProfile) -> MatchFactor:
    dated_names = entity.aliases + entity.school_names
    canonical_names = [entity.display_name]
    canonical_names.extend(
        item.name
        for item in dated_names
        if candidate.year is None
        or _active(candidate.year, item.valid_from, item.valid_to)
    )
    best = 0.0
    pair = (candidate.name, entity.display_name)
    for candidate_name in (candidate.name, *candidate.aliases):
        for canonical_name in canonical_names:
            direct = name_similarity(candidate_name, canonical_name)
            organization = (
                name_similarity(
                    _organization_name(candidate_name),
                    _organization_name(canonical_name),
                )
                if candidate.kind == "organization" or entity.kind == "organization"
                else 0.0
            )
            score = max(direct, organization)
            if score > best:
                best, pair = score, (candidate_name, canonical_name)
    method = "exact normalized" if best == 1 else "fuzzy"
    return MatchFactor(
        "name",
        best * 0.55,
        f'{method} name match "{pair[0]}" ↔ "{pair[1]}" ({best:.3f})',
    )


def _score_kind(candidate: ResolutionCandidate, entity: EntityProfile) -> MatchFactor:
    if candidate.kind is None:
        return MatchFactor("kind", 0.08, "candidate kind unspecified")
    if candidate.kind == entity.kind:
        return MatchFactor("kind", 0.15, f"entity kind matches {candidate.kind}")
    return MatchFactor(
        "kind", -0.35, f"entity kind conflict: {candidate.kind} vs {entity.kind}"
    )


def _score_identifier(
    candidate: ResolutionCandidate, entity: EntityProfile
) -> MatchFactor:
    canonical = {
        (normalize_alias(system), normalize_alias(value))
        for system, value in entity.identifiers
    }
    match = next(
        (
            system
            for system, value in candidate.identifiers
            if (normalize_alias(system), normalize_alias(value)) in canonical
        ),
        None,
    )
    if match:
        return MatchFactor("identifier", 0.1, f"exact identifier match for {match}")
    rationale = (
        "no identifier match"
        if candidate.identifiers
        else "no candidate identifier supplied"
    )
    return MatchFactor("identifier", 0.0, rationale)


def _score_geography(
    candidate: ResolutionCandidate,
    entity: EntityProfile,
    jurisdictions: tuple[Jurisdiction, ...],
) -> MatchFactor:
    parsed = parse_address(candidate.address) if candidate.address else {}
    hints = [
        *candidate.geographic_hints,
        *([parsed["city"]] if "city" in parsed else []),
        *([parsed["state"], f"US-{parsed['state']}"] if "state" in parsed else []),
    ]
    normalized_hints = [
        normalize_alias(hint) for hint in hints if normalize_alias(hint)
    ]
    if not normalized_hints:
        return MatchFactor("geography", 0.05, "no geographic evidence supplied")
    valid_jurisdictions = {
        jurisdiction.id: jurisdiction.name
        for jurisdiction in jurisdictions
        if candidate.year is None
        or _active(candidate.year, jurisdiction.valid_from, jurisdiction.valid_to)
    }
    values: list[str] = []
    for location in entity.locations:
        if candidate.year is not None and not _active(
            candidate.year, location.valid_from, location.valid_to
        ):
            continue
        values.append(normalize_alias(location.label))
        values.extend(
            normalize_alias(valid_jurisdictions[jurisdiction_id])
            for jurisdiction_id in location.jurisdiction_ids
            if jurisdiction_id in valid_jurisdictions
        )
    matches = any(
        hint in value or value in hint
        for hint in normalized_hints
        for value in values
        if value
    )
    return MatchFactor(
        "geography",
        0.12 if matches else -0.08,
        "candidate geography matches a valid entity location or jurisdiction"
        if matches
        else "candidate geography conflicts with known entity locations",
    )


def _score_temporal(
    candidate: ResolutionCandidate, entity: EntityProfile
) -> MatchFactor:
    if candidate.year is None:
        return MatchFactor("temporal", 0.05, "candidate year unspecified")
    if (entity.birth_year is not None and candidate.year < entity.birth_year) or (
        entity.death_year is not None and candidate.year > entity.death_year
    ):
        return MatchFactor(
            "temporal", -0.4, "candidate year falls outside person lifespan"
        )
    valid_locations = [
        location
        for location in entity.locations
        if _active(candidate.year, location.valid_from, location.valid_to)
    ]
    if entity.locations and not valid_locations:
        return MatchFactor(
            "temporal",
            -0.2,
            "no historical/current location is valid in candidate year",
        )
    role = (
        "historical"
        if any(location.role == "historical" for location in valid_locations)
        else "current"
    )
    return MatchFactor(
        "temporal",
        0.08,
        f"{role} evidence is consistent with candidate year {candidate.year}",
    )


def score_entity_match(
    candidate: ResolutionCandidate,
    entity: EntityProfile,
    jurisdictions: tuple[Jurisdiction, ...] = (),
) -> RankedEntityMatch:
    factors = (
        _score_name(candidate, entity),
        _score_kind(candidate, entity),
        _score_identifier(candidate, entity),
        _score_geography(candidate, entity, jurisdictions),
        _score_temporal(candidate, entity),
    )
    confidence = round(max(0.0, min(1.0, sum(factor.score for factor in factors))), 4)
    return RankedEntityMatch(entity.id, confidence, factors)


def resolve_entity_candidate(
    candidate: ResolutionCandidate,
    entities: tuple[EntityProfile, ...],
    jurisdictions: tuple[Jurisdiction, ...] = (),
) -> ResolutionResult:
    ranked = tuple(
        sorted(
            (
                score_entity_match(candidate, entity, jurisdictions)
                for entity in entities
            ),
            key=lambda match: (-match.confidence, match.entity_id),
        )
    )
    if not ranked or ranked[0].confidence < REVIEW_THRESHOLD:
        return ResolutionResult(
            candidate.id,
            "no_match",
            None,
            ranked,
            ("No canonical entity reached the review confidence threshold.",),
        )
    ambiguous = (
        len(ranked) > 1
        and ranked[0].confidence - ranked[1].confidence < AMBIGUITY_MARGIN
    )
    if ranked[0].confidence < PROPOSE_THRESHOLD or ambiguous:
        rationale = (
            "Top matches are within the ambiguity margin; no entity was selected."
            if ambiguous
            else "Best match requires human review; no entity was selected."
        )
        return ResolutionResult(
            candidate.id, "review_required", None, ranked, (rationale,)
        )
    return ResolutionResult(
        candidate.id,
        "proposed_match",
        ranked[0].entity_id,
        ranked,
        tuple(factor.rationale for factor in ranked[0].factors),
    )


def create_duplicate_review_item(
    candidate: ResolutionCandidate,
    result: ResolutionResult,
    created_at: str,
) -> DuplicateReviewQueueItem:
    if result.outcome != "review_required":
        raise ValueError(f"Candidate {candidate.id} is not review-required")
    ambiguous = len(result.ranked_matches) > 1 and (
        result.ranked_matches[0].confidence - result.ranked_matches[1].confidence
        < AMBIGUITY_MARGIN
    )
    return DuplicateReviewQueueItem(
        id=f"resolution-review:{candidate.id}",
        candidate_id=candidate.id,
        candidate_name=candidate.name,
        reason="ambiguous_match" if ambiguous else "low_confidence_match",
        proposed_entity_ids=tuple(
            match.entity_id for match in result.ranked_matches[:3]
        ),
        ranked_matches=result.ranked_matches,
        source_reference_ids=candidate.source_reference_ids,
        created_at=created_at,
    )


def apply_resolution_decision(
    decision: ResolutionDecision, applied_at: str
) -> ResolutionDecision:
    if decision.status != "proposed":
        raise ValueError(f"Resolution decision {decision.id} is not proposed")
    return replace(decision, status="applied", applied_at=applied_at)


def reverse_resolution_decision(
    decision: ResolutionDecision,
    *,
    reversed_at: str,
    reversed_by: str,
    reason: str,
) -> ResolutionDecision:
    if decision.status != "applied":
        raise ValueError(f"Resolution decision {decision.id} is not applied")
    return replace(
        decision,
        status="reversed",
        reversed_at=reversed_at,
        reversed_by=reversed_by,
        reverse_reason=reason,
    )
