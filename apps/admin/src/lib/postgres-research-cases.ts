/**
 * Postgres reads/writes for bb_research.cases and normalized history/checklist tables.
 * Reconstructs serialized documents so parseResearchCaseRecord remains the shared parser.
 */
import type pg from 'pg';
import type { ResearchCaseRecord, ResearchCaseState } from '@repo/domain';
import { queryPostgres } from './postgres-client.js';

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
     FROM bb_research.cases
     WHERE id = $1`,
    [caseId],
  );
  if (cases.length === 0) return null;

  const [historyRows, checklistRows] = await Promise.all([
    queryPostgres<HistoryRow>(
      `SELECT case_id, from_state, to_state, reason_code, reason, actor_id, evidence_ids,
              occurred_at, metadata
       FROM bb_research.case_history_events
       WHERE case_id = $1
       ORDER BY occurred_at ASC, id ASC`,
      [caseId],
    ),
    queryPostgres<ChecklistRow>(
      `SELECT case_id, key, complete, evidence_ids, note
       FROM bb_research.case_checklist_items
       WHERE case_id = $1
       ORDER BY key ASC`,
      [caseId],
    ),
  ]);

  return buildResearchCaseDocument(cases[0]!, historyRows, checklistRows);
}

export async function listCaseIdsPostgres(input: {
  readonly states?: readonly ResearchCaseState[];
  readonly limit: number;
}): Promise<readonly string[]> {
  const states = input.states ?? [];
  if (states.length > 0 && states.length <= 10) {
    const rows = await queryPostgres<{ readonly id: string }>(
      `SELECT id
       FROM bb_research.cases
       WHERE state = ANY($1::text[])
       ORDER BY updated_at DESC
       LIMIT $2`,
      [states, input.limit],
    );
    return rows.map((row) => row.id);
  }

  const rows = await queryPostgres<{ readonly id: string; readonly state: string }>(
    `SELECT id, state
     FROM bb_research.cases
     ORDER BY updated_at DESC
     LIMIT $1`,
    [input.limit],
  );
  if (states.length === 0) return rows.map((row) => row.id);
  const allowed = new Set(states);
  return rows.filter((row) => allowed.has(row.state as ResearchCaseState)).map((row) => row.id);
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

/** Persists a full ResearchCaseRecord into normalized bb_research tables inside a transaction. */
export async function writeResearchCasePostgres(
  client: pg.PoolClient,
  record: ResearchCaseRecord,
): Promise<void> {
  await client.query(
    `INSERT INTO bb_research.cases
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

  await client.query(`DELETE FROM bb_research.case_history_events WHERE case_id = $1`, [record.id]);
  for (const event of record.history) {
    await client.query(
      `INSERT INTO bb_research.case_history_events
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
      `INSERT INTO bb_research.case_checklist_items
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
    await client.query(`DELETE FROM bb_research.case_checklist_items WHERE case_id = $1`, [
      record.id,
    ]);
  } else {
    await client.query(
      `DELETE FROM bb_research.case_checklist_items
       WHERE case_id = $1 AND NOT (key = ANY($2::text[]))`,
      [record.id, checklistKeys],
    );
  }
}
