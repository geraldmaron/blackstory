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
} from '@black-book/domain';

// ---------------------------------------------------------------------------
// Raw typed edges the only hand-authored graph input. `related` entries on
// `PublicEntityView` are computed FROM these via `relatedEntriesFor`, never typed directly.
// ---------------------------------------------------------------------------

export const SEED_ENTITY_RELATIONSHIPS: readonly EntityRelationship[] = [
  {
    id: 'rel_seed_school_located_at_place',
    fromEntityId: 'ent_seed_school_001',
    toEntityId: 'ent_seed_place_001',
    type: 'located_at',
    evidenceIds: ['evid_seed_located_001'],
    temporal: { validFrom: '1868' },
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
  {
    id: 'rel_seed_event_occurred_at_school',
    fromEntityId: 'ent_seed_event_001',
    toEntityId: 'ent_seed_school_001',
    type: 'occurred_at',
    evidenceIds: ['evid_seed_occurred_001'],
    temporal: { validFrom: '1954' },
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
  {
    id: 'rel_seed_institution_commemorates_event',
    fromEntityId: 'ent_seed_institution_001',
    toEntityId: 'ent_seed_event_001',
    type: 'commemorates',
    evidenceIds: ['evid_seed_commemorates_001'],
    temporal: { validFrom: '1975' },
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
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

export const SEED_STATUS_HISTORY: Readonly<Record<string, readonly StatusHistoryEntry<EntityStatusValue>[]>> = {
  ent_seed_place_001: [
    { status: 'historic', validFrom: '1950', datePrecision: 'year', basisClaimIds: ['claim_seed_001'] },
  ],
  ent_seed_school_001: [
    {
      status: 'historic',
      validFrom: '1868',
      validTo: '1954',
      datePrecision: 'year',
      basisClaimIds: ['claim_seed_002'],
    },
    { status: 'active', validFrom: '1954', datePrecision: 'year', basisClaimIds: ['claim_seed_003'] },
  ],
  ent_seed_institution_001: [
    { status: 'active', validFrom: '1975', datePrecision: 'year', basisClaimIds: ['claim_seed_004'] },
  ],
};

/** The entity's current status, ALWAYS derived from the open-ended `statusHistory` record never
 * an independently hand-set scalar. Returns `undefined` for kinds with no history
 * (e.g. `event`), matching `currentEntityStatus`'s behavior for statusless kinds. */
export function currentStatusFor(entityId: string): EntityStatusValue | undefined {
  return currentStatus(SEED_STATUS_HISTORY[entityId]);
}

export function statusHistoryFor(entityId: string): readonly StatusHistoryEntry<EntityStatusValue>[] | undefined {
  return SEED_STATUS_HISTORY[entityId];
}

// ---------------------------------------------------------------------------
// sensitivity flag (schema only presentation is `SensitivityContextBanner`).
// One flagged fixture demonstrates the banner; the note is conduct-based (a documented dispute
// action), never an identity attribute, and cites a real claim on the entity's own claims list.
// ---------------------------------------------------------------------------

export const SEED_SENSITIVITY: Readonly<Record<string, EntitySensitivity>> = {
  ent_seed_place_001: {
    class: 'contested_legacy',
    note:
      'Historical society records document a contested 1920s land-use dispute in which local ' +
      'authorities took disputed displacement actions affecting the community historically ' +
      'associated with this site.',
    basisClaimIds: ['claim_seed_005'],
  },
};

export function sensitivityFor(entityId: string): EntitySensitivity | undefined {
  return SEED_SENSITIVITY[entityId];
}

// ---------------------------------------------------------------------------
// Graph-driven timeline
// ---------------------------------------------------------------------------

export type GraphTimelineEntry = {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly body: string;
};

/** Structurally matches both this module's own `PublicRelatedEntry` (domain, `type:
 * RelationshipType`) and `./public-seed.ts`'s public-projection `PublicRelatedEntry` (`type:
 * string`) — the timeline builder only ever humanizes/reads `type`, never re-validates it against
 * the closed `RelationshipType` vocabulary, so it accepts the wider public-projection shape. */
export type TimelineRelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?: { readonly validFrom?: string; readonly validTo?: string | null };
};

export type TimelineSourceEntity = {
  readonly id: string;
  readonly displayName: string;
  readonly statusHistory?: readonly StatusHistoryEntry<EntityStatusValue>[];
  readonly related?: readonly TimelineRelatedEntry[];
};

function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** `{from} <verb phrase> {to}` sentence templates for the relationship types this seed graph
 * uses, plus a generic fallback for any other `RelationshipType` a future edit might add. Mirrors
 * the direction semantics documented in `RELATIONSHIP_TYPE_SEMANTICS`
 * (packages/domain/src/relationship.ts). */
const RELATIONSHIP_SENTENCE_TEMPLATES: Readonly<Record<string, (from: string, to: string) => string>> = {
  located_at: (from, to) => `${from} is located at ${to}.`,
  occurred_at: (from, to) => `${from} occurred at ${to}.`,
  commemorates: (from, to) => `${from} commemorates ${to}.`,
  member_of: (from, to) => `${from} is a member of ${to}.`,
  part_of: (from, to) => `${from} is part of ${to}.`,
  founded: (from, to) => `${from} founded ${to}.`,
};

/** Exported so `apps/web/src/components/entity/EntityRelatedList.tsx` can render the identical
 * sentence the timeline uses one description of a graph edge, not two independently-drifting
 * copies. */
export function relationshipSentence(
  entry: TimelineRelatedEntry,
  thisDisplayName: string,
  neighborDisplayName: string,
): string {
  const template =
    RELATIONSHIP_SENTENCE_TEMPLATES[entry.type] ??
    ((from: string, to: string) => `${from} ${humanizeToken(entry.type).toLowerCase()} ${to}.`);
  return entry.direction === 'outgoing'
    ? template(thisDisplayName, neighborDisplayName)
    : template(neighborDisplayName, thisDisplayName);
}

/**
 * Builds one entity's timeline purely from its status history and related-entry
 * timespans the two structured, evidence-backed inputs the entity page has, sorted
 * chronologically. `entitiesById` resolves neighbor display names for the relationship sentences;
 * callers pass a lookup over the full seed catalog (see `./public-seed.ts`).
 */
export function buildGraphTimeline(
  entity: TimelineSourceEntity,
  entitiesById: ReadonlyMap<string, { readonly displayName: string }>,
): readonly GraphTimelineEntry[] {
  const dated: { readonly sortKey: string; readonly entry: GraphTimelineEntry }[] = [];

  (entity.statusHistory ?? []).forEach((record, index) => {
    const basis = record.basisClaimIds.length > 0 ? record.basisClaimIds.join(', ') : 'none recorded';
    dated.push({
      sortKey: record.validFrom ?? '',
      entry: {
        id: `${entity.id}_status_${index}`,
        time: record.validFrom ?? 'Undated',
        title: `Status: ${humanizeToken(record.status)}`,
        body: record.validTo
          ? `In effect from ${record.validFrom ?? 'an undated point'} through ${record.validTo}. Basis: ${basis}.`
          : `In effect from ${record.validFrom ?? 'an undated point'}, ongoing as of this release. Basis: ${basis}.`,
      },
    });
  });

  for (const rel of entity.related ?? []) {
    if (!rel.timespan?.validFrom) continue;
    const neighborName = entitiesById.get(rel.id)?.displayName ?? rel.id;
    const sentence = relationshipSentence(rel, entity.displayName, neighborName);
    dated.push({
      sortKey: rel.timespan.validFrom,
      entry: {
        id: `${entity.id}_rel_${rel.id}_${rel.type}`,
        time: rel.timespan.validFrom,
        title: humanizeToken(rel.type),
        body: rel.timespan.validTo ? `${sentence} Through ${rel.timespan.validTo}.` : `${sentence} Ongoing connection.`,
      },
    });
  }

  return dated
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.entry.id.localeCompare(b.entry.id))
    .map((item) => item.entry);
}
