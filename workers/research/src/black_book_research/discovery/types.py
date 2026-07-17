"""Discovery pipeline types (BB-039)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DISCOVERY_CANDIDATE_SCHEMA_VERSION = "discovery-candidate.v1"

DiscoveryCandidateStatus = Literal["pending", "accepted", "quarantined", "dead_letter", "merged"]
DiscoveryFailureOutcome = Literal["retry", "quarantine", "dead_letter"]
DiscoveryIngestMode = Literal["bulk", "api"]


@dataclass(frozen=True, slots=True)
class SourceReference:
    source_id: str
    adapter_id: str
    parser_version: str
    registry_entry_id: str
    run_id: str
    captured_at: str
    stable_identifier: str
    source_item_id: str | None = None


@dataclass(frozen=True, slots=True)
class ContentHash:
    algorithm: Literal["sha256"]
    digest: str


@dataclass(frozen=True, slots=True)
class DiscoveryCandidateIdentity:
    identity_key: str
    stable_identifier: str
    content_hash: ContentHash
    source_references: tuple[SourceReference, ...]


@dataclass(frozen=True, slots=True)
class GeographicHint:
    text: str
    kind: Literal["state", "city", "region", "country", "unknown"]
    confidence: float


@dataclass(frozen=True, slots=True)
class DiscoverySignal:
    strength: Literal["strong", "medium", "weak"]
    outcome: Literal["promotable", "candidate_only"]
    matched_classes: tuple[str, ...]
    matched_terms: tuple[str, ...]
    reasons: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DiscoveryCampaignBudget:
    max_candidates: int
    max_quarantined: int
    max_dead_letter: int
    max_retries_per_candidate: int


@dataclass(frozen=True, slots=True)
class DiscoveryCampaignBoundaries:
    countries: tuple[str, ...]
    entity_kind: str | None = None
    theme: str | None = None
    adapter_ids: tuple[str, ...] | None = None


@dataclass(frozen=True, slots=True)
class DiscoveryCampaignConfig:
    campaign_id: str
    budget: DiscoveryCampaignBudget
    boundaries: DiscoveryCampaignBoundaries
    continue_on_quarantine: bool = True


@dataclass(frozen=True, slots=True)
class DiscoveryReproducibilityStamp:
    source_parser_versions: tuple[str, ...]
    query_pack_version_id: str
    query_pack_content_hash: str
    fingerprint: str
