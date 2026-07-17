"""In-memory source registry mirroring domain register/get/list/approve (BB-037)."""

from __future__ import annotations

from dataclasses import replace

from .types import (
    AdapterRegistryState,
    EvidenceSource,
    SourceAdapterContract,
    SourceRegistryEntry,
    SourceRegistryStore,
)


class InMemorySourceRegistry:
    def __init__(self, seed: list[SourceRegistryEntry] | None = None) -> None:
        self._entries: dict[str, SourceRegistryEntry] = {
            entry.id: entry for entry in (seed or [])
        }

    def get(self, entry_id: str) -> SourceRegistryEntry | None:
        return self._entries.get(entry_id)

    def list(self) -> list[SourceRegistryEntry]:
        return list(self._entries.values())

    def save(self, entry: SourceRegistryEntry) -> None:
        self._entries[entry.id] = entry


def create_in_memory_source_registry(
    seed: list[SourceRegistryEntry] | None = None,
) -> SourceRegistryStore:
    return InMemorySourceRegistry(seed)


def register_source(
    store: SourceRegistryStore,
    *,
    entry_id: str,
    contract: SourceAdapterContract,
    evidence_source: EvidenceSource,
    created_at: str,
    registry_state: AdapterRegistryState = "disabled",
) -> SourceRegistryEntry:
    if store.get(entry_id):
        raise ValueError(f"Source registry entry already exists: {entry_id}")
    if evidence_source.adapter_id != contract.adapter_id:
        raise ValueError("evidence_source.adapter_id must match contract.adapter_id")
    entry = SourceRegistryEntry(
        id=entry_id,
        contract=contract,
        evidence_source=evidence_source,
        registry_state=registry_state,
        created_at=created_at,
        updated_at=created_at,
    )
    store.save(entry)
    return entry


def list_source_entries(
    store: SourceRegistryStore,
    *,
    registry_state: AdapterRegistryState | None = None,
) -> list[SourceRegistryEntry]:
    entries = store.list()
    if registry_state is None:
        return entries
    return [entry for entry in entries if entry.registry_state == registry_state]


def approve_source_policy(
    store: SourceRegistryStore,
    *,
    entry_id: str,
    approved_by: str,
    approved_at: str,
    registry_state: AdapterRegistryState = "approved",
) -> SourceRegistryEntry:
    existing = store.get(entry_id)
    if existing is None:
        raise ValueError(f"Source registry entry not found: {entry_id}")
    if existing.registry_state in {"quarantined", "dead_letter"}:
        raise ValueError(
            f"Cannot approve source policy in state {existing.registry_state!r}"
        )
    updated = replace(
        existing,
        registry_state=registry_state,
        approved_at=approved_at,
        approved_by=approved_by,
        updated_at=approved_at,
    )
    store.save(updated)
    return updated


def set_registry_state(
    store: SourceRegistryStore,
    *,
    entry_id: str,
    registry_state: AdapterRegistryState,
    updated_at: str,
    quarantine_reason: str | None = None,
    dead_letter_reason: str | None = None,
) -> SourceRegistryEntry:
    existing = store.get(entry_id)
    if existing is None:
        raise ValueError(f"Source registry entry not found: {entry_id}")
    updated = replace(
        existing,
        registry_state=registry_state,
        updated_at=updated_at,
        quarantine_reason=quarantine_reason,
        dead_letter_reason=dead_letter_reason,
    )
    store.save(updated)
    return updated
