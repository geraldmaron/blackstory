/**
 * Wikimedia + federal fan-out discovery campaign (fixture-first, never publishes).
 *
 * Methodology:
 * - Each adapter family normalizes independently (no shared mashup normalize path).
 * - Concatenated `AdapterCandidateRecord[]` feed one `runDiscoveryCampaign` with
 *   `boundaries.adapterIds` listing every participating adapter.
 * - Sub-budget policy: when `maxCandidates >= 100 + federalCount`, Wikimedia reserves
 *   100 slots and the remainder splits equally across federal families (LOC, NARA, NPS,
 *   school-history, federal DPLA). Below that threshold, budget splits equally across
 *   all six adapters so small dry-runs still fan out.
 * - Provenance: each record keeps its source `adapterId` through ingest and survivors.
 *
 * DPLA split: this campaign uses the federal `dpla-items-v1` fixture family only.
 * Live DPLA v2 discovery is owned separately by the archive-dpla bead.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  registerSource,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import {
  DPLA_ADAPTER_ID,
  FEDERAL_ADAPTER_DEFINITIONS,
  LOC_ADAPTER_ID,
  NARA_ADAPTER_ID,
  NPS_ADAPTER_ID,
  SCHOOL_HISTORY_ADAPTER_ID,
  parseFederalFixtureBatch,
  type FederalAdapterDefinition,
} from '../adapters/federal/index.js';
import {
  createWikimediaAdapterContract,
  normalizeWikimediaBulkBatch,
  parseWikimediaBulkBatch,
  WIKIMEDIA_ADAPTER_ID,
} from '../adapters/wikimedia/index.js';
import type { AdapterCandidateRecord } from '../adapters/types.js';
import { buildQueryPack, type QueryPack } from '../query-packs/index.js';
import { createDiscoveryCampaignConfig } from './campaign.js';
import {
  listCampaignSurvivors,
  partitionSurvivorsByRelevance,
  runOptionalEditorialHook,
  summarizeCampaignYield,
  toEditorialLeadPreview,
  type CampaignEditorialHook,
  type CampaignYieldSummary,
  type EditorialReviewResult,
} from './campaign-runner.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type { DiscoveryCampaignResult } from './types.js';
import type { ResolutionProfile } from '../resolution/types.js';

export const WIKIMEDIA_FEDERAL_CAMPAIGN_KIND = 'wikimedia-federal-discovery.v1' as const;

/** Wikimedia reserve slice when total budget is large enough to fan out federally. */
export const WIKIMEDIA_SUB_BUDGET_RESERVE = 100 as const;

export const PARTICIPATING_ADAPTER_IDS = [
  WIKIMEDIA_ADAPTER_ID,
  LOC_ADAPTER_ID,
  NARA_ADAPTER_ID,
  NPS_ADAPTER_ID,
  SCHOOL_HISTORY_ADAPTER_ID,
  DPLA_ADAPTER_ID,
] as const;

export type WikimediaFederalPerAdapterYield = {
  readonly adapterId: string;
  readonly normalized: number;
  readonly sliced: number;
};

export type WikimediaFederalCampaignResult = {
  readonly kind: typeof WIKIMEDIA_FEDERAL_CAMPAIGN_KIND;
  readonly adapterIds: readonly string[];
  readonly perAdapterYield: readonly WikimediaFederalPerAdapterYield[];
  readonly campaign: DiscoveryCampaignResult;
  readonly summary: CampaignYieldSummary;
  readonly editorial?: readonly EditorialReviewResult[];
  readonly completedAt: string;
};

export type RunWikimediaFederalCampaignInput = {
  readonly stampedAt: string;
  readonly completedAt: string;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly maxCandidates?: number;
  readonly pack?: QueryPack;
  readonly editorialHook?: CampaignEditorialHook;
  readonly relevancePartition?: boolean;
  readonly sourceRegistry?: SourceRegistryStore;
  /** Override federal fixture root (tests). */
  readonly federalFixturesRoot?: string;
  /** Override wikimedia bulk fixture path (tests). */
  readonly wikimediaFixturePath?: string;
  /** Optional catalog profiles for soft propose/review match (never hard-exclude). */
  readonly catalogProfiles?: readonly ResolutionProfile[];
};

const DOMAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WIKIMEDIA_FIXTURE = join(
  DOMAIN_ROOT,
  'adapters',
  'wikimedia',
  'fixtures',
  'wikimedia-bulk-batch.json',
);
const DEFAULT_FEDERAL_FIXTURES_ROOT = join(DOMAIN_ROOT, 'adapters', 'federal');

const FEDERAL_FIXTURE_RELATIVE: Readonly<Record<string, string>> = {
  [LOC_ADAPTER_ID]: 'loc/fixtures/sample-export.json',
  [NARA_ADAPTER_ID]: 'nara/fixtures/sample-export.json',
  [NPS_ADAPTER_ID]: 'nps/fixtures/sample-export.json',
  [SCHOOL_HISTORY_ADAPTER_ID]: 'school-history/fixtures/sample-export.json',
  [DPLA_ADAPTER_ID]: 'dpla/fixtures/sample-export.json',
};

function defaultCampaignPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-wikimedia-federal',
    displayName: 'Wikimedia + federal discovery',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'Rosa Parks', termClass: 'historical' },
      { text: 'Buffalo Soldiers', termClass: 'historical' },
      { text: 'Montgomery', termClass: 'geographic' },
      { text: 'National Register', termClass: 'historical' },
      { text: 'school', termClass: 'modern' },
    ],
  });
}

function approvedFederalRegistryEntry(
  definition: FederalAdapterDefinition,
  store: SourceRegistryStore,
  now: string,
): SourceRegistryEntry {
  const regId = `reg_${definition.family}`;
  const existing = store.get(regId);
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  if (!existing) {
    registerSource(store, {
      id: regId,
      contract: definition.contract,
      evidenceSource: {
        ...definition.evidenceSource,
        createdAt: now,
        updatedAt: now,
      },
      createdAt: now,
    });
  }
  return approveSourcePolicy(store, {
    id: regId,
    approvedBy: 'wikimedia-federal-campaign',
    approvedAt: now,
  });
}

function approvedWikimediaRegistryEntry(
  store: SourceRegistryStore,
  now: string,
): SourceRegistryEntry {
  const regId = 'reg_wikimedia_federal';
  const existing = store.get(regId);
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  const contract = createWikimediaAdapterContract();
  const entry: SourceRegistryEntry = {
    id: regId,
    contract,
    evidenceSource: {
      id: 'src_wikimedia_federal',
      organizationId: 'org_wikimedia',
      displayName: 'Wikimedia Discovery (federal campaign)',
      classification: contract.classification,
      adapterId: WIKIMEDIA_ADAPTER_ID,
      stableIdScheme: contract.stableIdScheme,
      policy: contract.policy,
      adapterEnabled: true,
      killSwitchId: 'source-adapter-wikimedia-discovery-v1',
      createdAt: now,
      updatedAt: now,
    },
    registryState: 'approved',
    approvedAt: now,
    approvedBy: 'wikimedia-federal-campaign',
    createdAt: now,
    updatedAt: now,
  };
  store.save(entry);
  return entry;
}

/**
 * Compute per-adapter candidate slices from shared `maxCandidates`.
 * See file header for reserve vs equal-split policy.
 */
export function computeAdapterSubBudgets(
  maxCandidates: number,
  adapterIds: readonly string[] = PARTICIPATING_ADAPTER_IDS,
): ReadonlyMap<string, number> {
  if (maxCandidates < 1) {
    throw new Error('maxCandidates must be at least 1');
  }
  const budgets = new Map<string, number>();
  const federalIds = adapterIds.filter((id) => id !== WIKIMEDIA_ADAPTER_ID);
  const reserveThreshold = WIKIMEDIA_SUB_BUDGET_RESERVE + federalIds.length;

  if (adapterIds.includes(WIKIMEDIA_ADAPTER_ID) && maxCandidates >= reserveThreshold) {
    budgets.set(WIKIMEDIA_ADAPTER_ID, WIKIMEDIA_SUB_BUDGET_RESERVE);
    const remaining = maxCandidates - WIKIMEDIA_SUB_BUDGET_RESERVE;
    const perFederal = Math.floor(remaining / federalIds.length);
    let extra = remaining - perFederal * federalIds.length;
    for (const adapterId of federalIds) {
      let slice = perFederal;
      if (extra > 0) {
        slice += 1;
        extra -= 1;
      }
      budgets.set(adapterId, slice);
    }
    return budgets;
  }

  const base = Math.floor(maxCandidates / adapterIds.length);
  let extra = maxCandidates - base * adapterIds.length;
  for (const adapterId of adapterIds) {
    let slice = base;
    if (extra > 0) {
      slice += 1;
      extra -= 1;
    }
    budgets.set(adapterId, slice);
  }
  return budgets;
}

function loadJsonFixture(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function normalizeWikimediaFromFixture(input: {
  readonly fixturePath: string;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
}): readonly AdapterCandidateRecord[] {
  const batch = parseWikimediaBulkBatch(loadJsonFixture(input.fixturePath));
  const candidates = normalizeWikimediaBulkBatch(batch, {
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
  });
  return candidates.filter((candidate) => candidate.payload.categoryGate.passed);
}

function sliceRecords(
  records: readonly AdapterCandidateRecord[],
  limit: number,
): readonly AdapterCandidateRecord[] {
  if (limit <= 0) return [];
  return records.slice(0, limit);
}

/**
 * Fan-out Wikimedia + federal fixtures through discovery. Private candidates only.
 */
export async function runWikimediaFederalCampaign(
  input: RunWikimediaFederalCampaignInput,
): Promise<WikimediaFederalCampaignResult> {
  const runId = input.runId ?? `run_wikimedia_federal_${input.stampedAt}`;
  const maxCandidates = input.maxCandidates ?? 500;
  const federalFixturesRoot = input.federalFixturesRoot ?? DEFAULT_FEDERAL_FIXTURES_ROOT;
  const wikimediaFixturePath = input.wikimediaFixturePath ?? DEFAULT_WIKIMEDIA_FIXTURE;

  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();
  const wikimediaEntry = approvedWikimediaRegistryEntry(sourceRegistry, input.stampedAt);

  const subBudgets = computeAdapterSubBudgets(maxCandidates, PARTICIPATING_ADAPTER_IDS);
  const perAdapterYield: WikimediaFederalPerAdapterYield[] = [];
  const records: AdapterCandidateRecord[] = [];

  const wikimediaNormalized = normalizeWikimediaFromFixture({
    fixturePath: wikimediaFixturePath,
    registryEntry: wikimediaEntry,
    runId,
    capturedAt: input.stampedAt,
  });
  const wikimediaSliced = sliceRecords(
    wikimediaNormalized,
    subBudgets.get(WIKIMEDIA_ADAPTER_ID) ?? 0,
  );
  perAdapterYield.push({
    adapterId: WIKIMEDIA_ADAPTER_ID,
    normalized: wikimediaNormalized.length,
    sliced: wikimediaSliced.length,
  });
  records.push(...wikimediaSliced);

  for (const definition of FEDERAL_ADAPTER_DEFINITIONS) {
    const fixtureRelative = FEDERAL_FIXTURE_RELATIVE[definition.adapterId];
    if (fixtureRelative === undefined) continue;

    const registryEntry = approvedFederalRegistryEntry(definition, sourceRegistry, input.stampedAt);
    const raw = loadJsonFixture(join(federalFixturesRoot, fixtureRelative));
    const normalized = parseFederalFixtureBatch(
      definition,
      registryEntry,
      runId,
      input.stampedAt,
      raw,
    ).candidates;
    const sliced = sliceRecords(normalized, subBudgets.get(definition.adapterId) ?? 0);
    perAdapterYield.push({
      adapterId: definition.adapterId,
      normalized: normalized.length,
      sliced: sliced.length,
    });
    records.push(...sliced);
  }

  if (records.length === 0) {
    throw new Error('Wikimedia+federal campaign produced no fixture candidates after slicing');
  }

  const pack = input.pack ?? defaultCampaignPack(input.stampedAt);
  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_wikimedia_federal_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: {
        countries: ['US'],
        adapterIds: [...PARTICIPATING_ADAPTER_IDS],
      },
      continueOnQuarantine: true,
    }),
    records,
    pack,
    runContext: {
      runId,
      adapterId: WIKIMEDIA_ADAPTER_ID,
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
  const partition = partitionSurvivorsByRelevance({
    survivors,
    assessedAt: input.completedAt,
    ...(input.relevancePartition === true ? { enabled: true } : {}),
  });
  const summary = summarizeCampaignYield({
    campaign,
    graylistedCount: partition.graylisted.length,
    researchEligibleCount: partition.researchEligible.length,
  });

  let editorial: readonly EditorialReviewResult[] | undefined;
  if (input.editorialHook) {
    const previews = partition.researchEligible.map((candidate) =>
      toEditorialLeadPreview(candidate),
    );
    editorial = await runOptionalEditorialHook(input.editorialHook, previews);
  }

  return {
    kind: WIKIMEDIA_FEDERAL_CAMPAIGN_KIND,
    adapterIds: PARTICIPATING_ADAPTER_IDS,
    perAdapterYield,
    campaign,
    summary,
    ...(editorial !== undefined && editorial.length > 0 ? { editorial } : {}),
    completedAt: input.completedAt,
  };
}
