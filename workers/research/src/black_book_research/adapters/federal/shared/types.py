"""Shared federal adapter types for fixture-based discovery (BB-046)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from black_book_research.adapters.types import (
    AdapterCandidateRecord,
    AdapterRunOutcome,
    RightsPolicy,
    SourceAdapterContract,
)

FederalAdapterFamily = Literal["loc", "nara", "dpla", "nps", "school_history"]


@dataclass(frozen=True, slots=True)
class FederalRetentionRules:
    required_fields: tuple[str, ...]
    min_title_length: int
    allowed_classifications: tuple[str, ...]
    require_canonical_url: bool


@dataclass(frozen=True, slots=True)
class FederalExportFilterPolicy:
    max_payload_bytes: int
    strip_keys: tuple[str, ...]
    essential_keys: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class FederalRejectedRecord:
    stable_identifier: str
    reason: str


@dataclass(frozen=True, slots=True)
class FederalParseResult:
    candidates: tuple[AdapterCandidateRecord, ...]
    rejected: tuple[FederalRejectedRecord, ...]
    filtered_export_count: int


@dataclass(frozen=True, slots=True)
class FederalAdapterDefinition:
    family: FederalAdapterFamily
    adapter_id: str
    kill_switch_id: str
    contract: SourceAdapterContract
    evidence_source: dict[str, object]
    rights: RightsPolicy
    retention: FederalRetentionRules
    export_filter: FederalExportFilterPolicy


@dataclass(frozen=True, slots=True)
class IsolatedFederalRunResult:
    adapter_id: str
    run_id: str
    outcome: AdapterRunOutcome
    candidate_count: int
    issues: tuple[str, ...]
    completed_at: str
    publication_impact: Literal["none"]
    candidates: tuple[AdapterCandidateRecord, ...]
