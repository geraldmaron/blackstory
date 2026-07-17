"""Immutable contracts for auditable entity and historical-location resolution."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class ResolutionCandidate:
    id: str
    name: str
    source_reference_ids: tuple[str, ...]
    kind: str | None = None
    aliases: tuple[str, ...] = ()
    address: str | None = None
    year: int | None = None
    geographic_hints: tuple[str, ...] = ()
    identifiers: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True, slots=True)
class DatedName:
    name: str
    valid_from: int | None = None
    valid_to: int | None = None


@dataclass(frozen=True, slots=True)
class LocationEvidence:
    role: Literal["historical", "current", "approximate"]
    label: str = ""
    jurisdiction_ids: tuple[str, ...] = ()
    valid_from: int | None = None
    valid_to: int | None = None


@dataclass(frozen=True, slots=True)
class Jurisdiction:
    id: str
    name: str
    valid_from: int | None = None
    valid_to: int | None = None


@dataclass(frozen=True, slots=True)
class EntityProfile:
    id: str
    kind: str
    display_name: str
    aliases: tuple[DatedName, ...] = ()
    school_names: tuple[DatedName, ...] = ()
    identifiers: tuple[tuple[str, str], ...] = ()
    locations: tuple[LocationEvidence, ...] = ()
    birth_year: int | None = None
    death_year: int | None = None


@dataclass(frozen=True, slots=True)
class MatchFactor:
    factor: Literal["name", "kind", "identifier", "geography", "temporal"]
    score: float
    rationale: str


@dataclass(frozen=True, slots=True)
class RankedEntityMatch:
    entity_id: str
    confidence: float
    factors: tuple[MatchFactor, ...]


@dataclass(frozen=True, slots=True)
class ResolutionResult:
    candidate_id: str
    outcome: Literal["proposed_match", "review_required", "no_match"]
    selected_entity_id: str | None
    ranked_matches: tuple[RankedEntityMatch, ...]
    rationale: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DuplicateReviewQueueItem:
    id: str
    candidate_id: str
    candidate_name: str
    reason: Literal["ambiguous_match", "low_confidence_match"]
    proposed_entity_ids: tuple[str, ...]
    ranked_matches: tuple[RankedEntityMatch, ...]
    source_reference_ids: tuple[str, ...]
    created_at: str
    status: Literal["pending"] = "pending"


@dataclass(frozen=True, slots=True)
class ResolutionDecision:
    id: str
    candidate_id: str
    selected_entity_id: str | None
    status: Literal["proposed", "applied", "reversed"]
    confidence: float
    rationale: tuple[str, ...]
    decided_by: str
    decided_at: str
    source_reference_ids: tuple[str, ...]
    applied_at: str | None = None
    reversed_at: str | None = None
    reversed_by: str | None = None
    reverse_reason: str | None = None
