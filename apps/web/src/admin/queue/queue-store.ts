/**
 * The Queue's read projection: one SQL statement over research cases, intake items, story packet
 * reviews and management work, so ordering, pagination, totals and facets all come from the same
 * membership predicate. The existing desk stores are not reused: requests read their newest 50 and
 * packets their newest 200, and merging capped slices can never surface the true oldest item.
 *
 * Contract: docs/plans/admin-footprint-console.md, "Phase 4: Queue contract". Measured against the
 * live database on 2026-10-29: 453 cases, 6 leads, 6 packets, 2 requests, no identity repeated.
 *
 * Every JSON comparison is null-safe. `payload->>'proposalKind' = 'story_packet'` is NULL when the
 * key is missing, and `NOT (NULL OR false)` drops the row; that once hid a public correction.
 */
import {
  createSqlBinder,
  normalizeDeskPageSize,
  paginate,
  type DeskPage,
  type FacetBucket,
} from '../lib/desk-query';
import { queryPostgres } from '../lib/canonical-postgres-client';
import { deriveSubmissionTitle } from '../lib/postgres-submissions';
import { storyPacketTitle } from '../lib/postgres-story-packets';
import {
  queueRowHref,
  type QueueAgeBand,
  type QueueQuery,
  type QueueRow,
  type QueueStage,
  type QueueType,
} from './queue-query';

export type QueueFacets = {
  readonly type: readonly FacetBucket[];
  readonly stage: readonly FacetBucket[];
  readonly ageBand: readonly FacetBucket[];
};

/**
 * `ownerParam` is the verified Supabase user id. It is the only way request rows enter the
 * projection, so no total, facet or search can include another owner's requests.
 */
function projection(ownerParam: string): string {
  return `
  WITH pk AS (
    SELECT i.id, i.status::text AS status, i.payload, i.created_at,
           (coalesce(i.payload->>'proposalKind', '') = 'story_packet'
            OR i.payload->'storyPacket' IS NOT NULL
            OR coalesce(i.payload->>'statement', '') LIKE '%packetJson=%') AS is_packet
      FROM submissions.intake_items i
  ),
  packet_rows AS (
    SELECT 'packet'::text AS type, pk.id, pk.id AS native_id, NULL::text AS title,
           CASE WHEN r.submission_id IS NULL OR r.decision IS NULL THEN 'pending'
                WHEN r.decision = 'needs_evidence' THEN 'needs_evidence'
                ELSE 'approved_not_imported' END AS native_state,
           pk.created_at AS waiting_since, NULL::text AS assignee_id, 1::int AS open_count,
           pk.payload, pk.id || ' ' || pk.payload::text AS search_text
      FROM pk
      LEFT JOIN ops.story_packet_reviews r ON r.submission_id = pk.id
     WHERE pk.is_packet
       AND (r.submission_id IS NULL OR r.decision IS NULL OR r.decision = 'needs_evidence'
            -- An approved packet counts as done only once its story exists. The story id is
            -- derived from the submission id, as importStoryPacket (editorial/packet.ts) does.
            OR (r.decision = 'approved' AND NOT EXISTS (
                  SELECT 1 FROM reference.stories s
                   WHERE s.id = 'story_packet_' || left(encode(sha256(convert_to(pk.id, 'UTF8')), 'hex'), 24))))
  ),
  open_cases AS (
    SELECT c.*
      FROM research.cases c
     WHERE c.state IN ('candidate', 'relevance_review', 'relevance_confirmed', 'insufficient_evidence')
       -- A managed case belongs to its request, but only when that request exists.
       AND NOT (c.id ~ '^managed-[0-9a-f-]{36}-v[0-9]+-case$'
                AND EXISTS (SELECT 1 FROM research.management_work w
                             WHERE w.id::text = substring(c.id FROM 9 FOR 36)))
       -- A packet's case belongs to the packet while the packet has its own row.
       AND NOT EXISTS (SELECT 1 FROM packet_rows p WHERE p.id = c.candidate_id)
  ),
  case_rows AS (
    SELECT DISTINCT ON (oc.candidate_id)
           'case'::text AS type, oc.candidate_id AS id, oc.id AS native_id, oc.title,
           oc.state AS native_state,
           -- Entry into the current state: the latest real transition into it. Promotion writes
           -- from_state = to_state, which is activity, not entry. No such event: import time.
           coalesce((SELECT max(h.occurred_at) FROM research.case_history_events h
                      WHERE h.case_id = oc.id AND h.to_state = oc.state
                        AND h.from_state IS DISTINCT FROM h.to_state), oc.created_at) AS waiting_since,
           oc.assignment->>'reviewerId' AS assignee_id,
           (count(*) OVER (PARTITION BY oc.candidate_id))::int AS open_count,
           NULL::jsonb AS payload,
           concat_ws(' ', oc.title, oc.id, oc.candidate_id, oc.assignment->>'reviewerId') AS search_text
      FROM open_cases oc
     ORDER BY oc.candidate_id, oc.updated_at DESC, oc.id
  ),
  lead_rows AS (
    SELECT 'lead'::text, pk.id, pk.id, NULL::text, pk.status, pk.created_at, NULL::text, 1::int,
           pk.payload, pk.id || ' ' || pk.payload::text
      FROM pk
     WHERE pk.status = 'quarantined' AND NOT pk.is_packet
       AND NOT EXISTS (SELECT 1 FROM research.cases c WHERE c.candidate_id = pk.id)
  ),
  request_rows AS (
    SELECT 'request'::text, w.id::text, w.id::text, left(w.request->>'request', 200), w.state,
           w.updated_at, NULL::text, 1::int, NULL::jsonb,
           w.id::text || ' ' || coalesce(w.request->>'request', '')
      FROM research.management_work w
     WHERE w.owner_id::text = ${ownerParam}
       AND (w.state IN ('awaiting_review', 'held', 'failed', 'verification_failed')
            OR w.dispatch_status = 'failed'
            -- Interrupted, by the same rule the Requests page uses (work-inbox.tsx).
            OR (w.state IN ('queued', 'researching', 'approved', 'publishing')
                AND w.updated_at < now() - interval '2 minutes'
                AND (w.lease_until IS NULL OR w.lease_until < now())))
  ),
  unioned AS (
    SELECT * FROM case_rows
    UNION ALL SELECT * FROM lead_rows
    UNION ALL SELECT * FROM packet_rows
    UNION ALL SELECT * FROM request_rows
  ),
  q AS (
    SELECT u.*,
           CASE
             WHEN u.type = 'case' AND u.native_state IN ('candidate', 'relevance_review') THEN 'triage'
             WHEN u.type = 'case' AND u.native_state = 'insufficient_evidence' THEN 'needs_evidence'
             WHEN u.type = 'case' AND u.native_state = 'relevance_confirmed' THEN 'in_research'
             WHEN u.type = 'lead' THEN 'triage'
             WHEN u.type = 'packet' AND u.native_state = 'pending' THEN 'ready'
             WHEN u.type = 'packet' AND u.native_state = 'needs_evidence' THEN 'needs_evidence'
             WHEN u.type = 'request' AND u.native_state = 'awaiting_review' THEN 'ready'
             ELSE 'stuck'
           END AS stage,
           CASE
             WHEN u.waiting_since > now() - interval '7 days' THEN 'under_7d'
             WHEN u.waiting_since > now() - interval '30 days' THEN '7_30d'
             WHEN u.waiting_since > now() - interval '90 days' THEN '30_90d'
             ELSE 'over_90d'
           END AS age_band
      FROM unioned u
  )`;
}

type Omit = 'types' | 'stages' | 'ageBands';

function buildQueueSql(query: QueueQuery, ownerId: string, omit?: Omit) {
  const { bind, params } = createSqlBinder();
  const head = projection(bind(ownerId));
  const conditions: string[] = [];
  if (query.types?.length && omit !== 'types') {
    conditions.push(`type = ANY(${bind([...query.types])}::text[])`);
  }
  if (query.stages?.length && omit !== 'stages') {
    conditions.push(`stage = ANY(${bind([...query.stages])}::text[])`);
  }
  if (query.ageBands?.length && omit !== 'ageBands') {
    conditions.push(`age_band = ANY(${bind([...query.ageBands])}::text[])`);
  }
  // Assignment exists only on cases, so either assignee filter narrows to cases.
  if (query.assignee === 'assigned') conditions.push(`type = 'case' AND assignee_id IS NOT NULL`);
  if (query.assignee === 'unassigned') conditions.push(`type = 'case' AND assignee_id IS NULL`);
  const search = query.search?.trim();
  if (search) conditions.push(`search_text ILIKE ${bind(`%${search}%`)}`);
  return {
    head,
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    bind,
  };
}

type Row = {
  readonly type: QueueType;
  readonly id: string;
  readonly native_id: string;
  readonly title: string | null;
  readonly native_state: string;
  readonly waiting_since: Date | string;
  readonly assignee_id: string | null;
  readonly open_count: number;
  readonly payload: unknown;
  readonly stage: QueueStage;
  readonly age_band: QueueAgeBand;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function titleFor(row: Row): string {
  if (row.type === 'lead') return deriveSubmissionTitle(row.payload, row.id);
  if (row.type === 'packet')
    return storyPacketTitle(row.payload) ?? `Unreadable story packet ${row.id}`;
  return row.title?.trim() || row.native_id;
}

export function toQueueRow(row: Row): QueueRow {
  return {
    type: row.type,
    id: row.id,
    nativeId: row.native_id,
    title: titleFor(row),
    nativeState: row.native_state,
    stage: row.stage,
    waitingSince: toIso(row.waiting_since),
    ageBand: row.age_band,
    ...(row.assignee_id ? { assigneeId: row.assignee_id } : {}),
    openCaseCount: Number(row.open_count),
    href: queueRowHref(row.type, row.native_id),
  };
}

/** One page, oldest waiting first, plus the unpaginated total under the same predicate. */
export async function queryQueuePage(
  query: QueueQuery,
  ownerId: string,
): Promise<DeskPage<QueueRow>> {
  const pageSize = normalizeDeskPageSize(query.pageSize);
  const built = buildQueueSql(query, ownerId);
  const totals = await queryPostgres<{ readonly total: string }>(
    `${built.head} SELECT count(*)::text AS total FROM q ${built.where}`,
    built.params,
  );
  const total = Number(totals[0]?.total ?? 0);
  const { page, pageCount, offset } = paginate(total, query.page, pageSize);
  const limit = built.bind(pageSize);
  const skip = built.bind(offset);
  const rows = await queryPostgres<Row>(
    `${built.head}
     SELECT type, id, native_id, title, native_state, waiting_since, assignee_id, open_count,
            payload, stage, age_band
       FROM q ${built.where}
      ORDER BY waiting_since ASC, type ASC, id ASC
      LIMIT ${limit} OFFSET ${skip}`,
    built.params,
  );
  return { rows: rows.map(toQueueRow), total, page, pageSize, pageCount };
}

async function facet(query: QueueQuery, ownerId: string, omit: Omit, column: string) {
  const built = buildQueueSql(query, ownerId, omit);
  const rows = await queryPostgres<{ readonly value: string; readonly count: string }>(
    `${built.head} SELECT ${column} AS value, count(*)::text AS count FROM q ${built.where}
      GROUP BY 1 ORDER BY count(*) DESC, 1 ASC`,
    built.params,
  );
  return rows.map((row) => ({ value: row.value, count: Number(row.count) }));
}

/** Each facet is counted under every other filter but not its own, as the other desks do. */
export async function queryQueueFacets(query: QueueQuery, ownerId: string): Promise<QueueFacets> {
  const [type, stage, ageBand] = await Promise.all([
    facet(query, ownerId, 'types', 'type'),
    facet(query, ownerId, 'stages', 'stage'),
    facet(query, ownerId, 'ageBands', 'age_band'),
  ]);
  return { type, stage, ageBand };
}
