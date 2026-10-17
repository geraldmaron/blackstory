/** Admin reads for Postgres discovery graylist entries parked below the relevance bar. */
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import {
  createSqlBinder,
  normalizeDeskPageSize,
  paginate,
  type DeskPage,
  type FacetBucket,
} from '@/admin/lib/desk-query';
import type { GraylistQuery, GraylistSortKey } from './graylist-query';

export type GraylistListItem = {
  readonly id: string;
  readonly candidateId: string;
  readonly disposition: string;
  readonly status: string;
  readonly compositeScore: number;
  readonly parkedAt: string;
  readonly updatedAt: string;
  readonly reason: string;
  readonly adapterId?: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function listDiscoveryGraylist(limit = 100): Promise<readonly GraylistListItem[]> {
  const capped = Math.min(200, Math.max(1, limit));
  const rows = await queryPostgres<{
    readonly id: string;
    readonly candidate_id: string;
    readonly disposition: string;
    readonly status: string;
    readonly composite_score: number;
    readonly parked_at: Date | string;
    readonly updated_at: Date | string;
    readonly reason: string;
    readonly adapter_id: string | null;
  }>(
    `SELECT id, candidate_id, disposition, status, composite_score, parked_at, updated_at, reason, adapter_id
     FROM ops.discovery_graylist
     ORDER BY parked_at DESC
     LIMIT $1`,
    [capped],
  );
  return rows.map((row) => ({
    id: row.id,
    candidateId: row.candidate_id,
    disposition: row.disposition,
    status: row.status,
    compositeScore: row.composite_score,
    parkedAt: toIso(row.parked_at),
    updatedAt: toIso(row.updated_at),
    reason: row.reason,
    ...(row.adapter_id ? { adapterId: row.adapter_id } : {}),
  }));
}

export async function tryListDiscoveryGraylist(
  limit?: number,
): Promise<readonly GraylistListItem[] | null> {
  try {
    return await listDiscoveryGraylist(limit);
  } catch (error) {
    console.error('admin discovery graylist list failed', error);
    return null;
  }
}

const GRAYLIST_SORT_SQL: Record<GraylistSortKey, string> = {
  parked: 'parked_at',
  score: 'composite_score',
  updated: 'updated_at',
};

function buildGraylistWhere(query: GraylistQuery, omit?: 'statuses' | 'dispositions') {
  const { bind, params } = createSqlBinder();
  const conditions: string[] = [];
  if (query.statuses?.length && omit !== 'statuses') {
    conditions.push(`status = ANY(${bind([...query.statuses])}::text[])`);
  }
  if (query.dispositions?.length && omit !== 'dispositions') {
    conditions.push(`disposition = ANY(${bind([...query.dispositions])}::text[])`);
  }
  const search = query.search?.trim();
  if (search) {
    const needle = bind(`%${search}%`);
    conditions.push(
      `(candidate_id ILIKE ${needle} OR id ILIKE ${needle} OR reason ILIKE ${needle}` +
        ` OR adapter_id ILIKE ${needle})`,
    );
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

type GraylistSqlRow = {
  readonly id: string;
  readonly candidate_id: string;
  readonly disposition: string;
  readonly status: string;
  readonly composite_score: number;
  readonly parked_at: Date | string;
  readonly updated_at: Date | string;
  readonly reason: string;
  readonly adapter_id: string | null;
};

/** One page of graylist entries under the query's filters; every entry is reachable. */
export async function queryGraylistPage(query: GraylistQuery): Promise<DeskPage<GraylistListItem>> {
  const pageSize = normalizeDeskPageSize(query.pageSize);
  const where = buildGraylistWhere(query);
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  const sort = GRAYLIST_SORT_SQL[query.sort ?? 'parked'];
  const counted = await queryPostgres<{ readonly total: string }>(
    `SELECT count(*)::text AS total FROM ops.discovery_graylist ${where.sql}`,
    where.params,
  );
  const total = Number(counted[0]?.total ?? 0);
  const { page, pageCount, offset } = paginate(total, query.page, pageSize);
  const rows = await queryPostgres<GraylistSqlRow>(
    `SELECT id, candidate_id, disposition, status, composite_score, parked_at, updated_at, reason, adapter_id
     FROM ops.discovery_graylist
     ${where.sql}
     ORDER BY ${sort} ${direction}, id ASC
     LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
    [...where.params, pageSize, offset],
  );
  return {
    rows: rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      disposition: row.disposition,
      status: row.status,
      compositeScore: row.composite_score,
      parkedAt: toIso(row.parked_at),
      updatedAt: toIso(row.updated_at),
      reason: row.reason,
      ...(row.adapter_id ? { adapterId: row.adapter_id } : {}),
    })),
    total,
    page,
    pageSize,
    pageCount,
  };
}

export type GraylistFacets = {
  readonly status: readonly FacetBucket[];
  readonly disposition: readonly FacetBucket[];
};

async function graylistFacet(
  query: GraylistQuery,
  omit: 'statuses' | 'dispositions',
  column: 'status' | 'disposition',
): Promise<readonly FacetBucket[]> {
  const where = buildGraylistWhere(query, omit);
  const rows = await queryPostgres<{ readonly value: string; readonly count: string }>(
    `SELECT ${column} AS value, count(*)::text AS count
     FROM ops.discovery_graylist ${where.sql}
     GROUP BY 1 ORDER BY count(*) DESC, 1 ASC`,
    where.params,
  );
  return rows.map((row) => ({ value: row.value, count: Number(row.count) }));
}

export async function queryGraylistFacets(query: GraylistQuery): Promise<GraylistFacets> {
  const [status, disposition] = await Promise.all([
    graylistFacet(query, 'statuses', 'status'),
    graylistFacet(query, 'dispositions', 'disposition'),
  ]);
  return { status, disposition };
}
