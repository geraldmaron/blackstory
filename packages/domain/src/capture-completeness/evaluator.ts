/**
 * Capture-completeness evaluator for published web citations.
 *
 * Measures what share of URL-backed citations carry an archived capture pointer — the ops bar
 * counterpart to fail-closed publish gates in `../citations/completeness-gate.ts` and
 * `../facts/publish-gate.ts`. Those gates enforce per-record discipline at release time; this
 * module aggregates corpus-level readiness so operators know when marketing a queryable surface
 * would outrun evidence posture (production snapshot: four `source_captures` vs 1,103 release
 * entities — see `docs/research/capture-completeness-ops-bar.md`).
 *
 * Offline citations (structured archive designations) are excluded from the denominator.
 * Pure measurement — never auto-captures, never mutates citations.
 */
import type { CitationCapturePointer, CitationLocation } from '../citations/citation.js';
import type { ContentHash } from '../provenance/hashes.js';
import {
  CAPTURE_COMPLETENESS_BAR_RATIO,
  CAPTURE_COMPLETENESS_OPS_BAR_VERSION,
} from './constants.js';

const WAYBACK_HOST_PATTERN = /(^|\.)web\.archive\.org$|(^|\.)archive\.org$/i;

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

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isWaybackCaptureUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && WAYBACK_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

function isContentHashPresent(contentHash: ContentHash | undefined): boolean {
  return (
    contentHash !== undefined &&
    isNonEmpty(contentHash.algorithm) &&
    isNonEmpty(contentHash.digest)
  );
}

/** URL-backed citations count toward the ops bar; offline designations do not. */
export function isWebCitationForCaptureCompleteness(
  citation: Pick<CitationForCaptureCompleteness, 'location'>,
): boolean {
  return citation.location.kind === 'url';
}

/**
 * A web citation satisfies capture completeness when it anchors to archived evidence:
 * a valid Wayback/Internet Archive capture URL or a content-addressed stored capture row.
 */
export function webCitationHasArchivedCapture(
  citation: Pick<CitationForCaptureCompleteness, 'capture'>,
): boolean {
  if (!isNonEmpty(citation.capture.captureId)) {
    return false;
  }
  if (
    isNonEmpty(citation.capture.waybackCaptureUrl) &&
    isHttpsUrl(citation.capture.waybackCaptureUrl) &&
    isWaybackCaptureUrl(citation.capture.waybackCaptureUrl)
  ) {
    return true;
  }
  return isContentHashPresent(citation.capture.contentHash);
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
