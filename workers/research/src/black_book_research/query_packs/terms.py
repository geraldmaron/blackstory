"""Query term validation and public-safe projection (BB-038)."""

from __future__ import annotations

from .types import PublicSafeTerm, QueryTerm, TermClass

TERM_CLASSES: frozenset[TermClass] = frozenset(
    {
        "positive",
        "negative",
        "historical",
        "modern",
        "geographic",
        "alias",
        "source_specific",
    }
)


def assert_query_term_valid(term: QueryTerm) -> None:
    if not term.text.strip():
        raise ValueError("Query term text is required")
    if term.term_class not in TERM_CLASSES:
        raise ValueError(f"Unknown term class: {term.term_class}")
    if term.term_class == "source_specific" and not (term.source_id or "").strip():
        raise ValueError("source_specific terms require source_id")
    if term.weight is not None and (term.weight < 0 or term.weight != term.weight):
        raise ValueError("Query term weight must be a non-negative finite number")


def assert_query_terms_valid(terms: tuple[QueryTerm, ...] | list[QueryTerm]) -> None:
    for term in terms:
        assert_query_term_valid(term)


def to_public_safe_terms(terms: tuple[QueryTerm, ...] | list[QueryTerm]) -> tuple[PublicSafeTerm, ...]:
    safe: list[PublicSafeTerm] = []
    for term in terms:
        if term.research_only_offensive:
            continue
        safe.append(PublicSafeTerm(text=term.text, term_class=term.term_class, redacted=False))
    return tuple(safe)


def to_research_query_terms(terms: tuple[QueryTerm, ...] | list[QueryTerm]) -> tuple[QueryTerm, ...]:
    return tuple(QueryTerm(**term.__dict__) for term in terms)


def count_redacted_terms(terms: tuple[QueryTerm, ...] | list[QueryTerm]) -> int:
    return sum(1 for term in terms if term.research_only_offensive)
