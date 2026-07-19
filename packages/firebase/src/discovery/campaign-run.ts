/**
 * Discovery campaign run documents: pure builders, publish guard, and an in-memory store
 * for tests. Firestore persistence uses `discoveryCampaignRuns/{runId}` via Admin SDK writers
 * outside this module; every run records `publicEffect: 'none'`.
 */
import { discoveryCampaignRunSchema, type DiscoveryCampaignRunDoc } from '../firestore/types.js';

export const DISCOVERY_CAMPAIGN_RUN_STATUSES = ['success', 'skipped_kill_switch', 'error'] as const;

export type DiscoveryCampaignRunStatus = (typeof DISCOVERY_CAMPAIGN_RUN_STATUSES)[number];

export const DISCOVERY_CAMPAIGN_RUN_MODES = ['fixture', 'live'] as const;

export type DiscoveryCampaignRunMode = (typeof DISCOVERY_CAMPAIGN_RUN_MODES)[number];

export const RESEARCH_CAMPAIGNS_KILL_SWITCH_ID = 'research-campaigns' as const;

export type BuildDiscoveryCampaignRunInput = {
  readonly id: string;
  readonly jobId: string;
  readonly jobRunId: string;
  readonly status: DiscoveryCampaignRunStatus;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly mode: DiscoveryCampaignRunMode;
  readonly itemsExpected: number;
  readonly itemsProcessed: number;
  readonly survivors?: number;
  readonly accepted?: number;
  readonly kind?: string;
  readonly errorMessage?: string;
  readonly createdAt?: string;
};

/** Builds a validated discovery campaign run document with fixed private-only metadata. */
export function buildDiscoveryCampaignRunDoc(
  input: BuildDiscoveryCampaignRunInput,
): DiscoveryCampaignRunDoc {
  return discoveryCampaignRunSchema.parse({
    id: input.id,
    jobId: input.jobId,
    jobRunId: input.jobRunId,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    mode: input.mode,
    itemsExpected: input.itemsExpected,
    itemsProcessed: input.itemsProcessed,
    publicEffect: 'none',
    killSwitchId: RESEARCH_CAMPAIGNS_KILL_SWITCH_ID,
    createdAt: input.createdAt ?? input.completedAt,
    ...(input.survivors === undefined ? {} : { survivors: input.survivors }),
    ...(input.accepted === undefined ? {} : { accepted: input.accepted }),
    ...(input.kind === undefined ? {} : { kind: input.kind }),
    ...(input.errorMessage === undefined ? {} : { errorMessage: input.errorMessage }),
  });
}

/** Fail closed when a persisted run claims any automatic public effect. */
export function assertDiscoveryRunCannotPublish(doc: DiscoveryCampaignRunDoc): void {
  if (doc.publicEffect !== 'none') {
    throw new Error(`Discovery campaign run ${doc.id} cannot publish: publicEffect must be "none"`);
  }
}

export type DiscoveryCampaignRunStore = {
  save(doc: DiscoveryCampaignRunDoc): void;
  get(runId: string): DiscoveryCampaignRunDoc | undefined;
};

/** In-memory run store for unit tests and local fixture dispatchers. */
export function createInMemoryDiscoveryCampaignRunStore(): DiscoveryCampaignRunStore {
  const docs = new Map<string, DiscoveryCampaignRunDoc>();

  return {
    save(doc) {
      const parsed = discoveryCampaignRunSchema.parse(doc);
      assertDiscoveryRunCannotPublish(parsed);
      docs.set(parsed.id, parsed);
    },
    get(runId) {
      return docs.get(runId);
    },
  };
}
