"""Federal archive adapter tests (BB-046)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from black_book_research.adapters import approve_source_policy, create_in_memory_source_registry, register_source
from black_book_research.adapters.types import EvidenceSource, SourceRegistryEntry
from black_book_research.adapters.federal import (
    DPLA_ADAPTER_ID,
    FEDERAL_ADAPTER_DEFINITIONS,
    FEDERAL_ADAPTER_KILL_SWITCH_PREFIX,
    LOC_ADAPTER_ID,
    NARA_ADAPTER_ID,
    FederalAdapterRunContext,
    build_isolated_federal_run_result,
    federal_adapter_kill_switch_id,
    filter_large_export_payload,
    get_federal_adapter_definition,
    loc_adapter_definition,
    nara_adapter_definition,
    nps_adapter_definition,
    parse_federal_fixture_batch,
    qualifies_for_candidate_retention,
    school_history_adapter_definition,
)

FIXED_NOW = "2026-07-16T20:00:00.000Z"
FEDERAL_DIR = Path(__file__).resolve().parent


def _load_fixture(relative: str) -> object:
    return json.loads((FEDERAL_DIR / relative).read_text(encoding="utf-8"))


def _approved_entry(definition: object) -> SourceRegistryEntry:
    definition = definition  # typed alias workaround
    from black_book_research.adapters.federal.shared.types import FederalAdapterDefinition

    assert isinstance(definition, FederalAdapterDefinition)
    store = create_in_memory_source_registry()
    evidence = definition.evidence_source
    register_source(
        store,
        entry_id=f"reg_{definition.family}",
        contract=definition.contract,
        evidence_source=EvidenceSource(
            id=str(evidence["id"]),
            organization_id=str(evidence["organizationId"]),
            display_name=str(evidence["displayName"]),
            classification=str(evidence["classification"]),
            adapter_id=str(evidence["adapterId"]),
            stable_id_scheme=str(evidence["stableIdScheme"]),
            policy=definition.contract.policy,
            adapter_enabled=True,
            kill_switch_id=definition.kill_switch_id,
            created_at=FIXED_NOW,
            updated_at=FIXED_NOW,
        ),
        created_at=FIXED_NOW,
    )
    return approve_source_policy(
        store,
        entry_id=f"reg_{definition.family}",
        approved_by="admin@blackbook.local",
        approved_at=FIXED_NOW,
    )


def test_federal_adapters_have_independent_policies() -> None:
    assert len(FEDERAL_ADAPTER_DEFINITIONS) == 5
    ids = {definition.adapter_id for definition in FEDERAL_ADAPTER_DEFINITIONS}
    assert len(ids) == 5
    for definition in FEDERAL_ADAPTER_DEFINITIONS:
        assert definition.contract.rate_limits.requests_per_minute > 0
        assert definition.kill_switch_id.startswith(FEDERAL_ADAPTER_KILL_SWITCH_PREFIX)


def test_loc_fixture_parsing() -> None:
    entry = _approved_entry(loc_adapter_definition)
    result = parse_federal_fixture_batch(
        loc_adapter_definition,
        entry,
        run_id="run_loc",
        captured_at=FIXED_NOW,
        raw=_load_fixture("loc/fixtures/sample-export.json"),
    )
    assert len(result.candidates) == 1
    assert result.candidates[0].stable_identifier == "lccn-2016656001"
    assert len(result.rejected) == 1
    assert get_federal_adapter_definition(LOC_ADAPTER_ID) is not None


def test_nara_strips_large_exports() -> None:
    entry = _approved_entry(nara_adapter_definition)
    result = parse_federal_fixture_batch(
        nara_adapter_definition,
        entry,
        run_id="run_nara",
        captured_at=FIXED_NOW,
        raw=_load_fixture("nara/fixtures/sample-export.json"),
    )
    assert len(result.candidates) == 1
    assert result.filtered_export_count == 1
    assert result.candidates[0].payload is not None
    assert "fullText" not in result.candidates[0].payload
    assert result.candidates[0].payload.get("recordGroup") == "RG-123"


def test_dpla_export_filter() -> None:
    definition = get_federal_adapter_definition(DPLA_ADAPTER_ID)
    assert definition is not None
    filtered = filter_large_export_payload(
        {
            "stableIdentifier": "dpla-x",
            "title": "Sample",
            "canonicalUrl": "https://dp.la/item/x",
            "aggregatedPreview": "x" * 10_000,
            "provider": "Test",
        },
        definition.export_filter,
    )
    assert filtered.filtered is True
    assert "aggregatedPreview" not in filtered.payload


def test_nps_fixture_parsing() -> None:
    entry = _approved_entry(nps_adapter_definition)
    result = parse_federal_fixture_batch(
        nps_adapter_definition,
        entry,
        run_id="run_nps",
        captured_at=FIXED_NOW,
        raw=_load_fixture("nps/fixtures/sample-export.json"),
    )
    assert len(result.candidates) == 1
    assert result.candidates[0].payload is not None
    assert "boundaryGeojson" not in result.candidates[0].payload


def test_school_history_retention() -> None:
    entry = _approved_entry(school_history_adapter_definition)
    result = parse_federal_fixture_batch(
        school_history_adapter_definition,
        entry,
        run_id="run_school",
        captured_at=FIXED_NOW,
        raw=_load_fixture("school_history/fixtures/sample-export.json"),
    )
    assert len(result.candidates) == 1
    assert result.candidates[0].payload is not None
    assert "lessonPlanBody" not in result.candidates[0].payload
    assert any(record.reason.startswith("missing_required_field") for record in result.rejected)


def test_retention_requires_canonical_url() -> None:
    ok, reason = qualifies_for_candidate_retention(
        {"stableIdentifier": "x", "title": "Valid title", "classification": "primary_archival"},
        nara_adapter_definition.retention,
    )
    assert ok is False
    assert reason == "missing_canonical_url"


def test_failure_isolation_quarantines_without_publication_impact() -> None:
    entry = _approved_entry(nara_adapter_definition)
    parse_result = parse_federal_fixture_batch(
        nara_adapter_definition,
        entry,
        run_id="run_isolation",
        captured_at=FIXED_NOW,
        raw=_load_fixture("nara/fixtures/sample-export.json"),
    )
    isolated = build_isolated_federal_run_result(
        context=FederalAdapterRunContext(
            run_id="run_isolation",
            started_at=FIXED_NOW,
            registry_entry=entry,
        ),
        parse_result=parse_result,
        completed_at=FIXED_NOW,
    )
    assert isolated.publication_impact == "none"
    assert isolated.outcome == "quarantined"
    assert len(isolated.candidates) == 0


def test_runtime_error_dead_letters_without_publication_impact() -> None:
    entry = _approved_entry(loc_adapter_definition)
    isolated = build_isolated_federal_run_result(
        context=FederalAdapterRunContext(
            run_id="run_error",
            started_at=FIXED_NOW,
            registry_entry=entry,
        ),
        error=RuntimeError("fixture parser exploded"),
        completed_at=FIXED_NOW,
    )
    assert isolated.outcome == "dead_letter"
    assert isolated.publication_impact == "none"
    assert isolated.candidate_count == 0


def test_nara_kill_switch_id_stable() -> None:
    assert NARA_ADAPTER_ID == "nara-catalog-v1"
    assert nara_adapter_definition.kill_switch_id == federal_adapter_kill_switch_id("nara-catalog-v1")
