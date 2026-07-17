"""Exact-quotation checks and immutable evidence-span registration."""

from __future__ import annotations

from collections.abc import Mapping

from .models import EvidenceSpan


def assert_quotation_accurate(
    excerpt: str, offset_start: int, offset_end: int, quotation: str
) -> None:
    if (
        isinstance(offset_start, bool)
        or isinstance(offset_end, bool)
        or not isinstance(offset_start, int)
        or not isinstance(offset_end, int)
    ):
        raise ValueError("Evidence span offsets must be integers")
    if offset_start < 0 or offset_end <= offset_start:
        raise ValueError("Evidence span offsets must define a non-empty range")
    if offset_end > len(excerpt):
        raise ValueError("Evidence span exceeds the evidence excerpt")
    if excerpt[offset_start:offset_end] != quotation:
        raise ValueError("Exact quotation does not match the registered evidence span")


def register_evidence_span(
    *,
    span_id: str,
    evidence_id: str,
    source_item_id: str,
    excerpt: str,
    locator: Mapping[str, str],
    offset_start: int,
    offset_end: int,
    exact_quotation: bool,
    quotation: str | None = None,
) -> EvidenceSpan:
    if not span_id.strip() or not evidence_id.strip() or not source_item_id.strip():
        raise ValueError("Evidence span, evidence, and source item ids are required")
    exact_locator = tuple(
        sorted((key, value) for key, value in locator.items() if value.strip())
    )
    if not exact_locator:
        raise ValueError("Evidence span registration requires an exact source locator")
    text = excerpt[offset_start:offset_end]
    if exact_quotation and quotation is None:
        raise ValueError("Exact quotations require quotation text")
    assert_quotation_accurate(
        excerpt,
        offset_start,
        offset_end,
        quotation if exact_quotation and quotation is not None else text,
    )
    return EvidenceSpan(
        id=span_id,
        evidence_id=evidence_id,
        source_item_id=source_item_id,
        offset_start=offset_start,
        offset_end=offset_end,
        text=text,
        exact_quotation=exact_quotation,
        locator=exact_locator,
    )
