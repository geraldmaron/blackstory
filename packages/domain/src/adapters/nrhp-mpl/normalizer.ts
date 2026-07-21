/**
 * Normalize curated NRHP Multiple Property Listing metadata exports into
 * `AdapterCandidateRecord` output with full provenance. Accepts fixture JSON only — no live NPS
 * scrape and no bulk OCR of MPL PDF bodies.
 */
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import {
  NRHP_MPL_ADAPTER_ID,
  NRHP_MPL_DEFAULT_CLASSIFICATION,
  NRHP_MPL_FORBIDDEN_PAYLOAD_KEYS,
  NRHP_MPL_PAYLOAD_SCHEMA_VERSION,
  qualifiesForAaCuratedNet,
} from './definition.js';
import type {
  NrhpMplCandidatePayload,
  NrhpMplCandidateRecord,
  NrhpMplParseResult,
  NrhpMplRawRecord,
  NrhpMplRejectedRecord,
} from './types.js';

function asRawRecords(raw: unknown): NrhpMplRawRecord[] {
  if (!Array.isArray(raw)) {
    throw new Error('NRHP MPL fixture batch must be an array');
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`NRHP MPL fixture record at index ${index} must be an object`);
    }
    return item as NrhpMplRawRecord;
  });
}

function stripForbiddenKeys(
  record: NrhpMplRawRecord,
): { readonly payload: Record<string, unknown>; readonly strippedKeys: readonly string[] } {
  const payload: Record<string, unknown> = { ...record };
  const strippedKeys: string[] = [];
  for (const key of NRHP_MPL_FORBIDDEN_PAYLOAD_KEYS) {
    if (key in payload) {
      delete payload[key];
      strippedKeys.push(key);
    }
  }
  return { payload, strippedKeys };
}

function buildStableIdentifier(record: NrhpMplRawRecord): string {
  const explicit = record.stableIdentifier?.trim();
  if (explicit) {
    return explicit;
  }
  const ref = record.mplReference?.trim();
  if (ref) {
    return `nrhp-mpl:${ref}`;
  }
  throw new Error('NRHP MPL record requires stableIdentifier or mplReference');
}

function reject(
  rejected: NrhpMplRejectedRecord[],
  record: NrhpMplRawRecord,
  reason: string,
  index: number,
): void {
  rejected.push({
    index,
    reason,
    ...(record.mplReference !== undefined ? { mplReference: record.mplReference } : {}),
    ...(record.title !== undefined ? { title: record.title } : {}),
  });
}

export function normalizeNrhpMplRecord(input: {
  readonly record: NrhpMplRawRecord;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): NrhpMplCandidateRecord {
  const stableIdentifier = buildStableIdentifier(input.record);
  const { payload: strippedRecord, strippedKeys } = stripForbiddenKeys(input.record);

  const candidatePayload: NrhpMplCandidatePayload = {
    schemaVersion: NRHP_MPL_PAYLOAD_SCHEMA_VERSION,
    mplReference: String(strippedRecord.mplReference ?? '').trim(),
    documentType:
      typeof strippedRecord.documentType === 'string'
        ? strippedRecord.documentType
        : 'multiple_property_documentation_form',
    theme: String(strippedRecord.theme ?? '').trim(),
    aaHeritageRelevance: String(strippedRecord.aaHeritageRelevance ?? '').trim(),
    ...(Array.isArray(strippedRecord.stateCodes)
      ? { stateCodes: strippedRecord.stateCodes.map(String) }
      : {}),
    ...(typeof strippedRecord.thematicContext === 'string'
      ? { thematicContext: strippedRecord.thematicContext }
      : {}),
    ...(typeof strippedRecord.coveragePeriod === 'string'
      ? { coveragePeriod: strippedRecord.coveragePeriod }
      : {}),
    ...(typeof strippedRecord.propertyCountEstimate === 'number'
      ? { propertyCountEstimate: strippedRecord.propertyCountEstimate }
      : {}),
    ...(strippedKeys.length > 0 ? { strippedForbiddenKeys: strippedKeys } : {}),
  };

  const classification =
    typeof strippedRecord.classification === 'string'
      ? strippedRecord.classification
      : NRHP_MPL_DEFAULT_CLASSIFICATION;

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier,
    ...(typeof strippedRecord.title === 'string' ? { title: strippedRecord.title } : {}),
    ...(typeof strippedRecord.canonicalUrl === 'string'
      ? { canonicalUrl: strippedRecord.canonicalUrl }
      : {}),
    classification,
    payload: candidatePayload as Readonly<Record<string, unknown>>,
  });

  assertNrhpMplCandidate(candidate as NrhpMplCandidateRecord);
  return candidate as NrhpMplCandidateRecord;
}

export function parseNrhpMplFixtureBatch(
  entry: SourceRegistryEntry,
  runId: string,
  capturedAt: string,
  raw: unknown,
): NrhpMplParseResult {
  const records = asRawRecords(raw);
  const candidates: NrhpMplCandidateRecord[] = [];
  const rejected: NrhpMplRejectedRecord[] = [];

  for (const [index, record] of records.entries()) {
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const canonicalUrl = typeof record.canonicalUrl === 'string' ? record.canonicalUrl.trim() : '';
    const theme = typeof record.theme === 'string' ? record.theme.trim() : '';
    const aaHeritageRelevance =
      typeof record.aaHeritageRelevance === 'string' ? record.aaHeritageRelevance.trim() : '';

    if (!title) {
      reject(rejected, record, 'missing_required_field:title', index);
      continue;
    }
    if (!canonicalUrl) {
      reject(rejected, record, 'missing_required_field:canonicalUrl', index);
      continue;
    }
    try {
      new URL(canonicalUrl);
    } catch {
      reject(rejected, record, 'invalid_canonical_url', index);
      continue;
    }
    if (!theme || !aaHeritageRelevance) {
      reject(rejected, record, 'missing_aa_curated_net_fields', index);
      continue;
    }
    if (!qualifiesForAaCuratedNet({ theme, aaHeritageRelevance })) {
      reject(rejected, record, 'not_in_aa_curated_net', index);
      continue;
    }

    try {
      candidates.push(
        normalizeNrhpMplRecord({
          record,
          registryEntry: entry,
          runId,
          capturedAt,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reject(rejected, record, message, index);
    }
  }

  return { candidates, rejected };
}

export function assertNrhpMplCandidate(candidate: NrhpMplCandidateRecord): void {
  if (candidate.provenance.adapterId !== NRHP_MPL_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${NRHP_MPL_ADAPTER_ID}`);
  }
  if (candidate.payload.schemaVersion !== NRHP_MPL_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${candidate.payload.schemaVersion}`);
  }
  if (!candidate.payload.mplReference.trim()) {
    throw new Error('NRHP MPL candidate requires mplReference');
  }
  if (!candidate.payload.theme.trim()) {
    throw new Error('NRHP MPL candidate requires theme');
  }
  if (!qualifiesForAaCuratedNet(candidate.payload)) {
    throw new Error('NRHP MPL candidate failed African American curated-net qualification');
  }
  for (const key of NRHP_MPL_FORBIDDEN_PAYLOAD_KEYS) {
    if (key in (candidate.payload as Record<string, unknown>)) {
      throw new Error(`NRHP MPL candidate must not carry forbidden key: ${key}`);
    }
  }
}
