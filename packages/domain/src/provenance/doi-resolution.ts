/**
 * DOI resolution check (repo-k2q3 criterion 2): verifies a scholarly citation actually
 * matches what its DOI resolves to, so a citation can't silently drift or be fabricated
 * with a plausible-looking DOI attached. Tries Crossref first (api.crossref.org/works/{doi}),
 * falling back to OpenAlex (api.openalex.org/works/doi:{doi}) when Crossref has no record —
 * both are free, keyless, public metadata APIs.
 *
 * Fetches through the shared safe HTTP port (../adapters/internet-archive/shared/http-port.js),
 * same as the Wayback/DPLA/RSS adapters — this module never calls `fetch` directly, so
 * production wiring is responsible for SSRF-safe transport (see http-port.ts's doc comment).
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
} from '../adapters/internet-archive/shared/http-port.js';

const JSON_CONTENT_TYPES = ['application/json'];

export type StoredCitation = {
  readonly title: string;
  /** Surname only; comparison is surname-based since given-name formatting varies by source. */
  readonly firstAuthorSurname: string;
  readonly venue: string;
};

export type ResolvedCitation = {
  readonly title: string;
  readonly firstAuthorSurname: string | null;
  readonly venue: string | null;
  readonly resolvedVia: 'crossref' | 'openalex';
};

export type DoiFieldMismatch = {
  readonly field: 'title' | 'firstAuthorSurname' | 'venue';
  readonly stored: string;
  readonly resolved: string | null;
};

export type DoiResolutionResult =
  | { readonly outcome: 'match'; readonly resolved: ResolvedCitation }
  | {
      readonly outcome: 'mismatch';
      readonly resolved: ResolvedCitation;
      readonly mismatches: readonly DoiFieldMismatch[];
    }
  | { readonly outcome: 'unresolved'; readonly doi: string; readonly reason: string };

/** Case/punctuation-insensitive comparison: strips everything but letters/digits, lowercases. */
function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fieldsMatch(stored: string, resolved: string | null): boolean {
  if (resolved === null) return false;
  return normalizeForCompare(stored) === normalizeForCompare(resolved);
}

/** Strips a leading `https://doi.org/` / `doi:` prefix and trims whitespace. */
export function normalizeDoi(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim();
}

function parseJsonBody(bodyText: string, context: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`${context}: response body was not valid JSON`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${context}: response body must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Crossref work JSON shape (narrow: only the fields this check reads). */
function parseCrossrefWork(body: Record<string, unknown>): ResolvedCitation | null {
  const message = body.message;
  if (!message || typeof message !== 'object') return null;
  const work = message as Record<string, unknown>;
  const titleArray = Array.isArray(work.title) ? work.title : [];
  const title = firstString(titleArray[0]);
  if (!title) return null;

  const authors = Array.isArray(work.author) ? work.author : [];
  const firstAuthor = authors[0];
  const firstAuthorSurname =
    firstAuthor && typeof firstAuthor === 'object'
      ? firstString((firstAuthor as Record<string, unknown>).family)
      : null;

  const containerTitleArray = Array.isArray(work['container-title']) ? work['container-title'] : [];
  const venue = firstString(containerTitleArray[0]);

  return { title, firstAuthorSurname, venue, resolvedVia: 'crossref' };
}

/** OpenAlex work JSON shape (narrow: only the fields this check reads). */
function parseOpenAlexWork(body: Record<string, unknown>): ResolvedCitation | null {
  const title = firstString(body.title ?? body.display_name);
  if (!title) return null;

  const authorships = Array.isArray(body.authorships) ? body.authorships : [];
  const firstAuthorship = authorships[0];
  let firstAuthorSurname: string | null = null;
  if (firstAuthorship && typeof firstAuthorship === 'object') {
    const author = (firstAuthorship as Record<string, unknown>).author;
    const displayName =
      author && typeof author === 'object'
        ? firstString((author as Record<string, unknown>).display_name)
        : null;
    // OpenAlex gives a full display name, not a structured surname; take the last token.
    firstAuthorSurname = displayName ? (displayName.trim().split(/\s+/).pop() ?? null) : null;
  }

  const primaryLocation = body.primary_location;
  const venue =
    primaryLocation && typeof primaryLocation === 'object'
      ? firstString(
          (
            (primaryLocation as Record<string, unknown>).source as
              Record<string, unknown> | undefined
          )?.display_name,
        )
      : null;

  return { title, firstAuthorSurname, venue, resolvedVia: 'openalex' };
}

async function fetchCrossrefWork(
  client: SafeHttpClient,
  doi: string,
): Promise<ResolvedCitation | null> {
  const response = await withRetry(
    () =>
      client({
        url: `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        method: 'GET',
        allowedContentTypes: JSON_CONTENT_TYPES,
      }),
    { retries: 2, baseDelayMs: 300, isRetryable: defaultIsRetryable },
  );
  if (response.status === 404) return null;
  if (response.status >= 400) {
    throw new Error(`Crossref lookup failed with status ${response.status} for DOI ${doi}`);
  }
  assertAllowedContentType(response, JSON_CONTENT_TYPES);
  return parseCrossrefWork(parseJsonBody(response.bodyText, 'Crossref works lookup'));
}

async function fetchOpenAlexWork(
  client: SafeHttpClient,
  doi: string,
): Promise<ResolvedCitation | null> {
  const response = await withRetry(
    () =>
      client({
        url: `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`,
        method: 'GET',
        allowedContentTypes: JSON_CONTENT_TYPES,
      }),
    { retries: 2, baseDelayMs: 300, isRetryable: defaultIsRetryable },
  );
  if (response.status === 404) return null;
  if (response.status >= 400) {
    throw new Error(`OpenAlex lookup failed with status ${response.status} for DOI ${doi}`);
  }
  assertAllowedContentType(response, JSON_CONTENT_TYPES);
  return parseOpenAlexWork(parseJsonBody(response.bodyText, 'OpenAlex works lookup'));
}

/**
 * Resolves `doi` (Crossref, falling back to OpenAlex on a 404/no-record) and compares the
 * result against `stored`. Title and venue compare case/punctuation-insensitively; the
 * author field compares only the first author's surname, since given-name formatting
 * (initials vs full name) differs by source and isn't a reliable signal either way.
 *
 * A resolved venue of `null` (e.g. OpenAlex primary_location missing) is not itself a
 * mismatch — an absent field can't be compared, so it's excluded from the mismatch list.
 */
export async function checkDoiCitation(
  client: SafeHttpClient,
  doi: string,
  stored: StoredCitation,
): Promise<DoiResolutionResult> {
  const normalizedDoi = normalizeDoi(doi);
  if (!normalizedDoi) {
    return { outcome: 'unresolved', doi, reason: 'empty_doi' };
  }

  let resolved: ResolvedCitation | null;
  try {
    resolved = await fetchCrossrefWork(client, normalizedDoi);
    if (resolved === null) {
      resolved = await fetchOpenAlexWork(client, normalizedDoi);
    }
  } catch (error) {
    return {
      outcome: 'unresolved',
      doi: normalizedDoi,
      reason: error instanceof Error ? error.message : 'lookup_failed',
    };
  }

  if (resolved === null) {
    return { outcome: 'unresolved', doi: normalizedDoi, reason: 'not_found' };
  }

  const mismatches: DoiFieldMismatch[] = [];
  if (!fieldsMatch(stored.title, resolved.title)) {
    mismatches.push({ field: 'title', stored: stored.title, resolved: resolved.title });
  }
  if (!fieldsMatch(stored.firstAuthorSurname, resolved.firstAuthorSurname)) {
    mismatches.push({
      field: 'firstAuthorSurname',
      stored: stored.firstAuthorSurname,
      resolved: resolved.firstAuthorSurname,
    });
  }
  // Venue is the softest signal (abbreviations, subtitle variance) — only flag a mismatch
  // when the resolver actually returned one to compare against.
  if (resolved.venue !== null && !fieldsMatch(stored.venue, resolved.venue)) {
    mismatches.push({ field: 'venue', stored: stored.venue, resolved: resolved.venue });
  }

  if (mismatches.length > 0) {
    return { outcome: 'mismatch', resolved, mismatches };
  }
  return { outcome: 'match', resolved };
}
