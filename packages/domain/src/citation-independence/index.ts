/**
 * Citation independence review signals — semantic flags for human triage only.
 */
export {
  CITATION_INDEPENDENCE_REVIEW_SIGNAL_VERSION,
  DEFAULT_CITATION_INDEPENDENCE_SIMILARITY_THRESHOLD,
  findCitationIndependenceReviewFlags,
  independenceKeyForCitation,
} from './review-signal.js';
export type {
  CitationForIndependenceReview,
  FindCitationIndependenceReviewFlagsOptions,
  ReviewFlag,
  ReviewFlagKind,
} from './review-signal.js';

// Cross-reference entity resolution (multi-source stitcher): finds persons in ≥2 sources but not
// in catalog; aggregation of independent source references clears the confidence-floor bottleneck.
export * from './cross-reference-stitcher.js';
