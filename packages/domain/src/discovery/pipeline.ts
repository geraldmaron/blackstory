/**
 * Discovery campaign pipeline orchestration.
 * Produces private research candidates only never public entities.
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import {
  assertDiscoveryRunStamped,
  stampDiscoveryRun,
  type QueryPack,
} from '../query-packs/index.js';
import type { DiscoveryRunContext } from '../query-packs/types.js';
import {
  isWithinCampaignBudget,
  recordWithinCampaignBoundaries,
  type CampaignBudgetSnapshot,
} from './campaign.js';
import { mergeDuplicateCandidates } from './deduplication.js';
import { stampDiscoveryReproducibility } from './hashing.js';
import { ingestBulkCandidates } from './ingestion.js';
import {
  handleCandidateFailure,
  quarantineCandidate,
  shouldContinueCampaign,
  shouldStopForDeadLetters,
} from './quarantine.js';
import type {
  DiscoveryCampaignConfig,
  DiscoveryCampaignResult,
  DiscoveryCandidateRecord,
} from './types.js';

export type RunDiscoveryCampaignInput = {
  readonly config: DiscoveryCampaignConfig;
  readonly records: readonly AdapterCandidateRecord[];
  readonly pack: QueryPack;
  readonly runContext: DiscoveryRunContext;
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly idPrefix?: string;
};

function emptySnapshot(): CampaignBudgetSnapshot {
  return { accepted: 0, quarantined: 0, deadLetter: 0, totalProcessed: 0 };
}

function processCandidate(
  candidate: DiscoveryCandidateRecord,
  config: DiscoveryCampaignConfig,
  snapshot: CampaignBudgetSnapshot,
  completedAt: string,
): { readonly candidate: DiscoveryCandidateRecord; readonly snapshot: CampaignBudgetSnapshot } {
  try {
    if (!recordWithinCampaignBoundaries(candidate.adapterRecord, config.boundaries)) {
      const quarantinedCandidate = quarantineCandidate(
        candidate,
        'outside_campaign_boundaries',
        completedAt,
      );
      const next: CampaignBudgetSnapshot = {
        ...snapshot,
        totalProcessed: snapshot.totalProcessed + 1,
        quarantined: snapshot.quarantined + 1,
      };
      return { candidate: quarantinedCandidate, snapshot: next };
    }

    const accepted: DiscoveryCandidateRecord = {
      ...candidate,
      status: 'accepted',
      updatedAt: completedAt,
    };
    return {
      candidate: accepted,
      snapshot: {
        ...snapshot,
        totalProcessed: snapshot.totalProcessed + 1,
        accepted: snapshot.accepted + 1,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const failure = handleCandidateFailure(
      { candidate, reason, now: completedAt },
      config.budget.maxRetriesPerCandidate,
    );
    const next: CampaignBudgetSnapshot = {
      ...snapshot,
      totalProcessed: snapshot.totalProcessed + 1,
      quarantined:
        failure.candidate.status === 'quarantined'
          ? snapshot.quarantined + 1
          : snapshot.quarantined,
      deadLetter:
        failure.candidate.status === 'dead_letter'
          ? snapshot.deadLetter + 1
          : snapshot.deadLetter,
    };
    return { candidate: failure.candidate, snapshot: next };
  }
}

/**
 * Run a full discovery campaign over adapter records.
 * Failed candidates are quarantined or dead-lettered without blocking the campaign.
 */
export function runDiscoveryCampaign(input: RunDiscoveryCampaignInput): DiscoveryCampaignResult {
  const stampedRun = stampDiscoveryRun(input.runContext, input.pack, input.stampedAt);
  assertDiscoveryRunStamped(stampedRun);

  const parserVersions = [
    ...new Set(input.records.map((record) => record.provenance.parserVersion)),
  ];
  const reproducibility = stampDiscoveryReproducibility(stampedRun, parserVersions);

  const ingested = ingestBulkCandidates(
    { records: input.records },
    input.pack,
    {
      now: input.stampedAt,
      ...(input.idPrefix !== undefined ? { idPrefix: input.idPrefix } : {}),
    },
  );

  let snapshot = emptySnapshot();
  const processed: DiscoveryCandidateRecord[] = [];
  let skippedCount = 0;

  for (const candidate of ingested) {
    if (!isWithinCampaignBudget(snapshot, input.config.budget)) {
      skippedCount += 1;
      continue;
    }

    if (
      !shouldContinueCampaign(
        input.config.continueOnQuarantine,
        snapshot.quarantined,
        input.config.budget.maxQuarantined,
      )
    ) {
      skippedCount += 1;
      continue;
    }

    if (shouldStopForDeadLetters(snapshot.deadLetter, input.config.budget.maxDeadLetter)) {
      skippedCount += 1;
      continue;
    }

    const result = processCandidate(candidate, input.config, snapshot, input.completedAt);
    processed.push(result.candidate);
    snapshot = result.snapshot;
  }

  const { survivors, mergedCount } = mergeDuplicateCandidates(processed);

  return {
    campaignId: input.config.campaignId,
    run: stampedRun,
    pack: {
      id: input.pack.id,
      versionId: input.pack.versionId,
      version: input.pack.version,
    },
    reproducibility,
    candidates: survivors,
    acceptedCount: survivors.filter((c) => c.status === 'accepted' || c.status === 'merged').length,
    quarantinedCount: survivors.filter((c) => c.status === 'quarantined').length,
    deadLetterCount: survivors.filter((c) => c.status === 'dead_letter').length,
    mergedCount,
    skippedCount,
    completedAt: input.completedAt,
  };
}
