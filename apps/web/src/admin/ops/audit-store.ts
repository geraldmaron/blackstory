/** Admin reads for recent append-only Postgres audit events. */
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { listRecentAuditEventsPostgres } from '@/admin/lib/postgres-ops-reads';
import { createSqlBinder, paginate, type DeskPage, type FacetBucket } from '@/admin/lib/desk-query';
import { normalizeDeskPageSize } from '@/admin/lib/desk-query';
import type { AuditQuery } from './audit-query';

export type AuditEventListItem = {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly actorType: string;
  readonly actorDisplayName?: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly entityId?: string;
  readonly releaseId?: string;
};

export async function listRecentAuditEvents(limit = 100): Promise<readonly AuditEventListItem[]> {
  return listRecentAuditEventsPostgres(limit);
}

export async function tryListRecentAuditEvents(
  limit?: number,
): Promise<readonly AuditEventListItem[] | null> {
  try {
    return await listRecentAuditEvents(limit);
  } catch (error) {
    console.error('admin audit events list failed', error);
    return null;
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function buildAuditWhere(query: AuditQuery, omit?: 'categories' | 'actorTypes') {
  const { bind, params } = createSqlBinder();
  const conditions: string[] = [];
  if (query.categories?.length && omit !== 'categories') {
    conditions.push(`category = ANY(${bind([...query.categories])}::text[])`);
  }
  if (query.actorTypes?.length && omit !== 'actorTypes') {
    conditions.push(`actor->>'type' = ANY(${bind([...query.actorTypes])}::text[])`);
  }
  if (query.from) conditions.push(`occurred_at >= ${bind(query.from)}::date`);
  // Inclusive of the whole end day.
  if (query.to) conditions.push(`occurred_at < (${bind(query.to)}::date + 1)`);
  const search = query.search?.trim();
  if (search) {
    const needle = bind(`%${search}%`);
    conditions.push(
      `(action ILIKE ${needle} OR reason ILIKE ${needle} OR actor->>'id' ILIKE ${needle}` +
        ` OR actor->>'displayName' ILIKE ${needle} OR subject->>'id' ILIKE ${needle}` +
        ` OR entity_id ILIKE ${needle} OR release_id ILIKE ${needle})`,
    );
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

type AuditSqlRow = {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  readonly actor_id: string | null;
  readonly actor_type: string | null;
  readonly actor_name: string | null;
  readonly subject_type: string | null;
  readonly subject_id: string | null;
  readonly reason: string;
  readonly entity_id: string | null;
  readonly release_id: string | null;
  readonly occurred_at: Date | string;
};

/**
 * One page of audit events under the query's filters. The previous list read the latest 100 rows
 * and silently dropped any whose actor or subject was malformed; this one returns every row, with
 * a placeholder where a field is missing, because an audit trail that hides rows is not one.
 */
export async function queryAuditPage(query: AuditQuery): Promise<DeskPage<AuditEventListItem>> {
  const pageSize = normalizeDeskPageSize(query.pageSize);
  const where = buildAuditWhere(query);
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  const counted = await queryPostgres<{ readonly total: string }>(
    `SELECT count(*)::text AS total FROM audit.events ${where.sql}`,
    where.params,
  );
  const total = Number(counted[0]?.total ?? 0);
  const { page, pageCount, offset } = paginate(total, query.page, pageSize);
  const rows = await queryPostgres<AuditSqlRow>(
    `SELECT id, action, category, actor->>'id' AS actor_id, actor->>'type' AS actor_type,
            actor->>'displayName' AS actor_name, subject->>'type' AS subject_type,
            subject->>'id' AS subject_id, reason, entity_id, release_id, occurred_at
     FROM audit.events
     ${where.sql}
     ORDER BY occurred_at ${direction}, id ASC
     LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
    [...where.params, pageSize, offset],
  );
  return {
    rows: rows.map((row) => ({
      id: row.id,
      action: row.action,
      category: row.category,
      occurredAt: toIso(row.occurred_at),
      actorId: row.actor_id ?? '—',
      actorType: row.actor_type ?? 'unknown',
      subjectType: row.subject_type ?? 'unknown',
      subjectId: row.subject_id ?? '—',
      reason: row.reason,
      ...(row.actor_name ? { actorDisplayName: row.actor_name } : {}),
      ...(row.entity_id ? { entityId: row.entity_id } : {}),
      ...(row.release_id ? { releaseId: row.release_id } : {}),
    })),
    total,
    page,
    pageSize,
    pageCount,
  };
}

export type AuditFacets = {
  readonly category: readonly FacetBucket[];
  readonly actorType: readonly FacetBucket[];
};

async function auditFacet(
  query: AuditQuery,
  omit: 'categories' | 'actorTypes',
  expression: string,
): Promise<readonly FacetBucket[]> {
  const where = buildAuditWhere(query, omit);
  const rows = await queryPostgres<{ readonly value: string | null; readonly count: string }>(
    `SELECT ${expression} AS value, count(*)::text AS count
     FROM audit.events ${where.sql}
     GROUP BY 1 ORDER BY count(*) DESC, 1 ASC`,
    where.params,
  );
  return rows
    .filter((row): row is { value: string; count: string } => typeof row.value === 'string')
    .map((row) => ({ value: row.value, count: Number(row.count) }));
}

/** Category and actor-type counts, each under every other active filter. */
export async function queryAuditFacets(query: AuditQuery): Promise<AuditFacets> {
  const [category, actorType] = await Promise.all([
    auditFacet(query, 'categories', 'category'),
    auditFacet(query, 'actorTypes', `actor->>'type'`),
  ]);
  return { category, actorType };
}
