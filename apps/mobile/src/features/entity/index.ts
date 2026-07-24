/**
 * Public surface of the entity detail feature (MOB-014). The route
 * (`src/app/entity/[id].tsx`) imports ONLY from this barrel.
 */
export { EntityDetailScreen, type EntityDetailScreenProps } from './EntityDetailScreen';
export { EntitySessionNav, type EntitySessionNavProps } from './EntitySessionNav';
export { EntitySessionNavHost, type EntitySessionNavHostProps } from './EntitySessionNavHost';
export {
  pickNext,
  pickPrevious,
  canPickNext,
  canBack,
  push,
  back,
  orderedEntityIdsFromMapSource,
  type SessionStack,
  type PickNextInput,
} from './entity-session-nav';
export { useOrderedEntityIds, loadOrderedEntityIds } from './use-ordered-entity-ids';
export { useEntityDetail, type EntityDetailState } from './useEntityDetail';
export {
  createRuntimeEntityDataDeps,
  fetchEntityDetail,
  type EntityDataDeps,
  type EntityFetchResult,
  type EntityFreshness,
} from './dataClient';
export { normalizeEntity } from './normalize';
export { shareEntity, type ShareResult } from './share';
export type { Entity } from './types';
