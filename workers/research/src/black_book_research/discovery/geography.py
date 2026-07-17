"""Basic geographic extraction helpers (BB-039)."""

from __future__ import annotations

import re

from black_book_research.adapters.types import AdapterCandidateRecord

from .types import GeographicHint

US_STATE_NAMES: dict[str, str] = {
    "alabama": "US-AL",
    "georgia": "US-GA",
    "texas": "US-TX",
}

US_STATE_CODES = frozenset(
    {
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
        "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
        "VA", "WA", "WV", "WI", "WY", "DC",
    }
)

CITY_PATTERN = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b")


def _collect_candidate_text(record: AdapterCandidateRecord) -> str:
    parts: list[str] = []
    if record.title:
        parts.append(record.title)
    if record.payload:
        for value in record.payload.values():
            if isinstance(value, str):
                parts.append(value)
    return " ".join(parts)


def extract_geographic_hints(record: AdapterCandidateRecord) -> tuple[GeographicHint, ...]:
    text = _collect_candidate_text(record)
    if not text.strip():
        return ()

    hints: list[GeographicHint] = []
    lower = text.lower()
    for name, code in US_STATE_NAMES.items():
        if re.search(rf"\b{re.escape(name)}\b", lower):
            hints.append(GeographicHint(text=code, kind="state", confidence=0.85))

    for match in CITY_PATTERN.finditer(text):
        city, state = match.group(1), match.group(2)
        if state in US_STATE_CODES:
            hints.append(GeographicHint(text=f"{city}, {state}", kind="city", confidence=0.75))

    seen: dict[str, GeographicHint] = {}
    for hint in hints:
        key = f"{hint.kind}:{hint.text.lower()}"
        existing = seen.get(key)
        if existing is None or hint.confidence > existing.confidence:
            seen[key] = hint
    return tuple(seen.values())


def geographic_hint_within_countries(
    hints: tuple[GeographicHint, ...],
    countries: tuple[str, ...],
) -> bool:
    if not countries or "global" in countries:
        return True
    if not hints:
        return True
    normalized = {country.upper() for country in countries}
    return any(
        hint.text.startswith("US-") and "US" in normalized for hint in hints
    )
