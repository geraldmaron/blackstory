/**
 * Defensive DPLA v2 response parsing. See types.ts's module header for why this is
 * deliberately tolerant of field renames/relocations rather than assuming a rigid shape 
 * DPLA's aggregation program transitions to Cleveland Public Library starting July 2026.
 */
import type { DplaNormalizedDoc, DplaParsedBatch, DplaRejectedDoc } from './types.js';

/** `sourceResource.title`/`description` may be a string, an array of strings, or absent. */
function firstNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first.trim() : undefined;
  }
  return undefined;
}

/** `sourceResource.date` may be `{ displayDate }`, a plain string, or absent. */
function extractDisplayDate(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'displayDate' in value) {
    const displayDate = (value as { displayDate?: unknown }).displayDate;
    if (typeof displayDate === 'string' && displayDate.trim()) return displayDate.trim();
  }
  return undefined;
}

/** `isShownAt` may be a plain URL string or `{ "@id": url }` in some DPLA provider records. */
function extractIsShownAt(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const atId = (value as Record<string, unknown>)['@id'];
    if (typeof atId === 'string' && atId.trim()) return atId.trim();
  }
  return undefined;
}

/** `subject` is typically `[{ name }]`, but tolerate bare strings too. */
function extractSubjects(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names = value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === 'string' ? name : undefined;
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item && item.trim()));
  return names.length > 0 ? names : undefined;
}

/** Provider name may live at `provider.name`, a bare `provider` string, or `dataProvider`. */
function extractProviderName(record: Record<string, unknown>): string | undefined {
  const provider = record.provider;
  if (typeof provider === 'string' && provider.trim()) return provider.trim();
  if (provider && typeof provider === 'object' && 'name' in provider) {
    const name = (provider as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  const dataProvider = record.dataProvider;
  if (typeof dataProvider === 'string' && dataProvider.trim()) return dataProvider.trim();
  return undefined;
}

/** Item id may be `id` or a legacy/alternate `_id`; either is accepted. */
function extractId(record: Record<string, unknown>): string | undefined {
  const id = record.id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  const legacyId = record._id;
  if (typeof legacyId === 'string' && legacyId.trim()) return legacyId.trim();
  return undefined;
}

function parseDoc(raw: unknown, index: number): { doc: DplaNormalizedDoc } | { rejected: DplaRejectedDoc } {
  if (!raw || typeof raw !== 'object') {
    return { rejected: { index, reason: 'not_an_object' } };
  }
  const record = raw as Record<string, unknown>;
  const id = extractId(record);
  if (!id) {
    return { rejected: { index, reason: 'missing_id' } };
  }

  // sourceResource is the conventional container; tolerate it being absent (fields at top level)
  // or a wholly different shape post-transition every extractor below is independently defensive.
  const sourceResource =
    record.sourceResource && typeof record.sourceResource === 'object'
      ? (record.sourceResource as Record<string, unknown>)
      : record;

  const title = firstNonEmptyString(sourceResource.title) ?? firstNonEmptyString(record.title);
  if (!title) {
    return { rejected: { index, reason: 'missing_title' } };
  }

  const description = firstNonEmptyString(sourceResource.description);
  const isShownAt = extractIsShownAt(record.isShownAt);
  const displayDate = extractDisplayDate(sourceResource.date);
  const providerName = extractProviderName(record);
  const subjects = extractSubjects(sourceResource.subject);

  const doc: DplaNormalizedDoc = {
    id,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(isShownAt !== undefined ? { isShownAt } : {}),
    ...(displayDate !== undefined ? { displayDate } : {}),
    ...(providerName !== undefined ? { providerName } : {}),
    ...(subjects !== undefined ? { subjects } : {}),
  };
  return { doc };
}

/**
 * Parses a DPLA v2 `/v2/items` search response. Accepts `docs` (current DPLA v2 shape) and
 * falls back to `items` (a plausible post-transition rename) so a shape change does not
 * immediately break discovery see types.ts's module header.
 */
export function parseDplaSearchResponse(raw: unknown): DplaParsedBatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('DPLA search response must be an object');
  }
  const record = raw as Record<string, unknown>;
  const rawDocs = Array.isArray(record.docs) ? record.docs : Array.isArray(record.items) ? record.items : [];

  const docs: DplaNormalizedDoc[] = [];
  const rejected: DplaRejectedDoc[] = [];
  for (const [index, item] of rawDocs.entries()) {
    const result = parseDoc(item, index);
    if ('doc' in result) {
      docs.push(result.doc);
    } else {
      rejected.push(result.rejected);
    }
  }

  return {
    docs,
    rejected,
    ...(typeof record.count === 'number' ? { count: record.count } : {}),
  };
}

export function buildDplaSearchUrl(input: { readonly query: string; readonly apiKey: string; readonly page?: number; readonly pageSize?: number }): string {
  const params = new URLSearchParams({
    q: input.query,
    api_key: input.apiKey,
    page: String(input.page ?? 1),
    page_size: String(input.pageSize ?? 50),
  });
  return `https://api.dp.la/v2/items?${params.toString()}`;
}
