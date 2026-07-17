"""Source adapter registry package surface (BB-037)."""

from .candidates import (
    assert_adapter_candidate_valid,
    assert_candidate_has_provenance,
    stamp_candidate_provenance,
    validate_adapter_candidates,
)
from .drift import (
    build_parser_drift_metric,
    compute_field_null_rates,
    create_drift_accumulator,
    record_field_observation,
)
from .gates import (
    assert_adapter_may_run,
    can_adapter_run,
    is_canary_mode,
    select_canary_record_indices,
)
from .registry import (
    approve_source_policy,
    create_in_memory_source_registry,
    list_source_entries,
    register_source,
    set_registry_state,
)
from .run_health import evaluate_run_health, should_dead_letter_run, should_quarantine_run
from .types import (
    ADAPTER_CANDIDATE_SCHEMA_VERSION,
    AdapterCandidateProvenance,
    AdapterCandidateRecord,
    AdapterRegistryState,
    EvaluateRunHealthResult,
    ParserDriftMetric,
    SourceAdapterContract,
    SourceRegistryEntry,
)

__all__ = [
    "ADAPTER_CANDIDATE_SCHEMA_VERSION",
    "AdapterCandidateProvenance",
    "AdapterCandidateRecord",
    "AdapterRegistryState",
    "EvaluateRunHealthResult",
    "ParserDriftMetric",
    "SourceAdapterContract",
    "SourceRegistryEntry",
    "approve_source_policy",
    "assert_adapter_candidate_valid",
    "assert_adapter_may_run",
    "assert_candidate_has_provenance",
    "build_parser_drift_metric",
    "can_adapter_run",
    "compute_field_null_rates",
    "create_drift_accumulator",
    "create_in_memory_source_registry",
    "evaluate_run_health",
    "is_canary_mode",
    "list_source_entries",
    "record_field_observation",
    "register_source",
    "select_canary_record_indices",
    "set_registry_state",
    "should_dead_letter_run",
    "should_quarantine_run",
    "stamp_candidate_provenance",
    "validate_adapter_candidates",
]
