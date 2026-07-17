/**
 * In-memory query pack registry for versioned pack lookup (BB-038).
 */
import { assertQueryPackValid } from './pack.js';
import type { EntityKind } from '../entity-kinds.js';
import type { QueryPack, QueryPackTheme } from './types.js';

export type QueryPackRegistryStore = {
  readonly packs: Map<string, QueryPack>;
};

export function createInMemoryQueryPackRegistry(): QueryPackRegistryStore {
  return { packs: new Map() };
}

export function registerQueryPack(store: QueryPackRegistryStore, pack: QueryPack): QueryPack {
  assertQueryPackValid(pack);
  store.packs.set(pack.id, pack);
  return pack;
}

export function getQueryPack(store: QueryPackRegistryStore, id: string): QueryPack | undefined {
  return store.packs.get(id);
}

export type ListQueryPacksFilter = {
  readonly entityKind?: EntityKind;
  readonly theme?: QueryPackTheme;
};

export function listQueryPacks(
  store: QueryPackRegistryStore,
  filter: ListQueryPacksFilter = {},
): readonly QueryPack[] {
  return [...store.packs.values()].filter((pack) => {
    if (filter.entityKind !== undefined && pack.entityKind !== filter.entityKind) {
      return false;
    }
    if (filter.theme !== undefined && pack.theme !== filter.theme) {
      return false;
    }
    return true;
  });
}

export function resolveQueryPackForRun(
  store: QueryPackRegistryStore,
  input: { readonly entityKind: EntityKind; readonly theme: QueryPackTheme },
): QueryPack {
  const matches = listQueryPacks(store, input);
  if (matches.length === 0) {
    throw new Error(
      `No query pack registered for entityKind=${input.entityKind} theme=${input.theme}`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous query pack for entityKind=${input.entityKind} theme=${input.theme}`,
    );
  }
  return matches[0]!;
}
