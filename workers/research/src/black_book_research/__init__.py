"""Research worker package: source discovery and ingestion (cannot publish)."""

from __future__ import annotations

__all__ = ["adapters", "health"]


def health() -> dict[str, str]:
    return {"service": "research", "status": "ok"}
