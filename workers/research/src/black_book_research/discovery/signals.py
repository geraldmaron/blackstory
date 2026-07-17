"""Signal extraction integrating query-pack classification (BB-039)."""

from __future__ import annotations

from black_book_research.adapters.types import AdapterCandidateRecord
from black_book_research.query_packs.classification import classify_signal_strength
from black_book_research.query_packs.pack import evaluate_text_against_terms
from black_book_research.query_packs.types import QueryPack

from .types import DiscoverySignal


def _collect_searchable_text(record: AdapterCandidateRecord) -> str:
    parts: list[str] = []
    if record.title:
        parts.append(record.title)
    if record.classification:
        parts.append(record.classification)
    if record.payload:
        for value in record.payload.values():
            if isinstance(value, str):
                parts.append(value)
    return " ".join(parts)


def extract_discovery_signals(record: AdapterCandidateRecord, pack: QueryPack) -> DiscoverySignal:
    text = _collect_searchable_text(record)
    matched_terms = evaluate_text_against_terms(text, pack.terms)
    result = classify_signal_strength(matched_terms=tuple(matched_terms))
    return DiscoverySignal(
        strength=result.strength,
        outcome=result.outcome,
        matched_classes=result.matched_classes,
        matched_terms=tuple(term.text for term in matched_terms),
        reasons=result.reasons,
    )
