/**
 * graph substrate feeding the entity detail page.
 *
 * Related-entity and timeline data for `./public-seed.ts`'s fixtures are DERIVED here through the
 * real graph-view builders (`buildEntityAdjacency` `toPublicRelatedEntries`) over a small
 * set of typed `EntityRelationship` edges never hand-typed as a final related-entry array. This
 * is the same graph-view shape a real `publicReleases/{releaseId}/graph` build
 * (`packages/domain/src/graph/build.ts`) would produce; this module stands in for that pipeline
 * until release build is wired to a live Firestore relationship collection (see
 * `public-seed.ts`'s own module doc for the parallel "seed stands in for a release" convention).
 *
 * Also carries the time-scoped `statusHistory` and schema-only `sensitivity` fixtures the
 * entity page needs to render kind-appropriate status (derived via `currentStatus`, never a
 * hand-set scalar) and the sensitivity context banner.
 */
import {
  buildEntityAdjacency,
  currentStatus,
  toPublicRelatedEntries,
  type EntityRelationship,
  type EntitySensitivity,
  type EntityStatusValue,
  type PublicRelatedEntry,
  type StatusHistoryEntry,
} from '@repo/domain';

// ---------------------------------------------------------------------------
// Raw typed edges the only hand-authored graph input. `related` entries on
// `PublicEntityView` are computed FROM these via `relatedEntriesFor`, never typed directly.
// ---------------------------------------------------------------------------

const BASE_ENTITY_RELATIONSHIPS: readonly EntityRelationship[] = [
  {
    id: 'rel_dunbar_school_located_at_church',
    fromEntityId: 'ent_dunbar_school_001',
    toEntityId: 'ent_15th_st_church_001',
    type: 'located_at',
    evidenceIds: ['evid_dunbar_located_001'],
    temporal: { validFrom: '1870' },
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
  {
    id: 'rel_landmark_occurred_at_school',
    fromEntityId: 'ent_dc_landmark_listing_1975',
    toEntityId: 'ent_dunbar_school_001',
    type: 'occurred_at',
    evidenceIds: ['evid_landmark_occurred_001'],
    temporal: { validFrom: '1975' },
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
  {
    id: 'rel_alumni_commemorates_landmark',
    fromEntityId: 'ent_dunbar_alumni_federation_001',
    toEntityId: 'ent_dc_landmark_listing_1975',
    type: 'commemorates',
    evidenceIds: ['evid_alumni_commemorates_001'],
    temporal: { validFrom: '2002' },
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
] as const;

export const SEED_ENTITY_RELATIONSHIPS: readonly EntityRelationship[] = [
  ...BASE_ENTITY_RELATIONSHIPS,
] as const;

/**
 * Builds one entity's public related-entry list by running the REAL adjacency builder over
 * `SEED_ENTITY_RELATIONSHIPS`, then projecting to the public `{id, type, direction, timespan}`
 * shape the exact function pair a real release build calls (`packages/domain/src/graph/build.ts`
 * `adjacency.ts`).
 */
export function relatedEntriesFor(entityId: string): readonly PublicRelatedEntry[] {
  return toPublicRelatedEntries(buildEntityAdjacency(entityId, SEED_ENTITY_RELATIONSHIPS));
}

// ---------------------------------------------------------------------------
// time-scoped status history (place | school | institution the PlaceLikeStatus
// vocabulary). `event` entities intentionally have no entry here their when-span is
// authoritative (see `eventWindow` on `PublicEntityView` in./public-seed.ts).
// ---------------------------------------------------------------------------

export const SEED_STATUS_HISTORY: Readonly<
  Record<string, readonly StatusHistoryEntry<EntityStatusValue>[]>
> = {
  ent_15th_st_church_001: [
    {
      status: 'active',
      validFrom: '1841',
      datePrecision: 'year',
      basisClaimIds: ['claim_church_founded_1841'],
    },
  ],
  ent_dunbar_school_001: [
    {
      status: 'historic',
      validFrom: '1870',
      validTo: '1891',
      datePrecision: 'year',
      basisClaimIds: ['claim_dunbar_founded_1870'],
    },
    {
      status: 'active',
      validFrom: '1891',
      datePrecision: 'year',
      basisClaimIds: ['claim_dunbar_renamed_m_street_1891'],
    },
  ],
  ent_dunbar_alumni_federation_001: [
    {
      status: 'active',
      validFrom: '2002',
      datePrecision: 'year',
      basisClaimIds: ['claim_alumni_organized_2002'],
    },
  ],
};

/** The entity's current status, ALWAYS derived from the open-ended `statusHistory` record never
 * an independently hand-set scalar. Returns `undefined` for kinds with no history
 * (e.g. `event`), matching `currentEntityStatus`'s behavior for statusless kinds. */
export function currentStatusFor(entityId: string): EntityStatusValue | undefined {
  return currentStatus(SEED_STATUS_HISTORY[entityId]);
}

export function statusHistoryFor(
  entityId: string,
): readonly StatusHistoryEntry<EntityStatusValue>[] | undefined {
  return SEED_STATUS_HISTORY[entityId];
}

// ---------------------------------------------------------------------------
// sensitivity flag (schema only presentation is `SensitivityContextBanner`).
// One flagged fixture demonstrates the banner: a real, documented, bittersweet preservation
// history (not a conduct/identity dispute), citing a real claim on the entity's own claims list.
// ---------------------------------------------------------------------------

export const SEED_SENSITIVITY: Readonly<Record<string, EntitySensitivity>> = {
  ent_dunbar_school_001: {
    class: 'contested_legacy',
    note:
      'The school’s original 1916 building was demolished in 1977, and its 1970s replacement was ' +
      'itself demolished in 2013; the demolitions were emotionally significant for alumni, though ' +
      'the buildings had seriously deteriorated by the time each was torn down. The current 2013 ' +
      'building sits on the original footprint and honors the school’s history through graduate ' +
      'plaques and paintings of alumni who appeared on U.S. postage stamps, rather than preserving ' +
      'the original structure.',
    basisClaimIds: ['claim_dunbar_demolitions_1977_2013'],
  },
};

export function sensitivityFor(entityId: string): EntitySensitivity | undefined {
  return SEED_SENSITIVITY[entityId];
}

// ---------------------------------------------------------------------------
// Graph-driven timeline
// ---------------------------------------------------------------------------

/**
 * The builder itself now lives in `@repo/domain` (`graph/timeline.ts`) so `apps/api-public` can
 * serve the same timeline this page renders instead of hard-coding an empty array — see
 * repo-n7p6.6 item 2. Re-exported here unchanged so every existing import path keeps working.
 */
export {
  buildGraphTimeline,
  relationshipSentence,
  isUndatedTimelineEntry,
  UNDATED_LABEL,
} from '@repo/domain';
export type { GraphTimelineEntry, TimelineRelatedEntry, TimelineSourceEntity } from '@repo/domain';
