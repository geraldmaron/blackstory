/**
 * County Archive Ladder discovery campaign.
 *
 * Harvests Black-history micro-records from county/state historical-society finding aids
 * (EAD/XML + OAI-PMH) via an injected `FindingAidAdapter`, runs them through the standard
 * discovery pipeline (ingestion → signals → deduplication → boundary gate), scores survivors
 * for catalog-relative obscurity (`scoreObscurity`), and returns the campaign-runner yield
 * summary. Mirrors `community-obscurity-campaign.ts` / `archive-dpla-campaign.ts`.
 *
 * Invariants:
 * - Private candidates only. `assertCampaignCannotPublish()` runs before any yield. No public
 *   projection, release, or canonical write path exists here (ADR-009).
 * - Sources register DISABLED (`registerFindingAidSource`); the campaign approves policy at run
 *   time via `approveSourcePolicy`, exactly like the other fixture-first campaigns.
 * - Fixture-first: the campaign performs no network I/O. A live `FindingAidAdapter` MUST use
 *   `@repo/security` safe-fetch. Tests inject an inline deterministic adapter.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import {
  FINDING_AID_ADAPTER_ID,
  normalizeFindingAidCandidate,
  registerFindingAidSource,
  type FindingAidAdapter,
  type FindingAidSource,
} from '../adapters/finding-aid/index.js';
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type { AuditActor } from '../audit/index.js';
import { buildQueryPack, type QueryPack } from '../query-packs/index.js';
import type { ResolutionProfile } from '../resolution/types.js';
import { createDiscoveryCampaignConfig } from './campaign.js';
import {
  assertCampaignCannotPublish,
  listCampaignSurvivors,
  runOptionalEditorialHook,
  summarizeCampaignYield,
  toEditorialLeadPreview,
  type CampaignEditorialHook,
  type CampaignYieldSummary,
  type EditorialReviewResult,
} from './campaign-runner.js';
import {
  OBSCURITY_METHODOLOGY_DISCLAIMER,
  rankByObscurity,
  scoreObscurity,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
} from './obscurity.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type { DiscoveryCampaignResult, DiscoveryCandidateRecord } from './types.js';

export const COUNTY_ARCHIVE_CAMPAIGN_KIND = 'county-archive-ladder.v1' as const;

export type CountyArchiveRankedLead = {
  readonly candidateId: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly repository?: string;
  readonly state?: string;
  readonly obscurity: ObscurityAssessment;
};

export type CountyArchiveCampaignResult = {
  readonly kind: typeof COUNTY_ARCHIVE_CAMPAIGN_KIND;
  readonly adapterId: typeof FINDING_AID_ADAPTER_ID;
  readonly sourceIds: readonly string[];
  readonly campaign: DiscoveryCampaignResult;
  readonly yield: CampaignYieldSummary;
  readonly ranked: readonly CountyArchiveRankedLead[];
  readonly editorialReviews: readonly EditorialReviewResult[];
  readonly disclaimer: typeof OBSCURITY_METHODOLOGY_DISCLAIMER;
  readonly completedAt: string;
};

export type RunCountyArchiveCampaignInput = {
  /** Harvester over finding aids. Inline/deterministic in tests; safe-fetch-backed in prod. */
  readonly adapter: FindingAidAdapter;
  /** Seeded state/county archives to walk. Defaults to `loadStateArchiveSeed()`. */
  readonly sources?: readonly FindingAidSource[];
  /** Catalog titles for the obscurity reference corpus (IDF). */
  readonly catalogTitles: readonly string[];
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly pack?: QueryPack;
  readonly maxCandidates?: number;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly editorialHook?: CampaignEditorialHook;
  readonly operatorActor?: AuditActor;
};

const SEED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'adapters',
  'finding-aid',
  'fixtures',
  'state-archive-seed.v1.json',
);

/** Load the real state-archive seed shipped with the finding-aid adapter fixtures. */
export function loadStateArchiveSeed(): readonly FindingAidSource[] {
  const parsed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as {
    readonly sources?: readonly FindingAidSource[];
  };
  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error('state-archive-seed.v1.json has no sources');
  }
  return parsed.sources;
}

function defaultCountyArchivePack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-county-archive-ladder',
    displayName: 'County Archive Ladder discovery',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'NAACP', termClass: 'historical' },
      { text: 'desegregation', termClass: 'historical' },
      { text: 'church', termClass: 'modern' },
      { text: 'school', termClass: 'modern' },
      { text: 'county', termClass: 'geographic' },
    ],
  });
}

function ensureApprovedFindingAidSource(
  store: SourceRegistryStore,
  source: FindingAidSource,
  now: string,
  approvedBy: string,
): SourceRegistryEntry {
  const existing = store.get(source.registryEntryId);
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  if (!existing) {
    registerFindingAidSource({ store, source, createdAt: now });
  }
  return approveSourcePolicy(store, {
    id: source.registryEntryId,
    approvedBy,
    approvedAt: now,
  });
}

/**
 * Run the County Archive Ladder over seeded state/county archives. Private candidates only.
 */
export async function runCountyArchiveCampaign(
  input: RunCountyArchiveCampaignInput,
): Promise<CountyArchiveCampaignResult> {
  assertCampaignCannotPublish();

  const actor: AuditActor = input.operatorActor ?? {
    id: 'county-archive-campaign',
    type: 'system',
  };
  const runId = input.runId ?? `run_county_archive_${input.stampedAt}`;
  const sources = input.sources ?? loadStateArchiveSeed();
  const store = input.sourceRegistry ?? createInMemorySourceRegistry();

  const records: AdapterCandidateRecord[] = [];
  const sourceIds: string[] = [];

  for (const source of sources) {
    const registryEntry = ensureApprovedFindingAidSource(store, source, input.stampedAt, actor.id);
    sourceIds.push(source.sourceId);

    const collections = await input.adapter.listCollections(source.state);
    for (const collection of collections) {
      const candidateInputs = await input.adapter.extractCandidates(collection);
      for (const candidate of candidateInputs) {
        records.push(
          normalizeFindingAidCandidate({
            candidate,
            registryEntry,
            runId,
            capturedAt: input.stampedAt,
          }),
        );
      }
    }
  }

  if (records.length === 0) {
    throw new Error('County Archive Ladder campaign harvested no finding-aid candidates');
  }

  const maxCandidates = input.maxCandidates ?? 300;
  const boundedRecords = records.slice(0, maxCandidates);
  const pack = input.pack ?? defaultCountyArchivePack(input.stampedAt);

  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_county_archive_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: { countries: ['US'], adapterIds: [FINDING_AID_ADAPTER_ID] },
      continueOnQuarantine: true,
    }),
    records: boundedRecords,
    pack,
    runContext: {
      runId,
      adapterId: FINDING_AID_ADAPTER_ID,
      startedAt: input.stampedAt,
      entityKind: 'person',
      theme: 'civil_rights',
    },
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
    ...(input.catalogProfiles !== undefined
      ? { catalog: { profiles: input.catalogProfiles } }
      : {}),
  };

  const campaign = runDiscoveryCampaign(campaignInput);
  const survivors = listCampaignSurvivors(campaign);
  const yieldSummary = summarizeCampaignYield({ campaign });

  const corpus: ObscurityReferenceCorpus = { catalogTitles: input.catalogTitles };
  const assessments = survivors.map((candidate) =>
    scoreObscurity({ candidate, corpus, assessedAt: input.completedAt }),
  );
  const rankedAssessments = rankByObscurity(assessments);
  const byId = new Map<string, DiscoveryCandidateRecord>(survivors.map((c) => [c.id, c]));

  const ranked: CountyArchiveRankedLead[] = rankedAssessments.map((obscurity) => {
    const candidate = byId.get(obscurity.candidateId)!;
    const payload = (candidate.adapterRecord.payload ?? {}) as {
      readonly repository?: string;
      readonly state?: string;
    };
    return {
      candidateId: candidate.id,
      ...(candidate.adapterRecord.title !== undefined
        ? { title: candidate.adapterRecord.title }
        : {}),
      ...(candidate.adapterRecord.canonicalUrl !== undefined
        ? { canonicalUrl: candidate.adapterRecord.canonicalUrl }
        : {}),
      ...(payload.repository !== undefined ? { repository: payload.repository } : {}),
      ...(payload.state !== undefined ? { state: payload.state } : {}),
      obscurity,
    };
  });

  const editorialReviews = await runOptionalEditorialHook(
    input.editorialHook,
    survivors.map(toEditorialLeadPreview),
  );

  return {
    kind: COUNTY_ARCHIVE_CAMPAIGN_KIND,
    adapterId: FINDING_AID_ADAPTER_ID,
    sourceIds,
    campaign,
    yield: yieldSummary,
    ranked,
    editorialReviews,
    disclaimer: OBSCURITY_METHODOLOGY_DISCLAIMER,
    completedAt: input.completedAt,
  };
}
