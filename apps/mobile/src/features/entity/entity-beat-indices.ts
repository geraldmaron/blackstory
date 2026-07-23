/**
 * Dynamic beat index assignment for v6 entity edition panels — mirrors web
 * `EntityEditionSections.entityBeatIndices`.
 */
import type { Entity } from './types';

export type EntityBeatIndices = {
  readonly relevance: string;
  readonly context: string;
  readonly reading?: string;
  readonly status: string;
  readonly claims: string;
  readonly timeline?: string;
  readonly connected: string;
  readonly provenance: string;
};

export function entityBeatIndices(entity: Entity): EntityBeatIndices {
  let current = 2;
  const next = () => String(current++).padStart(2, '0');
  const relevance = next();
  const context = next();
  const reading =
    entity.extendedNarrative !== undefined && entity.extendedNarrative.trim().length > 0
      ? next()
      : undefined;
  const status = next();
  const claims = next();
  const timeline = entity.timeline.length > 0 ? next() : undefined;
  const connected = next();
  const provenance = next();
  return { relevance, context, reading, status, claims, timeline, connected, provenance };
}
