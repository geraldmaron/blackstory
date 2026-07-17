"""Tests for candidate discovery pipeline (BB-039)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from black_book_research.adapters.candidates import stamp_candidate_provenance
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
from black_book_research.discovery import (
    assert_discovery_cannot_publish,
    build_candidate_identity,
    hash_candidate_content,
    ingest_api_candidate,
    merge_duplicate_identities,
    run_discovery_campaign,
    stamp_discovery_reproducibility,
)
from black_book_research.discovery.types import (
    DiscoveryCampaignBoundaries,
    DiscoveryCampaignBudget,
    DiscoveryCampaignConfig,
)
from black_book_research.query_packs import (
    DiscoveryRunContext,
    QueryTerm,
    build_query_pack,
    stamp_discovery_run,
)
from black_book_research.query_packs.pack import BuildQueryPackInput

FIXED_NOW = "2026-07-16T20:00:00.000Z"
DOMAIN_ROOT = Path(__file__).resolve().parents[5] / "packages" / "domain" / "src"


def _rights() -> RightsPolicy:
    return RightsPolicy(
        default_status="public_domain",
        publication_permissions=("cite", "short_excerpt"),
        prohibited_uses=("biometric_extraction",),
    )


def _registry_entry() -> SourceRegistryEntry:
    rights = _rights()
    policy = SourceAdapterPolicy(
        snapshot_mode="selective",
        rights=rights,
        permitted_claim_classes=("biographical_fact",),
        refresh_schedule="0 6 * * 1",
    )
    contract = SourceAdapterContract(
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
    evidence_source = EvidenceSource(
        id="src_nara",
        organization_id="org_nara",
        display_name="NARA Catalog",
        classification="primary_archival",
        adapter_id="nara-catalog-v1",
        stable_id_scheme="nara-naid",
        policy=policy,
        adapter_enabled=True,
        kill_switch_id="source-adapter-nara-catalog-v1",
        created_at=FIXED_NOW,
        updated_at=FIXED_NOW,
    )
    return SourceRegistryEntry(
        id="reg_nara",
        contract=contract,
        evidence_source=evidence_source,
        registry_state="approved",
        created_at=FIXED_NOW,
        updated_at=FIXED_NOW,
    )


def _sample_record(*, run_id: str = "run_fixture", adapter_id: str = "nara-catalog-v1"):
    entry = _registry_entry()
    if adapter_id != entry.contract.adapter_id:
        contract = entry.contract
        entry = SourceRegistryEntry(
            id=entry.id,
            contract=SourceAdapterContract(
                adapter_id=adapter_id,
                parser_version=contract.parser_version,
                display_name=contract.display_name,
                classification=contract.classification,
                stable_id_scheme=contract.stable_id_scheme,
                policy=contract.policy,
                rights=contract.rights,
                permitted_claim_classes=contract.permitted_claim_classes,
                rate_limits=contract.rate_limits,
                volume=contract.volume,
                geographic_coverage=contract.geographic_coverage,
                expected_schema_version=contract.expected_schema_version,
                refresh_schedule=contract.refresh_schedule,
            ),
            evidence_source=entry.evidence_source,
            registry_state=entry.registry_state,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )
    return stamp_candidate_provenance(
        entry,
        run_id=run_id,
        captured_at=FIXED_NOW,
        stable_identifier="naid-12345678",
        title="Civil rights activist in Montgomery, Alabama",
    )


def _sample_pack():
    return build_query_pack(
        BuildQueryPackInput(
            id="qp-person-civil-rights",
            display_name="Civil rights movement figures",
            entity_kind="person",
            theme="civil_rights",
            semver="1.0.0",
            created_at=FIXED_NOW,
            terms=(
                QueryTerm(text="civil rights activist", term_class="positive"),
                QueryTerm(text="Montgomery", term_class="geographic"),
                QueryTerm(text="Alabama", term_class="geographic"),
                QueryTerm(text="segregation", term_class="historical"),
            ),
        )
    )


def _load_fixture_pack():
    fixture_path = (
        DOMAIN_ROOT
        / "query-packs"
        / "fixtures"
        / "person-civil-rights-fixture.v1.json"
    )
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    pack_raw = raw["pack"]
    terms = tuple(
        QueryTerm(
            text=term["text"],
            term_class=term["termClass"],
            research_only_offensive=term.get("researchOnlyOffensive", False),
            source_id=term.get("sourceId"),
            weight=term.get("weight"),
        )
        for term in pack_raw["terms"]
    )
    return build_query_pack(
        BuildQueryPackInput(
            id=pack_raw["id"],
            display_name=pack_raw["displayName"],
            entity_kind=pack_raw["entityKind"],
            theme=pack_raw["theme"],
            semver=pack_raw["version"]["semver"],
            created_at=pack_raw["createdAt"],
            terms=terms,
            notes=pack_raw.get("notes"),
        )
    )


def test_assert_discovery_cannot_publish_blocks_public_writes() -> None:
    with pytest.raises(ValueError, match="forbidden"):
        assert_discovery_cannot_publish(operation="write_public_projection")


def test_hash_candidate_content_returns_sha256() -> None:
    record = _sample_record()
    content_hash = hash_candidate_content(record)
    assert content_hash.algorithm == "sha256"
    assert len(content_hash.digest) == 64


def test_duplicate_identities_merge_without_losing_provenance() -> None:
    left = build_candidate_identity(_sample_record(run_id="run_a"))
    right = build_candidate_identity(_sample_record(run_id="run_b"))
    merged = merge_duplicate_identities(left, right)
    assert len(merged.source_references) == 2


def test_failed_candidates_do_not_block_campaign() -> None:
    pack = _sample_pack()
    good = _sample_record()
    bad = _sample_record(run_id="run_bad", adapter_id="disallowed-adapter-v1")
    config = DiscoveryCampaignConfig(
        campaign_id="camp_test",
        budget=DiscoveryCampaignBudget(
            max_candidates=10,
            max_quarantined=10,
            max_dead_letter=5,
            max_retries_per_candidate=2,
        ),
        boundaries=DiscoveryCampaignBoundaries(
            countries=("US",),
            adapter_ids=("nara-catalog-v1",),
        ),
        continue_on_quarantine=True,
    )
    result = run_discovery_campaign(
        config=config,
        records=(good, bad),
        pack=pack,
        run_context=DiscoveryRunContext(
            run_id="run_campaign",
            adapter_id="nara-catalog-v1",
            started_at=FIXED_NOW,
        ),
        stamped_at=FIXED_NOW,
    )
    assert result.accepted_count >= 1
    assert result.quarantined_count >= 1


def test_campaign_reproducibility_fingerprint() -> None:
    pack = _sample_pack()
    record = _sample_record()
    run_context = DiscoveryRunContext(
        run_id="run_repro",
        adapter_id="nara-catalog-v1",
        started_at=FIXED_NOW,
    )
    stamped = stamp_discovery_run(run_context, pack, FIXED_NOW)
    repro = stamp_discovery_reproducibility(stamped, (record.provenance.parser_version,))
    assert len(repro.fingerprint) == 64
    assert repro.query_pack_version_id == pack.version_id

    result = run_discovery_campaign(
        config=DiscoveryCampaignConfig(
            campaign_id="camp_repro",
            budget=DiscoveryCampaignBudget(100, 10, 5, 2),
            boundaries=DiscoveryCampaignBoundaries(countries=("US",)),
        ),
        records=(record,),
        pack=pack,
        run_context=run_context,
        stamped_at=FIXED_NOW,
    )
    assert result.fingerprint == repro.fingerprint


def test_ingest_api_candidate_with_fixture_pack_if_present() -> None:
    fixture_path = (
        DOMAIN_ROOT
        / "query-packs"
        / "fixtures"
        / "person-civil-rights-fixture.v1.json"
    )
    if not fixture_path.exists():
        pytest.skip("query pack fixture not available")
    pack = _load_fixture_pack()
    candidate = ingest_api_candidate(_sample_record(), pack, candidate_id="disc_test")
    assert candidate.schema_version == "discovery-candidate.v1"
    assert candidate.signals.strength in {"strong", "medium", "weak"}
