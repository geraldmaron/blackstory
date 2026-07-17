"""Discovery campaign boundaries and budget enforcement (BB-039)."""

from __future__ import annotations

from black_book_research.adapters.types import AdapterCandidateRecord

from .geography import extract_geographic_hints, geographic_hint_within_countries
from .types import DiscoveryCampaignBoundaries, DiscoveryCampaignBudget


def assert_campaign_budget_valid(budget: DiscoveryCampaignBudget) -> None:
    if budget.max_candidates < 1:
        raise ValueError("Campaign max_candidates must be at least 1")
    if budget.max_quarantined < 0:
        raise ValueError("Campaign max_quarantined must be non-negative")
    if budget.max_dead_letter < 0:
        raise ValueError("Campaign max_dead_letter must be non-negative")
    if budget.max_retries_per_candidate < 0:
        raise ValueError("Campaign max_retries_per_candidate must be non-negative")


def record_within_campaign_boundaries(
    record: AdapterCandidateRecord,
    boundaries: DiscoveryCampaignBoundaries,
) -> bool:
    if boundaries.adapter_ids:
        if record.provenance.adapter_id not in boundaries.adapter_ids:
            return False
    hints = extract_geographic_hints(record)
    return geographic_hint_within_countries(hints, boundaries.countries)
