"""Publication worker package: projections and immutable releases."""

from __future__ import annotations

__all__ = ["health"]


def health() -> dict[str, str]:
    return {"service": "publication", "status": "ok"}
