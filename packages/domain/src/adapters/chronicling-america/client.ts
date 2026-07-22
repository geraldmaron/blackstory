/**
 * Defensive parsing for loc.gov JSON API Chronicling America search and item responses.
 * Fixtures mimic live API shapes; no network calls are made from this module.
 */
import type {
  ChroniclingAmericaNormalizedDoc,
  ChroniclingAmericaParsedBatch,
  ChroniclingAmericaRejectedDoc,
} from './types.js';

function firstNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first.trim() : undefined;
  }
  return undefined;
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : undefined))
    .filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : undefined;
}

/** Extract LCCN from a loc.gov resource or item URL (`sn83045462` pattern). */
export function extractLccnFromLocUrl(url: string): string | undefined {
  const match = /\/(?:item|resource|lccn)\/(sn\d+)/i.exec(url);
  return match?.[1]?.toLowerCase();
}

export function buildChroniclingAmericaCanonicalUrl(input: {
  readonly url?: string;
  readonly id?: string;
  readonly lccn?: string;
}): string | undefined {
  const direct = input.url?.trim() || input.id?.trim();
  if (direct && /^https?:\/\//i.test(direct)) {
    return direct;
  }
  if (input.lccn) {
    return `https://chroniclingamerica.loc.gov/lccn/${encodeURIComponent(input.lccn)}/`;
  }
  return undefined;
}

export function buildChroniclingAmericaStableIdentifier(input: {
  readonly lccn?: string;
  readonly url?: string;
  readonly id?: string;
  readonly index: number;
}): string {
  const lccn = input.lccn ?? extractLccnFromLocUrl(input.url ?? input.id ?? '');
  if (lccn) {
    const resourcePath = (input.url ?? input.id ?? '').replace(/^https?:\/\/[^/]+/i, '');
    const suffix = resourcePath.includes('/resource/')
      ? resourcePath.replace(/^\/resource\//i, '').replace(/\//g, ':')
      : undefined;
    return suffix ? `ca:${lccn}:${suffix}` : `ca:${lccn}`;
  }
  return `ca:unknown:${input.index}`;
}

function parseSearchResult(
  raw: unknown,
  index: number,
): { doc: ChroniclingAmericaNormalizedDoc } | { rejected: ChroniclingAmericaRejectedDoc } {
  if (!raw || typeof raw !== 'object') {
    return { rejected: { index, stableIdentifier: `ca:unknown:${index}`, reason: 'not_an_object' } };
  }

  const record = raw as Record<string, unknown>;
  const url = firstNonEmptyString(record.url) ?? firstNonEmptyString(record.id);
  const lccn =
    firstNonEmptyString(record.lccn) ??
    (url ? extractLccnFromLocUrl(url) : undefined) ??
    firstNonEmptyString(record.shelf_id);

  const title =
    firstNonEmptyString(record.title) ??
    firstNonEmptyString(record.publication_title) ??
    firstNonEmptyString(record.other_title);

  if (!title) {
    const rejectIdInput = {
      ...(lccn !== undefined ? { lccn } : {}),
      ...(url !== undefined ? { url } : {}),
      index,
    };
    return {
      rejected: {
        index,
        stableIdentifier: buildChroniclingAmericaStableIdentifier(rejectIdInput),
        reason: 'missing_title',
      },
    };
  }

  const canonicalUrl = buildChroniclingAmericaCanonicalUrl({
    ...(url !== undefined ? { url } : {}),
    ...(url !== undefined ? { id: url } : {}),
    ...(lccn !== undefined ? { lccn } : {}),
  });
  if (!canonicalUrl) {
    const rejectIdInput = {
      ...(lccn !== undefined ? { lccn } : {}),
      ...(url !== undefined ? { url } : {}),
      index,
    };
    return {
      rejected: {
        index,
        stableIdentifier: buildChroniclingAmericaStableIdentifier(rejectIdInput),
        reason: 'missing_canonical_url',
      },
    };
  }

  const displayDate =
    firstNonEmptyString(record.date) ??
    firstNonEmptyString(record.dates) ??
    firstNonEmptyString(record.start_date);
  const publicationTitle = firstNonEmptyString(record.publication_title);
  const publicationPlace = firstNonEmptyString(record.publication_place);
  const location = readStringArray(record.location);
  const subjects = readStringArray(record.subject);
  const stableIdInput = {
    ...(lccn !== undefined ? { lccn } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(url !== undefined ? { id: url } : {}),
    index,
  };

  return {
    doc: {
      stableIdentifier: buildChroniclingAmericaStableIdentifier(stableIdInput),
      title,
      canonicalUrl,
      ...(displayDate !== undefined ? { displayDate } : {}),
      ...(publicationTitle !== undefined ? { publicationTitle } : {}),
      ...(publicationPlace !== undefined ? { publicationPlace } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(subjects !== undefined ? { subjects } : {}),
      ...(lccn !== undefined ? { lccn } : {}),
    },
  };
}

function parseItemEnvelope(
  raw: unknown,
  index: number,
): { doc: ChroniclingAmericaNormalizedDoc } | { rejected: ChroniclingAmericaRejectedDoc } {
  if (!raw || typeof raw !== 'object') {
    return { rejected: { index, stableIdentifier: `ca:unknown:${index}`, reason: 'not_an_object' } };
  }
  const envelope = raw as Record<string, unknown>;
  const item = envelope.item;
  if (item && typeof item === 'object') {
    return parseSearchResult(item, index);
  }
  return parseSearchResult(raw, index);
}

export function parseChroniclingAmericaSearchResponse(raw: unknown): ChroniclingAmericaParsedBatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Chronicling America search fixture must be an object');
  }

  const envelope = raw as Record<string, unknown>;
  const results = envelope.results;
  const pagination =
    envelope.pagination && typeof envelope.pagination === 'object'
      ? (envelope.pagination as Record<string, unknown>)
      : undefined;
  const paginationTotal =
    typeof pagination?.total === 'number' ? pagination.total : undefined;

  if (!Array.isArray(results)) {
    throw new Error('Chronicling America search fixture must include a results array');
  }

  const docs: ChroniclingAmericaNormalizedDoc[] = [];
  const rejected: ChroniclingAmericaRejectedDoc[] = [];

  results.forEach((result, index) => {
    const parsed = parseSearchResult(result, index);
    if ('doc' in parsed) {
      docs.push(parsed.doc);
    } else {
      rejected.push(parsed.rejected);
    }
  });

  return {
    docs,
    rejected,
    ...(paginationTotal !== undefined ? { paginationTotal } : {}),
  };
}

export function parseChroniclingAmericaItemResponse(raw: unknown): ChroniclingAmericaParsedBatch {
  const parsed = parseItemEnvelope(raw, 0);
  if ('doc' in parsed) {
    return { docs: [parsed.doc], rejected: [] };
  }
  return { docs: [], rejected: [parsed.rejected] };
}

export function buildChroniclingAmericaSearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    fo: 'json',
    dl: 'page',
  });
  return `https://www.loc.gov/collections/chronicling-america/?${params.toString()}`;
}

export function buildChroniclingAmericaItemUrl(lccn: string): string {
  return `https://www.loc.gov/item/${encodeURIComponent(lccn)}/?fo=json`;
}
