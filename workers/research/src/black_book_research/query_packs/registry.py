"""In-memory query pack registry (BB-038)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .pack import assert_query_pack_valid
from .types import EntityKind, QueryPack, QueryPackTheme


@dataclass
class QueryPackRegistryStore:
    packs: dict[str, QueryPack] = field(default_factory=dict)


def create_in_memory_query_pack_registry() -> QueryPackRegistryStore:
    return QueryPackRegistryStore()


def register_query_pack(store: QueryPackRegistryStore, pack: QueryPack) -> QueryPack:
    assert_query_pack_valid(pack)
    store.packs[pack.id] = pack
    return pack


def get_query_pack(store: QueryPackRegistryStore, pack_id: str) -> QueryPack | None:
    return store.packs.get(pack_id)


def list_query_packs(
    store: QueryPackRegistryStore,
    *,
    entity_kind: EntityKind | None = None,
    theme: QueryPackTheme | None = None,
) -> tuple[QueryPack, ...]:
    results: list[QueryPack] = []
    for pack in store.packs.values():
        if entity_kind is not None and pack.entity_kind != entity_kind:
            continue
        if theme is not None and pack.theme != theme:
            continue
        results.append(pack)
    return tuple(results)


def resolve_query_pack_for_run(
    store: QueryPackRegistryStore,
    *,
    entity_kind: EntityKind,
    theme: QueryPackTheme,
) -> QueryPack:
    matches = list_query_packs(store, entity_kind=entity_kind, theme=theme)
    if not matches:
        raise ValueError(f"No query pack registered for entity_kind={entity_kind} theme={theme}")
    if len(matches) > 1:
        raise ValueError(f"Ambiguous query pack for entity_kind={entity_kind} theme={theme}")
    return matches[0]
