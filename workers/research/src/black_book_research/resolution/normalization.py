"""Deterministic text normalization, fuzzy matching, and US address parsing."""

from __future__ import annotations

import re
import unicodedata


def normalize_alias(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    normalized = (
        without_marks.lower().replace("&", " and ").replace("’", "").replace("'", "")
    )
    return " ".join(re.sub(r"[^\w]+", " ", normalized, flags=re.UNICODE).split())


def _levenshtein(left: str, right: str) -> int:
    previous = list(range(len(right) + 1))
    for row, left_char in enumerate(left, start=1):
        current = [row]
        for column, right_char in enumerate(right, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + (left_char != right_char),
                )
            )
        previous = current
    return previous[-1]


def name_similarity(left: str, right: str) -> float:
    normalized_left = normalize_alias(left)
    normalized_right = normalize_alias(right)
    length = max(len(normalized_left), len(normalized_right))
    return (
        1.0
        if length == 0
        else max(0.0, 1 - _levenshtein(normalized_left, normalized_right) / length)
    )


def parse_address(raw: str) -> dict[str, str]:
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    final = parts[-1] if parts else ""
    state_zip = re.fullmatch(r"([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?", final)
    postal_only = re.fullmatch(r"(\d{5}(?:-\d{4})?)", final)
    locality_end = len(parts) - 1 if state_zip or postal_only else len(parts)
    parsed = {"raw": raw, "country_code": "US"}
    if len(parts) > 1:
        parsed["street"] = parts[0]
    if locality_end > 1:
        parsed["city"] = parts[locality_end - 1]
    if state_zip:
        parsed["state"] = state_zip.group(1).upper()
        if state_zip.group(2):
            parsed["postal_code"] = state_zip.group(2)
    elif postal_only:
        parsed["postal_code"] = postal_only.group(1)
    return parsed
