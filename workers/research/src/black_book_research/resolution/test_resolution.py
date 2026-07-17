"""Parity and safety tests for the Python entity-resolution mirror."""

from __future__ import annotations

import json
from pathlib import Path

from . import (
    DatedName,
    EntityProfile,
    Jurisdiction,
    LocationEvidence,
    ResolutionCandidate,
    ResolutionDecision,
    apply_resolution_decision,
    create_duplicate_review_item,
    normalize_alias,
    parse_address,
    resolve_entity_candidate,
    reverse_resolution_decision,
)

NOW = "2026-07-17T00:00:00.000Z"
REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
GOLD_FIXTURE = (
    REPOSITORY_ROOT
    / "packages"
    / "domain"
    / "src"
    / "resolution"
    / "fixtures"
    / "gold-resolution.v1.json"
)

PROFILES = (
    EntityProfile(
        id="school-1",
        kind="school",
        display_name="Washington Heritage Academy",
        school_names=(
            DatedName("Booker T. Washington High School", 1924, 1971),
            DatedName("Washington Heritage Academy", 1972),
        ),
        locations=(
            LocationEvidence(
                role="historical",
                label="45 History Ave, Atlanta, GA",
                jurisdiction_ids=("city-atlanta-1950",),
                valid_from=1924,
                valid_to=1971,
            ),
        ),
    ),
    EntityProfile(
        id="person-alex-a", kind="person", display_name="Alex Johnson", birth_year=1930
    ),
    EntityProfile(
        id="person-alex-b", kind="person", display_name="Alex Johnson", birth_year=1932
    ),
    EntityProfile(
        id="org-1",
        kind="organization",
        display_name="Freedom League",
        identifiers=(("archives", "FL-77"),),
    ),
)

JURISDICTIONS = (
    Jurisdiction("city-atlanta-1950", "Atlanta", 1950, 1970),
    Jurisdiction("city-atlanta-current", "Atlanta", 1971),
)


def _candidate(raw: dict[str, object]) -> ResolutionCandidate:
    identifiers = raw.get("identifiers", {})
    assert isinstance(identifiers, dict)
    return ResolutionCandidate(
        id=str(raw["id"]),
        name=str(raw["name"]),
        kind=str(raw["kind"]) if "kind" in raw else None,
        aliases=tuple(str(value) for value in raw.get("aliases", [])),
        address=str(raw["address"]) if "address" in raw else None,
        year=int(raw["year"]) if "year" in raw else None,
        geographic_hints=tuple(str(value) for value in raw.get("geographicHints", [])),
        identifiers=tuple((str(key), str(value)) for key, value in identifiers.items()),
        source_reference_ids=tuple(str(value) for value in raw["sourceReferenceIds"]),
    )


def test_gold_fixture_matches_typescript_expectations() -> None:
    fixture = json.loads(GOLD_FIXTURE.read_text(encoding="utf-8"))
    for case in fixture["cases"]:
        result = resolve_entity_candidate(
            _candidate(case["candidate"]), PROFILES, JURISDICTIONS
        )
        assert result.outcome == case["expectedOutcome"], case["id"]
        assert result.selected_entity_id == case.get("expectedEntityId"), case["id"]


def test_ambiguous_match_is_queued_without_selection() -> None:
    candidate = ResolutionCandidate(
        id="candidate-alex",
        name="Alex Johnson",
        kind="person",
        year=1965,
        source_reference_ids=("archive:2002",),
    )
    result = resolve_entity_candidate(candidate, PROFILES, JURISDICTIONS)
    assert result.outcome == "review_required"
    assert result.selected_entity_id is None
    queue_item = create_duplicate_review_item(candidate, result, NOW)
    assert queue_item.reason == "ambiguous_match"
    assert queue_item.proposed_entity_ids[:2] == ("person-alex-a", "person-alex-b")


def test_normalization_address_and_historical_time_checks() -> None:
    assert normalize_alias("St. Mary’s & Ácademy") == "st marys and academy"
    assert parse_address("45 History Ave, Atlanta, GA 30303") == {
        "raw": "45 History Ave, Atlanta, GA 30303",
        "street": "45 History Ave",
        "city": "Atlanta",
        "state": "GA",
        "postal_code": "30303",
        "country_code": "US",
    }
    impossible = ResolutionCandidate(
        id="impossible",
        name="Alex Johnson",
        kind="person",
        year=1900,
        source_reference_ids=("archive:impossible",),
    )
    result = resolve_entity_candidate(impossible, PROFILES)
    assert result.outcome != "proposed_match"
    assert any(
        factor.rationale == "candidate year falls outside person lifespan"
        for factor in result.ranked_matches[0].factors
    )


def test_resolution_decisions_are_reversible() -> None:
    proposed = ResolutionDecision(
        id="decision-1",
        candidate_id="candidate-school-1961",
        selected_entity_id="school-1",
        status="proposed",
        confidence=0.9,
        rationale=("historical name and location agree",),
        decided_by="researcher-1",
        decided_at=NOW,
        source_reference_ids=("nara:1001",),
    )
    applied = apply_resolution_decision(proposed, "2026-07-17T00:01:00.000Z")
    reversed_decision = reverse_resolution_decision(
        applied,
        reversed_at="2026-07-17T00:02:00.000Z",
        reversed_by="reviewer-1",
        reason="new contradictory evidence",
    )
    assert reversed_decision.status == "reversed"
    assert reversed_decision.selected_entity_id == "school-1"
    assert reversed_decision.reverse_reason == "new contradictory evidence"
