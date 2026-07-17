"""Public surface for deterministic entity and historical-location resolution."""

from .models import (
    DatedName,
    DuplicateReviewQueueItem,
    EntityProfile,
    Jurisdiction,
    LocationEvidence,
    MatchFactor,
    RankedEntityMatch,
    ResolutionCandidate,
    ResolutionDecision,
    ResolutionResult,
)
from .normalization import name_similarity, normalize_alias, parse_address
from .resolver import (
    apply_resolution_decision,
    create_duplicate_review_item,
    resolve_entity_candidate,
    reverse_resolution_decision,
    score_entity_match,
)

__all__ = [
    "DatedName",
    "DuplicateReviewQueueItem",
    "EntityProfile",
    "Jurisdiction",
    "LocationEvidence",
    "MatchFactor",
    "RankedEntityMatch",
    "ResolutionCandidate",
    "ResolutionDecision",
    "ResolutionResult",
    "apply_resolution_decision",
    "create_duplicate_review_item",
    "name_similarity",
    "normalize_alias",
    "parse_address",
    "resolve_entity_candidate",
    "reverse_resolution_decision",
    "score_entity_match",
]
