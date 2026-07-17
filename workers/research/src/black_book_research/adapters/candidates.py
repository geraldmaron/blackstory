"""Adapter candidate validation and provenance stamping (BB-037)."""

from __future__ import annotations

from urllib.parse import urlparse

from .types import (
    ADAPTER_CANDIDATE_SCHEMA_VERSION,
    AdapterCandidateProvenance,
    AdapterCandidateRecord,
    SourceRegistryEntry,
)


def assert_candidate_has_provenance(candidate: AdapterCandidateRecord) -> None:
    provenance = candidate.provenance
    if not provenance.source_id.strip():
        raise ValueError("Candidate provenance.source_id is required")
    if not provenance.adapter_id.strip():
        raise ValueError("Candidate provenance.adapter_id is required")
    if not provenance.parser_version.strip():
        raise ValueError("Candidate provenance.parser_version is required")
    if not provenance.registry_entry_id.strip():
        raise ValueError("Candidate provenance.registry_entry_id is required")
    if not provenance.run_id.strip():
        raise ValueError("Candidate provenance.run_id is required")
    if not provenance.captured_at.strip():
        raise ValueError("Candidate provenance.captured_at is required")
    if not provenance.schema_version.strip():
        raise ValueError("Candidate provenance.schema_version is required")


def assert_adapter_candidate_valid(
    candidate: AdapterCandidateRecord,
    *,
    expected_schema_version: str = ADAPTER_CANDIDATE_SCHEMA_VERSION,
) -> None:
    if not candidate.stable_identifier.strip():
        raise ValueError("Candidate stable_identifier is required")
    assert_candidate_has_provenance(candidate)
    if candidate.provenance.schema_version != expected_schema_version:
        raise ValueError(
            "Candidate schema version mismatch: "
            f"expected {expected_schema_version}, got {candidate.provenance.schema_version}"
        )
    if candidate.canonical_url is not None:
        parsed = urlparse(candidate.canonical_url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError(
                f"Candidate canonical_url is not a valid URL: {candidate.canonical_url}"
            )


def validate_adapter_candidates(
    candidates: list[AdapterCandidateRecord],
    *,
    expected_schema_version: str = ADAPTER_CANDIDATE_SCHEMA_VERSION,
) -> None:
    for candidate in candidates:
        assert_adapter_candidate_valid(
            candidate, expected_schema_version=expected_schema_version
        )


def stamp_candidate_provenance(
    entry: SourceRegistryEntry,
    *,
    run_id: str,
    captured_at: str,
    stable_identifier: str,
    title: str | None = None,
    canonical_url: str | None = None,
    classification: str | None = None,
    payload: dict[str, object] | None = None,
) -> AdapterCandidateRecord:
    provenance = AdapterCandidateProvenance(
        source_id=entry.evidence_source.id,
        adapter_id=entry.contract.adapter_id,
        parser_version=entry.contract.parser_version,
        registry_entry_id=entry.id,
        run_id=run_id,
        captured_at=captured_at,
        schema_version=entry.contract.expected_schema_version,
    )
    candidate = AdapterCandidateRecord(
        stable_identifier=stable_identifier,
        provenance=provenance,
        title=title,
        canonical_url=canonical_url,
        classification=classification,
        payload=payload,
    )
    assert_adapter_candidate_valid(candidate)
    return candidate
