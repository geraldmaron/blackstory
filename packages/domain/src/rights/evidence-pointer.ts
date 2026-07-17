/**
 * Evidence-pointer doctrine (BB-077): the strongest fair-use posture available for
 * third-party/UGC material. Store an outbound URL, a short judge-relevance snippet, a
 * mandatory Wayback/Internet Archive capture pointer, and retrieval metadata — never a
 * self-hosted full-page copy.
 *
 * Research basis: search-caching (Field v. Google) and Google Books precedents protect
 * indexing plus minimal excerpts that do not substitute for the original work; archive
 * posture is strongest when the viewable portion is minimized and full-page preservation is
 * delegated to the Internet Archive / Wayback Machine rather than self-hosted. This module
 * encodes that as a type/schema constraint, not just a comment: the `EvidencePointer` type
 * has no field capable of holding a full page body, and `assertEvidencePointerValid` /
 * `assertNoFullPageFields` fail closed at construction time.
 */

/**
 * Concrete cap for "1-2 sentences, the minimum needed to judge relevance": the tighter of a
 * character bound (roughly two 160-character sentences) and a word bound. Both are enforced.
 */
export const MAX_EVIDENCE_SNIPPET_CHARACTERS = 320;
export const MAX_EVIDENCE_SNIPPET_WORDS = 60;

const WAYBACK_HOST_PATTERN = /(^|\.)web\.archive\.org$|(^|\.)archive\.org$/i;

/**
 * Keys that would indicate a full page body is being smuggled into an otherwise-valid
 * pointer payload (e.g. from an adapter that hasn't been updated to the doctrine yet).
 * Checked defensively at the boundary where untyped/adapter-sourced data is normalized.
 */
const PROHIBITED_FULL_PAGE_KEYS = new Set([
  'body',
  'bodyhtml',
  'bodytext',
  'fulltext',
  'fullpage',
  'fullpagetext',
  'html',
  'rawhtml',
  'pagecontent',
  'pagetext',
  'markup',
  'domsnapshot',
  'renderedhtml',
]);

export type EvidencePointerRetrievalMetadata = {
  readonly retrievedAt: string;
  readonly adapterId: string;
  readonly parserVersion?: string;
  readonly httpStatus?: number;
};

/**
 * The evidence-pointer doctrine's storage shape. There is deliberately no field here that
 * can hold page bytes/markup — full-page preservation is Wayback's job, not ours.
 */
export type EvidencePointer = {
  readonly id: string;
  /** Mandatory outbound link — the doctrine always links out rather than republishing. */
  readonly sourceUrl: string;
  /** Short excerpt only: the minimum needed to judge relevance. */
  readonly snippet: string;
  /** Mandatory Wayback/Internet Archive capture pointer. */
  readonly waybackCaptureUrl: string;
  readonly waybackCapturedAt?: string;
  readonly retrieval: EvidencePointerRetrievalMetadata;
  readonly createdAt: string;
};

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

/**
 * Defensive check against full-page fields arriving on a payload bound for an evidence
 * pointer (e.g. from a not-yet-conformant adapter). Throws rather than silently dropping
 * the field, so the caller fixes the adapter instead of quietly losing data provenance.
 */
export function assertNoFullPageFields(value: Readonly<Record<string, unknown>>): void {
  for (const key of Object.keys(value)) {
    if (PROHIBITED_FULL_PAGE_KEYS.has(key.toLowerCase())) {
      throw new Error(
        `Evidence pointer cannot include a full-page field "${key}"; the evidence-pointer ` +
          'doctrine never self-hosts full page copies (BB-077)',
      );
    }
  }
}

/**
 * Fail-closed validation of the evidence-pointer doctrine's core constraints: a valid
 * outbound https link, a snippet capped to ~1-2 sentences, and a mandatory Wayback capture
 * pointer.
 */
export function assertEvidencePointerValid(
  pointer: Pick<EvidencePointer, 'sourceUrl' | 'snippet' | 'waybackCaptureUrl'>,
): void {
  if (!pointer.sourceUrl?.trim() || !isHttpsUrl(pointer.sourceUrl)) {
    throw new Error('Evidence pointer requires a valid https sourceUrl (mandatory outbound link)');
  }

  const snippet = pointer.snippet?.trim() ?? '';
  if (!snippet) {
    throw new Error('Evidence pointer requires a non-empty snippet');
  }
  if (snippet.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    throw new Error(
      `Evidence pointer snippet exceeds ${MAX_EVIDENCE_SNIPPET_CHARACTERS} characters ` +
        `(~1-2 sentences); got ${snippet.length}. Full-page copies must never be self-hosted — ` +
        'link out and rely on the Wayback capture pointer instead.',
    );
  }
  const wordCount = snippet.split(/\s+/u).filter(Boolean).length;
  if (wordCount > MAX_EVIDENCE_SNIPPET_WORDS) {
    throw new Error(
      `Evidence pointer snippet exceeds ${MAX_EVIDENCE_SNIPPET_WORDS} words (~1-2 sentences); ` +
        `got ${wordCount}`,
    );
  }

  if (!pointer.waybackCaptureUrl?.trim() || !isWaybackCaptureUrl(pointer.waybackCaptureUrl)) {
    throw new Error(
      'Evidence pointer requires a mandatory Wayback/Internet Archive capture pointer ' +
        '(https URL on an archive.org host)',
    );
  }
}

/**
 * Build a validated evidence pointer. Fails closed on any doctrine violation, including
 * full-page fields smuggled in via a loosely-typed input object.
 */
export function buildEvidencePointer(input: {
  readonly id: string;
  readonly sourceUrl: string;
  readonly snippet: string;
  readonly waybackCaptureUrl: string;
  readonly waybackCapturedAt?: string;
  readonly retrieval: EvidencePointerRetrievalMetadata;
  readonly createdAt: string;
}): EvidencePointer {
  assertNoFullPageFields(input as unknown as Record<string, unknown>);
  assertEvidencePointerValid(input);
  const pointer: EvidencePointer = {
    id: input.id,
    sourceUrl: input.sourceUrl,
    snippet: input.snippet.trim(),
    waybackCaptureUrl: input.waybackCaptureUrl,
    ...(input.waybackCapturedAt ? { waybackCapturedAt: input.waybackCapturedAt } : {}),
    retrieval: input.retrieval,
    createdAt: input.createdAt,
  };
  return pointer;
}
