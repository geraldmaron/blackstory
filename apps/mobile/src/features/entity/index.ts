/**
 * Public surface of the entity detail feature (MOB-014). The route
 * (`src/app/entity/[id].tsx`) imports ONLY from this barrel.
 */
export { EntityDetailScreen, type EntityDetailScreenProps } from './EntityDetailScreen';
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
