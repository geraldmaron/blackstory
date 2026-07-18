/**
 * Wires web-search candidates into the standard discovery pipeline via the SAME
 * Wayback capture gate every other community adapter uses -- no
 * parallel ingestion path. `requireCaptureForAllCandidates` submits every candidate's
 * `canonicalUrl` through the injected `SafeHttpClient` (which production wiring backs with
 * safety,../internet-archive/shared/http-port.ts), so a discovered URL only becomes
 * review-eligible after both evaluation and a real Wayback capture succeed. Accepted
 * candidates then flow through `ingestApiCandidate` -- the same API-ingestion entry
 * point adapters use -- rather than a bespoke ingestion function.
 */
import { ingestApiCandidate } from '../../discovery/ingestion.js';
import type { DiscoveryCandidateRecord } from '../../discovery/types.js';
import type { QueryPack } from '../../query-packs/types.js';
import type { SafeHttpClient } from '../internet-archive/shared/http-port.js';
import { requireCaptureForAllCandidates } from '../internet-archive/wayback/index.js';
import type { SpnCredentials } from '../internet-archive/wayback/types.js';
import { webSearchAdapterId } from './types.js';
import type { WebSearchCandidateRecord, WebSearchProvider } from './types.js';

export type IngestWebSearchCandidatesThroughPipelineInput = {
  readonly candidates: readonly WebSearchCandidateRecord[];
  readonly provider: WebSearchProvider;
  readonly client: SafeHttpClient;
  readonly credentials: SpnCredentials;
  readonly pack: QueryPack;
  readonly now: string;
  readonly captureConcurrency?: number;
};

export async function ingestWebSearchCandidatesThroughPipeline(
  input: IngestWebSearchCandidatesThroughPipelineInput,
): Promise<readonly DiscoveryCandidateRecord[]> {
  const captured = await requireCaptureForAllCandidates(input.candidates, {
    client: input.client,
    credentials: input.credentials,
    snippetFor: (candidate) =>
      candidate.payload.summary ?? candidate.title ?? candidate.canonicalUrl ?? 'web search result',
    adapterId: webSearchAdapterId(input.provider),
    now: input.now,
    ...(input.captureConcurrency !== undefined ? { concurrency: input.captureConcurrency } : {}),
  });

  return captured.map((entry) => ingestApiCandidate({ record: entry.candidate }, input.pack, { now: input.now }));
}
