/**
 * Coerces Firestore researchCases documents into domain ResearchCaseRecord shapes.
 * Intake docs may be sparse; defaults keep triage operable without inventing evidence.
 */
import type {
  EvidenceChecklist,
  EvidenceChecklistItem,
  ResearchCaseAssignment,
  ResearchCasePublication,
  ResearchCaseRecord,
  ResearchCaseRetraction,
  ResearchCaseState,
  ResearchCaseTransitionEvent,
  RelevanceAssessment,
  ReviewPriority,
  ResearchReviewQueue,
} from '@repo/domain';
import { ALL_CASE_STATES } from './research-case-types';

function isState(value: unknown): value is ResearchCaseState {
  return typeof value === 'string' && (ALL_CASE_STATES as readonly string[]).includes(value);
}

function readChecklist(raw: unknown): EvidenceChecklist {
  if (!raw || typeof raw !== 'object' || !('items' in raw)) {
    return { items: [] };
  }
  const itemsRaw = (raw as { items?: unknown }).items;
  if (!Array.isArray(itemsRaw)) return { items: [] };
  const items: EvidenceChecklistItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as {
      key?: unknown;
      complete?: unknown;
      evidenceIds?: unknown;
      note?: unknown;
    };
    if (typeof row.key !== 'string') continue;
    items.push({
      key: row.key as EvidenceChecklistItem['key'],
      complete: row.complete === true,
      evidenceIds: Array.isArray(row.evidenceIds)
        ? row.evidenceIds.filter((value): value is string => typeof value === 'string')
        : [],
      ...(typeof row.note === 'string' ? { note: row.note } : {}),
    });
  }
  return { items };
}

function readHistory(raw: unknown): readonly ResearchCaseTransitionEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: ResearchCaseTransitionEvent[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (
      typeof row.from !== 'string' ||
      typeof row.to !== 'string' ||
      typeof row.reasonCode !== 'string' ||
      typeof row.reason !== 'string' ||
      typeof row.actorId !== 'string' ||
      typeof row.occurredAt !== 'string'
    ) {
      continue;
    }
    events.push({
      from: row.from as ResearchCaseState,
      to: row.to as ResearchCaseState,
      reasonCode: row.reasonCode as ResearchCaseTransitionEvent['reasonCode'],
      reason: row.reason,
      actorId: row.actorId,
      occurredAt: row.occurredAt,
      evidenceIds: Array.isArray(row.evidenceIds)
        ? row.evidenceIds.filter((value): value is string => typeof value === 'string')
        : [],
      ...(typeof row.mergedIntoCaseId === 'string'
        ? { mergedIntoCaseId: row.mergedIntoCaseId }
        : {}),
    });
  }
  return events;
}

function readAssignment(raw: unknown): ResearchCaseAssignment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.queue !== 'string' ||
    typeof row.priority !== 'string' ||
    typeof row.reviewerId !== 'string' ||
    typeof row.assignedBy !== 'string' ||
    typeof row.assignedAt !== 'string'
  ) {
    return undefined;
  }
  return {
    queue: row.queue as ResearchReviewQueue,
    priority: row.priority as ReviewPriority,
    reviewerId: row.reviewerId,
    assignedBy: row.assignedBy,
    assignedAt: row.assignedAt,
  };
}

function readPublication(raw: unknown): ResearchCasePublication | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.releaseId !== 'string' ||
    typeof row.publishedAt !== 'string' ||
    typeof row.revision !== 'string'
  ) {
    return undefined;
  }
  return {
    releaseId: row.releaseId,
    publishedAt: row.publishedAt,
    revision: row.revision,
  };
}

function readRetraction(raw: unknown): ResearchCaseRetraction | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.priorReleaseId !== 'string' ||
    typeof row.replacementReleaseId !== 'string' ||
    typeof row.reasonCode !== 'string' ||
    typeof row.reason !== 'string' ||
    typeof row.retractedAt !== 'string' ||
    typeof row.retractedBy !== 'string'
  ) {
    return undefined;
  }
  return {
    priorReleaseId: row.priorReleaseId,
    replacementReleaseId: row.replacementReleaseId,
    reasonCode: row.reasonCode as ResearchCaseRetraction['reasonCode'],
    reason: row.reason,
    retractedAt: row.retractedAt,
    retractedBy: row.retractedBy,
  };
}

function readPlaceHint(data: Record<string, unknown>): string | undefined {
  const direct = data.placeHint;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const geo = data.geographicHints;
  if (Array.isArray(geo) && typeof geo[0] === 'string') return geo[0];
  return undefined;
}

/**
 * Parse a Firestore doc into a ResearchCaseRecord. Returns null when id/title cannot be recovered.
 */
export function parseResearchCaseRecord(
  id: string,
  data: Record<string, unknown>,
): { readonly record: ResearchCaseRecord; readonly placeHint?: string } | null {
  const title =
    typeof data.title === 'string' && data.title.trim() ? data.title.trim() : id;
  const candidateId =
    typeof data.candidateId === 'string' && data.candidateId.trim()
      ? data.candidateId.trim()
      : id;
  const state = isState(data.state) ? data.state : 'candidate';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt : '';
  const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : createdAt;
  const checklist = readChecklist(data.checklist);
  const history = readHistory(data.history);
  const assignment = readAssignment(data.assignment);
  const publication = readPublication(data.publication);
  const retraction = readRetraction(data.retraction);
  const relevanceAssessment =
    data.relevanceAssessment && typeof data.relevanceAssessment === 'object'
      ? (data.relevanceAssessment as RelevanceAssessment)
      : undefined;
  const placeHint = readPlaceHint(data);

  const record: ResearchCaseRecord = {
    id,
    state,
    candidateId,
    title,
    checklist,
    history,
    createdAt,
    updatedAt,
    ...(relevanceAssessment ? { relevanceAssessment } : {}),
    ...(assignment ? { assignment } : {}),
    ...(publication ? { publication } : {}),
    ...(retraction ? { retraction } : {}),
  };

  return {
    record,
    ...(placeHint ? { placeHint } : {}),
  };
}

export function checklistProgress(checklist: EvidenceChecklist): {
  readonly complete: number;
  readonly total: number;
} {
  const total = checklist.items.length;
  const complete = checklist.items.filter((item) => item.complete).length;
  return { complete, total };
}
