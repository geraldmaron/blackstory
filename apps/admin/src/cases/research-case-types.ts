/**
 * Shared admin types for research-case list/detail surfaces.
 * Keeps interactive queues off ConsoleFixtureRow collapse.
 */
import type {
  EvidenceChecklist,
  ResearchCaseAssignment,
  ResearchCaseReasonCode,
  ResearchCaseRecord,
  ResearchCaseState,
  ResearchCaseTransitionEvent,
  RelevanceAssessment,
} from '@repo/domain';

export type AdminCaseListItem = {
  readonly id: string;
  readonly title: string;
  readonly state: ResearchCaseState;
  readonly candidateId: string;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly checklistComplete: number;
  readonly checklistTotal: number;
  readonly assigneeId?: string;
  readonly placeHint?: string;
};

export type AdminCaseDetail = {
  readonly id: string;
  readonly title: string;
  readonly state: ResearchCaseState;
  readonly candidateId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly checklist: EvidenceChecklist;
  readonly history: readonly ResearchCaseTransitionEvent[];
  readonly relevanceAssessment?: RelevanceAssessment;
  readonly assignment?: ResearchCaseAssignment;
  readonly publication?: ResearchCaseRecord['publication'];
  readonly retraction?: ResearchCaseRecord['retraction'];
  readonly placeHint?: string;
  readonly record: ResearchCaseRecord;
};

export type AdminCaseTransitionAction =
  | 'send_to_relevance'
  | 'confirm_relevance'
  | 'needs_evidence'
  | 'exclude'
  | 'merge';

export type AdminCaseTransitionRequest = {
  readonly action: AdminCaseTransitionAction;
  readonly reason: string;
  readonly reasonCode?: ResearchCaseReasonCode;
  readonly mergedIntoCaseId?: string;
  readonly evidenceIds?: readonly string[];
};

export const INBOX_CASE_STATES: readonly ResearchCaseState[] = [
  'candidate',
  'relevance_review',
  'insufficient_evidence',
];

export const ALL_CASE_STATES: readonly ResearchCaseState[] = [
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
];

export const EXCLUSION_REASON_CODES: readonly ResearchCaseReasonCode[] = [
  'duplicate_case',
  'outside_scope',
  'rights_restricted',
  'relevance_not_established',
  'insufficient_source_evidence',
];

export function stateLabel(state: ResearchCaseState): string {
  switch (state) {
    case 'candidate':
      return 'Awaiting triage';
    case 'relevance_review':
      return 'Relevance review';
    case 'relevance_confirmed':
      return 'Relevance confirmed';
    case 'minimum_record':
      return 'Minimum record';
    case 'partial_enrichment':
      return 'Partial enrichment';
    case 'substantial_enrichment':
      return 'Substantial enrichment';
    case 'insufficient_evidence':
      return 'Needs evidence';
    case 'excluded':
      return 'Excluded';
    case 'merged':
      return 'Merged';
    case 'retracted':
      return 'Retracted';
  }
}

export function legalActionsForState(state: ResearchCaseState): readonly AdminCaseTransitionAction[] {
  switch (state) {
    case 'candidate':
      return ['send_to_relevance', 'merge'];
    case 'relevance_review':
      return ['confirm_relevance', 'needs_evidence', 'exclude', 'merge'];
    case 'insufficient_evidence':
      return ['send_to_relevance', 'exclude', 'merge'];
    case 'excluded':
      return ['send_to_relevance', 'merge'];
    case 'retracted':
      return ['send_to_relevance'];
    default:
      return [];
  }
}
