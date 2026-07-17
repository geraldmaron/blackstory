/**
 * Wires Common Crawl candidates into the standard discovery pipeline via the SAME 
 * Wayback capture gate every other community adapter uses -- no
 * parallel ingestion path. Mirrors../web-search/pipeline.ts exactly.
 */
import { ingestApiCandidate } from '../../discovery/ingestion.js';
import type { DiscoveryCandidateRecord } from '../../discovery/types.js';
import type { QueryPack } from '../../query-packs/types.js';
import type { SafeHttpClient } from '../internet-archive/shared/http-port.js';
import { requireCaptureForAllCandidates } from '../internet-archive/wayback/index.js';
import type { SpnCredentials } from '../internet-archive/wayback/types.js';
import { COMMON_CRAWL_ADAPTER_ID } from './types.js';
import type { CommonCrawlCandidateRecord } from './types.js';

export type IngestCommonCrawlCandidatesThroughPipelineInput = {
  readonly candidates: readonly CommonCrawlCandidateRecord[];
  readonly client: SafeHttpClient;
  readonly credentials: SpnCredentials;
  readonly pack: QueryPack;
  readonly now: string;
  readonly captureConcurrency?: number;
};

export async function ingestCommonCrawlCandidatesThroughPipeline(
  input: IngestCommonCrawlCandidatesThroughPipelineInput,
): Promise<readonly DiscoveryCandidateRecord[]> {
  const captured = await requireCaptureForAllCandidates(input.candidates, {
    client: input.client,
    credentials: input.credentials,
    snippetFor: (candidate) =>
      `Common Crawl capture from ${candidate.payload.crawlId} (${candidate.payload.geographicLabel}).`,
    adapterId: COMMON_CRAWL_ADAPTER_ID,
    now: input.now,
    ...(input.captureConcurrency !== undefined ? { concurrency: input.captureConcurrency } : {}),
  });

  return captured.map((entry) => ingestApiCandidate({ record: entry.candidate }, input.pack, { now: input.now }));
}
