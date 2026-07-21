/**
 * Admin reads/writes for research cases used by the management portal.
 * Uses Postgres bb_research exclusively. Mutations remain audited and never touch public projections.
 */
import { randomUUID } from 'node:crypto';
import {
  assignResearchCase,
  auditCategoryFor,
  transitionResearchCase,
  type RelevanceAssessment,
  type ResearchCaseReasonCode,
  type ResearchCaseRecord,
  type ResearchCaseState,
  type ReviewPriority,
} from '@repo/domain';
import { ledgerPaths } from '@repo/data-access';
import { commitWithAuditPostgres } from '@/lib/postgres-commit';
import {
  listCaseIdsPostgres,
  loadResearchCaseDocument,
  writeResearchCasePostgres,
} from '@/lib/postgres-research-cases';
import { checklistProgress, parseResearchCaseRecord } from './parse-research-case';
import {
  EXCLUSION_REASON_CODES,
  type AdminCaseDetail,
  type AdminCaseListItem,
  type AdminCaseTransitionAction,
  type AdminCaseTransitionRequest,
  INBOX_CASE_STATES,
} from './research-case-types';

function toListItem(record: ResearchCaseRecord, placeHint?: string): AdminCaseListItem {
  const progress = checklistProgress(record.checklist);
  return {
    id: record.id,
    title: record.title,
    state: record.state,
    candidateId: record.candidateId,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
    checklistComplete: progress.complete,
    checklistTotal: progress.total,
    ...(record.assignment?.reviewerId ? { assigneeId: record.assignment.reviewerId } : {}),
    ...(placeHint ? { placeHint } : {}),
  };
}

function toDetail(record: ResearchCaseRecord, placeHint?: string): AdminCaseDetail {
  return {
    id: record.id,
    title: record.title,
    state: record.state,
    candidateId: record.candidateId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    checklist: record.checklist,
    history: record.history,
    record,
    ...(record.relevanceAssessment ? { relevanceAssessment: record.relevanceAssessment } : {}),
    ...(record.assignment ? { assignment: record.assignment } : {}),
    ...(record.publication ? { publication: record.publication } : {}),
    ...(record.retraction ? { retraction: record.retraction } : {}),
    ...(placeHint ? { placeHint } : {}),
  };
}

export async function listAdminResearchCases(options?: {
  readonly states?: readonly ResearchCaseState[];
  readonly limit?: number;
}): Promise<readonly AdminCaseListItem[]> {
  const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
  const states = options?.states ?? INBOX_CASE_STATES;

  const caseIds = await listCaseIdsPostgres({ states, limit });
  const items: AdminCaseListItem[] = [];
  for (const caseId of caseIds) {
    const doc = await loadResearchCaseDocument(caseId);
    if (!doc) continue;
    const parsed = parseResearchCaseRecord(caseId, doc);
    if (!parsed) continue;
    items.push(toListItem(parsed.record, parsed.placeHint));
  }
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAdminResearchCaseDetail(id: string): Promise<AdminCaseDetail | null> {
  const doc = await loadResearchCaseDocument(id);
  if (!doc) return null;
  const parsed = parseResearchCaseRecord(id, doc);
  if (!parsed) return null;
  return toDetail(parsed.record, parsed.placeHint);
}

export async function tryListAdminResearchCases(
  options?: Parameters<typeof listAdminResearchCases>[0],
): Promise<readonly AdminCaseListItem[] | null> {
  try {
    return await listAdminResearchCases(options);
  } catch (error) {
    console.error('admin researchCases list failed', error);
    return null;
  }
}

function buildOperatorRelevanceAssessment(input: {
  readonly candidateId: string;
  readonly actorId: string;
  readonly now: string;
  readonly reason: string;
}): RelevanceAssessment {
  return {
    schemaVersion: 'relevance-assessment.v1',
    candidateId: input.candidateId,
    decision: 'include',
    compositeScore: 1,
    policyVersion: 'admin-operator-affirmation.v1',
    passes: true,
    featureValues: [],
    gates: [],
    evidence: [{ kind: 'override', summary: input.reason }],
    whyThisAppears: input.reason,
    override: {
      decision: 'include',
      reason: input.reason,
      overriddenBy: input.actorId,
      overriddenAt: input.now,
    },
    distinctivenessKey: `operator:${input.candidateId}`,
    isDuplicate: false,
    assessedAt: input.now,
  };
}

function resolveTransition(
  record: ResearchCaseRecord,
  request: AdminCaseTransitionRequest,
  actorId: string,
  now: string,
): { readonly next: ResearchCaseRecord; readonly targetState: ResearchCaseState } {
  const reason = request.reason.trim();
  if (!reason) {
    throw new Error(
      'Add a decision reason before this action. Every move is audited and does not publish by itself.',
    );
  }

  const map: Record<
    AdminCaseTransitionAction,
    { targetState: Exclude<ResearchCaseState, 'retracted'>; reasonCode: ResearchCaseReasonCode }
  > = {
    send_to_relevance: {
      targetState: 'relevance_review',
      reasonCode: request.reasonCode ?? 'new_evidence_received',
    },
    confirm_relevance: {
      targetState: 'relevance_confirmed',
      reasonCode: request.reasonCode ?? 'relevance_confirmed',
    },
    needs_evidence: {
      targetState: 'insufficient_evidence',
      reasonCode: request.reasonCode ?? 'insufficient_source_evidence',
    },
    exclude: {
      targetState: 'excluded',
      reasonCode: request.reasonCode ?? 'outside_scope',
    },
    merge: {
      targetState: 'merged',
      reasonCode: request.reasonCode ?? 'merged_duplicate',
    },
  };

  const plan = map[request.action];
  if (request.action === 'exclude' && !EXCLUSION_REASON_CODES.includes(plan.reasonCode)) {
    throw new Error('Excluded cases require an exclusion reason code');
  }
  if (request.action === 'merge' && !request.mergedIntoCaseId?.trim()) {
    throw new Error('mergedIntoCaseId is required for merge');
  }

  const needsReconsiderationEvidence =
    plan.targetState === 'relevance_review' &&
    (record.state === 'excluded' ||
      record.state === 'insufficient_evidence' ||
      record.state === 'retracted');
  const evidenceIds =
    request.evidenceIds && request.evidenceIds.length > 0
      ? request.evidenceIds
      : needsReconsiderationEvidence
        ? [`admin-reconsideration:${now}`]
        : [];
  const next = transitionResearchCase(record, {
    targetState: plan.targetState,
    actorId,
    now,
    reasonCode: plan.reasonCode,
    reason,
    ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
    ...(request.action === 'merge' && request.mergedIntoCaseId
      ? { mergedIntoCaseId: request.mergedIntoCaseId.trim() }
      : {}),
    ...(request.action === 'confirm_relevance'
      ? {
          relevanceAssessment: buildOperatorRelevanceAssessment({
            candidateId: record.candidateId,
            actorId,
            now,
            reason,
          }),
        }
      : {}),
  });

  return { next, targetState: plan.targetState };
}

async function commitCaseUpdate(input: {
  readonly previous: ResearchCaseRecord;
  readonly next: ResearchCaseRecord;
  readonly actorUid: string;
  readonly actorEmail: string;
  readonly reason: string;
  readonly action: string;
}): Promise<{ readonly detail: AdminCaseDetail; readonly auditEventId: string }> {
  const now = input.next.updatedAt;
  const path = ledgerPaths.researchCase(input.next.id);
  const idempotencyKey = `research-case:${input.next.id}:${input.action}:${now}:${randomUUID()}`;
  const eventId = randomUUID();
  const auditEvent = {
    id: eventId,
    action: 'research.updated' as const,
    category: auditCategoryFor('research.updated'),
    actor: {
      type: 'user' as const,
      id: input.actorUid,
      displayName: input.actorEmail,
    },
    subject: { type: 'researchCase', id: input.next.id, path },
    reason: input.reason,
    requestId: randomUUID(),
    correlationId: idempotencyKey,
    idempotencyKey,
    occurredAt: now.includes('T') ? now : new Date().toISOString(),
    entityId: input.next.id,
    data: {
      fromState: input.previous.state,
      toState: input.next.state,
      action: input.action,
    },
  };

  const outboxMessage = {
    id: randomUUID(),
    eventId,
    topic: 'research.case.updated',
    aggregateType: 'researchCase',
    aggregateId: input.next.id,
    payload: {
      caseId: input.next.id,
      fromState: input.previous.state,
      toState: input.next.state,
      action: input.action,
    },
    status: 'pending' as const,
    attempts: 0,
    maxAttempts: 8,
    availableAt: auditEvent.occurredAt,
    createdAt: auditEvent.occurredAt,
    correlationId: idempotencyKey,
    idempotencyKey,
  };

  const result = await commitWithAuditPostgres({
    auditEvent,
    outboxMessage,
    applyState: async (client) => {
      await writeResearchCasePostgres(client, input.next);
    },
  });

  return {
    detail: toDetail(input.next),
    auditEventId: result.eventId,
  };
}

export async function transitionAdminResearchCase(input: {
  readonly caseId: string;
  readonly request: AdminCaseTransitionRequest;
  readonly actorUid: string;
  readonly actorEmail: string;
}): Promise<{ readonly detail: AdminCaseDetail; readonly auditEventId: string }> {
  const detail = await getAdminResearchCaseDetail(input.caseId);
  if (!detail) throw new Error(`Research case not found: ${input.caseId}`);
  const now = new Date().toISOString();
  const { next } = resolveTransition(detail.record, input.request, input.actorUid, now);
  return commitCaseUpdate({
    previous: detail.record,
    next,
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
    reason: input.request.reason.trim(),
    action: input.request.action,
  });
}

export async function bulkTransitionAdminResearchCases(input: {
  readonly caseIds: readonly string[];
  readonly request: AdminCaseTransitionRequest;
  readonly actorUid: string;
  readonly actorEmail: string;
}): Promise<{
  readonly succeeded: number;
  readonly failed: number;
  readonly errors: readonly { readonly caseId: string; readonly error: string }[];
}> {
  if (input.caseIds.length === 0) throw new Error('At least one case id is required');
  if (input.caseIds.length > 50) throw new Error('Bulk transition limit is 50 items');
  if (new Set(input.caseIds).size !== input.caseIds.length) {
    throw new Error('Duplicate case ids are not allowed');
  }

  let succeeded = 0;
  let failed = 0;
  const errors: { caseId: string; error: string }[] = [];

  for (const caseId of input.caseIds) {
    try {
      await transitionAdminResearchCase({
        caseId,
        request: input.request,
        actorUid: input.actorUid,
        actorEmail: input.actorEmail,
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        caseId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed, errors };
}

export async function assignAdminResearchCase(input: {
  readonly caseId: string;
  readonly reviewerId: string;
  readonly assignedBy: string;
  readonly actorUid: string;
  readonly actorEmail: string;
  readonly priority?: ReviewPriority;
  readonly reason?: string;
}): Promise<{ readonly detail: AdminCaseDetail; readonly auditEventId: string }> {
  const detail = await getAdminResearchCaseDetail(input.caseId);
  if (!detail) throw new Error(`Research case not found: ${input.caseId}`);
  const now = new Date().toISOString();
  const next = assignResearchCase(detail.record, {
    reviewerId: input.reviewerId,
    assignedBy: input.assignedBy,
    assignedAt: now,
    priority: input.priority ?? 'normal',
  });
  return commitCaseUpdate({
    previous: detail.record,
    next,
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
    reason: input.reason?.trim() || `Assigned to ${input.reviewerId}`,
    action: 'assign',
  });
}
