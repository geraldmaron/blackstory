"""Security worker package: quarantine, integrity, and safe URL fetch (BB-030)."""

from __future__ import annotations

from .url_fetch import (
    FetchLimits,
    FetchOutcome,
    evaluate_job,
    parse_external_url,
    pin_destination,
)

__all__ = [
    "FetchLimits",
    "FetchOutcome",
    "evaluate_job",
    "health",
    "parse_external_url",
    "pin_destination",
]


def health() -> dict[str, str]:
    return {"service": "security", "status": "ok"}
