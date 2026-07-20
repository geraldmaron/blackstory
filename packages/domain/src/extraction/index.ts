/**
 * Public extraction module surface for atomic claims and evidence registration.
 */
export { assessAtomicity, createManualClaimEntry, parseClaimLines } from './parser.js';
export {
  assertQuotationAccurate,
  evidenceLinkQualifies,
  registerEvidenceSpan,
} from './evidence.js';
export {
  assertAtomicDraftValid,
  assertExtractionRecordValid,
  assertGeographicContextValid,
  assertProceduralLanguageValid,
  assertTemporalContextValid,
} from './validation.js';
export { evaluateClaimExtraction } from './pipeline.js';
export { EXTRACTION_METHODS, EXTRACTION_UNCERTAINTY_CODES } from './types.js';
export type {
  AtomicityAssessment,
  ClaimDraft,
  EvidenceSpan,
  ExtractionDecision,
  ExtractionMethod,
  ExtractionRecord,
  ExtractionUncertainty,
  ExtractionUncertaintyCode,
  ManualClaimEntry,
  ParsedClaimLine,
} from './types.js';
