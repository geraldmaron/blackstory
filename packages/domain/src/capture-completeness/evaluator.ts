/**
 * Capture-completeness evaluator for published web citations.
 *
 * Measures what share of URL-backed citations carry a completed archive pointer — the ops bar
 * counterpart to fail-closed publish gates in `../citations/completeness-gate.ts` and
 * `../facts/publish-gate.ts`. Those gates enforce per-record discipline at release time; this
 * module aggregates corpus-level readiness so operators know when marketing a queryable surface
 * would outrun evidence posture. A capture row or content hash alone is identity metadata, not
 * evidence that source content can be recovered; see `docs/research/capture-completeness-ops-bar.md`.
 *
 * Offline citations (structured archive designations) are excluded from the denominator.
 * Pure measurement — never auto-captures, never mutates citations.
 */
import type { CitationCapturePointer, CitationLocation } from '../citations/citation.js';
import { parseWaybackCaptureUrl } from '../adapters/internet-archive/wayback/types.js';
import {
  CAPTURE_COMPLETENESS_BAR_RATIO,
  CAPTURE_COMPLETENESS_OPS_BAR_VERSION,
} from './constants.js';

export type CitationForCaptureCompleteness = {
  readonly citationId: string;
  readonly location: CitationLocation;
  readonly capture: Pick<
    CitationCapturePointer,
    'captureId' | 'contentHash' | 'waybackCaptureUrl' | 'waybackCapturedAt'
  >;
};

export type CaptureCompletenessResult = {
  readonly ratio: number;
  readonly meetsBar: boolean;
  readonly missing: readonly string[];
};

export type EvaluateCaptureCompletenessOptions = {
  readonly barRatio?: number;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** URL-backed citations count toward the ops bar; offline designations do not. */
export function isWebCitationForCaptureCompleteness(
  citation: Pick<CitationForCaptureCompleteness, 'location'>,
): boolean {
  return citation.location.kind === 'url';
}

/**
 * A web citation satisfies archive completeness only when it has a completed Internet Archive
 * pointer and timestamp. A content hash proves identity, not that recoverable bytes or text exist.
 */
export function webCitationHasArchivedCapture(
  citation: Pick<CitationForCaptureCompleteness, 'capture' | 'location'>,
): boolean {
  if (!isNonEmpty(citation.capture.captureId)) {
    return false;
  }
  if (
    isNonEmpty(citation.capture.waybackCaptureUrl) &&
    citation.location.kind === 'url' &&
    isNonEmpty(citation.capture.waybackCapturedAt)
  ) {
    const parsed = parseWaybackCaptureUrl(
      citation.capture.waybackCaptureUrl,
      citation.location.url,
    );
    if (!parsed || !Number.isFinite(Date.parse(citation.capture.waybackCapturedAt))) return false;
    return Date.parse(parsed.capturedAt) === Date.parse(citation.capture.waybackCapturedAt);
  }
  return false;
}

/**
 * Returns the share of web citations with archived captures, whether that share meets the ops
 * bar, and citation ids still missing capture pointers. When no web citations exist, ratio is
 * `1` and `meetsBar` is true (nothing to backfill).
 */
export function evaluateCaptureCompleteness(
  citations: readonly CitationForCaptureCompleteness[],
  options: EvaluateCaptureCompletenessOptions = {},
): CaptureCompletenessResult {
  const barRatio = options.barRatio ?? CAPTURE_COMPLETENESS_BAR_RATIO;
  if (!Number.isFinite(barRatio) || barRatio < 0 || barRatio > 1) {
    throw new Error(`barRatio must be a finite number between 0 and 1, got ${barRatio}`);
  }

  const webCitations = citations.filter(isWebCitationForCaptureCompleteness);
  if (webCitations.length === 0) {
    return { ratio: 1, meetsBar: true, missing: [] };
  }

  const missing: string[] = [];
  let captured = 0;
  for (const citation of webCitations) {
    if (webCitationHasArchivedCapture(citation)) {
      captured += 1;
    } else {
      missing.push(citation.citationId);
    }
  }

  missing.sort((a, b) => a.localeCompare(b));
  const ratio = captured / webCitations.length;
  return {
    ratio,
    meetsBar: ratio >= barRatio,
    missing,
  };
}

/** Exposed for operator dashboards tying preflight results to policy version. */
export function captureCompletenessOpsBarVersion(): typeof CAPTURE_COMPLETENESS_OPS_BAR_VERSION {
  return CAPTURE_COMPLETENESS_OPS_BAR_VERSION;
}
