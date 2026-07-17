"""Candidate discovery pipeline (BB-039)."""

from __future__ import annotations

from .campaign import assert_campaign_budget_valid, record_within_campaign_boundaries
from .deduplication import merge_duplicate_identities
from .guard import FORBIDDEN_DISCOVERY_OPERATIONS, assert_discovery_cannot_publish
from .hashing import hash_candidate_content, stamp_discovery_reproducibility
from .identity import build_candidate_identity, build_source_reference, candidate_identity_key
from .ingestion import ingest_api_candidate, ingest_bulk_candidates
from .pipeline import run_discovery_campaign
from .types import (
    DISCOVERY_CANDIDATE_SCHEMA_VERSION,
    DiscoveryCampaignBoundaries,
    DiscoveryCampaignBudget,
    DiscoveryCampaignConfig,
    DiscoveryReproducibilityStamp,
)

__all__ = [
    "DISCOVERY_CANDIDATE_SCHEMA_VERSION",
    "FORBIDDEN_DISCOVERY_OPERATIONS",
    "DiscoveryCampaignBoundaries",
    "DiscoveryCampaignBudget",
    "DiscoveryCampaignConfig",
    "DiscoveryReproducibilityStamp",
    "assert_campaign_budget_valid",
    "assert_discovery_cannot_publish",
    "build_candidate_identity",
    "build_source_reference",
    "candidate_identity_key",
    "hash_candidate_content",
    "ingest_api_candidate",
    "ingest_bulk_candidates",
    "merge_duplicate_identities",
    "record_within_campaign_boundaries",
    "run_discovery_campaign",
    "stamp_discovery_reproducibility",
]
