/**
 * Dynamic beat index assignment for v6 entity edition panels — order mirrors web's canonical
 * `recordSectionIndex` (`apps/web/src/app/entity/[id]/EntityRoomSections.tsx`) for the beats the
 * two platforms share: claims ("What the sources say") come before status, matching web's
 * `claims-heading` preceding `status-heading`.
 */
import type { Entity } from './types';

export type EntityBeatIndices = {
  readonly relevance: string;
  readonly context: string;
  readonly reading?: string;
  readonly claims: string;
  readonly status: string;
  readonly timeline?: string;
  readonly connected: string;
  /**
   * Present only when a published story cites this record. Most of the catalog has no long-form
   * written about it yet, and a numbered beat that says so on every other record would read as a
   * research gap rather than as the ordinary state of the archive's writing — so the beat is
   * skipped entirely, the way `reading` and `timeline` are, and the numbering closes over it.
   */
  readonly citedIn?: string;
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
  const claims = next();
  const status = next();
  const timeline = entity.timeline.length > 0 ? next() : undefined;
  const connected = next();
  const citedIn = (entity.citingStories?.length ?? 0) > 0 ? next() : undefined;
  const provenance = next();
  return {
    relevance,
    context,
    reading,
    claims,
    status,
    timeline,
    connected,
    citedIn,
    provenance,
  };
}
