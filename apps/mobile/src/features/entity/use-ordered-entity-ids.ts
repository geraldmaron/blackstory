/**
 * Loads ordered entity ids for session Next/Random from the release map cache
 * (same catalog Explore uses). Falls back to demo map ids in __DEV__ when cache
 * is empty, then to related-neighbor ids from the open entity.
 */
import { useEffect, useState } from 'react';
import { mapSourceV1Schema } from '@repo/public-contracts/v1/map';
import { DEMO_MAP_SOURCE } from '@/features/map/demoMapSource';
import { MAP_CACHE_KEY, MAP_NAMESPACE } from '@/features/explore/map-source-client';
import type { Entity } from './types';
import { orderedEntityIdsFromMapSource } from './entity-session-nav';
import type { EntityDataDeps } from './dataClient';

function neighborFallbackIds(entity: Entity | undefined, currentId: string): readonly string[] {
  if (!entity) return [currentId];
  const seen = new Set<string>([currentId]);
  const ids: string[] = [currentId];
  for (const neighbor of [...(entity.relatedNeighbors ?? []), ...(entity.continueLearning ?? [])]) {
    if (seen.has(neighbor.id)) continue;
    seen.add(neighbor.id);
    ids.push(neighbor.id);
  }
  return ids;
}

function orderedIdsFromCachedMap(raw: unknown): readonly string[] {
  const parsed = mapSourceV1Schema.safeParse(raw);
  if (!parsed.success) return [];
  return orderedEntityIdsFromMapSource({
    features: parsed.data.features.map((feature) => ({
      properties: { entityId: feature.properties.entityId },
    })),
  });
}

export async function loadOrderedEntityIds(
  deps: EntityDataDeps | undefined,
  entity: Entity | undefined,
  currentId: string,
): Promise<readonly string[]> {
  if (deps) {
    try {
      const activeStamp = (await deps.releaseCache.getActiveStamp()) ?? '';
      const cached = await deps.releaseCache.read<unknown>(MAP_NAMESPACE, MAP_CACHE_KEY, {
        activeStamp,
        degraded: true,
        now: Date.now(),
      });
      if (cached?.value) {
        const fromCache = orderedIdsFromCachedMap(cached.value);
        if (fromCache.length > 1) return fromCache;
      }
    } catch {
      // Fall through to demo / neighbor catalog.
    }
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const demoIds = orderedEntityIdsFromMapSource(DEMO_MAP_SOURCE);
    if (demoIds.length > 1) return demoIds;
  }

  return neighborFallbackIds(entity, currentId);
}

export function useOrderedEntityIds(
  currentId: string,
  deps: EntityDataDeps | undefined,
  entity: Entity | undefined,
): readonly string[] {
  const [orderedIds, setOrderedIds] = useState<readonly string[]>(() =>
    neighborFallbackIds(entity, currentId),
  );

  useEffect(() => {
    let canceled = false;
    void loadOrderedEntityIds(deps, entity, currentId).then((ids) => {
      if (!canceled) setOrderedIds(ids);
    });
    return () => {
      canceled = true;
    };
  }, [currentId, deps, entity]);

  return orderedIds;
}
