"""Discovery campaign pipeline orchestration (BB-039)."""

from __future__ import annotations

from dataclasses import dataclass

from black_book_research.adapters.types import AdapterCandidateRecord
from black_book_research.query_packs.discovery import assert_discovery_run_stamped, stamp_discovery_run
from black_book_research.query_packs.types import DiscoveryRunContext, QueryPack

from .campaign import record_within_campaign_boundaries
from .deduplication import merge_duplicate_identities
from .hashing import stamp_discovery_reproducibility
from .identity import build_candidate_identity
from .ingestion import ingest_bulk_candidates
from .quarantine import should_continue_campaign
from .types import DiscoveryCampaignConfig


@dataclass(frozen=True, slots=True)
class DiscoveryCampaignResult:
    campaign_id: str
    fingerprint: str
    accepted_count: int
    quarantined_count: int
    candidate_count: int
    merged_reference_count: int


def run_discovery_campaign(
    *,
    config: DiscoveryCampaignConfig,
    records: tuple[AdapterCandidateRecord, ...],
    pack: QueryPack,
    run_context: DiscoveryRunContext,
    stamped_at: str,
) -> DiscoveryCampaignResult:
    stamped_run = stamp_discovery_run(run_context, pack, stamped_at)
    assert_discovery_run_stamped(stamped_run)

    parser_versions = tuple({record.provenance.parser_version for record in records})
    reproducibility = stamp_discovery_reproducibility(stamped_run, parser_versions)

    ingested = ingest_bulk_candidates(records, pack)
    accepted = 0
    quarantined = 0
    identities = [build_candidate_identity(record) for record in records]

    merged_reference_count = 0
    if len(identities) >= 2:
        merged = merge_duplicate_identities(identities[0], identities[1])
        merged_reference_count = len(merged.source_references)

    for record in records:
        if not record_within_campaign_boundaries(record, config.boundaries):
            quarantined += 1
            if not should_continue_campaign(
                continue_on_quarantine=config.continue_on_quarantine,
                quarantined_count=quarantined,
                max_quarantined=config.budget.max_quarantined,
            ):
                break
            continue
        accepted += 1
        if accepted >= config.budget.max_candidates:
            break

    return DiscoveryCampaignResult(
        campaign_id=config.campaign_id,
        fingerprint=reproducibility.fingerprint,
        accepted_count=accepted,
        quarantined_count=quarantined,
        candidate_count=len(ingested),
        merged_reference_count=merged_reference_count,
    )
