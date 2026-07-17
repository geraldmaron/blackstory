/**
 * Normalize Common Crawl CDX records into AdapterCandidateRecord output. No storage-rights
 * gate here (unlike `../web-search/normalizer.ts`) — Common Crawl's research/fair-use terms
 * already permit this use; see `types.ts`'s module doc comment.
 */
import { hashUtf8 } from '../../provenance/hashes.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import {
  COMMON_CRAWL_ADAPTER_ID,
  COMMON_CRAWL_DEFAULT_CLASSIFICATION,
  COMMON_CRAWL_PAYLOAD_SCHEMA_VERSION,
} from './types.js';
import type {
  CommonCrawlCandidatePayload,
  CommonCrawlCandidateRecord,
  CommonCrawlCdxRecord,
  CommonCrawlQueryProvenance,
} from './types.js';

function buildStableIdentifier(crawlId: string, record: CommonCrawlCdxRecord): string {
  const material = `${record.urlkey}|${record.timestamp}|${record.digest ?? record.url}`;
  const digest = hashUtf8(material).digest.slice(0, 24);
  return `common-crawl:${crawlId}:${digest}`;
}

export type NormalizeCdxRecordInput = {
  readonly record: CommonCrawlCdxRecord;
  readonly crawlId: string;
  readonly geographicLabel: string;
  readonly queryProvenance: CommonCrawlQueryProvenance;
  readonly filterPattern?: string;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
};

export function normalizeCdxRecord(input: NormalizeCdxRecordInput): CommonCrawlCandidateRecord {
  const payload: CommonCrawlCandidatePayload = {
    schemaVersion: COMMON_CRAWL_PAYLOAD_SCHEMA_VERSION,
    crawlId: input.crawlId,
    captureTimestamp: input.record.timestamp,
    query: input.queryProvenance,
    geographicLabel: input.geographicLabel,
    ...(input.record.mime !== undefined ? { mime: input.record.mime } : {}),
    ...(input.record.status !== undefined ? { status: input.record.status } : {}),
    ...(input.record.digest !== undefined ? { digest: input.record.digest } : {}),
    ...(input.filterPattern !== undefined ? { filterPattern: input.filterPattern } : {}),
  };

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: buildStableIdentifier(input.crawlId, input.record),
    canonicalUrl: input.record.url,
    classification: input.classification ?? COMMON_CRAWL_DEFAULT_CLASSIFICATION,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertCommonCrawlCandidate(candidate as CommonCrawlCandidateRecord);
  return candidate as CommonCrawlCandidateRecord;
}

export function normalizeCdxBatch(input: {
  readonly records: readonly CommonCrawlCdxRecord[];
  readonly crawlId: string;
  readonly geographicLabel: string;
  readonly queryProvenance: CommonCrawlQueryProvenance;
  readonly filterPattern?: string;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
}): readonly CommonCrawlCandidateRecord[] {
  return input.records.map((record) =>
    normalizeCdxRecord({
      record,
      crawlId: input.crawlId,
      geographicLabel: input.geographicLabel,
      queryProvenance: input.queryProvenance,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
      ...(input.filterPattern !== undefined ? { filterPattern: input.filterPattern } : {}),
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
    }),
  );
}

export function assertCommonCrawlCandidate(candidate: CommonCrawlCandidateRecord): void {
  if (candidate.provenance.adapterId !== COMMON_CRAWL_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${COMMON_CRAWL_ADAPTER_ID}`);
  }
  if (candidate.payload.schemaVersion !== COMMON_CRAWL_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${candidate.payload.schemaVersion}`);
  }
  if (!candidate.payload.geographicLabel.trim()) {
    throw new Error('Common Crawl candidate requires a non-empty geographicLabel');
  }
  if (!candidate.payload.query.apiName.trim()) {
    throw new Error('Common Crawl candidate requires query provenance with apiName');
  }
  if (!candidate.payload.query.queryText.trim()) {
    throw new Error('Common Crawl candidate requires query provenance with queryText');
  }
  if (!candidate.payload.query.executedAt.trim()) {
    throw new Error('Common Crawl candidate requires query provenance with executedAt');
  }
  if (!candidate.payload.query.planTermsVersion.trim()) {
    throw new Error('Common Crawl candidate requires query provenance with planTermsVersion');
  }
}
