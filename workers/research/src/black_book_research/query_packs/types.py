"""Versioned historical query pack types (BB-038)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

QUERY_PACK_SCHEMA_VERSION = "query-pack.v1"

TermClass = Literal[
    "positive",
    "negative",
    "historical",
    "modern",
    "geographic",
    "alias",
    "source_specific",
]
SignalStrength = Literal["strong", "medium", "weak"]
MatchOutcome = Literal["promotable", "candidate_only"]
QueryPackTheme = Literal[
    "civil_rights",
    "education_segregation",
    "archival_person",
    "historical_place",
    "institutional_records",
    "legal_case",
]
EntityKind = Literal[
    "person",
    "place",
    "school",
    "organization",
    "institution",
    "event",
    "law",
    "case",
    "publication",
    "artifact",
    "other",
]


@dataclass(frozen=True, slots=True)
class QueryTerm:
    text: str
    term_class: TermClass
    research_only_offensive: bool = False
    source_id: str | None = None
    weight: float | None = None


@dataclass(frozen=True, slots=True)
class QueryPackVersion:
    semver: str
    content_hash: str


@dataclass(frozen=True, slots=True)
class QueryPack:
    schema_version: Literal["query-pack.v1"]
    id: str
    display_name: str
    entity_kind: EntityKind
    theme: QueryPackTheme
    version: QueryPackVersion
    version_id: str
    terms: tuple[QueryTerm, ...]
    created_at: str
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class PublicSafeTerm:
    text: str
    term_class: TermClass
    redacted: bool
    redaction_reason: str | None = None


@dataclass(frozen=True, slots=True)
class DiscoveryRunContext:
    run_id: str
    adapter_id: str
    started_at: str
    entity_kind: EntityKind | None = None
    theme: QueryPackTheme | None = None


@dataclass(frozen=True, slots=True)
class StampedDiscoveryRun(DiscoveryRunContext):
    query_pack_id: str = ""
    query_pack_version_id: str = ""
    query_pack_semver: str = ""
    query_pack_content_hash: str = ""
    stamped_at: str = ""


@dataclass(frozen=True, slots=True)
class QueryPackEffectivenessRecord:
    pack_id: str
    version_id: str
    run_id: str
    recorded_at: str
    queries_executed: int
    matches_observed: int
    exclusions_observed: int
    false_positive_observed: int


@dataclass(frozen=True, slots=True)
class QueryPackEffectivenessMetrics:
    pack_id: str
    version_id: str
    record_count: int
    total_queries: int
    total_matches: int
    total_exclusions: int
    total_false_positives: int
    match_rate: float
    exclusion_rate: float
    false_positive_rate: float
    effectiveness_score: float


@dataclass(frozen=True, slots=True)
class ClassifySignalResult:
    strength: SignalStrength
    outcome: MatchOutcome
    matched_classes: tuple[TermClass, ...]
    reasons: tuple[str, ...]
