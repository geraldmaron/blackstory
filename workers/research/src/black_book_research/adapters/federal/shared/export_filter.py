"""Filters large federal archive exports before canonical ingestion (BB-046)."""

from __future__ import annotations

import json
from dataclasses import dataclass

from .types import FederalExportFilterPolicy


@dataclass(frozen=True, slots=True)
class ExportFilterResult:
    payload: dict[str, object]
    filtered: bool
    original_bytes: int
    retained_bytes: int
    stripped_keys: tuple[str, ...]


def _estimate_json_bytes(value: object) -> int:
    return len(json.dumps(value, separators=(",", ":")).encode("utf-8"))


def filter_large_export_payload(
    raw: dict[str, object],
    policy: FederalExportFilterPolicy,
) -> ExportFilterResult:
    stripped_keys: list[str] = []
    without_bulk: dict[str, object] = {}

    for key, value in raw.items():
        if key in policy.strip_keys:
            stripped_keys.append(key)
            continue
        without_bulk[key] = value

    original_bytes = _estimate_json_bytes(raw)
    payload = without_bulk
    retained_bytes = _estimate_json_bytes(payload)
    filtered = bool(stripped_keys)

    if retained_bytes > policy.max_payload_bytes:
        payload = {key: without_bulk[key] for key in policy.essential_keys if key in without_bulk}
        retained_bytes = _estimate_json_bytes(payload)
        filtered = True

    return ExportFilterResult(
        payload=payload,
        filtered=filtered,
        original_bytes=original_bytes,
        retained_bytes=retained_bytes,
        stripped_keys=tuple(stripped_keys),
    )
