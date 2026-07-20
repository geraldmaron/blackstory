/**
 * Citation record shape for (citation integrity and link-rot management).
 *
 * Every published claim must carry at least one citation with: a URL or a structured
 * offline-source designation, a source name, a capture pointer, and a retrieval date
 * This module models that record and adapts it from the
 * provenance model (`../provenance/`) `EvidenceRecord`, `SourceItem`,
 * `EvidenceSource`, `SourceCapture` rather than inventing a parallel source-of-truth.
 * "Unsourced" is not a publishable state; see `./completeness-gate.ts` for the fail-closed
 * check this type feeds.
 */
import type { ContentHash } from '../provenance/hashes.js';

export const OFFLINE_SOURCE_KINDS = [
  'book',
  'physical_archive',
  'oral_interview',
  'microfilm_or_photostat',
  'other',
] as const;

export type OfflineSourceKind = (typeof OFFLINE_SOURCE_KINDS)[number];

/** A structured designation for a source with no stable URL. */
export type OfflineSourceDesignation = {
  readonly kind: OfflineSourceKind;
  /** Human-readable locator, e.g. "Florida State Archives, Series 1234, Box 5, Folder 2". */
  readonly description: string;
  readonly repository?: string;
};

export type CitationLocation =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'offline'; readonly designation: OfflineSourceDesignation };

/**
 * Points at the `SourceCapture` (or, for offline sources, an equivalent captured
 * record e.g. a photographed archive page) that evidences this citation's content at
 * retrieval time. Required unconditionally: URL and offline citations alike must anchor to
 * something captured, not just an assertion that a source exists.
 */
export type CitationCapturePointer = {
  readonly captureId: string;
  readonly contentHash?: ContentHash;
  /** Wayback/Internet Archive capture URL, when one exists. */
  readonly waybackCaptureUrl?: string;
  readonly waybackCapturedAt?: string;
};

export const LINK_HEALTH_STATUSES = ['alive', 'redirected', 'drifted', 'dead'] as const;
export type LinkHealthStatus = (typeof LINK_HEALTH_STATUSES)[number];

export type Citation = {
  readonly id: string;
  readonly claimId: string;
  readonly sourceName: string;
  /** Source classification vocabulary token `), used to group
   * rot-rate telemetry by source class. Optional because not
   * every caller resolves the owning `EvidenceSource` before building a citation. */
  readonly sourceClassification?: string;
  readonly title?: string;
  readonly authorName?: string;
  /** Key named entities already present in the citation record (never derived via an LLM at
   * read time) feeds the deterministic "Try searching for" suggestion (./try-searching-for.ts). */
  readonly namedEntities?: readonly string[];
  readonly location: CitationLocation;
  readonly capture: CitationCapturePointer;
  readonly retrievalDate: string;
  /** Set once the repair ladder (./repair-ladder.ts) swaps the primary link away from the
   * original URL the original is preserved as "originally published at", never discarded. */
  readonly originallyPublishedAtUrl?: string;
  readonly linkStatus?: LinkHealthStatus;
  readonly linkStatusAsOf?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function assertOfflineSourceDesignationValid(designation: OfflineSourceDesignation): void {
  if (!(OFFLINE_SOURCE_KINDS as readonly string[]).includes(designation.kind)) {
    throw new Error(`Unknown offline source kind: ${designation.kind}`);
  }
  if (!isNonEmptyString(designation.description)) {
    throw new Error('Offline source designation requires a non-empty description');
  }
}

export function assertCitationLocationValid(location: CitationLocation): void {
  if (location.kind === 'url') {
    if (!isNonEmptyString(location.url) || !isHttpsUrl(location.url)) {
      throw new Error('Citation URL location requires a valid https URL');
    }
    return;
  }
  if (location.kind === 'offline') {
    assertOfflineSourceDesignationValid(location.designation);
    return;
  }
  throw new Error(`Unknown citation location kind: ${(location as { kind: string }).kind}`);
}

export function assertCitationCapturePointerValid(capture: CitationCapturePointer): void {
  if (!isNonEmptyString(capture.captureId)) {
    throw new Error('Citation capture pointer requires a non-empty captureId');
  }
}

/**
 * Fail-closed structural validity for a single citation: source name, a valid location
 * (URL or offline designation), a capture pointer, and a retrieval date. This is necessary
 * but not sufficient for "may publish" see `./completeness-gate.ts` for the claim-level
 * publication gate this feeds.
 */
export function assertCitationStructurallyComplete(
  citation: Pick<Citation, 'sourceName' | 'location' | 'capture' | 'retrievalDate'>,
): void {
  if (!isNonEmptyString(citation.sourceName)) {
    throw new Error('Citation requires a non-empty sourceName');
  }
  assertCitationLocationValid(citation.location);
  assertCitationCapturePointerValid(citation.capture);
  if (!isNonEmptyString(citation.retrievalDate) || !isIsoDate(citation.retrievalDate)) {
    throw new Error('Citation requires a valid ISO retrievalDate');
  }
}

export function isCitationStructurallyComplete(
  citation: Pick<Citation, 'sourceName' | 'location' | 'capture' | 'retrievalDate'>,
): boolean {
  try {
    assertCitationStructurallyComplete(citation);
    return true;
  } catch {
    return false;
  }
}

/**
 * Adapts a evidence chain (evidence record + source item + evidence source + capture)
 * into a `Citation`. This is the intended way to build citations from the existing provenance
 * model rather than duplicating it pass either a `capture` (URL-backed evidence) or an
 * `offlineDesignation` (analog source with no stable URL); exactly one is required.
 */
export function buildCitationFromEvidence(input: {
  readonly id: string;
  readonly claimId: string;
  readonly evidence: { readonly sourceItemId: string; readonly sourceId: string };
  readonly sourceItem: { readonly canonicalUrl?: string; readonly title?: string };
  readonly source: { readonly displayName: string; readonly classification?: string };
  readonly capture?: {
    readonly id: string;
    readonly contentHash?: ContentHash;
    readonly retrievedAt: string;
  };
  readonly offlineDesignation?: OfflineSourceDesignation;
  readonly waybackCaptureUrl?: string;
  readonly waybackCapturedAt?: string;
  readonly authorName?: string;
  readonly namedEntities?: readonly string[];
  readonly createdAt: string;
}): Citation {
  if (!input.capture && !input.offlineDesignation) {
    throw new Error('buildCitationFromEvidence requires either capture or offlineDesignation');
  }
  const location: CitationLocation =
    input.offlineDesignation && !input.sourceItem.canonicalUrl
      ? { kind: 'offline', designation: input.offlineDesignation }
      : { kind: 'url', url: input.sourceItem.canonicalUrl ?? '' };

  if (!input.capture && !input.offlineDesignation) {
    throw new Error('A capture pointer or offline designation is required to anchor a citation');
  }

  const capture: CitationCapturePointer = input.capture
    ? {
        captureId: input.capture.id,
        ...(input.capture.contentHash ? { contentHash: input.capture.contentHash } : {}),
        ...(input.waybackCaptureUrl ? { waybackCaptureUrl: input.waybackCaptureUrl } : {}),
        ...(input.waybackCapturedAt ? { waybackCapturedAt: input.waybackCapturedAt } : {}),
      }
    : {
        // Offline sources still need a captured anchor (e.g. a photographed archive page);
        // the evidence's sourceItemId doubles as that pointer until a dedicated offline
        // capture record exists.
        captureId: input.evidence.sourceItemId,
      };

  const citation: Citation = {
    id: input.id,
    claimId: input.claimId,
    sourceName: input.source.displayName,
    ...(input.source.classification ? { sourceClassification: input.source.classification } : {}),
    ...(input.sourceItem.title ? { title: input.sourceItem.title } : {}),
    ...(input.authorName ? { authorName: input.authorName } : {}),
    ...(input.namedEntities ? { namedEntities: input.namedEntities } : {}),
    location,
    capture,
    retrievalDate: input.capture?.retrievedAt ?? input.createdAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  assertCitationStructurallyComplete(citation);
  return citation;
}
