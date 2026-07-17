"""Parity tests for deterministic extraction and evidence helpers."""

from __future__ import annotations

import pytest

from . import (
    assess_atomicity,
    decide_claim_extraction,
    parse_claim_lines,
    register_evidence_span,
)

EXCERPT = "The school opened in 1961 in Atlanta."


def test_parser_is_deterministic_and_records_atomicity_uncertainty() -> None:
    source = (
        "# claims\n"
        "school-1 | opened in | 1961\n"
        "school-2 | served Atlanta and Birmingham | 1962"
    )
    assert parse_claim_lines(source) == parse_claim_lines(source)
    parsed = parse_claim_lines(source)
    assert parsed[0].object == "1961"
    assert parsed[1].uncertainties[0].code == "atomicity"


def test_escaped_pipe_is_preserved() -> None:
    parsed = parse_claim_lines(r"entity-1 | catalogued as | A \| B")
    assert parsed[0].object == "A | B"


def test_exact_quotation_requires_matching_located_span() -> None:
    start = EXCERPT.index("opened in 1961")
    span = register_evidence_span(
        span_id="span-1",
        evidence_id="ev-1",
        source_item_id="item-1",
        excerpt=EXCERPT,
        locator={"page": "12", "paragraph": "3"},
        offset_start=start,
        offset_end=start + len("opened in 1961"),
        exact_quotation=True,
        quotation="opened in 1961",
    )
    assert span.text == "opened in 1961"
    with pytest.raises(ValueError, match="does not match"):
        register_evidence_span(
            span_id="span-bad",
            evidence_id="ev-1",
            source_item_id="item-1",
            excerpt=EXCERPT,
            locator={"page": "12"},
            offset_start=start,
            offset_end=start + len("opened in 1961"),
            exact_quotation=True,
            quotation="opened in 1962",
        )
    with pytest.raises(ValueError, match="exact source locator"):
        register_evidence_span(
            span_id="span-unlocated",
            evidence_id="ev-1",
            source_item_id="item-1",
            excerpt=EXCERPT,
            locator={},
            offset_start=start,
            offset_end=start + len("opened in 1961"),
            exact_quotation=True,
            quotation="opened in 1961",
        )


def test_unsupported_claim_rejected_and_context_uncertainty_stored() -> None:
    decision = decide_claim_extraction(
        atomicity=assess_atomicity("opened in", "1961"),
        procedural_status="unknown_procedural",
        claim_text="opened in 1961",
        qualifying_evidence_count=0,
        temporal_context_present=False,
        geographic_context_present=False,
    )
    assert decision.decision == "rejected"
    assert {item.code for item in decision.uncertainties} >= {
        "evidence",
        "temporal",
        "geographic",
    }


def test_supported_atomic_claim_accepted_but_uncertainty_not_dropped() -> None:
    decision = decide_claim_extraction(
        atomicity=assess_atomicity("opened in", "1961"),
        procedural_status="unknown_procedural",
        claim_text="opened in 1961",
        qualifying_evidence_count=1,
        temporal_context_present=False,
        geographic_context_present=True,
    )
    assert decision.decision == "accepted"
    assert any(item.code == "temporal" for item in decision.uncertainties)


def test_multi_assertion_and_unsupported_legal_language_rejected() -> None:
    decision = decide_claim_extraction(
        atomicity=assess_atomicity("was charged and convicted", "in 1961"),
        procedural_status="convicted",
        claim_text="was definitely guilty",
        qualifying_evidence_count=1,
        temporal_context_present=True,
        geographic_context_present=True,
    )
    assert decision.decision == "rejected"
    assert len(decision.rejection_reasons) == 2
