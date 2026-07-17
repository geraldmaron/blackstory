"""Parses federal adapter fixture exports into normalized candidate records (BB-046)."""

from __future__ import annotations

from black_book_research.adapters.candidates import stamp_candidate_provenance
from black_book_research.adapters.types import SourceRegistryEntry

from .export_filter import filter_large_export_payload
from .retention import partition_by_retention
from .types import FederalAdapterDefinition, FederalParseResult


def parse_federal_fixture_batch(
    definition: FederalAdapterDefinition,
    entry: SourceRegistryEntry,
    run_id: str,
    captured_at: str,
    raw: object,
) -> FederalParseResult:
    if not isinstance(raw, list):
        raise ValueError("Federal fixture batch must be an array")

    records: list[dict[str, object]] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"Federal fixture record at index {index} must be an object")
        records.append(item)

    qualified, rejected = partition_by_retention(records, definition.retention)
    candidates = []
    filtered_export_count = 0

    for record in qualified:
        stable_identifier = str(record.get("stableIdentifier") or record.get("id") or "").strip()
        filtered = filter_large_export_payload(record, definition.export_filter)
        if filtered.filtered:
            filtered_export_count += 1

        title = record.get("title")
        canonical_url = record.get("canonicalUrl")
        classification = record.get("classification")

        candidates.append(
            stamp_candidate_provenance(
                entry,
                run_id=run_id,
                captured_at=captured_at,
                stable_identifier=stable_identifier,
                title=title if isinstance(title, str) else None,
                canonical_url=canonical_url if isinstance(canonical_url, str) else None,
                classification=(
                    classification if isinstance(classification, str) else definition.contract.classification
                ),
                payload=filtered.payload,
            )
        )

    return FederalParseResult(
        candidates=tuple(candidates),
        rejected=rejected,
        filtered_export_count=filtered_export_count,
    )
