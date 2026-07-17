/**
 * Defensive parsing for Internet Archive Advanced Search, Scrape (cursor-based), and Metadata
 * API responses (BB-073). Malformed individual docs are rejected (recorded, not thrown) so one
 * bad record never poisons an entire batch — the same posture the DPLA adapter uses, since IA
 * aggregates uploads from thousands of independent contributors with inconsistent metadata
 * hygiene.
 */
import type {
  InternetArchiveAdvancedSearchResponse,
  InternetArchiveMetadataResponse,
  InternetArchiveParsedBatch,
  InternetArchiveRejectedDoc,
  InternetArchiveScrapeResponse,
  InternetArchiveSearchDoc,
} from './types.js';

function asStringArray(value: unknown): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as readonly string[];
  }
  return undefined;
}

function parseDoc(raw: unknown, index: number): { doc: InternetArchiveSearchDoc } | { rejected: InternetArchiveRejectedDoc } {
  if (!raw || typeof raw !== 'object') {
    return { rejected: { index, reason: 'not_an_object' } };
  }
  const record = raw as Record<string, unknown>;
  const identifier = record.identifier;
  if (typeof identifier !== 'string' || !identifier.trim()) {
    return { rejected: { index, reason: 'missing_identifier' } };
  }

  const subject = asStringArray(record.subject);
  const collection = asStringArray(record.collection);

  const doc: InternetArchiveSearchDoc = {
    identifier: identifier.trim(),
    ...(typeof record.title === 'string' ? { title: record.title } : {}),
    ...(typeof record.description === 'string' ? { description: record.description } : {}),
    ...(typeof record.date === 'string' ? { date: record.date } : {}),
    ...(typeof record.mediatype === 'string' ? { mediatype: record.mediatype } : {}),
    ...(subject !== undefined ? { subject } : {}),
    ...(collection !== undefined ? { collection } : {}),
  };
  return { doc };
}

function parseDocBatch(raw: readonly unknown[] | undefined): InternetArchiveParsedBatch {
  const docs: InternetArchiveSearchDoc[] = [];
  const rejected: InternetArchiveRejectedDoc[] = [];
  for (const [index, item] of (raw ?? []).entries()) {
    const result = parseDoc(item, index);
    if ('doc' in result) {
      docs.push(result.doc);
    } else {
      rejected.push(result.rejected);
    }
  }
  return { docs, rejected };
}

/** Parses `https://archive.org/advancedsearch.php` JSON output. */
export function parseAdvancedSearchResponse(raw: unknown): InternetArchiveParsedBatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Internet Archive advanced search response must be an object');
  }
  const response = raw as InternetArchiveAdvancedSearchResponse;
  return parseDocBatch(response.response?.docs);
}

export type InternetArchiveScrapePage = InternetArchiveParsedBatch & {
  readonly cursor?: string;
};

/** Parses `https://archive.org/services/search/v1/scrape` cursor-paginated output. */
export function parseScrapeResponse(raw: unknown): InternetArchiveScrapePage {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Internet Archive scrape response must be an object');
  }
  const response = raw as InternetArchiveScrapeResponse;
  const batch = parseDocBatch(response.items);
  return {
    ...batch,
    ...(typeof response.cursor === 'string' && response.cursor ? { cursor: response.cursor } : {}),
  };
}

/** True while a scrape page carries a cursor for the next page. */
export function hasNextScrapePage(page: InternetArchiveScrapePage): boolean {
  return page.cursor !== undefined;
}

/** Parses `https://archive.org/metadata/<identifier>` output defensively. */
export function parseMetadataResponse(raw: unknown): InternetArchiveSearchDoc | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const response = raw as InternetArchiveMetadataResponse;
  if (!response.metadata) return undefined;
  const result = parseDoc(response.metadata, 0);
  return 'doc' in result ? result.doc : undefined;
}

export function buildAdvancedSearchUrl(query: string, rows: number, page: number): string {
  const params = new URLSearchParams({
    q: query,
    output: 'json',
    rows: String(rows),
    page: String(page),
  });
  for (const field of ['identifier', 'title', 'description', 'date', 'mediatype', 'subject', 'collection']) {
    params.append('fl[]', field);
  }
  return `https://archive.org/advancedsearch.php?${params.toString()}`;
}

export function buildScrapeUrl(query: string, count: number, cursor?: string): string {
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    fields: 'identifier,title,description,date,mediatype,subject,collection',
  });
  if (cursor) {
    params.set('cursor', cursor);
  }
  return `https://archive.org/services/search/v1/scrape?${params.toString()}`;
}

export function buildMetadataUrl(identifier: string): string {
  return `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
}
