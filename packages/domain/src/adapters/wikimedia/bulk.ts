/**
 * Bulk Wikimedia dump-style processing path (BB-045). Avoids high-volume public SPARQL dependence.
 */
import type { WikimediaBulkBatch, WikimediaBulkPageRecord } from './types.js';

export function parseWikimediaBulkBatch(raw: unknown): WikimediaBulkBatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Wikimedia bulk batch must be an object');
  }
  const batch = raw as WikimediaBulkBatch;
  if (batch.ingestMode !== 'bulk') {
    throw new Error('Wikimedia bulk batch ingestMode must be "bulk"');
  }
  if (!batch.project?.trim()) {
    throw new Error('Wikimedia bulk batch project is required');
  }
  if (!Array.isArray(batch.records) || batch.records.length === 0) {
    throw new Error('Wikimedia bulk batch records must be a non-empty array');
  }
  for (const record of batch.records) {
    assertBulkRecord(record);
  }
  return batch;
}

function assertBulkRecord(record: WikimediaBulkPageRecord): void {
  if (!record.page?.pageid || !record.page.title) {
    throw new Error('Bulk record page requires pageid and title');
  }
}

export function chunkBulkRecords(
  records: readonly WikimediaBulkPageRecord[],
  chunkSize: number,
): readonly (readonly WikimediaBulkPageRecord[])[] {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be positive');
  }
  const chunks: WikimediaBulkPageRecord[][] = [];
  for (let index = 0; index < records.length; index += chunkSize) {
    chunks.push(records.slice(index, index + chunkSize));
  }
  return chunks;
}
