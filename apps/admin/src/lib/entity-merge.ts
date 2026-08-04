/**
 * Entity merge: repoint everything an absorbed record owns onto a survivor, inside the audited
 * canonical-write transaction, and record enough to run the whole thing backwards.
 *
 * The rule every statement here obeys is stated in `entity-merge-plan.ts`: a merge moves rows and
 * never deletes them. A row that cannot move cleanly stays on the absorbed record and is reported
 * to the operator. Concretely, the collisions the live schema can produce are:
 *
 *   - `event_participation` UNIQUE (event_id, participant_id, role).
 *   - `entity_embeddings` and `entity_reconciliation_status` are keyed by `entity_id` alone, so
 *     the survivor's own row wins and the absorbed one stays put.
 *   - `entity_relationships` has no unique constraint, but an edge between the survivor and an
 *     absorbed record would become a self-loop, which is not a fact about anything.
 *
 * `claims`, `entity_locations`, `entity_aliases`, and `entity_identifiers` are keyed by their own
 * id and always move. Identifiers deserve a note, because the opposite was assumed while B2 was
 * built: `UNIQUE (namespace, value)` on `entity_identifiers` is global rather than per entity,
 * which means two entities can never hold the same identifier in the first place. A merge
 * therefore has no identifier collisions to reconcile — the constraint that makes adding a
 * borrowed identifier fail is the same one that makes the merge case impossible. Verified live:
 * zero (namespace, value) pairs are held by more than one entity, and the database refuses to
 * create one.
 *
 * What this deliberately does not touch: `bb_public.release_entities` and `bb_public.search_index`
 * are published release surfaces. A merge is a canonical decision; the next release build reads
 * canonical, and the signed manifest is still the only thing that changes what is live.
 */
import type pg from 'pg';
import {
  MERGE_TABLES,
  type MergeReversalRecord,
  type MergeTable,
  type MergeTableOutcome,
  type MovedRow,
} from './entity-merge-plan.js';
import { queryPostgres } from './postgres-client.js';

/* -------------------------------------------------------------------------- */
/* Preview                                                                     */
/* -------------------------------------------------------------------------- */

export type MergeCandidate = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly entityClass?: string;
  readonly claimCount: number;
  readonly relationshipCount: number;
  readonly identifierCount: number;
  readonly locationCount: number;
  readonly updatedAt: string;
  /** Set when this record has already been absorbed by an earlier merge. */
  readonly absorbedBy?: string;
};

/**
 * The candidates for a merge, with the weight of each so an operator can pick the survivor on
 * evidence rather than on which row they happened to click first.
 */
export async function readMergeCandidates(
  entityIds: readonly string[],
): Promise<readonly MergeCandidate[]> {
  const ids = [...new Set(entityIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const rows = await queryPostgres<{
    id: string;
    display_name: string;
    kind: string;
    entity_class: string | null;
    merge_state: unknown;
    updated_at: Date | string;
    claim_count: string;
    relationship_count: string;
    identifier_count: string;
    location_count: string;
  }>(
    `SELECT
       e.id, e.display_name, e.kind, e.entity_class, e.merge_state, e.updated_at,
       (SELECT count(*) FROM bb_canonical.claims c WHERE c.entity_id = e.id) AS claim_count,
       (SELECT count(*) FROM bb_canonical.entity_relationships r
         WHERE r.from_entity_id = e.id OR r.to_entity_id = e.id) AS relationship_count,
       (SELECT count(*) FROM bb_canonical.entity_identifiers i WHERE i.entity_id = e.id)
         AS identifier_count,
       (SELECT count(*) FROM bb_canonical.entity_locations l WHERE l.entity_id = e.id)
         AS location_count
     FROM bb_canonical.entities e
     WHERE e.id = ANY($1::text[])
     ORDER BY claim_count DESC, relationship_count DESC, e.id ASC`,
    [ids],
  );

  return rows.map((row) => {
    const mergeState = row.merge_state as { status?: unknown; survivorId?: unknown } | null;
    const absorbedBy =
      mergeState && mergeState.status === 'absorbed' && typeof mergeState.survivorId === 'string'
        ? mergeState.survivorId
        : undefined;
    return {
      id: row.id,
      displayName: row.display_name,
      kind: row.kind,
      ...(row.entity_class ? { entityClass: row.entity_class } : {}),
      claimCount: Number(row.claim_count),
      relationshipCount: Number(row.relationship_count),
      identifierCount: Number(row.identifier_count),
      locationCount: Number(row.location_count),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString(),
      ...(absorbedBy ? { absorbedBy } : {}),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Apply                                                                       */
/* -------------------------------------------------------------------------- */

type MoveRow = { id: string; from: Record<string, string> };

function outcome(moved: readonly MoveRow[], leftBehind: MergeTableOutcome['leftBehind']) {
  return { moved: moved as readonly MovedRow[], leftBehind };
}

/**
 * Relationships: both endpoints are rewritten in one pass, because a single edge can have an
 * absorbed record at each end. Edges that would collapse to a self-loop stay behind.
 */
async function moveRelationships(
  client: pg.PoolClient,
  survivorId: string,
  absorbedIds: readonly string[],
): Promise<MergeTableOutcome> {
  const params = [survivorId, absorbedIds];
  const candidate = `
    SELECT id,
      CASE WHEN from_entity_id = ANY($2::text[]) THEN $1 ELSE from_entity_id END AS new_from,
      CASE WHEN to_entity_id   = ANY($2::text[]) THEN $1 ELSE to_entity_id   END AS new_to,
      from_entity_id AS old_from, to_entity_id AS old_to
    FROM bb_canonical.entity_relationships
    WHERE from_entity_id = ANY($2::text[]) OR to_entity_id = ANY($2::text[])`;

  const moved = await client.query<{ id: string; old_from: string; old_to: string }>(
    `WITH candidate AS (${candidate}),
     movable AS (SELECT * FROM candidate WHERE new_from <> new_to)
     UPDATE bb_canonical.entity_relationships r
     SET from_entity_id = m.new_from, to_entity_id = m.new_to, updated_at = now()
     FROM movable m
     WHERE r.id = m.id
     RETURNING r.id, m.old_from, m.old_to`,
    params,
  );

  const stuck = await client.query<{ id: string }>(
    `WITH candidate AS (${candidate})
     SELECT id FROM candidate WHERE new_from = new_to`,
    params,
  );

  return outcome(
    moved.rows.map((row) => ({ id: row.id, from: { from: row.old_from, to: row.old_to } })),
    stuck.rows.map((row) => ({
      id: row.id,
      reason:
        'Edge runs between the survivor and an absorbed record; moving it would be a self-loop.',
    })),
  );
}

/**
 * Event participation: same two-endpoint rewrite, plus the UNIQUE (event, participant, role)
 * guard. `DISTINCT ON` settles the case where two absorbed records both hold the same role in the
 * same event — one moves, the other stays.
 */
async function moveEventParticipation(
  client: pg.PoolClient,
  survivorId: string,
  absorbedIds: readonly string[],
): Promise<MergeTableOutcome> {
  const params = [survivorId, absorbedIds];
  const candidate = `
    SELECT id, role,
      CASE WHEN event_id       = ANY($2::text[]) THEN $1 ELSE event_id       END AS new_event,
      CASE WHEN participant_id = ANY($2::text[]) THEN $1 ELSE participant_id END AS new_participant,
      event_id AS old_event, participant_id AS old_participant
    FROM bb_canonical.event_participation
    WHERE event_id = ANY($2::text[]) OR participant_id = ANY($2::text[])`;
  const movable = `
    SELECT DISTINCT ON (c.new_event, c.new_participant, c.role) c.*
    FROM candidate c
    WHERE c.new_event <> c.new_participant
      AND NOT EXISTS (
        SELECT 1 FROM bb_canonical.event_participation e
        WHERE e.event_id = c.new_event
          AND e.participant_id = c.new_participant
          AND e.role = c.role
          AND e.id <> c.id
      )
    ORDER BY c.new_event, c.new_participant, c.role, c.id`;

  const moved = await client.query<{ id: string; old_event: string; old_participant: string }>(
    `WITH candidate AS (${candidate}), movable AS (${movable})
     UPDATE bb_canonical.event_participation p
     SET event_id = m.new_event, participant_id = m.new_participant, updated_at = now()
     FROM movable m
     WHERE p.id = m.id
     RETURNING p.id, m.old_event, m.old_participant`,
    params,
  );

  const stuck = await client.query<{ id: string; self_loop: boolean }>(
    `WITH candidate AS (${candidate}), movable AS (${movable})
     SELECT c.id, (c.new_event = c.new_participant) AS self_loop
     FROM candidate c
     WHERE c.id NOT IN (SELECT id FROM movable)`,
    params,
  );

  return outcome(
    moved.rows.map((row) => ({
      id: row.id,
      from: { event: row.old_event, participant: row.old_participant },
    })),
    stuck.rows.map((row) => ({
      id: row.id,
      reason: row.self_loop
        ? 'Participation links the survivor to an absorbed record; moving it would be a self-loop.'
        : 'The survivor already has this participant in this event under the same role.',
    })),
  );
}

/** Tables keyed by `entity_id` alone: the survivor's own row wins. */
async function moveSingletonRow(
  client: pg.PoolClient,
  table: 'entity_embeddings' | 'entity_reconciliation_status',
  survivorId: string,
  absorbedIds: readonly string[],
): Promise<MergeTableOutcome> {
  const survivorHasRow = await client.query(
    `SELECT 1 FROM bb_canonical.${table} WHERE entity_id = $1`,
    [survivorId],
  );

  if ((survivorHasRow.rowCount ?? 0) > 0) {
    const stuck = await client.query<{ entity_id: string }>(
      `SELECT entity_id FROM bb_canonical.${table} WHERE entity_id = ANY($1::text[])`,
      [absorbedIds],
    );
    return outcome(
      [],
      stuck.rows.map((row) => ({
        id: row.entity_id,
        reason: `The survivor already has its own ${table.replace(/_/g, ' ')} row.`,
      })),
    );
  }

  // No survivor row: the first absorbed record's row moves, the rest stay (one row per entity).
  const moved = await client.query<{ entity_id: string }>(
    `WITH chosen AS (
       SELECT entity_id FROM bb_canonical.${table}
       WHERE entity_id = ANY($2::text[]) ORDER BY entity_id LIMIT 1
     )
     UPDATE bb_canonical.${table} t
     SET entity_id = $1
     FROM chosen c
     WHERE t.entity_id = c.entity_id
     RETURNING c.entity_id`,
    [survivorId, absorbedIds],
  );
  const stuck = await client.query<{ entity_id: string }>(
    `SELECT entity_id FROM bb_canonical.${table} WHERE entity_id = ANY($1::text[])`,
    [absorbedIds],
  );
  return outcome(
    moved.rows.map((row) => ({ id: row.entity_id, from: { entity: row.entity_id } })),
    stuck.rows.map((row) => ({
      id: row.entity_id,
      reason: `Only one ${table.replace(/_/g, ' ')} row can belong to an entity.`,
    })),
  );
}

export type ApplyMergeInput = {
  readonly survivorId: string;
  readonly absorbedIds: readonly string[];
  readonly mergeId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly absorbedAt: string;
};

/**
 * Run the merge inside a caller-supplied transaction (`commitCanonicalWrite`'s `applyState`), and
 * return the record that reverses it. Throwing here rolls back the audit event with the state,
 * which is the point: an unaudited merge is not reachable.
 */
export async function applyEntityMerge(
  client: pg.PoolClient,
  input: ApplyMergeInput,
): Promise<MergeReversalRecord> {
  const { survivorId, absorbedIds, mergeId } = input;

  const survivor = await client.query<{ merge_state: unknown }>(
    `SELECT merge_state FROM bb_canonical.entities WHERE id = $1 FOR UPDATE`,
    [survivorId],
  );
  if (survivor.rowCount === 0) {
    throw new Error(`Survivor ${survivorId} no longer exists.`);
  }
  const survivorMergeState = survivor.rows[0]?.merge_state as { status?: unknown } | null;
  if (survivorMergeState?.status === 'absorbed') {
    throw new Error(
      `${survivorId} has itself been absorbed by an earlier merge and cannot be a survivor.`,
    );
  }

  const absorbed = await client.query<{ id: string; merge_state: unknown }>(
    `SELECT id, merge_state FROM bb_canonical.entities WHERE id = ANY($1::text[]) FOR UPDATE`,
    [absorbedIds],
  );
  if (absorbed.rowCount !== absorbedIds.length) {
    const found = new Set(absorbed.rows.map((row) => row.id));
    const missing = absorbedIds.filter((id) => !found.has(id));
    throw new Error(`No longer in the catalog: ${missing.join(', ')}.`);
  }
  for (const row of absorbed.rows) {
    if ((row.merge_state as { status?: unknown } | null)?.status === 'absorbed') {
      throw new Error(`${row.id} was already absorbed by an earlier merge.`);
    }
  }

  await client.query(
    `INSERT INTO bb_canonical.entity_merges (id, survivor_id, status, reason, actor_id)
     VALUES ($1, $2, 'active', $3, $4)`,
    [mergeId, survivorId, input.reason, input.actorId],
  );
  await client.query(
    `INSERT INTO bb_canonical.entity_merge_absorbed (merge_id, absorbed_id)
     SELECT $1, unnest($2::text[])`,
    [mergeId, absorbedIds],
  );

  const tables: Partial<Record<MergeTable, MergeTableOutcome>> = {
    entity_relationships: await moveRelationships(client, survivorId, absorbedIds),
    event_participation: await moveEventParticipation(client, survivorId, absorbedIds),
    entity_embeddings: await moveSingletonRow(client, 'entity_embeddings', survivorId, absorbedIds),
    entity_reconciliation_status: await moveSingletonRow(
      client,
      'entity_reconciliation_status',
      survivorId,
      absorbedIds,
    ),
  };

  // Rows keyed by their own id: capture the owner before the update so reversal is exact.
  for (const table of [
    'claims',
    'entity_locations',
    'entity_aliases',
    'entity_identifiers',
  ] as const) {
    const before = await client.query<{ id: string; entity_id: string }>(
      `SELECT id, entity_id FROM bb_canonical.${table} WHERE entity_id = ANY($1::text[])`,
      [absorbedIds],
    );
    if (before.rowCount === 0) {
      tables[table] = outcome([], []);
      continue;
    }
    const hasUpdatedAt = table === 'claims' || table === 'entity_locations';
    await client.query(
      `UPDATE bb_canonical.${table}
       SET entity_id = $1${hasUpdatedAt ? ', updated_at = now()' : ''}
       WHERE entity_id = ANY($2::text[])`,
      [survivorId, absorbedIds],
    );
    tables[table] = outcome(
      before.rows.map((row) => ({ id: row.id, from: { entity: row.entity_id } })),
      [],
    );
  }

  for (const absorbedId of absorbedIds) {
    await client.query(
      `UPDATE bb_canonical.entities
       SET merge_state = $2::jsonb, updated_at = now()
       WHERE id = $1`,
      [
        absorbedId,
        JSON.stringify({
          status: 'absorbed',
          survivorId,
          mergeId,
          absorbedAt: input.absorbedAt,
          reason: input.reason,
        }),
      ],
    );
  }
  await client.query(`UPDATE bb_canonical.entities SET updated_at = now() WHERE id = $1`, [
    survivorId,
  ]);

  return { mergeId, survivorId, absorbedIds, tables };
}

/* -------------------------------------------------------------------------- */
/* Reverse                                                                     */
/* -------------------------------------------------------------------------- */

const RELATIONSHIP_ENDPOINTS: Readonly<Record<string, readonly [string, string]>> = {
  entity_relationships: ['from_entity_id', 'to_entity_id'],
  event_participation: ['event_id', 'participant_id'],
};

/**
 * Put every recorded row back where it came from. Rows that have since been deleted simply do not
 * come back — reversal restores what still exists rather than resurrecting history, and the count
 * it returns is what actually moved.
 */
export async function reverseEntityMerge(
  client: pg.PoolClient,
  record: MergeReversalRecord,
  reverseReason: string,
): Promise<{ readonly restored: number }> {
  let restored = 0;

  for (const table of MERGE_TABLES) {
    const outcomeForTable = record.tables[table];
    if (!outcomeForTable || outcomeForTable.moved.length === 0) continue;

    const endpoints = RELATIONSHIP_ENDPOINTS[table];
    for (const row of outcomeForTable.moved) {
      if (endpoints) {
        const [first, second] = endpoints;
        const firstKey = table === 'entity_relationships' ? 'from' : 'event';
        const secondKey = table === 'entity_relationships' ? 'to' : 'participant';
        const result = await client.query(
          `UPDATE bb_canonical.${table}
           SET ${first} = $2, ${second} = $3, updated_at = now()
           WHERE id = $1`,
          [row.id, row.from[firstKey], row.from[secondKey]],
        );
        restored += result.rowCount ?? 0;
        continue;
      }

      if (table === 'entity_embeddings' || table === 'entity_reconciliation_status') {
        const result = await client.query(
          `UPDATE bb_canonical.${table} SET entity_id = $2 WHERE entity_id = $1`,
          [record.survivorId, row.from.entity],
        );
        restored += result.rowCount ?? 0;
        continue;
      }

      // `entity_aliases` and `entity_identifiers` have no `updated_at` column.
      const touch =
        table === 'claims' || table === 'entity_locations' ? ', updated_at = now()' : '';
      const result = await client.query(
        `UPDATE bb_canonical.${table} SET entity_id = $2${touch} WHERE id = $1`,
        [row.id, row.from.entity],
      );
      restored += result.rowCount ?? 0;
    }
  }

  for (const absorbedId of record.absorbedIds) {
    await client.query(
      `UPDATE bb_canonical.entities SET merge_state = '{}'::jsonb, updated_at = now()
       WHERE id = $1`,
      [absorbedId],
    );
  }
  await client.query(
    `UPDATE bb_canonical.entity_merges
     SET status = 'reversed', reversed_at = now(), reverse_reason = $2, updated_at = now()
     WHERE id = $1 AND status = 'active'`,
    [record.mergeId, reverseReason],
  );
  await client.query(`UPDATE bb_canonical.entities SET updated_at = now() WHERE id = $1`, [
    record.survivorId,
  ]);

  return { restored };
}

/** The reversal record for a merge, read back off its audit event. */
export async function readMergeReversalRecord(
  mergeId: string,
): Promise<MergeReversalRecord | null> {
  const rows = await queryPostgres<{ data: unknown }>(
    `SELECT data FROM bb_audit.events
     WHERE data->>'verb' = 'entity.merge' AND data->'reversal'->>'mergeId' = $1
     ORDER BY occurred_at DESC
     LIMIT 1`,
    [mergeId],
  );
  const data = rows[0]?.data as { reversal?: MergeReversalRecord } | undefined;
  return data?.reversal ?? null;
}

export type ActiveMerge = {
  readonly mergeId: string;
  readonly absorbedIds: readonly string[];
  readonly reason: string;
  readonly createdAt: string;
  /** Rows that stayed with an absorbed record because they would have collided. */
  readonly leftBehind: readonly { readonly table: string; readonly reason: string }[];
  /** False for merges made before the console recorded a reversal record (the ops scripts). */
  readonly reversible: boolean;
};

/**
 * Active merges where this entity is the survivor, newest first, joined to the audit event that
 * carries the reversal record. A merge with no such record is shown as not reversible rather than
 * offering a button that would fail — the two ops-script merges already in the ledger are exactly
 * that case.
 */
export async function readActiveMergesFor(survivorId: string): Promise<readonly ActiveMerge[]> {
  const rows = await queryPostgres<{
    id: string;
    reason: string;
    created_at: Date | string;
    absorbed_ids: string[];
    reversal: unknown;
  }>(
    `SELECT m.id, m.reason, m.created_at,
            coalesce(array_agg(DISTINCT a.absorbed_id)
                     FILTER (WHERE a.absorbed_id IS NOT NULL), '{}') AS absorbed_ids,
            (SELECT e.data->'reversal'
             FROM bb_audit.events e
             WHERE e.data->'reversal'->>'mergeId' = m.id
             ORDER BY e.occurred_at DESC
             LIMIT 1) AS reversal
     FROM bb_canonical.entity_merges m
     LEFT JOIN bb_canonical.entity_merge_absorbed a ON a.merge_id = m.id
     WHERE m.survivor_id = $1 AND m.status = 'active'
     GROUP BY m.id, m.reason, m.created_at
     ORDER BY m.created_at DESC`,
    [survivorId],
  );

  return rows.map((row) => {
    const reversal = row.reversal as MergeReversalRecord | null;
    const leftBehind: { table: string; reason: string }[] = [];
    if (reversal?.tables) {
      for (const [table, outcomeForTable] of Object.entries(reversal.tables)) {
        for (const entry of outcomeForTable?.leftBehind ?? []) {
          leftBehind.push({ table, reason: entry.reason });
        }
      }
    }
    return {
      mergeId: row.id,
      absorbedIds: row.absorbed_ids ?? [],
      reason: row.reason,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
      leftBehind,
      reversible: Boolean(reversal),
    };
  });
}
