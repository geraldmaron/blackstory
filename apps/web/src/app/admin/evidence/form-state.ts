export type EvidenceAttachState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly error: string }
  | {
      readonly status: 'prepared';
      readonly submissionId: string;
      readonly researchCaseId: string;
    }
  | {
      readonly status: 'committed';
      readonly submissionId: string;
      readonly researchCaseId: string;
      readonly auditEventId: string;
    };

export const EVIDENCE_ATTACH_INITIAL: EvidenceAttachState = { status: 'idle' };
