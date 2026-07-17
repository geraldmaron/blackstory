"""Bulk and API candidate ingestion interfaces (BB-039)."""

from __future__ import annotations

from dataclasses import dataclass

from black_book_research.adapters.candidates import assert_adapter_candidate_valid
from black_book_research.adapters.types import AdapterCandidateRecord
from black_book_research.query_packs.types import QueryPack

from .geography import extract_geographic_hints
from .identity import build_candidate_identity
from .signals import extract_discovery_signals
from .types import DISCOVERY_CANDIDATE_SCHEMA_VERSION, DiscoveryIngestMode, DiscoverySignal


@dataclass(frozen=True, slots=True)
class DiscoveryCandidateRecord:
    schema_version: str
    candidate_id: str
    identity_key: str
    stable_identifier: str
    ingest_mode: DiscoveryIngestMode
    signals: DiscoverySignal
    geographic_hint_count: int


def ingest_api_candidate(
    record: AdapterCandidateRecord,
    pack: QueryPack,
    *,
    candidate_id: str,
) -> DiscoveryCandidateRecord:
    assert_adapter_candidate_valid(record)
    identity = build_candidate_identity(record)
    signals = extract_discovery_signals(record, pack)
    hints = extract_geographic_hints(record)
    return DiscoveryCandidateRecord(
        schema_version=DISCOVERY_CANDIDATE_SCHEMA_VERSION,
        candidate_id=candidate_id,
        identity_key=identity.identity_key,
        stable_identifier=identity.stable_identifier,
        ingest_mode="api",
        signals=signals,
        geographic_hint_count=len(hints),
    )


def ingest_bulk_candidates(
    records: tuple[AdapterCandidateRecord, ...],
    pack: QueryPack,
    *,
    id_prefix: str = "disc",
) -> tuple[DiscoveryCandidateRecord, ...]:
    return tuple(
        ingest_api_candidate(
            record,
            pack,
            candidate_id=f"{id_prefix}_{index}_{record.stable_identifier}",
        )
        for index, record in enumerate(records)
    )
