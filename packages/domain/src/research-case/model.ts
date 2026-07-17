/**
 * Defines the research-case lifecycle, review work, evidence completeness, publication,
 * retraction, and backfill contracts.
 */
import type { RelevanceAssessment } from '../relevance/index.js';
import type { ReleaseClaimPreview } from '../promotion/index.js';
import type { ReleaseManifest } from '../publication/index.js';

export const RESEARCH_CASE_STATES = [
  'candidate',
  'relevance_review',
  'relevance_confirmed',
  'minimum_record',
  'partial_enrichment',
  'substantial_enrichment',
  'insufficient_evidence',
  'excluded',
  'merged',
  'retracted',
] as const;

export type ResearchCaseState = (typeof RESEARCH_CASE_STATES)[number];

export const RESEARCH_CASE_REASON_CODES = [
  'relevance_confirmed',
  'minimum_record_complete',
  'partial_enrichment_complete',
  'substantial_enrichment_complete',
  'insufficient_source_evidence',
  'identity_unresolved',
  'relevance_not_established',
  'duplicate_case',
  'outside_scope',
  'rights_restricted',
  'merged_duplicate',
  'new_evidence_received',
  'material_correction',
  'legal_or_rights_request',
  'source_retracted',
  'publication_error',
] as const;

export type ResearchCaseReasonCode = (typeof RESEARCH_CASE_REASON_CODES)[number];

export const EVIDENCE_CHECKLIST_KEYS = [
  'identity',
  'relevance_assessment',
  'source_citation',
  'public_summary',
  'rights_clearance',
  'dates',
  'geography',
  'corroboration',
  'contradiction_search',
  'historical_context',
] as const;

export type EvidenceChecklistKey = (typeof EVIDENCE_CHECKLIST_KEYS)[number];

export const MINIMUM_RECORD_CHECKLIST_KEYS = [
  'identity',
  'relevance_assessment',
  'source_citation',
  'public_summary',
  'rights_clearance',
] as const satisfies readonly EvidenceChecklistKey[];

export type EvidenceChecklistItem = {
  readonly key: EvidenceChecklistKey;
  readonly complete: boolean;
  readonly evidenceIds: readonly string[];
  readonly note?: string;
};

export type EvidenceChecklist = {
  readonly items: readonly EvidenceChecklistItem[];
};

export type EvidenceChecklistEvaluation = {
  readonly meetsMinimumRecord: boolean;
  readonly level: 'insufficient' | 'minimum' | 'partial' | 'substantial';
  readonly missingMinimum: readonly EvidenceChecklistKey[];
  readonly completedEnrichment: readonly EvidenceChecklistKey[];
};

export const RESEARCH_REVIEW_QUEUES = [
  'relevance',
  'minimum_record',
  'enrichment',
  'publication',
  'retraction',
  'backfill',
] as const;

export type ResearchReviewQueue = (typeof RESEARCH_REVIEW_QUEUES)[number];
export type ReviewPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ResearchCaseAssignment = {
  readonly queue: ResearchReviewQueue;
  readonly priority: ReviewPriority;
  readonly reviewerId: string;
  readonly assignedBy: string;
  readonly assignedAt: string;
};

export type ResearchCaseTransitionEvent = {
  readonly from: ResearchCaseState;
  readonly to: ResearchCaseState;
  readonly reasonCode: ResearchCaseReasonCode;
  readonly reason: string;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly evidenceIds: readonly string[];
  readonly mergedIntoCaseId?: string;
};

export type ResearchCasePublication = {
  readonly releaseId: string;
  readonly publishedAt: string;
  readonly revision: string;
};

export type ResearchCaseRetraction = {
  readonly priorReleaseId: string;
  readonly replacementReleaseId: string;
  readonly reasonCode:
    'material_correction' | 'legal_or_rights_request' | 'source_retracted' | 'publication_error';
  readonly reason: string;
  readonly retractedAt: string;
  readonly retractedBy: string;
};

export type ResearchCaseRecord = {
  readonly id: string;
  readonly state: ResearchCaseState;
  readonly candidateId: string;
  readonly title: string;
  readonly relevanceAssessment?: RelevanceAssessment;
  readonly checklist: EvidenceChecklist;
  readonly assignment?: ResearchCaseAssignment;
  readonly publication?: ResearchCasePublication;
  readonly retraction?: ResearchCaseRetraction;
  readonly history: readonly ResearchCaseTransitionEvent[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ResearchCasePreview = {
  readonly caseId: string;
  readonly publishable: boolean;
  readonly checklist: EvidenceChecklistEvaluation;
  readonly claims: ReleaseClaimPreview;
};

export type ResearchCasePromotion = {
  readonly caseId: string;
  readonly promotionStage: 'research_case';
  readonly eligible: boolean;
  readonly reasonCodes: readonly ('minimum_record_incomplete' | 'relevance_not_confirmed')[];
  readonly preview: ResearchCasePreview;
};

export type ResearchCaseRetractionPlan = {
  readonly case: ResearchCaseRecord;
  readonly replacementManifest: ReleaseManifest;
  readonly removedEntityId: string;
  readonly priorReleaseId: string;
};

export type BackfillJob = {
  readonly id: string;
  readonly caseId: string;
  readonly status: 'scheduled';
  readonly missingFields: readonly EvidenceChecklistKey[];
  readonly priority: ReviewPriority;
  readonly scheduledFor: string;
  readonly scheduledBy: string;
  readonly createdAt: string;
};
