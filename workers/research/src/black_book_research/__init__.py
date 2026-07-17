"""Research worker package: source discovery and ingestion (cannot publish)."""

from __future__ import annotations

from . import adapters, confidence_engine, extraction

__all__ = ["adapters", "confidence_engine", "extraction", "health"]


def health() -> dict[str, str]:
    return {"service": "research", "status": "ok"}
