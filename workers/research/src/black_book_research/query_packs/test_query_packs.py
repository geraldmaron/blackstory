"""Tests for versioned historical query packs (BB-038)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from black_book_research.query_packs import (
    BuildQueryPackInput,
    DiscoveryRunContext,
    QueryTerm,
    RecordEffectivenessInput,
    assert_discovery_run_stamped,
    assert_may_promote_beyond_candidate,
    assert_query_pack_valid,
    build_query_pack,
    classify_signal_strength,
    compute_effectiveness_metrics,
    compute_query_pack_content_hash,
    create_in_memory_effectiveness_store,
    create_in_memory_query_pack_registry,
    evaluate_text_against_terms,
    may_promote_beyond_candidate,
    record_query_pack_metric,
    register_query_pack,
    resolve_query_pack_for_run,
    stamp_discovery_run,
    to_public_safe_terms,
)

FIXED_NOW = "2026-07-16T20:00:00.000Z"
REPO_ROOT = Path(__file__).resolve().parents[5]
FIXTURE_PATH = (
    REPO_ROOT
    / "packages"
    / "domain"
    / "src"
    / "query-packs"
    / "fixtures"
    / "person-civil-rights-fixture.v1.json"
)


def _load_fixture_pack():
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
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
    pack = build_query_pack(
        BuildQueryPackInput(
            id=pack_raw["id"],
            display_name=pack_raw["displayName"],
            entity_kind=pack_raw["entityKind"],
            theme=pack_raw["theme"],
            semver=pack_raw["version"]["semver"],
            terms=terms,
            created_at=pack_raw["createdAt"],
            notes=pack_raw.get("notes"),
        )
    )
    assert_query_pack_valid(pack)
    return pack, raw["expectations"]


def test_query_pack_versioning_uses_semver_and_content_hash() -> None:
    pack = build_query_pack(
        BuildQueryPackInput(
            id="qp-test",
            display_name="Test pack",
            entity_kind="person",
            theme="civil_rights",
            semver="1.0.0",
            created_at=FIXED_NOW,
            terms=(QueryTerm(text="activist", term_class="positive"),),
        )
    )
    assert pack.version.semver == "1.0.0"
    assert len(pack.version.content_hash) == 64
    assert pack.version_id.startswith("1.0.0+")
    assert_query_pack_valid(pack)


def test_content_hash_changes_when_terms_change() -> None:
    base = dict(
        id="qp-test",
        display_name="Test pack",
        entity_kind="person",
        theme="civil_rights",
        created_at=FIXED_NOW,
    )
    v1 = build_query_pack(
        BuildQueryPackInput(**base, semver="1.0.0", terms=(QueryTerm(text="activist", term_class="positive"),))
    )
    v2 = build_query_pack(
        BuildQueryPackInput(
            **base,
            semver="1.0.1",
            terms=(
                QueryTerm(text="activist", term_class="positive"),
                QueryTerm(text="Montgomery", term_class="geographic"),
            ),
        )
    )
    assert v1.version.content_hash != v2.version.content_hash


def test_to_public_safe_terms_strips_research_only_offensive_terms() -> None:
    terms = (
        QueryTerm(text="civil rights", term_class="positive"),
        QueryTerm(text="colored school", term_class="historical", research_only_offensive=True),
    )
    public_terms = to_public_safe_terms(terms)
    assert len(public_terms) == 1
    assert public_terms[0].text == "civil rights"


def test_weak_signals_produce_candidates_only() -> None:
    negative_only = classify_signal_strength(
        matched_terms=(QueryTerm(text="sports biography", term_class="negative"),)
    )
    assert negative_only.strength == "weak"
    assert negative_only.outcome == "candidate_only"
    assert not may_promote_beyond_candidate(negative_only)
    with pytest.raises(ValueError):
        assert_may_promote_beyond_candidate(negative_only)

    strong = classify_signal_strength(
        matched_terms=(
            QueryTerm(text="activist", term_class="positive"),
            QueryTerm(text="segregation", term_class="historical"),
        )
    )
    assert strong.strength == "strong"
    assert strong.outcome == "promotable"


def test_stamp_discovery_run_records_query_pack_version() -> None:
    pack, _ = _load_fixture_pack()
    stamped = stamp_discovery_run(
        DiscoveryRunContext(run_id="run_1", adapter_id="nara-catalog-v1", started_at=FIXED_NOW),
        pack,
        FIXED_NOW,
    )
    assert stamped.query_pack_id == pack.id
    assert stamped.query_pack_version_id == pack.version_id
    assert_discovery_run_stamped(stamped)


def test_registry_and_effectiveness_metrics() -> None:
    pack, _ = _load_fixture_pack()
    registry = create_in_memory_query_pack_registry()
    register_query_pack(registry, pack)
    resolved = resolve_query_pack_for_run(registry, entity_kind="person", theme="civil_rights")
    assert resolved.version_id == pack.version_id

    store = create_in_memory_effectiveness_store()
    record_query_pack_metric(
        store,
        RecordEffectivenessInput(
            pack_id=pack.id,
            version_id=pack.version_id,
            run_id="run_a",
            recorded_at=FIXED_NOW,
            queries_executed=100,
            matches_observed=20,
            exclusions_observed=5,
            false_positive_observed=2,
        ),
    )
    metrics = compute_effectiveness_metrics(
        pack_id=pack.id, version_id=pack.version_id, records=store.records
    )
    assert metrics.total_queries == 100
    assert metrics.total_matches == 20


def test_fixture_expectations() -> None:
    pack, expectations = _load_fixture_pack()
    for expectation in expectations:
        matched = evaluate_text_against_terms(expectation["input"], pack.terms)
        did_match = len(matched) > 0
        assert did_match == expectation["shouldMatch"], expectation["input"]
        if did_match and "expectedOutcome" in expectation:
            classification = classify_signal_strength(matched_terms=matched)
            assert classification.outcome == expectation["expectedOutcome"], expectation["input"]


def test_python_content_hash_matches_typescript_fixture() -> None:
    pack, _ = _load_fixture_pack()
    recomputed = compute_query_pack_content_hash(
        id=pack.id,
        display_name=pack.display_name,
        entity_kind=pack.entity_kind,
        theme=pack.theme,
        semver=pack.version.semver,
        terms=pack.terms,
        notes=pack.notes,
    )
    assert recomputed == pack.version.content_hash
