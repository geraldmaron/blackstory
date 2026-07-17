"""Tests for deterministic relevance engine (BB-040)."""

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
from black_book_research.discovery.geography import extract_geographic_hints
from black_book_research.discovery.identity import build_candidate_identity
from black_book_research.discovery.signals import extract_discovery_signals
from black_book_research.query_packs import QueryTerm, build_query_pack
from black_book_research.query_packs.pack import BuildQueryPackInput
from black_book_research.relevance import (
    assert_explanation_has_no_numeric_score,
    assert_override_reason_present,
    assert_public_relevance_has_no_score,
    evaluate_candidate_relevance,
    evaluate_candidate_relevance_batch,
    to_public_relevance_explanation,
    validate_relevance_override,
)
from black_book_research.relevance.types import RelevanceCandidateInput

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


def _sample_record(*, title: str = "Civil rights activist in Montgomery, Alabama"):
    return stamp_candidate_provenance(
        _registry_entry(),
        run_id="run_fixture",
        captured_at=FIXED_NOW,
        stable_identifier="naid-12345678",
        title=title,
    )


def _load_fixture_pack():
    fixture_path = (
        DOMAIN_ROOT / "query-packs" / "fixtures" / "person-civil-rights-fixture.v1.json"
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


def _build_candidate(title: str, candidate_id: str) -> RelevanceCandidateInput:
    record = _sample_record(title=title)
    pack = _load_fixture_pack()
    identity = build_candidate_identity(record)
    signals = extract_discovery_signals(record, pack)
    hints = extract_geographic_hints(record)
    return RelevanceCandidateInput(
        candidate_id=candidate_id,
        identity_key=identity.identity_key,
        classification=record.classification or "primary_archival",
        signals=signals,
        geographic_hints=hints,
    )


def test_included_candidate_has_relevance_evidence() -> None:
    candidate = _build_candidate(
        "Montgomery civil rights activist during segregation",
        "rel_include",
    )
    assessment = evaluate_candidate_relevance(candidate, assessed_at=FIXED_NOW)
    assert assessment.decision == "include"
    assert assessment.passes is True
    assert assessment.policy_version == "1.0.0"
    assert assessment.evidence
    assert len(assessment.feature_values) == 5
    assert assessment.why_this_appears.startswith("Included because")


def test_weak_signals_cannot_independently_include() -> None:
    pack = build_query_pack(
        BuildQueryPackInput(
            id="qp-weak-only",
            display_name="Weak only",
            entity_kind="person",
            theme="civil_rights",
            semver="1.0.0",
            created_at=FIXED_NOW,
            terms=(QueryTerm(text="Montgomery", term_class="geographic"),),
        )
    )
    record = _sample_record(title="Montgomery community bulletin")
    identity = build_candidate_identity(record)
    signals = extract_discovery_signals(record, pack)
    candidate = RelevanceCandidateInput(
        candidate_id="rel_weak",
        identity_key=identity.identity_key,
        classification="primary_archival",
        signals=signals,
        geographic_hints=extract_geographic_hints(record),
    )
    assessment = evaluate_candidate_relevance(candidate, assessed_at=FIXED_NOW)
    assert assessment.decision != "include"
    assert assessment.composite_score <= 0.5


def test_irrelevant_candidate_is_excluded() -> None:
    candidate = _build_candidate("unrelated marine biology field guide", "rel_irrelevant")
    assessment = evaluate_candidate_relevance(candidate, assessed_at=FIXED_NOW)
    assert assessment.decision == "exclude"
    assert assessment.passes is True


def test_public_projection_hides_numeric_scores() -> None:
    candidate = _build_candidate(
        "Montgomery civil rights activist during segregation",
        "rel_public",
    )
    assessment = evaluate_candidate_relevance(candidate, assessed_at=FIXED_NOW)
    public = to_public_relevance_explanation(assessment)
    assert_public_relevance_has_no_score(public, assessment)
    assert_explanation_has_no_numeric_score(public.why_this_appears)


def test_manual_override_requires_reason() -> None:
    with pytest.raises(ValueError):
        assert_override_reason_present("too short")
    override = validate_relevance_override(
        decision="include",
        reason="Archival review confirms direct civil-rights connection.",
        overridden_by="reviewer@example.com",
        overridden_at=FIXED_NOW,
    )
    assert len(override.reason) >= 12


def test_duplicate_of_included_candidate_is_excluded() -> None:
    included = _build_candidate(
        "Montgomery civil rights activist during segregation",
        "rel_dup_a",
    )
    duplicate = _build_candidate(
        "Montgomery civil rights activist during segregation",
        "rel_dup_b",
    )
    assessments = evaluate_candidate_relevance_batch(
        (included, duplicate),
        assessed_at=FIXED_NOW,
    )
    assert assessments[0].decision == "include"
    assert assessments[1].decision == "exclude"
    assert assessments[1].is_duplicate is True


def test_gold_relevance_fixtures_pass() -> None:
    fixture_path = (
        DOMAIN_ROOT
        / "relevance"
        / "fixtures"
        / "relevance-gold-fixture.v1.json"
    )
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    for entry in raw["cases"]:
        candidate = _build_candidate(entry["title"], f"rel_gold_{entry['id']}")
        assessment = evaluate_candidate_relevance(candidate, assessed_at=FIXED_NOW)
        assert assessment.decision == entry["expectedDecision"], entry["id"]
        assert assessment.passes == entry["expectedPasses"], entry["id"]
        if entry.get("mustNotExposeScore"):
            public = to_public_relevance_explanation(assessment)
            assert_public_relevance_has_no_score(public, assessment)
