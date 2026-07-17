"""Discovery candidate deduplication (BB-039)."""

from __future__ import annotations

from dataclasses import replace

from .types import DiscoveryCandidateIdentity, SourceReference


def _unique_source_references(
    references: tuple[SourceReference, ...],
) -> tuple[SourceReference, ...]:
    seen: set[str] = set()
    merged: list[SourceReference] = []
    for ref in references:
        key = "::".join(
            [
                ref.source_id,
                ref.adapter_id,
                ref.stable_identifier,
                ref.run_id,
                ref.captured_at,
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(ref)
    return tuple(merged)


def merge_duplicate_identities(
    identity: DiscoveryCandidateIdentity,
    other: DiscoveryCandidateIdentity,
) -> DiscoveryCandidateIdentity:
    merged_refs = _unique_source_references(identity.source_references + other.source_references)
    return replace(identity, source_references=merged_refs)
