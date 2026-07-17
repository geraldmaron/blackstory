"""Federal adapter kill-switch identifiers (BB-046 / BB-035 naming)."""

from __future__ import annotations

FEDERAL_ADAPTER_KILL_SWITCH_PREFIX = "adapter:"


def federal_adapter_kill_switch_id(adapter_id: str) -> str:
    trimmed = adapter_id.strip()
    if not trimmed:
        raise ValueError("adapter_id is required for kill-switch id")
    return f"{FEDERAL_ADAPTER_KILL_SWITCH_PREFIX}{trimmed}"


def parse_federal_adapter_kill_switch_id(kill_switch_id: str) -> str | None:
    if not kill_switch_id.startswith(FEDERAL_ADAPTER_KILL_SWITCH_PREFIX):
        return None
    adapter_id = kill_switch_id[len(FEDERAL_ADAPTER_KILL_SWITCH_PREFIX) :].strip()
    return adapter_id or None
