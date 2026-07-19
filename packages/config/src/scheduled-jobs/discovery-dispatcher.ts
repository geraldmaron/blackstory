/**
 * Discovery campaign dispatcher — Cloud Scheduler / GHA / Cloud Run Job entry.
 *
 * Gates: roster registration + research-campaigns kill switch. Loads fixture payloads by
 * default; live mode accepts injected file paths via env (SafeHttpClient fetch not wired yet).
 * Private candidates only — never publishes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateKillSwitch,
  type KillSwitchSnapshot,
  type KillSwitchState,
} from '../kill-switches.js';
import { assertJobMayBeDispatched } from './registry.js';
import { createDefaultScheduledJobRegistry } from './roster.js';
import {
  COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID,
  runCommunityObscurityDiscoveryJob,
} from './jobs/community-obscurity-discovery.js';
import {
  DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID,
  runDiscoveryCampaignArchiveDplaJob,
} from './jobs/discovery-campaign-archive-dpla.js';
import {
  RSS_DISCOVERY_CAMPAIGN_JOB_ID,
  runRssDiscoveryCampaignJob,
} from './jobs/discovery-campaign-rss.js';
import {
  DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID,
  runDiscoveryCampaignWebSearchJob,
} from './jobs/discovery-campaign-web-search.js';
import {
  DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID,
  runDiscoveryCampaignWikimediaFederalJob,
} from './jobs/discovery-campaign-wikimedia-federal.js';
import type { JobRunRecord } from './run-record.js';

export const DISCOVERY_DISPATCHER_VERSION = 'discovery-dispatcher.v1' as const;

export const DISCOVERY_CAMPAIGN_JOB_IDS = [
  RSS_DISCOVERY_CAMPAIGN_JOB_ID,
  DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID,
  DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID,
  DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID,
  COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID,
] as const;

export type DiscoveryCampaignJobId = (typeof DISCOVERY_CAMPAIGN_JOB_IDS)[number];
export type DiscoveryCampaignDispatchMode = 'fixture' | 'live';
export type DiscoveryCampaignDispatchStatus =
  | 'success'
  | 'skipped_kill_switch'
  | 'error';

export type DiscoveryCampaignDispatchResult = {
  readonly dispatcherVersion: typeof DISCOVERY_DISPATCHER_VERSION;
  readonly status: DiscoveryCampaignDispatchStatus;
  readonly jobId: string;
  readonly mode: DiscoveryCampaignDispatchMode;
  readonly summary: {
    readonly itemsProcessed?: number;
    readonly itemsExpected?: number;
    readonly survivors?: number;
    readonly accepted?: number;
    readonly kind?: string;
    readonly message?: string;
  };
  readonly run?: JobRunRecord;
  readonly publicEffect: 'none';
};

export type DispatchDiscoveryCampaignInput = {
  readonly jobId: string;
  readonly mode: DiscoveryCampaignDispatchMode;
  readonly jobRunId?: string;
  /** Explicit override. When set, skips evaluateKillSwitch snapshot. */
  readonly killSwitchEngaged?: boolean;
  /** Optional snapshot; used when killSwitchEngaged is omitted. */
  readonly killSwitchSnapshot?: KillSwitchSnapshot;
  readonly nowIso?: string;
  readonly maxCandidates?: number;
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

const RESEARCH_CAMPAIGNS_KILL_SWITCH = 'research-campaigns' as const;

function repoRootFromHere(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function readJson(path: string): unknown {
  return JSON.parse(readText(path));
}

function defaultCatalogTitles(): readonly string[] {
  return [
    'Rosa Parks',
    'Martin Luther King Jr.',
    'Buffalo Soldiers',
    'Harriet Tubman',
    'Paul Laurence Dunbar',
    'Dunbar High School',
  ];
}

function resolveKillSwitchEngaged(input: DispatchDiscoveryCampaignInput): boolean {
  if (input.killSwitchEngaged !== undefined) {
    return input.killSwitchEngaged;
  }
  const snapshot = input.killSwitchSnapshot ?? {};
  const decision = evaluateKillSwitch(RESEARCH_CAMPAIGNS_KILL_SWITCH, snapshot);
  return !decision.allowed;
}

/** Explicitly disengaged snapshot for local/CI fixture runs (missing flag would deny). */
export function disengagedResearchCampaignsSnapshot(
  updatedAt: string,
): KillSwitchSnapshot {
  const state: KillSwitchState = {
    id: RESEARCH_CAMPAIGNS_KILL_SWITCH,
    enabled: false,
    updatedAt,
  };
  return { [RESEARCH_CAMPAIGNS_KILL_SWITCH]: state };
}

function isDiscoveryJobId(jobId: string): jobId is DiscoveryCampaignJobId {
  return (DISCOVERY_CAMPAIGN_JOB_IDS as readonly string[]).includes(jobId);
}

async function runFixtureOrLiveJob(
  input: DispatchDiscoveryCampaignInput & {
    readonly jobId: DiscoveryCampaignJobId;
    readonly jobRunId: string;
    readonly startedAt: string;
    readonly completedAt: string;
  },
): Promise<{ run: JobRunRecord; survivors?: number; accepted?: number; kind?: string }> {
  const root = repoRootFromHere();
  const env = input.environment ?? process.env;

  switch (input.jobId) {
    case COMMUNITY_OBSCURITY_DISCOVERY_JOB_ID: {
      const fixturePath = join(
        root,
        'packages/domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml',
      );
      const livePath = env.DISCOVERY_FEED_XML?.trim();
      if (input.mode === 'live' && (livePath === undefined || livePath.length === 0)) {
        throw new Error(
          'live community-obscurity requires DISCOVERY_FEED_XML=/path/to/feed.xml (download first)',
        );
      }
      const xmlPath = input.mode === 'live' && livePath ? livePath : fixturePath;
      const result = runCommunityObscurityDiscoveryJob({
        jobRunId: input.jobRunId,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        feedXmlByFeedId: new Map([['feed_the_american_blackstory', readText(xmlPath)]]),
        catalogTitles: defaultCatalogTitles(),
        ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
      });
      return {
        run: result.run,
        survivors: result.campaign.ranked.length,
        accepted: result.campaign.campaign.acceptedCount,
        kind: result.campaign.kind,
      };
    }
    case RSS_DISCOVERY_CAMPAIGN_JOB_ID: {
      const fixturePath = join(
        root,
        'packages/domain/src/adapters/rss/fixtures/historical-society-feed.rss.xml',
      );
      const livePath = env.DISCOVERY_FEED_XML?.trim();
      if (input.mode === 'live' && (livePath === undefined || livePath.length === 0)) {
        throw new Error(
          'live rss requires DISCOVERY_FEED_XML=/path/to/feed.xml (download first)',
        );
      }
      const xmlPath = input.mode === 'live' && livePath ? livePath : fixturePath;
      const result = await runRssDiscoveryCampaignJob({
        jobRunId: input.jobRunId,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        feedXmlByFeedId: new Map([['feed_historical_society', readText(xmlPath)]]),
        ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
      });
      return {
        run: result.run,
        survivors: result.campaign.yield.survivors,
        accepted: result.campaign.campaign.acceptedCount,
        kind: result.campaign.kind,
      };
    }
    case DISCOVERY_CAMPAIGN_WIKIMEDIA_FEDERAL_JOB_ID: {
      // Live federal/Wikimedia HTTP clients are not shipped; fixture fan-out is the automation path.
      const result = await runDiscoveryCampaignWikimediaFederalJob({
        jobRunId: input.jobRunId,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
      });
      return {
        run: result.run,
        survivors: result.campaign.summary.survivors,
        accepted: result.campaign.summary.accepted,
        kind: result.campaign.kind,
      };
    }
    case DISCOVERY_CAMPAIGN_ARCHIVE_DPLA_JOB_ID: {
      const iaFixture = join(
        root,
        'packages/domain/src/adapters/internet-archive/fixtures/advanced-search-response.json',
      );
      const dplaFixture = join(
        root,
        'packages/domain/src/adapters/dpla/fixtures/search-response-current-shape.json',
      );
      const iaLive = env.DISCOVERY_IA_JSON?.trim();
      const dplaLive = env.DISCOVERY_DPLA_JSON?.trim();
      if (input.mode === 'live' && !iaLive && !dplaLive) {
        throw new Error(
          'live archive-dpla requires DISCOVERY_IA_JSON and/or DISCOVERY_DPLA_JSON file paths',
        );
      }
      const result = await runDiscoveryCampaignArchiveDplaJob({
        jobRunId: input.jobRunId,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        internetArchiveSearchJson: readJson(iaLive && iaLive.length > 0 ? iaLive : iaFixture),
        dplaSearchJson: readJson(dplaLive && dplaLive.length > 0 ? dplaLive : dplaFixture),
        ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
      });
      return {
        run: result.run,
        survivors: result.campaign.yield.survivors,
        accepted: result.campaign.yield.accepted,
        kind: result.campaign.kind,
      };
    }
    case DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID: {
      const braveFixture = join(
        root,
        'packages/domain/src/adapters/web-search/fixtures/brave-search-response.json',
      );
      const braveLive = env.DISCOVERY_BRAVE_JSON?.trim();
      if (input.mode === 'live' && (braveLive === undefined || braveLive.length === 0)) {
        throw new Error(
          'live web-search requires DISCOVERY_BRAVE_JSON=/path/to/brave-response.json and written storage terms',
        );
      }
      const storageConfirmed =
        env.DISCOVERY_STORAGE_TERMS_CONFIRMED === 'true' || input.mode === 'fixture';
      if (!storageConfirmed) {
        throw new Error(
          'web-search refuses to run without DISCOVERY_STORAGE_TERMS_CONFIRMED=true (written Brave storage-rights only)',
        );
      }
      const result = await runDiscoveryCampaignWebSearchJob({
        jobRunId: input.jobRunId,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        braveResponseRaw: readJson(
          braveLive && braveLive.length > 0 ? braveLive : braveFixture,
        ),
        providerConfig: {
          provider: 'brave',
          apiKey: env.BRAVE_SEARCH_API_KEY?.trim() || 'fixture-deterministic-brave-key',
          storageTermsConfirmed: true,
          planTermsVersion: 'brave-storage-rights-tier-2026-07',
        },
        requireWaybackCapture: false,
        ...(input.maxCandidates !== undefined ? { maxCandidates: input.maxCandidates } : {}),
      });
      return {
        run: result.run,
        survivors: result.campaign.yield.survivors,
        accepted: result.campaign.yield.accepted,
        kind: result.campaign.kind,
      };
    }
    default: {
      const _exhaustive: never = input.jobId;
      throw new Error(`Unhandled discovery job: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Dispatch a roster discovery campaign. Fail-closed on unknown job ids and engaged kill switch.
 */
export async function dispatchDiscoveryCampaign(
  input: DispatchDiscoveryCampaignInput,
): Promise<DiscoveryCampaignDispatchResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const jobRunId = input.jobRunId ?? `run_${input.jobId}_${nowIso.replace(/[:.]/g, '-')}`;

  const base = {
    dispatcherVersion: DISCOVERY_DISPATCHER_VERSION,
    jobId: input.jobId,
    mode: input.mode,
    publicEffect: 'none' as const,
  };

  try {
    if (!isDiscoveryJobId(input.jobId)) {
      return {
        ...base,
        status: 'error',
        summary: {
          message: `Unknown discovery job id "${input.jobId}"; expected one of ${DISCOVERY_CAMPAIGN_JOB_IDS.join(', ')}`,
        },
      };
    }

    const registry = createDefaultScheduledJobRegistry();
    assertJobMayBeDispatched(registry, input.jobId);

    if (resolveKillSwitchEngaged(input)) {
      return {
        ...base,
        status: 'skipped_kill_switch',
        summary: {
          message: 'Kill switch research-campaigns is engaged; discovery dispatch skipped',
        },
      };
    }

    const outcome = await runFixtureOrLiveJob({
      ...input,
      jobId: input.jobId,
      jobRunId,
      startedAt: nowIso,
      completedAt: nowIso,
    });

    return {
      ...base,
      status: 'success',
      summary: {
        itemsProcessed: outcome.run.itemsProcessed,
        itemsExpected: outcome.run.itemsExpected,
        ...(outcome.survivors !== undefined ? { survivors: outcome.survivors } : {}),
        ...(outcome.accepted !== undefined ? { accepted: outcome.accepted } : {}),
        ...(outcome.kind !== undefined ? { kind: outcome.kind } : {}),
      },
      run: outcome.run,
    };
  } catch (error) {
    return {
      ...base,
      status: 'error',
      summary: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
