"""Source adapter registry types mirroring @black-book/domain adapters (BB-037)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

AdapterRegistryState = Literal[
    "approved", "canary", "quarantined", "dead_letter", "disabled"
]
AdapterRunOutcome = Literal["success", "quarantined", "dead_letter"]
RunHealthIssue = Literal[
    "record_count_drift",
    "schema_version_drift",
    "null_field_spike",
    "missing_required_field",
]

ADAPTER_CANDIDATE_SCHEMA_VERSION = "candidate-record.v1"
RUNNABLE_REGISTRY_STATES = frozenset({"approved", "canary"})


@dataclass(frozen=True, slots=True)
class SourceKillSwitchState:
    id: str
    enabled: bool


@dataclass(frozen=True, slots=True)
class RateLimitPolicy:
    requests_per_minute: float
    burst: float | None = None


@dataclass(frozen=True, slots=True)
class VolumeExpectation:
    expected_records_per_run: int
    count_tolerance_fraction: float


@dataclass(frozen=True, slots=True)
class GeographicCoverage:
    countries: tuple[str, ...]
    regions: tuple[str, ...] = ()
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class RightsPolicy:
    default_status: str
    publication_permissions: tuple[str, ...]
    prohibited_uses: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class SourceAdapterPolicy:
    snapshot_mode: Literal["none", "selective"]
    rights: RightsPolicy
    permitted_claim_classes: tuple[str, ...] = ()
    refresh_schedule: str | None = None
    notes: str | None = None


@dataclass(frozen=True, slots=True)
class SourceAdapterContract:
    adapter_id: str
    parser_version: str
    display_name: str
    classification: str
    stable_id_scheme: str
    policy: SourceAdapterPolicy
    rights: RightsPolicy
    permitted_claim_classes: tuple[str, ...]
    rate_limits: RateLimitPolicy
    volume: VolumeExpectation
    geographic_coverage: GeographicCoverage
    expected_schema_version: str
    refresh_schedule: str | None = None
    canary_sample_fraction: float | None = None


@dataclass(frozen=True, slots=True)
class EvidenceSource:
    id: str
    display_name: str
    classification: str
    adapter_id: str
    stable_id_scheme: str
    policy: SourceAdapterPolicy
    adapter_enabled: bool
    created_at: str
    updated_at: str
    organization_id: str | None = None
    kill_switch_id: str | None = None


@dataclass(frozen=True, slots=True)
class SourceRegistryEntry:
    id: str
    contract: SourceAdapterContract
    evidence_source: EvidenceSource
    registry_state: AdapterRegistryState
    created_at: str
    updated_at: str
    approved_at: str | None = None
    approved_by: str | None = None
    quarantine_reason: str | None = None
    dead_letter_reason: str | None = None


@dataclass(frozen=True, slots=True)
class AdapterCandidateProvenance:
    source_id: str
    adapter_id: str
    parser_version: str
    registry_entry_id: str
    run_id: str
    captured_at: str
    schema_version: str
    source_item_id: str | None = None


@dataclass(frozen=True, slots=True)
class AdapterCandidateRecord:
    stable_identifier: str
    provenance: AdapterCandidateProvenance
    title: str | None = None
    canonical_url: str | None = None
    classification: str | None = None
    payload: dict[str, object] | None = None


@dataclass(frozen=True, slots=True)
class EvaluateRunHealthResult:
    outcome: Literal["success", "quarantined"]
    issues: tuple[RunHealthIssue, ...]
    details: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ParserDriftMetric:
    adapter_id: str
    parser_version: str
    registry_entry_id: str
    run_id: str
    recorded_at: str
    expected_record_count: int
    actual_record_count: int
    expected_schema_version: str
    observed_schema_version: str
    field_null_rates: dict[str, float]
    issues: tuple[str, ...]


@dataclass(slots=True)
class DriftAccumulator:
    adapter_id: str
    parser_version: str
    registry_entry_id: str
    run_id: str
    started_at: str
    field_null_counts: dict[str, dict[str, int]] = field(default_factory=dict)


class SourceRegistryStore(Protocol):
    def get(self, entry_id: str) -> SourceRegistryEntry | None: ...

    def list(self) -> list[SourceRegistryEntry]: ...

    def save(self, entry: SourceRegistryEntry) -> None: ...
