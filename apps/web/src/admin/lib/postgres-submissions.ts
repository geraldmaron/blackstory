/**
 * Postgres reads and decision-writes for the raw submissions queue (`bb_submissions.intake_items`).
 *
 * repo-gyq6.10 (D2): 2,175 rows in this table (measured live 2026-09-13: 2,060 quarantined, 50
 * promoted, 64 rejected, 1 spam, every one `kind = 'contribution'`), and the only admin surface
 * that ever read it (`postgres-story-packets.ts`, backing `/admin/stories/review`) filters to
 * `payload->>'proposalKind' = 'story_packet'` — a handful of rows. Everything else (public
 * submit-form leads, discovery-survivor intake, quick-add proposals, anything that is not a
 * story packet) had no list, no detail view, and no decision path outside a terminal. This
 * module is the general reader/writer: every row, not one proposal kind.
 *
 * The write side deliberately narrows `packages/operator-cli/src/quarantine-triage.ts`'s LLM
 * triage down to its human-operator case: same status machine (`quarantined` -> `promoted` |
 * `rejected` | `spam`, guarded so a row already moved out of `quarantined` cannot be
 * double-processed), same "'promote' opens a `bb_research.cases` candidate, 'reject'/'spam' only
 * flip status" split. It does not reuse that module's functions directly because operator-cli
 * writes through `getOpsPostgresPool()` (`DATABASE_URL`, the public/ops credential), while every
 * write this app makes goes through `ADMIN_DATABASE_URL`'s `role_admin_app` connection
 * (`canonical-postgres-client.ts`'s header explains why the two are kept apart by env var name).
 * Reaching into operator-cli here would write a privileged admin decision under the wrong
 * credential. `writeResearchCasePostgres` (already shared by `research-case-store.ts`) is reused
 * for the one part that is safe and correct to share: turning a `ResearchCaseRecord` into rows.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { auditCategoryFor, createResearchCase, type AuditEventAction } from '@repo/domain';
import type { AdminPermission } from '../auth/server-authorization.js';
import type { StaffRole } from '../auth/role-mutation.js';
import type { ServerAdminIdentity } from '../auth/supabase-server.js';
import { StaffPermissionDeniedError, assertStaffPermission } from '../auth/staff-permissions.js';
import { queryPostgres } from './canonical-postgres-client.js';
import { commitWithAuditPostgres } from './postgres-commit.js';
import { writeResearchCasePostgres } from './postgres-research-cases.js';

export const INTAKE_STATUSES = ['quarantined', 'promoted', 'rejected', 'spam'] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export type SubmissionListItem = {
  readonly id: string;
  readonly status: IntakeStatus;
  readonly kind: string | null;
  readonly sourceUrl: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  /** Best-effort human title derived from the payload; see deriveSubmissionTitle. */
  readonly title: string;
};

export type SubmissionDetail = SubmissionListItem & {
  readonly payload: unknown;
};

export type SubmissionQuery = {
  readonly search?: string;
  readonly statuses?: readonly string[];
  readonly kinds?: readonly string[];
  readonly direction?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
};

export type SubmissionPage = {
  readonly rows: readonly SubmissionListItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
};

export type FacetBucket = { readonly value: string; readonly count: number };

export type SubmissionFacets = {
  readonly status: readonly FacetBucket[];
  readonly kind: readonly FacetBucket[];
};

export const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Best-effort human title from an intake payload, whose shape varies by proposer pipeline
 * (public submit form, discovery-survivor intake, story packet, quick-add, ...). Mirrors the
 * fallback chain in `quarantine-triage.ts`'s `deriveTitle`, minus that function's LLM-judgment
 * title (this reader has no judgment to prefer).
 */
export function deriveSubmissionTitle(payload: unknown, id: string): string {
  const record = asRecord(payload);
  const normalized = asRecord(record?.normalized);
  const original = asRecord(asRecord(record?.original)?.payload);
  const storyDraft = asRecord(asRecord(record?.storyPacket)?.draft);

  const candidate =
    (typeof storyDraft?.title === 'string' && storyDraft.title) ||
    (typeof normalized?.title === 'string' && normalized.title) ||
    (typeof original?.title === 'string' && original.title) ||
    (typeof record?.title === 'string' && record.title) ||
    (typeof normalized?.statement === 'string' && normalized.statement) ||
    (typeof record?.statement === 'string' && record.statement) ||
    '';

  const cleaned = candidate.trim().replace(/\s+/gu, ' ');
  return cleaned ? truncate(cleaned, 200) : `Untitled submission ${id}`;
}

type WhereClause = { readonly sql: string; readonly params: readonly unknown[] };

function buildWhere(query: SubmissionQuery, omit?: keyof SubmissionQuery): WhereClause {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (query.statuses?.length && omit !== 'statuses') {
    conditions.push(`status = ANY(${bind([...query.statuses])}::text[])`);
  }
  if (query.kinds?.length && omit !== 'kinds') {
    conditions.push(`coalesce(kind, 'unspecified') = ANY(${bind([...query.kinds])}::text[])`);
  }
  const search = query.search?.trim();
  if (search && omit !== 'search') {
    const needle = bind(`%${search}%`);
    conditions.push(
      `(id ILIKE ${needle} OR source_url ILIKE ${needle} OR payload::text ILIKE ${needle})`,
    );
  }

  return { sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

type IntakeRow = {
  readonly id: string;
  readonly status: string;
  readonly kind: string | null;
  readonly source_url: string | null;
  readonly created_by: string;
  readonly created_at: Date | string;
  readonly payload: unknown;
};

function toListItem(row: IntakeRow): SubmissionListItem {
  return {
    id: row.id,
    status: row.status as IntakeStatus,
    kind: row.kind,
    sourceUrl: row.source_url,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    title: deriveSubmissionTitle(row.payload, row.id),
  };
}

const LIST_COLUMNS = 'id, status, kind, source_url, created_by, created_at, payload';

/** One page of intake items under the query's filters, plus the unfiltered-page total. */
export async function queryIntakeItemPage(query: SubmissionQuery): Promise<SubmissionPage> {
  const pageSize = normalizePageSize(query.pageSize);
  const where = buildWhere(query);
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';

  const countRows = await queryPostgres<{ readonly total: string }>(
    `SELECT count(*)::text AS total FROM bb_submissions.intake_items ${where.sql}`,
    where.params,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pageCount);
  const offset = (page - 1) * pageSize;

  // `id` breaks ties so pagination stays deterministic across rows sharing a created_at.
  const rows = await queryPostgres<IntakeRow>(
    `SELECT ${LIST_COLUMNS}
     FROM bb_submissions.intake_items
     ${where.sql}
     ORDER BY created_at ${direction}, id ASC
     LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
    [...where.params, pageSize, offset],
  );

  return { rows: rows.map(toListItem), total, page, pageSize, pageCount };
}

async function facetCounts(
  query: SubmissionQuery,
  omit: keyof SubmissionQuery,
  expression: string,
): Promise<readonly FacetBucket[]> {
  const where = buildWhere(query, omit);
  const rows = await queryPostgres<{ readonly value: string | null; readonly count: string }>(
    `SELECT ${expression} AS value, count(*)::text AS count
     FROM bb_submissions.intake_items
     ${where.sql}
     GROUP BY 1
     ORDER BY count(*) DESC, 1 ASC`,
    where.params,
  );
  return rows
    .filter((row): row is { value: string; count: string } => typeof row.value === 'string')
    .map((row) => ({ value: row.value, count: Number(row.count) }));
}

/** Status and kind facet counts, each computed under every *other* active filter. */
export async function queryIntakeItemFacets(query: SubmissionQuery): Promise<SubmissionFacets> {
  const [status, kind] = await Promise.all([
    facetCounts(query, 'statuses', 'status'),
    facetCounts(query, 'kinds', `coalesce(kind, 'unspecified')`),
  ]);
  return { status, kind };
}

export async function getIntakeItemDetail(id: string): Promise<SubmissionDetail | null> {
  const rows = await queryPostgres<IntakeRow>(
    `SELECT ${LIST_COLUMNS} FROM bb_submissions.intake_items WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...toListItem(row), payload: row.payload };
}

/**
 * `bb_research.cases.candidate_id` is set to the intake item's id for every case opened this way
 * (see `commitSubmissionDecision` below and `quarantine-triage.ts`'s identical convention), so a
 * promoted submission's case is a reverse lookup, not a stored column on `intake_items` itself.
 */
export async function findResearchCaseIdForSubmission(
  intakeItemId: string,
): Promise<string | null> {
  const rows = await queryPostgres<{ readonly id: string }>(
    `SELECT id FROM bb_research.cases WHERE candidate_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [intakeItemId],
  );
  return rows[0]?.id ?? null;
}

export const SUBMISSION_DECISIONS = ['promote', 'reject', 'spam'] as const;
export type SubmissionDecision = (typeof SUBMISSION_DECISIONS)[number];

export function isSubmissionDecision(value: unknown): value is SubmissionDecision {
  return typeof value === 'string' && (SUBMISSION_DECISIONS as readonly string[]).includes(value);
}

const NEXT_STATUS_BY_DECISION: Record<SubmissionDecision, IntakeStatus> = {
  promote: 'promoted',
  reject: 'rejected',
  spam: 'spam',
};

/**
 * The closed `AuditEventAction` vocabulary (`@repo/domain`) has no submission-specific verb.
 * `moderation.approved` / `moderation.rejected` are the closest existing fit for "an operator
 * decided what happens to a submitted item" — 'reject' and 'spam' share `moderation.rejected`;
 * `data.decision` on the event (and `intake_items.status` itself) carries which one it was.
 */
const AUDIT_ACTION_BY_DECISION: Record<
  SubmissionDecision,
  Extract<AuditEventAction, 'moderation.approved' | 'moderation.rejected'>
> = {
  promote: 'moderation.approved',
  reject: 'moderation.rejected',
  spam: 'moderation.rejected',
};

export const SUBMISSION_DECISION_PERMISSION: AdminPermission = 'research:write';

export type CommitSubmissionDecisionRequest = {
  readonly intakeItemId: string;
  readonly decision: SubmissionDecision;
  /** Operator-supplied justification. Required, like every other audited admin write here. */
  readonly reason: string;
};

export type SubmissionDecisionResult =
  | { readonly status: 'ok'; readonly eventId: string; readonly researchCaseId?: string }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'forbidden'; readonly role: StaffRole; readonly message: string }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'not_found' }
  /** The row already left 'quarantined' — a double-submit or another operator got there first. */
  | { readonly status: 'already_processed' }
  | { readonly status: 'failed'; readonly message: string };

/**
 * The transactional work one decision requires, computed without touching Postgres. Mirrors
 * `quarantine-triage.ts`'s `prepareQuarantineTriageDecision` split: deciding what to write is
 * pure and independently testable, executing it is not.
 */
export type SubmissionDecisionPlan = {
  readonly nextStatus: IntakeStatus;
  readonly researchCaseId?: string;
  readonly auditEvent: {
    readonly id: string;
    readonly action: Extract<AuditEventAction, 'moderation.approved' | 'moderation.rejected'>;
    readonly category: ReturnType<typeof auditCategoryFor>;
    readonly actor: { readonly id: string; readonly type: 'user'; readonly displayName: string };
    readonly subject: { readonly type: string; readonly id: string; readonly path: string };
    readonly reason: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly idempotencyKey: string;
    readonly occurredAt: string;
    readonly data: Readonly<Record<string, unknown>>;
  };
  readonly outboxMessage: {
    readonly id: string;
    readonly eventId: string;
    readonly topic: string;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly status: 'pending';
    readonly attempts: number;
    readonly maxAttempts: number;
    readonly availableAt: string;
    readonly createdAt: string;
    readonly correlationId: string;
    readonly idempotencyKey: string;
  };
};

/** Builds the plan for one decision. Pure: same inputs always produce the same plan. */
export function prepareSubmissionDecisionPlan(input: {
  readonly intakeItemId: string;
  readonly decision: SubmissionDecision;
  readonly title: string;
  readonly reason: string;
  readonly identity: Pick<ServerAdminIdentity, 'uid' | 'email'>;
  readonly nowIso: string;
  readonly newId: () => string;
}): SubmissionDecisionPlan {
  const nextStatus = NEXT_STATUS_BY_DECISION[input.decision];
  const action = AUDIT_ACTION_BY_DECISION[input.decision];
  const eventId = input.newId();
  const correlationId = input.newId();
  const idempotencyKey = `intake:${input.decision}:${eventId}`;
  const researchCaseId = input.decision === 'promote' ? input.newId() : undefined;

  return {
    nextStatus,
    ...(researchCaseId ? { researchCaseId } : {}),
    auditEvent: {
      id: eventId,
      action,
      category: auditCategoryFor(action),
      actor: { id: input.identity.uid, type: 'user', displayName: input.identity.email },
      subject: {
        type: 'intake_item',
        id: input.intakeItemId,
        path: `bb_submissions.intake_items/${input.intakeItemId}`,
      },
      reason: input.reason,
      requestId: eventId,
      correlationId,
      idempotencyKey,
      occurredAt: input.nowIso,
      data: {
        decision: input.decision,
        nextStatus,
        ...(researchCaseId ? { researchCaseId } : {}),
      },
    },
    outboxMessage: {
      id: input.newId(),
      eventId,
      topic: 'submissions.intake_item.moderated',
      aggregateType: 'intakeItem',
      aggregateId: input.intakeItemId,
      payload: {
        intakeItemId: input.intakeItemId,
        decision: input.decision,
        nextStatus,
        ...(researchCaseId ? { researchCaseId } : {}),
      },
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      availableAt: input.nowIso,
      createdAt: input.nowIso,
      correlationId,
      idempotencyKey,
    },
  };
}

export type SubmissionDecisionDependencies = {
  readonly readIdentity: () => Promise<ServerAdminIdentity | null>;
  readonly readCurrent: (id: string) => Promise<SubmissionDetail | null>;
  /**
   * Narrowed to what this module reads back (only `eventId`) rather than the full
   * `PostgresCommitResult`, so a test double does not have to fabricate `committed` and
   * `outboxMessageId` it will never be asked for — same narrowing `canonical-write.ts` uses.
   */
  readonly commit: (
    input: Parameters<typeof commitWithAuditPostgres>[0],
  ) => Promise<{ readonly eventId: string; readonly replayed: boolean }>;
  readonly newId: () => string;
  readonly now: () => string;
};

/**
 * `next/headers` (inside `supabase-server.ts`) is imported lazily so this module stays
 * unit-testable outside a request scope, matching `canonical-write.ts`'s same seam.
 */
const defaultDependencies: SubmissionDecisionDependencies = {
  async readIdentity() {
    const { readVerifiedAdminIdentity } = await import('../auth/supabase-server.js');
    return readVerifiedAdminIdentity();
  },
  readCurrent: getIntakeItemDetail,
  commit: commitWithAuditPostgres,
  newId: () => randomUUID(),
  now: () => new Date().toISOString(),
};

/** Thrown inside the transaction to roll it back without writing an audit row for a no-op. */
class SubmissionAlreadyProcessedError extends Error {}

/**
 * Decides one quarantined submission: 'promote' opens a `bb_research.cases` candidate (state
 * 'candidate', same shape `discovery-survivor-intake`/`quarantine-triage` produce elsewhere);
 * 'reject'/'spam' only flip `intake_items.status`. Every decision is one audited, transactional
 * commit — the status flip, the optional case insert, and the audit/outbox rows land together or
 * not at all.
 */
export async function commitSubmissionDecision(
  request: CommitSubmissionDecisionRequest,
  dependencies: Partial<SubmissionDecisionDependencies> = {},
): Promise<SubmissionDecisionResult> {
  const deps = { ...defaultDependencies, ...dependencies };

  const intakeItemId = request.intakeItemId.trim();
  if (!intakeItemId) {
    return { status: 'invalid', message: 'A submission id is required.' };
  }
  if (!isSubmissionDecision(request.decision)) {
    return { status: 'invalid', message: `Unknown decision: ${String(request.decision)}` };
  }
  const reason = request.reason.trim();
  if (!reason) {
    return { status: 'invalid', message: 'A reason is required to decide a submission.' };
  }

  const identity = await deps.readIdentity();
  if (!identity) {
    return { status: 'unauthenticated' };
  }

  try {
    assertStaffPermission(identity.role, SUBMISSION_DECISION_PERMISSION);
  } catch (error) {
    if (error instanceof StaffPermissionDeniedError) {
      return {
        status: 'forbidden',
        role: error.role,
        message: `Your role (${error.role}) cannot decide submissions. This needs ${error.permission}.`,
      };
    }
    throw error;
  }

  const current = await deps.readCurrent(intakeItemId);
  if (!current) {
    return { status: 'not_found' };
  }
  if (current.status !== 'quarantined') {
    return { status: 'already_processed' };
  }

  const plan = prepareSubmissionDecisionPlan({
    intakeItemId,
    decision: request.decision,
    title: current.title,
    reason,
    identity,
    nowIso: deps.now(),
    newId: deps.newId,
  });

  try {
    await deps.commit({
      auditEvent: plan.auditEvent,
      outboxMessage: plan.outboxMessage,
      applyState: async (client: pg.PoolClient) => {
        const updated = await client.query(
          `UPDATE bb_submissions.intake_items
              SET status = $1
            WHERE id = $2 AND status = 'quarantined'
          RETURNING id`,
          [plan.nextStatus, intakeItemId],
        );
        if (updated.rowCount === 0) {
          // Rolls the whole transaction back — no audit/outbox row for a decision that did not
          // actually happen (someone else's decision, or a resubmitted form, won the race).
          throw new SubmissionAlreadyProcessedError(intakeItemId);
        }
        if (request.decision === 'promote' && plan.researchCaseId) {
          const record = createResearchCase({
            id: plan.researchCaseId,
            candidateId: intakeItemId,
            title: current.title,
            checklist: { items: [] },
            now: plan.auditEvent.occurredAt,
          });
          await writeResearchCasePostgres(client, record);
        }
      },
    });
  } catch (error) {
    if (error instanceof SubmissionAlreadyProcessedError) {
      return { status: 'already_processed' };
    }
    console.error(
      'submission decision failed',
      { intakeItemId, decision: request.decision },
      error,
    );
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }

  return {
    status: 'ok',
    eventId: plan.auditEvent.id,
    ...(plan.researchCaseId ? { researchCaseId: plan.researchCaseId } : {}),
  };
}
