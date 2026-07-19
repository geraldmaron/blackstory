/**
 * Parses federal adapter fixture exports into normalized candidate records.
 */
import { stampCandidateProvenance } from '../../candidates.js';
import type { SourceRegistryEntry } from '../../types.js';
import { filterLargeExportPayload } from './export-filter.js';
import { partitionByRetention } from './retention.js';
import type {
  FederalAdapterDefinition,
  FederalParseResult,
  RawFederalExportRecord,
} from './types.js';

function asExportRecords(raw: unknown): RawFederalExportRecord[] {
  if (!Array.isArray(raw)) {
    throw new Error('Federal fixture batch must be an array');
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Federal fixture record at index ${index} must be an object`);
    }
    return item as RawFederalExportRecord;
  });
}

export function parseFederalFixtureBatch(
  definition: FederalAdapterDefinition,
  entry: SourceRegistryEntry,
  runId: string,
  capturedAt: string,
  raw: unknown,
): FederalParseResult {
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
