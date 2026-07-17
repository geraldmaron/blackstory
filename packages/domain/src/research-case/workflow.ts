/**
 * Implements deterministic research-case transitions, review routing, minimum-record
 * publication gates, previews, promotion, retraction releases, and backfill scheduling.
 */
import type { RelevanceAssessment } from '../relevance/index.js';
import { buildReleaseClaimPreview, type PreviewClaim } from '../promotion/index.js';
import { buildReleaseManifest, type ReleaseArtifact } from '../publication/index.js';
import {
  EVIDENCE_CHECKLIST_KEYS,
  MINIMUM_RECORD_CHECKLIST_KEYS,
  type BackfillJob,
  type EvidenceChecklist,
  type EvidenceChecklistEvaluation,
  type EvidenceChecklistKey,
  type ResearchCaseAssignment,
  type ResearchCasePreview,
  type ResearchCasePromotion,
  type ResearchCaseReasonCode,
  type ResearchCaseRecord,
  type ResearchCaseRetraction,
  type ResearchCaseRetractionPlan,
  type ResearchCaseState,
  type ResearchCaseTransitionEvent,
  type ResearchReviewQueue,
  type ReviewPriority,
} from './model.js';

const ISO_DATE_ERROR = 'must be an ISO-compatible date';
const ENRICHMENT_KEYS = EVIDENCE_CHECKLIST_KEYS.filter(
  (key) =>
    !MINIMUM_RECORD_CHECKLIST_KEYS.includes(key as (typeof MINIMUM_RECORD_CHECKLIST_KEYS)[number]),
);

const LEGAL_TRANSITIONS: Readonly<Record<ResearchCaseState, ReadonlySet<ResearchCaseState>>> = {
  candidate: new Set(['relevance_review', 'merged']),
  relevance_review: new Set(['relevance_confirmed', 'insufficient_evidence', 'excluded', 'merged']),
  relevance_confirmed: new Set([
    'minimum_record',
    'partial_enrichment',
    'substantial_enrichment',
    'insufficient_evidence',
    'excluded',
    'merged',
  ]),
  minimum_record: new Set([
    'partial_enrichment',
    'substantial_enrichment',
    'insufficient_evidence',
    'excluded',
    'merged',
    'retracted',
  ]),
  partial_enrichment: new Set([
    'substantial_enrichment',
    'insufficient_evidence',
    'excluded',
    'merged',
    'retracted',
  ]),
  substantial_enrichment: new Set([
    'partial_enrichment',
    'insufficient_evidence',
    'excluded',
    'merged',
    'retracted',
  ]),
  insufficient_evidence: new Set(['relevance_review', 'excluded', 'merged']),
  excluded: new Set(['relevance_review', 'merged']),
  merged: new Set(),
  retracted: new Set(['relevance_review']),
};

const EXCLUSION_REASONS = new Set<ResearchCaseReasonCode>([
  'duplicate_case',
  'outside_scope',
  'rights_restricted',
  'relevance_not_established',
  'insufficient_source_evidence',
]);

const RETRACTION_REASONS = new Set<ResearchCaseRetraction['reasonCode']>([
  'material_correction',
  'legal_or_rights_request',
  'source_retracted',
  'publication_error',
]);

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
}

function assertIsoDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} ${ISO_DATE_ERROR}`);
}

function freezeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export function evaluateEvidenceChecklist(
  checklist: EvidenceChecklist,
): EvidenceChecklistEvaluation {
  const byKey = new Map<EvidenceChecklistKey, boolean>();
  for (const item of checklist.items) {
    if (byKey.has(item.key)) throw new Error(`Duplicate evidence checklist item: ${item.key}`);
    if (item.complete && item.evidenceIds.length === 0) {
      throw new Error(`Completed checklist item ${item.key} requires evidence`);
    }
    byKey.set(item.key, item.complete);
  }

  const missingMinimum = MINIMUM_RECORD_CHECKLIST_KEYS.filter((key) => byKey.get(key) !== true);
  const completedEnrichment = ENRICHMENT_KEYS.filter((key) => byKey.get(key) === true);
  const meetsMinimumRecord = missingMinimum.length === 0;
  const level = !meetsMinimumRecord
    ? 'insufficient'
    : completedEnrichment.length === 0
      ? 'minimum'
      : completedEnrichment.length === ENRICHMENT_KEYS.length
        ? 'substantial'
        : 'partial';

  return Object.freeze({
    meetsMinimumRecord,
    level,
    missingMinimum: Object.freeze(missingMinimum),
    completedEnrichment: Object.freeze(completedEnrichment),
  });
}

export function createResearchCase(input: {
  readonly id: string;
  readonly candidateId: string;
  readonly title: string;
  readonly checklist: EvidenceChecklist;
  readonly now: string;
  readonly relevanceAssessment?: RelevanceAssessment;
}): ResearchCaseRecord {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.candidateId, 'candidateId');
  assertNonEmpty(input.title, 'title');
  assertIsoDate(input.now, 'now');
  evaluateEvidenceChecklist(input.checklist);
  return Object.freeze({
    id: input.id,
    state: 'candidate' as const,
    candidateId: input.candidateId,
    title: input.title,
    checklist: input.checklist,
    history: Object.freeze([]),
    createdAt: input.now,
    updatedAt: input.now,
    ...(input.relevanceAssessment ? { relevanceAssessment: input.relevanceAssessment } : {}),
  });
}

export type TransitionResearchCaseInput = {
  readonly targetState: Exclude<ResearchCaseState, 'retracted'>;
  readonly actorId: string;
  readonly now: string;
  readonly reasonCode: ResearchCaseReasonCode;
  readonly reason: string;
  readonly evidenceIds?: readonly string[];
  readonly checklist?: EvidenceChecklist;
  readonly relevanceAssessment?: RelevanceAssessment;
  readonly mergedIntoCaseId?: string;
};

function assertTargetRequirements(
  record: ResearchCaseRecord,
  input: TransitionResearchCaseInput,
  checklist: EvidenceChecklist,
  assessment: RelevanceAssessment | undefined,
): void {
  const evidenceIds = input.evidenceIds ?? [];
  if (
    input.targetState === 'relevance_confirmed' &&
    (!assessment || !assessment.passes || assessment.decision === 'exclude')
  ) {
    throw new Error('Relevance confirmation requires a passing non-excluded assessment');
  }
  const evaluation = evaluateEvidenceChecklist(checklist);
  if (input.targetState === 'minimum_record' && evaluation.level !== 'minimum') {
    throw new Error('Minimum-record state requires only the complete minimum checklist');
  }
  if (input.targetState === 'partial_enrichment' && evaluation.level !== 'partial') {
    throw new Error('Partial-enrichment state requires minimum fields and partial enrichment');
  }
  if (input.targetState === 'substantial_enrichment' && evaluation.level !== 'substantial') {
    throw new Error('Substantial-enrichment state requires all checklist items');
  }
  if (input.targetState === 'excluded' && !EXCLUSION_REASONS.has(input.reasonCode)) {
    throw new Error('Excluded cases require an exclusion reason code');
  }
  if (input.targetState === 'merged') {
    assertNonEmpty(input.mergedIntoCaseId ?? '', 'mergedIntoCaseId');
    if (input.mergedIntoCaseId === record.id) throw new Error('A case cannot merge into itself');
  }
  if (
    input.targetState === 'relevance_review' &&
    (record.state === 'excluded' ||
      record.state === 'insufficient_evidence' ||
      record.state === 'retracted') &&
    evidenceIds.length === 0
  ) {
    throw new Error('Reconsideration requires new evidence');
  }
}

export function transitionResearchCase(
  record: ResearchCaseRecord,
  input: TransitionResearchCaseInput,
): ResearchCaseRecord {
  if (!LEGAL_TRANSITIONS[record.state].has(input.targetState)) {
    throw new Error(`Research case cannot transition from ${record.state} to ${input.targetState}`);
  }
  assertNonEmpty(input.actorId, 'actorId');
  assertNonEmpty(input.reason, 'reason');
  assertIsoDate(input.now, 'now');
  const checklist = input.checklist ?? record.checklist;
  const assessment = input.relevanceAssessment ?? record.relevanceAssessment;
  assertTargetRequirements(record, input, checklist, assessment);
  const event: ResearchCaseTransitionEvent = Object.freeze({
    from: record.state,
    to: input.targetState,
    reasonCode: input.reasonCode,
    reason: input.reason,
    actorId: input.actorId,
    occurredAt: input.now,
    evidenceIds: freezeStrings(input.evidenceIds ?? []),
    ...(input.mergedIntoCaseId ? { mergedIntoCaseId: input.mergedIntoCaseId } : {}),
  });
  return Object.freeze({
    ...record,
    state: input.targetState,
    checklist,
    history: Object.freeze([...record.history, event]),
    updatedAt: input.now,
    ...(input.relevanceAssessment ? { relevanceAssessment: input.relevanceAssessment } : {}),
  });
}

export function routeResearchCaseQueue(record: ResearchCaseRecord): ResearchReviewQueue | null {
  switch (record.state) {
    case 'candidate':
    case 'relevance_review':
    case 'insufficient_evidence':
    case 'excluded':
      return 'relevance';
    case 'relevance_confirmed':
      return 'minimum_record';
    case 'minimum_record':
    case 'partial_enrichment':
    case 'substantial_enrichment':
      return record.publication ? 'enrichment' : 'publication';
    case 'retracted':
      return 'retraction';
    case 'merged':
      return null;
  }
}

export function assignResearchCase(
  record: ResearchCaseRecord,
  input: {
    readonly reviewerId: string;
    readonly assignedBy: string;
    readonly assignedAt: string;
    readonly priority: ReviewPriority;
    readonly queue?: ResearchReviewQueue;
  },
): ResearchCaseRecord {
  assertNonEmpty(input.reviewerId, 'reviewerId');
  assertNonEmpty(input.assignedBy, 'assignedBy');
  assertIsoDate(input.assignedAt, 'assignedAt');
  const queue = input.queue ?? routeResearchCaseQueue(record);
  if (!queue) throw new Error('Merged cases cannot be assigned');
  const assignment: ResearchCaseAssignment = Object.freeze({
    queue,
    priority: input.priority,
    reviewerId: input.reviewerId,
    assignedBy: input.assignedBy,
    assignedAt: input.assignedAt,
  });
  return Object.freeze({ ...record, assignment, updatedAt: input.assignedAt });
}

export function buildResearchCasePreview(input: {
  readonly record: ResearchCaseRecord;
  readonly currentClaims: readonly PreviewClaim[];
  readonly candidateClaims: readonly PreviewClaim[];
}): ResearchCasePreview {
  const checklist = evaluateEvidenceChecklist(input.record.checklist);
  return Object.freeze({
    caseId: input.record.id,
    publishable:
      checklist.meetsMinimumRecord &&
      (input.record.state === 'minimum_record' ||
        input.record.state === 'partial_enrichment' ||
        input.record.state === 'substantial_enrichment'),
    checklist,
    claims: buildReleaseClaimPreview(input.currentClaims, input.candidateClaims),
  });
}

export function prepareResearchCasePromotion(input: {
  readonly record: ResearchCaseRecord;
  readonly currentClaims: readonly PreviewClaim[];
  readonly candidateClaims: readonly PreviewClaim[];
}): ResearchCasePromotion {
  const preview = buildResearchCasePreview(input);
  const reasons: ('minimum_record_incomplete' | 'relevance_not_confirmed')[] = [];
  if (!preview.checklist.meetsMinimumRecord) reasons.push('minimum_record_incomplete');
  if (
    input.record.state !== 'minimum_record' &&
    input.record.state !== 'partial_enrichment' &&
    input.record.state !== 'substantial_enrichment'
  ) {
    reasons.push('relevance_not_confirmed');
  }
  return Object.freeze({
    caseId: input.record.id,
    promotionStage: 'research_case' as const,
    eligible: reasons.length === 0,
    reasonCodes: Object.freeze(reasons),
    preview,
  });
}

export function markResearchCasePublished(
  record: ResearchCaseRecord,
  input: { readonly releaseId: string; readonly revision: string; readonly publishedAt: string },
): ResearchCaseRecord {
  const promotion = prepareResearchCasePromotion({
    record,
    currentClaims: [],
    candidateClaims: [],
  });
  if (!promotion.eligible) throw new Error('Research case does not meet publication requirements');
  assertNonEmpty(input.releaseId, 'releaseId');
  assertNonEmpty(input.revision, 'revision');
  assertIsoDate(input.publishedAt, 'publishedAt');
  return Object.freeze({
    ...record,
    publication: Object.freeze(input),
    updatedAt: input.publishedAt,
  });
}

export function retractResearchCase(input: {
  readonly record: ResearchCaseRecord;
  readonly entityId: string;
  readonly replacementReleaseId: string;
  readonly searchIndexVersion: string;
  readonly remainingArtifacts: readonly ReleaseArtifact[];
  readonly actorId: string;
  readonly now: string;
  readonly reasonCode: ResearchCaseRetraction['reasonCode'];
  readonly reason: string;
}): ResearchCaseRetractionPlan {
  if (!input.record.publication) throw new Error('Only a published research case can be retracted');
  if (!LEGAL_TRANSITIONS[input.record.state].has('retracted')) {
    throw new Error(`Research case cannot transition from ${input.record.state} to retracted`);
  }
  if (!RETRACTION_REASONS.has(input.reasonCode)) {
    throw new Error('Retraction requires a supported reason code');
  }
  assertNonEmpty(input.reason, 'reason');
  assertNonEmpty(input.actorId, 'actorId');
  assertIsoDate(input.now, 'now');
  if (input.remainingArtifacts.some((artifact) => artifact.entityId === input.entityId)) {
    throw new Error('Replacement release must omit the retracted entity');
  }
  const replacementManifest = buildReleaseManifest({
    releaseId: input.replacementReleaseId,
    generatedAt: input.now,
    searchIndexVersion: input.searchIndexVersion,
    artifacts: input.remainingArtifacts,
  });
  const retraction: ResearchCaseRetraction = Object.freeze({
    priorReleaseId: input.record.publication.releaseId,
    replacementReleaseId: input.replacementReleaseId,
    reasonCode: input.reasonCode,
    reason: input.reason,
    retractedAt: input.now,
    retractedBy: input.actorId,
  });
  const event: ResearchCaseTransitionEvent = Object.freeze({
    from: input.record.state,
    to: 'retracted',
    reasonCode: input.reasonCode,
    reason: input.reason,
    actorId: input.actorId,
    occurredAt: input.now,
    evidenceIds: Object.freeze([]),
  });
  const record = Object.freeze({
    ...input.record,
    state: 'retracted' as const,
    retraction,
    history: Object.freeze([...input.record.history, event]),
    updatedAt: input.now,
  });
  return Object.freeze({
    case: record,
    replacementManifest,
    removedEntityId: input.entityId,
    priorReleaseId: input.record.publication.releaseId,
  });
}

export function scheduleResearchCaseBackfill(input: {
  readonly id: string;
  readonly record: ResearchCaseRecord;
  readonly scheduledFor: string;
  readonly scheduledBy: string;
  readonly priority: ReviewPriority;
  readonly now: string;
}): BackfillJob {
  assertNonEmpty(input.id, 'id');
  assertNonEmpty(input.scheduledBy, 'scheduledBy');
  assertIsoDate(input.scheduledFor, 'scheduledFor');
  assertIsoDate(input.now, 'now');
  if (Date.parse(input.scheduledFor) < Date.parse(input.now)) {
    throw new Error('Backfill cannot be scheduled in the past');
  }
  evaluateEvidenceChecklist(input.record.checklist);
  const completed = new Set(
    input.record.checklist.items.filter((item) => item.complete).map((item) => item.key),
  );
  const missingFields = EVIDENCE_CHECKLIST_KEYS.filter((key) => !completed.has(key));
  if (missingFields.length === 0) throw new Error('Complete cases do not need backfill');
  return Object.freeze({
    id: input.id,
    caseId: input.record.id,
    status: 'scheduled' as const,
    missingFields: Object.freeze(missingFields),
    priority: input.priority,
    scheduledFor: input.scheduledFor,
    scheduledBy: input.scheduledBy,
    createdAt: input.now,
  });
}
