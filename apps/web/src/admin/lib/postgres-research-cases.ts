/**
 * Postgres reads/writes for research.cases and normalized history/checklist tables.
 * Reconstructs serialized documents so parseResearchCaseRecord remains the shared parser.
 */
import type pg from 'pg';
import type { ResearchCaseRecord, ResearchCaseState } from '@repo/domain';
import { queryPostgres } from './canonical-postgres-client.js';
import {
  normalizeCasePageSize,
  type CasePage,
  type CaseQuery,
  type CaseSortKey,
  type CaseStateBucket,
} from '../cases/case-query-types.js';

type CaseRow = {
  readonly id: string;
  readonly state: string;
  readonly candidate_id: string;
  readonly title: string;
  readonly relevance_assessment: unknown;
  readonly assignment: unknown;
  readonly publication: unknown;
  readonly retraction: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

type HistoryRow = {
  readonly case_id: string;
  readonly from_state: string;
  readonly to_state: string;
  readonly reason_code: string;
  readonly reason: string | null;
  readonly actor_id: string;
  readonly evidence_ids: readonly string[] | null;
  readonly occurred_at: Date | string;
  readonly metadata: Record<string, unknown> | null;
};

type ChecklistRow = {
  readonly case_id: string;
  readonly key: string;
  readonly complete: boolean;
  readonly evidence_ids: readonly string[] | null;
  readonly note: string | null;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
): string | undefined {
  if (!metadata) return undefined;
  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function buildResearchCaseDocument(
  caseRow: CaseRow,
  historyRows: readonly HistoryRow[],
  checklistRows: readonly ChecklistRow[],
): Record<string, unknown> {
  return {
    id: caseRow.id,
    state: caseRow.state,
    candidateId: caseRow.candidate_id,
    title: caseRow.title,
    createdAt: toIso(caseRow.created_at),
    updatedAt: toIso(caseRow.updated_at),
    ...(caseRow.relevance_assessment ? { relevanceAssessment: caseRow.relevance_assessment } : {}),
    ...(caseRow.assignment ? { assignment: caseRow.assignment } : {}),
    ...(caseRow.publication ? { publication: caseRow.publication } : {}),
    ...(caseRow.retraction ? { retraction: caseRow.retraction } : {}),
    history: historyRows.map((row) => {
      const mergedIntoCaseId = readMetadataString(row.metadata, 'mergedIntoCaseId');
      return {
        from: row.from_state,
        to: row.to_state,
        reasonCode: row.reason_code,
        reason: row.reason ?? '',
        actorId: row.actor_id,
        occurredAt: toIso(row.occurred_at),
        evidenceIds: row.evidence_ids ?? [],
        ...(mergedIntoCaseId ? { mergedIntoCaseId } : {}),
      };
    }),
    checklist: {
      items: checklistRows.map((row) => ({
        key: row.key,
        complete: row.complete,
        evidenceIds: row.evidence_ids ?? [],
        ...(row.note ? { note: row.note } : {}),
      })),
    },
  };
}

export async function loadResearchCaseDocument(
  caseId: string,
): Promise<Record<string, unknown> | null> {
  const cases = await queryPostgres<CaseRow>(
    `SELECT id, state, candidate_id, title, relevance_assessment, assignment, publication,
            retraction, created_at, updated_at
     FROM research.cases
     WHERE id = $1`,
    [caseId],
  );
  if (cases.length === 0) return null;

  const [historyRows, checklistRows] = await Promise.all([
    queryPostgres<HistoryRow>(
      `SELECT case_id, from_state, to_state, reason_code, reason, actor_id, evidence_ids,
              occurred_at, metadata
       FROM research.case_history_events
       WHERE case_id = $1
       ORDER BY occurred_at ASC, id ASC`,
      [caseId],
    ),
    queryPostgres<ChecklistRow>(
      `SELECT case_id, key, complete, evidence_ids, note
       FROM research.case_checklist_items
       WHERE case_id = $1
       ORDER BY key ASC`,
      [caseId],
    ),
  ]);

  return buildResearchCaseDocument(cases[0]!, historyRows, checklistRows);
}

/**
 * List-shaped case documents for a set of states in two queries total, however many cases come
 * back. `loadResearchCaseDocument` costs three round trips per case, which turned a 200-row inbox
 * into ~600 sequential queries against a remote pooler (47s measured on 2026-10-17).
 *
 * History is deliberately empty: list rows show state, assignee and checklist progress, never the
 * transition log. Detail views still go through {@link loadResearchCaseDocument}.
 */
export async function listResearchCaseDocumentsPostgres(input: {
  readonly states?: readonly ResearchCaseState[];
  readonly limit: number;
}): Promise<readonly Record<string, unknown>[]> {
  const states = input.states ?? [];
  const cases = await queryPostgres<CaseRow>(
    `SELECT id, state, candidate_id, title, relevance_assessment, assignment, publication,
            retraction, created_at, updated_at
     FROM research.cases
     WHERE cardinality($1::text[]) = 0 OR state = ANY($1::text[])
     ORDER BY updated_at DESC, id ASC
     LIMIT $2`,
    [states, input.limit],
  );
  if (cases.length === 0) return [];

  const checklistRows = await queryPostgres<ChecklistRow>(
    `SELECT case_id, key, complete, evidence_ids, note
     FROM research.case_checklist_items
     WHERE case_id = ANY($1::text[])
     ORDER BY case_id ASC, key ASC`,
    [cases.map((row) => row.id)],
  );
  const checklistByCase = new Map<string, ChecklistRow[]>();
  for (const row of checklistRows) {
    const bucket = checklistByCase.get(row.case_id);
    if (bucket) bucket.push(row);
    else checklistByCase.set(row.case_id, [row]);
  }
  return cases.map((row) => buildResearchCaseDocument(row, [], checklistByCase.get(row.id) ?? []));
}

/** Whitelisted ORDER BY expressions; the sort key never reaches SQL as text from the caller. */
const CASE_SORT_SQL: Record<CaseSortKey, string> = {
  updated: 'c.updated_at',
  created: 'c.created_at',
  title: 'lower(c.title)',
  state: 'c.state',
  checklist: 'checklist_ratio',
};

function buildCaseWhere(
  query: CaseQuery,
  omit?: 'states',
): { readonly sql: string; readonly params: readonly unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };
  if (query.states?.length && omit !== 'states') {
    conditions.push(`c.state = ANY(${bind([...query.states])}::text[])`);
  }
  if (query.assignee === 'assigned') conditions.push(`c.assignment->>'reviewerId' IS NOT NULL`);
  if (query.assignee === 'unassigned') conditions.push(`c.assignment->>'reviewerId' IS NULL`);
  const search = query.search?.trim();
  if (search) {
    const needle = bind(`%${search}%`);
    conditions.push(
      `(c.title ILIKE ${needle} OR c.id ILIKE ${needle} OR c.candidate_id ILIKE ${needle}` +
        ` OR c.assignment->>'reviewerId' ILIKE ${needle})`,
    );
  }
  return { sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

type CaseListSqlRow = {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly candidate_id: string;
  readonly reviewer_id: string | null;
  readonly checklist_done: string;
  readonly checklist_total: string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

/**
 * One page of cases under the query's filters. Search, state, sort and paging resolve in SQL, so
 * every case is reachable — the previous list read `LIMIT 200` and filtered that slice in the
 * browser, leaving the rest of the inbox unreachable and its counts wrong.
 */
export async function queryCasePage(query: CaseQuery): Promise<CasePage> {
  const pageSize = normalizeCasePageSize(query.pageSize);
  const where = buildCaseWhere(query);
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  const sort = CASE_SORT_SQL[query.sort ?? 'updated'];

  const countRows = await queryPostgres<{ readonly total: string }>(
    `SELECT count(*)::text AS total FROM research.cases c ${where.sql}`,
    where.params,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pageCount);
  const offset = (page - 1) * pageSize;

  const rows = await queryPostgres<CaseListSqlRow>(
    `SELECT c.id, c.title, c.state, c.candidate_id, c.assignment->>'reviewerId' AS reviewer_id,
            c.created_at, c.updated_at,
            k.done::text AS checklist_done, k.total::text AS checklist_total,
            CASE WHEN k.total = 0 THEN 0 ELSE k.done::float / k.total END AS checklist_ratio
     FROM research.cases c
     LEFT JOIN LATERAL (
       SELECT count(*) AS total, count(*) FILTER (WHERE i.complete) AS done
       FROM research.case_checklist_items i WHERE i.case_id = c.id
     ) k ON true
     ${where.sql}
     ORDER BY ${sort} ${direction}, c.id ASC
     LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
    [...where.params, pageSize, offset],
  );

  return {
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      state: row.state,
      candidateId: row.candidate_id,
      ...(row.reviewer_id ? { assigneeId: row.reviewer_id } : {}),
      checklistComplete: Number(row.checklist_done),
      checklistTotal: Number(row.checklist_total),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    })),
    total,
    page,
    pageSize,
    pageCount,
  };
}

/** State counts under every active filter except the state filter itself. */
export async function queryCaseStateFacets(query: CaseQuery): Promise<readonly CaseStateBucket[]> {
  const where = buildCaseWhere(query, 'states');
  const rows = await queryPostgres<{ readonly value: string; readonly count: string }>(
    `SELECT c.state AS value, count(*)::text AS count
     FROM research.cases c
     ${where.sql}
     GROUP BY 1
     ORDER BY count(*) DESC, 1 ASC`,
    where.params,
  );
  return rows.map((row) => ({ value: row.value, count: Number(row.count) }));
}

/** Exact count for a set of states — not bounded by a page limit. */
export async function countCasesByStatePostgres(
  states: readonly ResearchCaseState[],
): Promise<number> {
  const rows = await queryPostgres<{ readonly count: string }>(
    `SELECT count(*)::text AS count FROM research.cases WHERE state = ANY($1::text[])`,
    [states],
  );
  return Number(rows[0]?.count ?? 0);
}

function historyMetadataFromEvent(
  event: ResearchCaseRecord['history'][number],
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (event.mergedIntoCaseId) {
    metadata.mergedIntoCaseId = event.mergedIntoCaseId;
  }
  return metadata;
}

/** Persists a full ResearchCaseRecord into normalized research tables inside a transaction. */
export async function writeResearchCasePostgres(
  client: pg.PoolClient,
  record: ResearchCaseRecord,
): Promise<void> {
  await client.query(
    `INSERT INTO research.cases
      (id, state, candidate_id, title, relevance_assessment, assignment, publication, retraction,
       created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       candidate_id = EXCLUDED.candidate_id,
       title = EXCLUDED.title,
       relevance_assessment = EXCLUDED.relevance_assessment,
       assignment = EXCLUDED.assignment,
       publication = EXCLUDED.publication,
       retraction = EXCLUDED.retraction,
       updated_at = EXCLUDED.updated_at`,
    [
      record.id,
      record.state,
      record.candidateId,
      record.title,
      record.relevanceAssessment ? JSON.stringify(record.relevanceAssessment) : null,
      record.assignment ? JSON.stringify(record.assignment) : null,
      record.publication ? JSON.stringify(record.publication) : null,
      record.retraction ? JSON.stringify(record.retraction) : null,
      record.createdAt,
      record.updatedAt,
    ],
  );

  await client.query(`DELETE FROM research.case_history_events WHERE case_id = $1`, [record.id]);
  for (const event of record.history) {
    await client.query(
      `INSERT INTO research.case_history_events
        (case_id, from_state, to_state, reason_code, reason, actor_id, evidence_ids, occurred_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        record.id,
        event.from,
        event.to,
        event.reasonCode,
        event.reason,
        event.actorId,
        event.evidenceIds,
        event.occurredAt,
        JSON.stringify(historyMetadataFromEvent(event)),
      ],
    );
  }

  for (const item of record.checklist.items) {
    await client.query(
      `INSERT INTO research.case_checklist_items
        (case_id, key, complete, evidence_ids, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (case_id, key) DO UPDATE SET
         complete = EXCLUDED.complete,
         evidence_ids = EXCLUDED.evidence_ids,
         note = EXCLUDED.note`,
      [record.id, item.key, item.complete, item.evidenceIds, item.note ?? null],
    );
  }

  const checklistKeys = record.checklist.items.map((item) => item.key);
  if (checklistKeys.length === 0) {
    await client.query(`DELETE FROM research.case_checklist_items WHERE case_id = $1`, [record.id]);
  } else {
    await client.query(
      `DELETE FROM research.case_checklist_items
       WHERE case_id = $1 AND NOT (key = ANY($2::text[]))`,
      [record.id, checklistKeys],
    );
  }
}
