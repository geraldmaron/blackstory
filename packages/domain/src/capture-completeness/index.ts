/**
 * Capture-completeness ops bar — corpus-level measurement for archived web citations.
 */
export {
  CAPTURE_COMPLETENESS_BAR_RATIO,
  CAPTURE_COMPLETENESS_OPS_BAR_VERSION,
  CAPTURE_COMPLETENESS_SOURCE_FETCH_DAILY_CAP,
} from './constants.js';

export {
  captureCompletenessOpsBarVersion,
  evaluateCaptureCompleteness,
  isWebCitationForCaptureCompleteness,
  webCitationHasArchivedCapture,
} from './evaluator.js';
export type {
  CaptureCompletenessResult,
  CitationForCaptureCompleteness,
  EvaluateCaptureCompletenessOptions,
} from './evaluator.js';
