"""Tests for source adapter registry and contract (BB-037)."""

from __future__ import annotations

import pytest

from black_book_research.adapters import (
    ADAPTER_CANDIDATE_SCHEMA_VERSION,
    approve_source_policy,
    assert_adapter_may_run,
    build_parser_drift_metric,
    can_adapter_run,
    create_drift_accumulator,
    create_in_memory_source_registry,
    evaluate_run_health,
    register_source,
    record_field_observation,
    stamp_candidate_provenance,
)
from black_book_research.adapters.types import (
    EvidenceSource,
    GeographicCoverage,
    RateLimitPolicy,
    RightsPolicy,
    SourceAdapterContract,
    SourceAdapterPolicy,
    SourceRegistryEntry,
    VolumeExpectation,
)

FIXED_NOW = "2026-07-16T20:00:00.000Z"


def _rights() -> RightsPolicy:
    return RightsPolicy(
        default_status="public_domain",
        publication_permissions=("cite", "short_excerpt"),
        prohibited_uses=("biometric_extraction",),
    )


def _contract() -> SourceAdapterContract:
    rights = _rights()
    policy = SourceAdapterPolicy(
        snapshot_mode="selective",
        rights=rights,
        permitted_claim_classes=("biographical_fact",),
        refresh_schedule="0 6 * * 1",
    )
    return SourceAdapterContract(
        adapter_id="nara-catalog-v1",
        parser_version="parser-1.2.0",
        display_name="NARA Catalog",
        classification="primary_archival",
        stable_id_scheme="nara-naid",
        policy=policy,
        rights=rights,
        permitted_claim_classes=("biographical_fact",),
        rate_limits=RateLimitPolicy(requests_per_minute=30, burst=5),
        volume=VolumeExpectation(
            expected_records_per_run=100, count_tolerance_fraction=0.15
        ),
        geographic_coverage=GeographicCoverage(countries=("US",)),
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        refresh_schedule="0 6 * * 1",
    )


def _evidence_source() -> EvidenceSource:
    return EvidenceSource(
        id="src_nara",
        organization_id="org_nara",
        display_name="NARA Catalog",
        classification="primary_archival",
        adapter_id="nara-catalog-v1",
        stable_id_scheme="nara-naid",
        policy=_contract().policy,
        adapter_enabled=True,
        kill_switch_id="source-adapter-nara-catalog-v1",
        created_at=FIXED_NOW,
        updated_at=FIXED_NOW,
    )


def _approved_entry() -> SourceRegistryEntry:
    return SourceRegistryEntry(
        id="reg_nara",
        contract=_contract(),
        evidence_source=_evidence_source(),
        registry_state="approved",
        approved_at=FIXED_NOW,
        approved_by="admin@blackbook.local",
        created_at=FIXED_NOW,
        updated_at=FIXED_NOW,
    )


def test_no_adapter_runs_without_approved_policy() -> None:
    store = create_in_memory_source_registry()
    register_source(
        store,
        entry_id="reg_nara",
        contract=_contract(),
        evidence_source=_evidence_source(),
        created_at=FIXED_NOW,
    )
    disabled = store.get("reg_nara")
    assert disabled is not None
    assert can_adapter_run(disabled) is False
    with pytest.raises(ValueError, match='cannot run in registry state "disabled"'):
        assert_adapter_may_run(disabled)

    approved = approve_source_policy(
        store,
        entry_id="reg_nara",
        approved_by="admin@blackbook.local",
        approved_at=FIXED_NOW,
    )
    assert_adapter_may_run(approved)

    missing_approval = SourceRegistryEntry(
        id=approved.id,
        contract=approved.contract,
        evidence_source=approved.evidence_source,
        registry_state="approved",
        created_at=approved.created_at,
        updated_at=approved.updated_at,
    )
    with pytest.raises(ValueError, match="no approved source policy"):
        assert_adapter_may_run(missing_approval)


def test_evaluate_run_health_quarantines_on_drift() -> None:
    healthy = evaluate_run_health(
        expected_count=100,
        actual_count=105,
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        observed_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
    )
    assert healthy.outcome == "success"

    drift = evaluate_run_health(
        expected_count=100,
        actual_count=200,
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        observed_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
    )
    assert drift.outcome == "quarantined"
    assert "record_count_drift" in drift.issues


def test_parser_drift_metric_records_null_rates() -> None:
    accumulator = create_drift_accumulator(
        adapter_id="nara-catalog-v1",
        parser_version="parser-1.2.0",
        registry_entry_id="reg_nara",
        run_id="run_1",
        started_at=FIXED_NOW,
    )
    record_field_observation(accumulator, "title", False)
    record_field_observation(accumulator, "title", True)
    health = evaluate_run_health(
        expected_count=2,
        actual_count=2,
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        observed_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
    )
    metric = build_parser_drift_metric(
        accumulator,
        expected_count=2,
        actual_count=2,
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        observed_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
        health=health,
        recorded_at=FIXED_NOW,
    )
    assert metric.field_null_rates["title"] == 0.5


def test_stamp_candidate_provenance() -> None:
    entry = _approved_entry()
    candidate = stamp_candidate_provenance(
        entry,
        run_id="run_stamp",
        captured_at=FIXED_NOW,
        stable_identifier="naid-999",
        title="Stamped record",
    )
    assert candidate.provenance.source_id == "src_nara"
    assert candidate.provenance.parser_version == "parser-1.2.0"
