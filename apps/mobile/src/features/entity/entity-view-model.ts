/**
 * Pure view-model helpers for entity detail — mirrors web `entity-view-model.ts`
 * without React or server imports.
 */
import type { Entity } from './types';

export type HistoricalFraming = 'historical' | 'present_day';

export function deriveHistoricalFraming(entity: Entity): HistoricalFraming {
  if (entity.kind === 'event') return 'historical';
  return entity.status === 'active' ? 'present_day' : 'historical';
}

export function historicalFramingLabel(framing: HistoricalFraming): string {
  return framing === 'present_day' ? 'Present-day record' : 'Historical record';
}
