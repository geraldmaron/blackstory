/**
 * Parses Chronicling America fixture exports into normalized candidate records.
 */
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import { parseChroniclingAmericaSearchResponse } from './client.js';
import { filterLargeExportPayload } from './export-filter.js';
import { partitionByRetention } from './retention.js';
import type {
  ChroniclingAmericaAdapterDefinition,
  ChroniclingAmericaNormalizedDoc,
  ChroniclingAmericaParseResult,
  RawChroniclingAmericaRecord,
} from './types.js';

function asExportRecords(raw: unknown): RawChroniclingAmericaRecord[] {
  if (!Array.isArray(raw)) {
    throw new Error('Chronicling America fixture batch must be an array');
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Chronicling America fixture record at index ${index} must be an object`);
    }
    return item as RawChroniclingAmericaRecord;
  });
}

function normalizedDocToExportRecord(
  doc: ChroniclingAmericaNormalizedDoc,
  classification: string,
): RawChroniclingAmericaRecord {
  return {
    stableIdentifier: doc.stableIdentifier,
    title: doc.title,
    canonicalUrl: doc.canonicalUrl,
    classification,
    ...(doc.lccn !== undefined ? { lccn: doc.lccn } : {}),
    ...(doc.displayDate !== undefined ? { displayDate: doc.displayDate } : {}),
    ...(doc.publicationTitle !== undefined ? { publicationTitle: doc.publicationTitle } : {}),
    ...(doc.publicationPlace !== undefined ? { publicationPlace: doc.publicationPlace } : {}),
    ...(doc.location !== undefined ? { location: doc.location } : {}),
    ...(doc.subjects !== undefined ? { subjects: doc.subjects } : {}),
  };
}

export function parseChroniclingAmericaFixtureBatch(
  definition: ChroniclingAmericaAdapterDefinition,
  entry: SourceRegistryEntry,
  runId: string,
  capturedAt: string,
  raw: unknown,
): ChroniclingAmericaParseResult {
  const records = asExportRecords(raw);
  const { qualified, rejected } = partitionByRetention(records, definition.retention);

  const candidates = [];
  let filteredExportCount = 0;

  for (const record of qualified) {
    const stableIdentifier = String(record.stableIdentifier ?? record.id ?? '').trim();
    const filtered = filterLargeExportPayload(record, definition.exportFilter);
    if (filtered.filtered) {
      filteredExportCount += 1;
    }

    candidates.push(
      stampCandidateProvenance(entry, runId, capturedAt, {
        stableIdentifier,
        ...(typeof record.title === 'string' ? { title: record.title } : {}),
        ...(typeof record.canonicalUrl === 'string' ? { canonicalUrl: record.canonicalUrl } : {}),
        classification:
          typeof record.classification === 'string'
            ? record.classification
            : definition.contract.classification,
        payload: filtered.payload,
      }),
    );
  }

  return { candidates, rejected, filteredExportCount };
}

export function parseChroniclingAmericaSearchFixture(
  definition: ChroniclingAmericaAdapterDefinition,
  entry: SourceRegistryEntry,
  runId: string,
  capturedAt: string,
  raw: unknown,
): ChroniclingAmericaParseResult {
  const parsed = parseChroniclingAmericaSearchResponse(raw);
  const exportRecords = parsed.docs.map((doc) =>
    normalizedDocToExportRecord(doc, definition.contract.classification),
  );

  const searchRejected = parsed.rejected.map((record) => ({
    stableIdentifier: record.stableIdentifier,
    reason: record.reason,
  }));

  const batchResult = parseChroniclingAmericaFixtureBatch(
    definition,
    entry,
    runId,
    capturedAt,
    exportRecords,
  );

  return {
    candidates: batchResult.candidates,
    rejected: [...searchRejected, ...batchResult.rejected],
    filteredExportCount: batchResult.filteredExportCount,
  };
}
