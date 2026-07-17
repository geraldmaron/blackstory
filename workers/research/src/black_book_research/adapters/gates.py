"""Fail-closed adapter run gates mirroring domain gates (BB-037)."""

from __future__ import annotations

from .types import RUNNABLE_REGISTRY_STATES, SourceKillSwitchState, SourceRegistryEntry


def _kill_switch_blocks(
    entry: SourceRegistryEntry, kill_switch: SourceKillSwitchState | None
) -> bool:
    source = entry.evidence_source
    if not source.adapter_enabled:
        return True
    if source.kill_switch_id and kill_switch is not None:
        if kill_switch.id != source.kill_switch_id:
            raise ValueError(
                f"Kill switch id mismatch: expected {source.kill_switch_id}, got {kill_switch.id}"
            )
        if kill_switch.enabled:
            return True
    return False


def can_adapter_run(
    entry: SourceRegistryEntry, kill_switch: SourceKillSwitchState | None = None
) -> bool:
    if entry.registry_state not in RUNNABLE_REGISTRY_STATES:
        return False
    if not entry.approved_at or not entry.approved_by:
        return False
    return not _kill_switch_blocks(entry, kill_switch)


def assert_adapter_may_run(
    entry: SourceRegistryEntry, kill_switch: SourceKillSwitchState | None = None
) -> None:
    if entry.registry_state not in RUNNABLE_REGISTRY_STATES:
        raise ValueError(
            f'Source adapter "{entry.contract.adapter_id}" cannot run in registry state "{entry.registry_state}"'
        )
    if not entry.approved_at or not entry.approved_by:
        raise ValueError(
            f'Source adapter "{entry.contract.adapter_id}" has no approved source policy'
        )
    if _kill_switch_blocks(entry, kill_switch):
        raise ValueError(
            f'Source adapter "{entry.contract.adapter_id}" ({entry.id}) is disabled and cannot create candidates'
        )


def is_canary_mode(entry: SourceRegistryEntry) -> bool:
    return entry.registry_state == "canary"


def select_canary_record_indices(total_records: int, sample_fraction: float) -> tuple[int, ...]:
    if total_records <= 0:
        return ()
    if sample_fraction <= 0 or sample_fraction > 1:
        raise ValueError("canary sample_fraction must be in (0, 1]")
    target = max(1, int(total_records * sample_fraction + 0.999999))
    step = total_records / target
    indices = {min(total_records - 1, int(i * step)) for i in range(target)}
    return tuple(sorted(indices))
