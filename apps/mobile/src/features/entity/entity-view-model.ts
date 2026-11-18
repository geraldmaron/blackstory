/**
 * Pure view-model helpers for entity detail — mirrors web `entity-view-model.ts`
 * without React or server imports.
 */
import { resolveMapTone } from '@/features/map/kind-encoding';
import type { Entity } from './types';

export type HistoricalFraming = 'historical' | 'present_day';

export function deriveHistoricalFraming(entity: Entity): HistoricalFraming {
  if (entity.kind === 'event') return 'historical';
  return entity.status === 'active' ? 'present_day' : 'historical';
}

export function historicalFramingLabel(framing: HistoricalFraming): string {
  return framing === 'present_day' ? 'Present-day record' : 'Historical record';
}

/**
 * A sensitive or violence-adjacent record: a sensitivity flag, or a massacre or plantation
 * tone. It gets no plate and no motion. Mirrors web `isQuietRecord`
 * (`apps/web/src/app/entity/[id]/adapters.ts`).
 */
export function isQuietRecord(entity: Entity): boolean {
  if (entity.sensitivity || entity.sensitivityClass) return true;
  // The tone the map paints, so a record cannot be a massacre there and plain here.
  const tone = resolveMapTone(entity);
  return tone === 'massacre' || tone === 'plantation';
}
