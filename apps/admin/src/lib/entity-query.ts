/**
 * Faceted, paginated, sortable server-side query layer for bb_canonical.entities.
 *
 * Replaces the previous `ORDER BY updated_at DESC LIMIT 200` + client-side substring filter,
 * which made ~95% of the 4,097-row catalog unreachable from the UI. Every filter, sort, and
 * page here is expressible in the URL so a workbench view is shareable and refresh-stable.
 *
 * Pagination is OFFSET-based, not keyset. At this table's size a filtered COUNT(*) is trivial
 * and offset buys two things keyset cannot: a real total (operators need "3,195 places", not
 * "more"), and jump-to-page under an arbitrary sort column. Revisit if entities passes ~100k.
 *
 * Column shapes were verified against the live database rather than inferred from the existing
 * TypeScript, which had drifted from all three JSONB columns — see parseAliases/parseIdentifiers
 * and LIVING_STATUSES below for what the old readers silently dropped.
 */
import { queryPostgres } from './postgres-client.js';

/**
 * Living status lives in the vocabulary module so client components can read it without pulling
 * `pg` into the browser bundle; re-exported because callers of the query layer expect it here.
 * The previous reader accepted only living/deceased/unknown and returned undefined for
 * everything else, so living status was blank for 88% of the catalog.
 */
export { LIVING_STATUSES, type LivingStatus } from './entity-vocabulary.js';
import type { LivingStatus } from './entity-vocabulary.js';

export type EntitySortKey = 'updated' | 'created' | 'name' | 'kind' | 'claims';
export type MergeStateFilter = 'active' | 'absorbed' | 'all';

export type EntitySensitivity = {
  readonly class: string;
  readonly source?: string;
};

export type EntityIdentifier = {
  readonly namespace: string;
  readonly value: string;
  readonly trusted?: boolean;
};

export type EntityMergeState = {
  readonly status: string;
  readonly survivorId?: string;
  readonly mergeId?: string;
  readonly reason?: string;
  readonly absorbedAt?: string;
};

export type EntityRow = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly entityClass?: string;
  readonly livingStatus: LivingStatus | string;
  readonly sensitivity: readonly EntitySensitivity[];
  readonly aliases: readonly string[];
  readonly claimCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mergeState?: EntityMergeState;
};

export type EntityQuery = {
  readonly search?: string;
  readonly kinds?: readonly string[];
  readonly entityClasses?: readonly string[];
  readonly livingStatuses?: readonly string[];
  readonly sensitivityClasses?: readonly string[];
  readonly mergeState?: MergeStateFilter;
  readonly withoutClaims?: boolean;
  readonly sort?: EntitySortKey;
  readonly direction?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
};

export type EntityPage = {
  readonly rows: readonly EntityRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
};

export type FacetBucket = {
  readonly value: string;
  readonly count: number;
};

export type EntityFacets = {
  readonly kind: readonly FacetBucket[];
  readonly entityClass: readonly FacetBucket[];
  readonly livingStatus: readonly FacetBucket[];
  readonly sensitivityClass: readonly FacetBucket[];
};

export const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const SORT_COLUMNS: Record<EntitySortKey, string> = {
  updated: 'e.updated_at',
  created: 'e.created_at',
  name: 'e.display_name',
  kind: 'e.kind',
  claims: 'claim_count',
};

/**
 * A parameterized WHERE clause plus its bind values. Filters are appended positionally so the
 * same builder serves the page query, the total count, and every facet count — a facet must be
 * counted under all filters *except its own*, which `omit` provides.
 */
type WhereClause = {
  readonly sql: string;
  readonly params: readonly unknown[];
};

function buildWhere(query: EntityQuery, omit?: keyof EntityQuery): WhereClause {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const search = query.search?.trim();
  if (search && omit !== 'search') {
    // display_name rides entities_display_name_trgm_idx; the rest are small enough to scan.
    const needle = bind(`%${search}%`);
    conditions.push(`(
      e.display_name ILIKE ${needle}
      OR e.id ILIKE ${needle}
      OR e.aliases::text ILIKE ${needle}
      OR EXISTS (
        SELECT 1 FROM bb_canonical.entity_identifiers ei
        WHERE ei.entity_id = e.id AND ei.value ILIKE ${needle}
      )
    )`);
  }

  if (query.kinds?.length && omit !== 'kinds') {
    conditions.push(`e.kind = ANY(${bind([...query.kinds])}::text[])`);
  }
  if (query.entityClasses?.length && omit !== 'entityClasses') {
    conditions.push(`e.entity_class = ANY(${bind([...query.entityClasses])}::text[])`);
  }
  if (query.livingStatuses?.length && omit !== 'livingStatuses') {
    conditions.push(`e.living_status = ANY(${bind([...query.livingStatuses])}::text[])`);
  }
  if (query.sensitivityClasses?.length && omit !== 'sensitivityClasses') {
    conditions.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(e.sensitivity) s
      WHERE s->>'class' = ANY(${bind([...query.sensitivityClasses])}::text[])
    )`);
  }

  // Absorbed entities are merge tombstones pointing at a survivor. They are still real rows and
  // must stay reachable, but they are noise in the default working view.
  const mergeState = query.mergeState ?? 'active';
  if (mergeState !== 'all' && omit !== 'mergeState') {
    conditions.push(
      mergeState === 'absorbed'
        ? `e.merge_state->>'status' = 'absorbed'`
        : `(e.merge_state IS NULL OR e.merge_state->>'status' IS DISTINCT FROM 'absorbed')`,
    );
  }

  if (query.withoutClaims && omit !== 'withoutClaims') {
    conditions.push(`NOT EXISTS (SELECT 1 FROM bb_canonical.claims c WHERE c.entity_id = e.id)`);
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * `aliases` is a JSONB array of plain strings (`["Alice Augusta Ball"]`). The previous reader
 * expected `{value, kind}` objects and filtered every entry out, so no alias ever rendered.
 * Object entries are still tolerated in case older rows carry the richer shape.
 */
function parseAliases(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      out.push(entry);
    } else if (entry && typeof entry === 'object') {
      const candidate = (entry as { value?: unknown }).value;
      if (typeof candidate === 'string' && candidate.length > 0) out.push(candidate);
    }
  }
  return out;
}

/**
 * `sensitivity` is a JSONB array of `{class, source}`. The previous reader kept only string
 * entries, so all 70 flagged entities displayed as unflagged.
 */
function parseSensitivity(value: unknown): readonly EntitySensitivity[] {
  if (!Array.isArray(value)) return [];
  const out: EntitySensitivity[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { class?: unknown; source?: unknown };
    if (typeof record.class !== 'string' || record.class.length === 0) continue;
    out.push({
      class: record.class,
      ...(typeof record.source === 'string' ? { source: record.source } : {}),
    });
  }
  return out;
}

function parseMergeState(value: unknown): EntityMergeState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.status !== 'string') return undefined;
  const str = (key: string): string | undefined =>
    typeof record[key] === 'string' ? (record[key] as string) : undefined;
  const survivorId = str('survivorId');
  const mergeId = str('mergeId');
  const reason = str('reason');
  const absorbedAt = str('absorbedAt');
  return {
    status: record.status,
    ...(survivorId ? { survivorId } : {}),
    ...(mergeId ? { mergeId } : {}),
    ...(reason ? { reason } : {}),
    ...(absorbedAt ? { absorbedAt } : {}),
  };
}

type EntityQueryRow = {
  readonly id: string;
  readonly kind: string;
  readonly entity_class: string | null;
  readonly display_name: string;
  readonly living_status: string;
  readonly sensitivity: unknown;
  readonly aliases: unknown;
  readonly merge_state: unknown;
  readonly claim_count: string | number;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

function toEntityRow(row: EntityQueryRow): EntityRow {
  const entityClass = row.entity_class ?? undefined;
  const mergeState = parseMergeState(row.merge_state);
  return {
    id: row.id,
    displayName: row.display_name,
    kind: row.kind,
    ...(entityClass ? { entityClass } : {}),
    livingStatus: row.living_status,
    sensitivity: parseSensitivity(row.sensitivity),
    aliases: parseAliases(row.aliases),
    claimCount: Number(row.claim_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...(mergeState ? { mergeState } : {}),
  };
}

export function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

/** One page of entities under the query's filters and sort, plus the unpaginated total. */
export async function queryEntityPage(query: EntityQuery): Promise<EntityPage> {
  const pageSize = normalizePageSize(query.pageSize);
  const where = buildWhere(query);
  const sortKey = query.sort ?? 'updated';
  const sortColumn = SORT_COLUMNS[sortKey] ?? SORT_COLUMNS.updated;
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';

  const countRows = await queryPostgres<{ readonly total: string }>(
    `SELECT count(*)::text AS total FROM bb_canonical.entities e ${where.sql}`,
    where.params,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pageCount);
  const offset = (page - 1) * pageSize;

  // `id` is appended to every sort so pagination is deterministic when the sort column ties —
  // without it, rows can repeat or vanish across pages under a non-unique ORDER BY.
  const rows = await queryPostgres<EntityQueryRow>(
    `SELECT
       e.id, e.kind, e.entity_class, e.display_name, e.living_status,
       e.sensitivity, e.aliases, e.merge_state, e.created_at, e.updated_at,
       coalesce(cc.claim_count, 0) AS claim_count
     FROM bb_canonical.entities e
     LEFT JOIN (
       SELECT entity_id, count(*)::int AS claim_count
       FROM bb_canonical.claims
       GROUP BY entity_id
     ) cc ON cc.entity_id = e.id
     ${where.sql}
     ORDER BY ${sortColumn} ${direction} NULLS LAST, e.id ASC
     LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
    [...where.params, pageSize, offset],
  );

  return {
    rows: rows.map(toEntityRow),
    total,
    page,
    pageSize,
    pageCount,
  };
}

async function facetCounts(
  query: EntityQuery,
  omit: keyof EntityQuery,
  expression: string,
): Promise<readonly FacetBucket[]> {
  const where = buildWhere(query, omit);
  const rows = await queryPostgres<{ readonly value: string | null; readonly count: string }>(
    // ORDER BY the numeric count, not the text-cast alias — ordering by the alias sorts
    // lexicographically, which puts 79 above 3195.
    `SELECT ${expression} AS value, count(*)::text AS count
     FROM bb_canonical.entities e
     ${where.sql}
     GROUP BY 1
     ORDER BY count(*) DESC, 1 ASC`,
    where.params,
  );
  return rows
    .filter((row): row is { value: string; count: string } => typeof row.value === 'string')
    .map((row) => ({ value: row.value, count: Number(row.count) }));
}

/**
 * Facet counts for the current query. Each dimension is counted with every *other* filter
 * applied but not its own, so selecting "person" still shows how many places you'd get by
 * switching — the behavior operators expect from a faceted browser.
 */
export async function queryEntityFacets(query: EntityQuery): Promise<EntityFacets> {
  const [kind, entityClass, livingStatus, sensitivityClass] = await Promise.all([
    facetCounts(query, 'kinds', 'e.kind'),
    facetCounts(query, 'entityClasses', 'e.entity_class'),
    facetCounts(query, 'livingStatuses', 'e.living_status'),
    facetCounts(
      query,
      'sensitivityClasses',
      `(SELECT s->>'class' FROM jsonb_array_elements(e.sensitivity) s LIMIT 1)`,
    ),
  ]);
  return { kind, entityClass, livingStatus, sensitivityClass };
}

/**
 * Every entity id matching the query, ignoring pagination. Backs select-all-matching so a bulk
 * action can address a whole filtered set instead of only the rendered page.
 */
export async function queryMatchingEntityIds(
  query: EntityQuery,
  cap = 10_000,
): Promise<readonly string[]> {
  const where = buildWhere(query);
  const rows = await queryPostgres<{ readonly id: string }>(
    `SELECT e.id FROM bb_canonical.entities e ${where.sql} ORDER BY e.id ASC LIMIT $${
      where.params.length + 1
    }`,
    [...where.params, cap],
  );
  return rows.map((row) => row.id);
}
