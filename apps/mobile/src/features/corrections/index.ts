/**
 * Corrections feature barrel (MOB-016). Quarantine-only correction submission
 * and opaque receipt-status lookup for the native reader.
 *
 * Boundary: the client reaches the server over HTTP only (ADR-021 §4) and the
 * only client write is this quarantine intake — no canonical write path exists.
 * Correction content, contact details, and the receipt code never reach logs,
 * the general SQLite cache, crash breadcrumbs, or a URL/route param
 * (invariant 7).
 */
export {
  CorrectionForm,
  type CorrectionFormProps,
} from './CorrectionForm';
export {
  CorrectionReceipt,
  type CorrectionReceiptProps,
} from './CorrectionReceipt';
export {
  CorrectionStatusView,
  type CorrectionStatusViewProps,
} from './CorrectionStatusView';
export {
  submitCorrection,
  lookupCorrectionStatus,
  type CorrectionClientDeps,
  type SubmitResult,
  type StatusResult,
  type TokenProvider,
} from './client';
export { createCorrectionClientDeps } from './runtime';
export {
  validateCorrectionForm,
  safeEvidenceUrl,
  EMPTY_CORRECTION_FORM,
  type CorrectionFormState,
  type CorrectionFieldIssue,
  type CorrectionValidation,
} from './validation';
export { deriveIdempotencyKey } from './idempotency';
export {
  isReceiptCodeShape,
  persistReceiptCode,
  readStoredReceiptCode,
  clearStoredReceiptCode,
  RECEIPT_CODE_PATTERN,
} from './receipt';
export {
  CORRECTION_SUBMIT_PATH,
  CORRECTION_STATUS_PATH,
  IDEMPOTENCY_KEY_HEADER,
  CORRECTIONS_API_MAJOR,
  type CorrectionSubmissionRequest,
  type CorrectionAcceptedResponse,
  type PublicCorrectionStatus,
  type PublicCorrectionPhase,
} from './contract';
export {
  CORRECTION_CATEGORIES,
  CORRECTION_TARGET_TYPES,
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_TARGET_LABELS,
  type CorrectionCategory,
  type CorrectionTargetType,
} from './categories';
