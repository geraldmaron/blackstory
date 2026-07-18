/**
 * Contracts for deterministic claim extraction, evidence spans, and review outcomes.
 */
import type { ClaimClass } from '@blap/schemas';
import type {
  ClaimEvidenceLink,
  ClaimGeographicContext,
  ClaimWorkflowStatus,
  ContradictionSet,
} from '../claims/index.js';
import type { TemporalContext } from '../relationship.js';

export const EXTRACTION_METHODS = ['deterministic', 'manual'] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

export const EXTRACTION_UNCERTAINTY_CODES = [
  'atomicity',
  'entity',
  'predicate',
  'object',
  'quotation',
  'temporal',
  'geographic',
  'procedural_status',
  'evidence',
] as const;
export type ExtractionUncertaintyCode = (typeof EXTRACTION_UNCERTAINTY_CODES)[number];

export type ExtractionUncertainty = {
  readonly code: ExtractionUncertaintyCode;
  readonly detail: string;
  readonly recordedBy: 'parser' | 'researcher' | 'validator';
};

export type AtomicityAssessment = {
  readonly assertionCount: number;
  readonly independentlySupportable: boolean;
  readonly rationale: string;
};

export type ClaimDraft = {
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly entityId: string;
  readonly predicate: string;
  readonly object: string;
  readonly claimClass: ClaimClass;
  readonly proceduralStatus: string;
  readonly temporal?: TemporalContext;
  readonly geographic?: ClaimGeographicContext;
  readonly atomicity: AtomicityAssessment;
};

export type EvidenceSpan = {
  readonly id: string;
  readonly evidenceId: string;
  readonly sourceItemId: string;
  readonly offsetStart: number;
  readonly offsetEnd: number;
  readonly text: string;
  readonly exactQuotation: boolean;
  readonly locator: {
    readonly page?: string;
    readonly pages?: string;
    readonly paragraph?: string;
    readonly offsetStart?: number;
    readonly offsetEnd?: number;
    readonly label?: string;
    readonly uriFragment?: string;
  };
};

export type ExtractionDecision = 'accepted' | 'rejected';

export type ExtractionRecord = {
  readonly schemaVersion: 'extraction-record.v1';
  readonly id: string;
  readonly method: ExtractionMethod;
  readonly draft: ClaimDraft;
  readonly evidenceSpans: readonly EvidenceSpan[];
  readonly evidenceLinks: readonly ClaimEvidenceLink[];
  readonly contradictions: ContradictionSet;
  readonly uncertainties: readonly ExtractionUncertainty[];
  readonly decision: ExtractionDecision;
  readonly workflowStatus: Extract<ClaimWorkflowStatus, 'accepted' | 'rejected'>;
  readonly rejectionReasons: readonly string[];
  readonly extractedAt: string;
  readonly extractedBy: string;
};

export type ManualClaimEntry = {
  readonly id: string;
  readonly extractedAt: string;
  readonly extractedBy: string;
  readonly draft: ClaimDraft;
  readonly uncertainties: readonly ExtractionUncertainty[];
};

export type ParsedClaimLine = {
  readonly lineNumber: number;
  readonly draft: Pick<ClaimDraft, 'entityId' | 'predicate' | 'object'>;
  readonly uncertainties: readonly ExtractionUncertainty[];
};
