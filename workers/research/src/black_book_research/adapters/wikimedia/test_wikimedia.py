"""Tests for Wikimedia discovery adapter (BB-045). Fixture-driven; no live network."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from black_book_research.adapters.types import (
    ADAPTER_CANDIDATE_SCHEMA_VERSION,
    EvidenceSource,
    GeographicCoverage,
    RateLimitPolicy,
    RightsPolicy,
    SourceAdapterContract,
    SourceAdapterPolicy,
    SourceRegistryEntry,
    VolumeExpectation,
)
from black_book_research.adapters.wikimedia import (
    WIKIMEDIA_ADAPTER_ID,
    assert_category_gate_passed,
    assert_search_snippets_not_copied,
    build_api_fetch_from_fixtures,
    candidates_equivalent,
    evaluate_category_gate,
    normalize_wikimedia_api_fetch,
    normalize_wikimedia_bulk_batch,
    parse_mediawiki_search_response,
    parse_wikimedia_bulk_batch,
)
from black_book_research.adapters.wikimedia.extractors import route_external_reference_url

FIXED_NOW = "2026-07-16T20:00:00.000Z"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def _wikimedia_registry_entry() -> SourceRegistryEntry:
    rights = RightsPolicy(
        default_status="licensed",
        publication_permissions=("cite",),
        prohibited_uses=("full_text_republication", "unattributed_reuse"),
    )
    policy = SourceAdapterPolicy(
        snapshot_mode="selective",
        rights=rights,
        permitted_claim_classes=("biographical_fact", "geographic_fact"),
    )
    contract = SourceAdapterContract(
        adapter_id=WIKIMEDIA_ADAPTER_ID,
        parser_version="wikimedia-parser-1.0.0",
        display_name="Wikimedia Discovery",
        classification="secondary_reference",
        stable_id_scheme="wikimedia-page",
        policy=policy,
        rights=rights,
        permitted_claim_classes=("biographical_fact", "geographic_fact"),
        rate_limits=RateLimitPolicy(requests_per_minute=60, burst=10),
        volume=VolumeExpectation(expected_records_per_run=250, count_tolerance_fraction=0.2),
        geographic_coverage=GeographicCoverage(countries=("global",)),
        expected_schema_version=ADAPTER_CANDIDATE_SCHEMA_VERSION,
    )
    evidence = EvidenceSource(
        id="src_wikimedia",
        organization_id="org_wikimedia",
        display_name="Wikimedia Discovery",
        classification="secondary_reference",
        adapter_id=WIKIMEDIA_ADAPTER_ID,
        stable_id_scheme="wikimedia-page",
        policy=policy,
        adapter_enabled=True,
        kill_switch_id="source-adapter-wikimedia-discovery-v1",
        created_at=FIXED_NOW,
        updated_at=FIXED_NOW,
    )
    return SourceRegistryEntry(
        id="reg_wikimedia",
        contract=contract,
        evidence_source=evidence,
        registry_state="approved",
        approved_at=FIXED_NOW,
        approved_by="admin@blackbook.local",
        created_at=FIXED_NOW,
        updated_at=FIXED_NOW,
    )


def test_category_membership_does_not_auto_include_reference_only_pages() -> None:
    gate = evaluate_category_gate(("Category:Births by year",))
    assert gate.passed is False
    assert gate.matched_seed_categories == ()
    with pytest.raises(ValueError, match="Wikimedia category gate failed"):
        assert_category_gate_passed(gate)


def test_seed_category_membership_passes_gate() -> None:
    gate = evaluate_category_gate(
        ("Category:African-American activists", "Category:Births by year"),
    )
    assert gate.passed is True
    assert "Category:African-American activists" in gate.matched_seed_categories


def test_mediawiki_search_fixture_parsing() -> None:
    hits = parse_mediawiki_search_response(_load_fixture("mediawiki-search-response.json"))
    assert len(hits) == 2
    assert hits[0]["pageid"] == 5045871


def test_api_and_bulk_modes_produce_equivalent_contracts() -> None:
    entry = _wikimedia_registry_entry()
    context = {
        "registry_entry": entry,
        "run_id": "run_wikimedia_fixture",
        "captured_at": FIXED_NOW,
    }

    api_fetch = build_api_fetch_from_fixtures(
        project="en",
        page_raw=_load_fixture("mediawiki-page-response.json"),
        wikidata_raw=_load_fixture("wikidata-entity-response.json"),
        wikidata_id="Q41909",
    )
    api_candidate = normalize_wikimedia_api_fetch(api_fetch, **context)

    bulk_batch = parse_wikimedia_bulk_batch(_load_fixture("wikimedia-bulk-batch.json"))
    bulk_candidates = normalize_wikimedia_bulk_batch(bulk_batch, **context)
    bulk_candidate = bulk_candidates[0]

    assert api_candidate.payload is not None
    assert bulk_candidate.payload is not None
    assert api_candidate.payload["ingestMode"] == "api"
    assert bulk_candidate.payload["ingestMode"] == "bulk"
    assert candidates_equivalent(api_candidate, bulk_candidate)
    assert api_candidate.payload["includeProse"] is False
    assert_search_snippets_not_copied(api_candidate.payload)
    assert api_candidate.payload["revisionId"] == 1239876543
    assert api_candidate.payload["wikidataId"] == "Q41909"
    assert api_candidate.provenance.adapter_id == WIKIMEDIA_ADAPTER_ID


def test_bulk_batch_retains_revision_and_gate_outcomes() -> None:
    entry = _wikimedia_registry_entry()
    bulk_batch = parse_wikimedia_bulk_batch(_load_fixture("wikimedia-bulk-batch.json"))
    candidates = normalize_wikimedia_bulk_batch(
        bulk_batch,
        registry_entry=entry,
        run_id="run_bulk",
        captured_at=FIXED_NOW,
    )
    assert len(candidates) == 2
    assert candidates[0].payload is not None
    assert candidates[1].payload is not None
    assert candidates[0].payload["categoryGate"]["passed"] is True
    assert candidates[1].payload["categoryGate"]["passed"] is False
    assert candidates[1].payload["revisionId"] == 555001


def test_external_reference_routing() -> None:
    assert route_external_reference_url("VIAF", "123456789") == "https://viaf.org/viaf/123456789/"
    assert route_external_reference_url("LCCN", "n79033051") == "https://id.loc.gov/authorities/n79033051"
    assert route_external_reference_url("Unknown", "abc") is None
