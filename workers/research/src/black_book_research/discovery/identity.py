"""Candidate identity and source reference helpers (BB-039)."""

from __future__ import annotations

from black_book_research.adapters.types import AdapterCandidateRecord

from .hashing import hash_candidate_content, hash_utf8
from .types import DiscoveryCandidateIdentity, SourceReference


def build_source_reference(record: AdapterCandidateRecord) -> SourceReference:
    return SourceReference(
        source_id=record.provenance.source_id,
        adapter_id=record.provenance.adapter_id,
        parser_version=record.provenance.parser_version,
        registry_entry_id=record.provenance.registry_entry_id,
        run_id=record.provenance.run_id,
        captured_at=record.provenance.captured_at,
        stable_identifier=record.stable_identifier,
        source_item_id=record.provenance.source_item_id,
    )


def candidate_identity_key(stable_identifier: str, content_hash_digest: str) -> str:
    material = f"{stable_identifier.strip()}::sha256:{content_hash_digest}"
    return hash_utf8(material).digest[:32]


def build_candidate_identity(record: AdapterCandidateRecord) -> DiscoveryCandidateIdentity:
    content_hash = hash_candidate_content(record)
    return DiscoveryCandidateIdentity(
        identity_key=candidate_identity_key(record.stable_identifier, content_hash.digest),
        stable_identifier=record.stable_identifier,
        content_hash=content_hash,
        source_references=(build_source_reference(record),),
    )
