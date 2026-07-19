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
  'send_to_relevance' | 'confirm_relevance' | 'needs_evidence' | 'exclude' | 'merge';

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

/** Filter chip labels — same operator language as {@link stateLabel} badges. */
export function filterChipLabel(filter: ResearchCaseState | 'all' | 'inbox'): string {
  switch (filter) {
    case 'inbox':
      return 'Inbox';
    case 'all':
      return 'All';
    default:
      return stateLabel(filter);
  }
}

export const CASE_QUEUE_INTENT_COPY = {
  inbox:
    'Work the pending queue — decide relevance, confirm, exclude, or mark needs evidence. These do not publish.',
  cases:
    'Browse every research case by state. Open a row for full context. Publishing happens only via Releases after story review.',
} as const;

/** Numbered operator steps shared by Inbox, Cases queue, and case detail. */
export const CASE_TRIAGE_STEPS = [
  'Open a case (or select rows for bulk).',
  'Write a short decision reason — every move is audited.',
  'Choose an action. Nothing here publishes to the public site; Releases does that later.',
] as const;

/** Plain-language explanation of what each transition does. */
export function actionHelp(action: AdminCaseTransitionAction): string {
  switch (action) {
    case 'send_to_relevance':
      return 'Move this case into relevance review. Use when the lead looks on-topic and worth a closer look.';
    case 'confirm_relevance':
      return 'Mark the case in-scope. Ready for enrichment — still not public.';
    case 'needs_evidence':
      return 'Park the case until stronger sources land. It stays in the inbox under Needs evidence.';
    case 'exclude':
      return 'Close the case as out of scope or otherwise not advancing. Pick an exclude reason code.';
    case 'merge':
      return 'Fold this case into another research case id (duplicate).';
  }
}

export function missingDecisionReasonMessage(action: AdminCaseTransitionAction): string {
  return `Add a decision reason before “${actionLabelSafe(action)}”. Every move is audited and does not publish by itself.`;
}

function actionLabelSafe(action: AdminCaseTransitionAction): string {
  switch (action) {
    case 'send_to_relevance':
      return 'Send to relevance';
    case 'confirm_relevance':
      return 'Confirm relevance';
    case 'needs_evidence':
      return 'Needs evidence';
    case 'exclude':
      return 'Exclude';
    case 'merge':
      return 'Merge';
  }
}

export function legalActionsForState(
  state: ResearchCaseState,
): readonly AdminCaseTransitionAction[] {
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
