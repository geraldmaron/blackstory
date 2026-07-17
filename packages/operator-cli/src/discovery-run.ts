
/**
 * Thin wrapper over the real discovery campaign gate (`@black-book/domain`).
 *
 * This does NOT fetch adapter candidates from any real source adapter fetching lives in
 * `packages/domain/src/adapters/**` and its worker callers, which are out of scope.
 * This wrapper's job is to run an already-assembled batch of `AdapterCandidateRecord`s through
 * the real, bounded, quarantine-aware campaign gate (`runDiscoveryCampaign`) and summarize
 * yield exactly what an operator session needs after kicking off (or receiving results from)
 * a bounded discovery run, without re-deriving any of the budget/boundary/quarantine logic.
 */
import {
  createDiscoveryCampaignConfig,
  runDiscoveryCampaign,
  type AdapterCandidateRecord,
  type DiscoveryCampaignConfig,
  type DiscoveryCampaignResult,
} from '@black-book/domain';
import type { QueryPack } from '@black-book/domain';
import type { DiscoveryRunContext } from '@black-book/domain';

export type DiscoveryRunBatch = {
  readonly pack: QueryPack;
  readonly records: readonly AdapterCandidateRecord[];
  readonly runContext: DiscoveryRunContext;
};

export type RunBoundedDiscoveryCampaignInput = {
  readonly batch: DiscoveryRunBatch;
  readonly config: DiscoveryCampaignConfig;
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly idPrefix?: string;
};

export type DiscoveryYieldSummary = {
  readonly campaignId: string;
  readonly acceptedCount: number;
  readonly quarantinedCount: number;
  readonly deadLetterCount: number;
  readonly mergedCount: number;
  readonly skippedCount: number;
  readonly totalCandidates: number;
};

export function summarizeDiscoveryYield(result: DiscoveryCampaignResult): DiscoveryYieldSummary {
  return {
    campaignId: result.campaignId,
    acceptedCount: result.acceptedCount,
    quarantinedCount: result.quarantinedCount,
    deadLetterCount: result.deadLetterCount,
    mergedCount: result.mergedCount,
    skippedCount: result.skippedCount,
    totalCandidates: result.candidates.length,
  };
}


/**
 * Runs one bounded discovery campaign over an already-assembled candidate batch and returns
 * both the full result (for anyone who needs the candidate list) and a compact yield summary.
 */
export function runBoundedDiscoveryCampaign(input: RunBoundedDiscoveryCampaignInput): {
  readonly result: DiscoveryCampaignResult;
  readonly summary: DiscoveryYieldSummary;
} {
  const config = createDiscoveryCampaignConfig(input.config);
  const result = runDiscoveryCampaign({
    config,
    records: input.batch.records,
    pack: input.batch.pack,
    runContext: input.batch.runContext,
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
    ...(input.idPrefix ? { idPrefix: input.idPrefix } : {}),
  });
  return { result, summary: summarizeDiscoveryYield(result) };
}
