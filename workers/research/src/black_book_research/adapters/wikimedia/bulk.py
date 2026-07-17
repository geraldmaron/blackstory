"""Bulk Wikimedia dump-style processing path (BB-045)."""

from __future__ import annotations

from typing import Any


def parse_wikimedia_bulk_batch(raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("ingestMode") != "bulk":
        raise ValueError('Wikimedia bulk batch ingestMode must be "bulk"')
    if not raw.get("project"):
        raise ValueError("Wikimedia bulk batch project is required")
    records = raw.get("records")
    if not isinstance(records, list) or not records:
        raise ValueError("Wikimedia bulk batch records must be a non-empty array")
    for record in records:
        page = record.get("page", {})
        if not page.get("pageid") or not page.get("title"):
            raise ValueError("Bulk record page requires pageid and title")
    return raw
