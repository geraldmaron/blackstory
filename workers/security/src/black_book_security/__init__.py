"""Security worker package: quarantine and integrity checks."""

from __future__ import annotations

__all__ = ["health"]


def health() -> dict[str, str]:
    return {"service": "security", "status": "ok"}
