/**
 * Postgres reads and the set-based bulk write for bb_ops catalog decisions.
 */
import type pg from 'pg';
import { queryPostgres } from './canonical-postgres-client.js';

export type CatalogDecisionAction = 'flag_for_retraction' | 'needs_review' | 'clear_flag';

export type CatalogDecisionRecord = {
  readonly entityId: string;
  readonly action: CatalogDecisionAction;
  readonly reason: string;
  readonly decidedByUid: string;
  readonly decidedByEmail: string;
  readonly decidedAt: string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type CatalogDecisionRow = {
  readonly entity_id: string;
  readonly decision: CatalogDecisionAction;
  readonly actor_id: string;
  readonly reason: string | null;
  readonly decided_at: Date | string;
  readonly metadata: Record<string, unknown> | null;
};

function mapCatalogDecisionRow(row: CatalogDecisionRow): CatalogDecisionRecord {
  const decidedByEmail =
    readString(row.metadata?.decidedByEmail) ??
    readString(row.metadata?.decided_by_email) ??
    row.actor_id;
  return {
    entityId: row.entity_id,
    action: row.decision,
    reason: row.reason ?? '',
    decidedByUid: row.actor_id,
    decidedByEmail,
    decidedAt: toIso(row.decided_at),
  };
}

export async function listCatalogDecisionsPostgres(
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, CatalogDecisionRecord>> {
  if (entityIds.length === 0) return new Map();
  const rows = await queryPostgres<CatalogDecisionRow>(
    `SELECT entity_id, decision, actor_id, reason, decided_at, metadata
     FROM bb_ops.catalog_decisions
     WHERE entity_id = ANY($1::text[])`,
    [entityIds],
  );
  const results = new Map<string, CatalogDecisionRecord>();
  for (const row of rows) {
    results.set(row.entity_id, mapCatalogDecisionRow(row));
  }
  return results;
}

/**
 * Writes the same decision for every id in the set with one INSERT ... SELECT over
 * `unnest($1::text[])`, so the statement costs the same whether it addresses 5 rows or 5,000.
 * Relies on the caller having already rejected duplicate ids: `entity_id` is the table's primary
 * key, and an `ON CONFLICT ... DO UPDATE` cannot affect the same row twice within one statement.
 */
export async function writeCatalogDecisionsBulkPostgres(
  client: pg.PoolClient,
  input: {
    readonly entityIds: readonly string[];
    readonly action: CatalogDecisionAction;
    readonly reason: string;
    readonly actorUid: string;
    readonly actorEmail: string;
    readonly decidedAt: string;
  },
): Promise<readonly string[]> {
  const result = await client.query<{ entity_id: string }>(
    `INSERT INTO bb_ops.catalog_decisions
      (entity_id, decision, actor_id, reason, decided_at, metadata)
     SELECT entity_id, $2, $3, $4, $5, $6
     FROM unnest($1::text[]) AS entity_id
     ON CONFLICT (entity_id) DO UPDATE SET
       decision = EXCLUDED.decision,
       actor_id = EXCLUDED.actor_id,
       reason = EXCLUDED.reason,
       decided_at = EXCLUDED.decided_at,
       metadata = EXCLUDED.metadata
     RETURNING entity_id`,
    [
      input.entityIds,
      input.action,
      input.actorUid,
      input.reason,
      input.decidedAt,
      JSON.stringify({ decidedByEmail: input.actorEmail }),
    ],
  );
  return result.rows.map((row) => row.entity_id);
}
