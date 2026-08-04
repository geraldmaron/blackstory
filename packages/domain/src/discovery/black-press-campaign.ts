/**
 * Black Press newspaper archive discovery campaign (fixture-first, leads only).
 *
 * Digitized Black newspapers documented neighborhood-level Black history at a
 * granularity federal sources miss. Per research-kernel `black-history.v1`,
 * their index/OCR mentions are sourceClass `news-index-summary-or-search-result`
 * → fitness `leadOnly`: every survivor is a LEAD routed to relevance review.
 *
 * Enforced here:
 * - `assertCampaignCannotPublish` at entry; discovery never publishes (ADR-009).
 * - Theme query packs use only historical/geographic term classes, so black-press
 *   signals classify WEAK (`candidate_only`) — an OCR keyword hit never promotes.
 * - Obscurity (`obscurity.v1`) is attached to every research-eligible lead.
 * - Authority follow-ups are harvested from cited primary sources (LOC, NARA, …)
 *   via the `harvestAuthorityFollowUpsForCandidate` pattern — the newspaper index
 *   is the discovery surface; the cited archive is the evidence lead.
 * - No network: OCR bundles are supplied by callers (any live fetch happens
 *   upstream through `@repo/security` safe-fetch only).
 *
 * Mirrors rss-campaign.ts / web-search-campaign.ts shape.
 */
import {
  approveSourcePolicy,
  createInMemorySourceRegistry,
  type SourceRegistryEntry,
  type SourceRegistryStore,
} from '../adapters/index.js';
import {
  BLACK_PRESS_ADAPTER_ID,
  BLACK_PRESS_LEAD_ROUTE,
  BLACK_PRESS_SOURCE_FITNESS,
  createFixtureBlackPressAdapter,
  normalizeBlackPressMentions,
  registerBlackPressSource,
  type BlackPressAdapter,
  type BlackPressIssueOcr,
  type BlackPressOcrMention,
  type BlackPressOutlet,
} from '../adapters/black-press/index.js';
import { buildQueryPack, type QueryPack, type QueryTerm } from '../query-packs/index.js';
import type { QueryPackTheme } from '../query-packs/types.js';
import type { ResolutionProfile } from '../resolution/types.js';
import type { AuditActor } from '../audit/index.js';
import { harvestAuthorityFollowUpsForCandidate } from './authority-harvest.js';
import { createDiscoveryCampaignConfig } from './campaign.js';
import {
  assertCampaignCannotPublish,
  listCampaignSurvivors,
  partitionSurvivorsByRelevance,
  runOptionalEditorialHook,
  summarizeCampaignYield,
  toEditorialLeadPreview,
  type CampaignEditorialHook,
  type CampaignYieldSummary,
  type EditorialReviewResult,
} from './campaign-runner.js';
import {
  rankByObscurity,
  scoreObscurity,
  type ObscurityAssessment,
  type ObscurityReferenceCorpus,
} from './obscurity.js';
import { runDiscoveryCampaign, type RunDiscoveryCampaignInput } from './pipeline.js';
import type {
  AuthorityFollowUpLead,
  DiscoveryCampaignResult,
  DiscoveryCandidateRecord,
} from './types.js';

export const BLACK_PRESS_CAMPAIGN_KIND = 'black-press-discovery.v1' as const;

const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_MAX_QUARANTINED = 40;
const DEFAULT_MAX_DEAD_LETTER = 10;
const DEFAULT_MAX_RETRIES_PER_CANDIDATE = 2;

/**
 * Theme-keyed term packs for Black-press OCR matching.
 *
 * INTENTIONAL: no `positive` term class. classifySignalStrength then yields
 * `weak` / `candidate_only` for every match (period_term_without_positive /
 * geographic_without_positive) — a news-index mention is a lead, never an
 * independently promotable signal (fitness `leadOnly`).
 */
export const BLACK_PRESS_THEME_QUERY_TERMS: Readonly<
  Record<
    string,
    {
      readonly packTheme: QueryPackTheme;
      readonly displayName: string;
      readonly terms: readonly QueryTerm[];
    }
  >
> = {
  redlining: {
    packTheme: 'historical_place',
    displayName: 'Black press — redlining and housing exclusion',
    terms: [
      { text: 'redlining', termClass: 'historical' },
      { text: 'FHA', termClass: 'historical' },
      { text: 'HOLC', termClass: 'historical' },
      // Period language from HOLC security maps: retained for research recall,
      // never default public language.
      { text: 'colored grade', termClass: 'historical', researchOnlyOffensive: true },
      { text: 'restrictive covenant', termClass: 'historical' },
      { text: 'housing project', termClass: 'historical' },
    ],
  },
  school_segregation: {
    packTheme: 'education_segregation',
    displayName: 'Black press — school segregation and equalization',
    terms: [
      { text: 'segregated school', termClass: 'historical' },
      { text: 'school board', termClass: 'historical' },
      { text: 'teacher salary equalization', termClass: 'historical' },
      { text: 'school bond', termClass: 'historical' },
    ],
  },
  civil_rights_organizing: {
    packTheme: 'civil_rights',
    displayName: 'Black press — local civil-rights organizing',
    terms: [
      { text: 'NAACP branch', termClass: 'historical' },
      { text: 'mass meeting', termClass: 'historical' },
      { text: 'voter registration', termClass: 'historical' },
      { text: 'boycott', termClass: 'historical' },
    ],
  },
} as const;

export type BlackPressCampaignTheme = keyof typeof BLACK_PRESS_THEME_QUERY_TERMS;

/** Build the versioned query pack for a black-press theme (reuses buildQueryPack). */
export function buildBlackPressQueryPack(
  theme: BlackPressCampaignTheme,
  createdAt: string,
): QueryPack {
  const spec = BLACK_PRESS_THEME_QUERY_TERMS[theme];
  if (!spec) {
    throw new Error(
      `Unknown black-press theme "${String(theme)}"; known: ${Object.keys(
        BLACK_PRESS_THEME_QUERY_TERMS,
      ).join(', ')}`,
    );
  }
  return buildQueryPack({
    id: `qp-black-press-${theme}`,
    displayName: spec.displayName,
    entityKind: 'place',
    theme: spec.packTheme,
    semver: '1.0.0',
    createdAt,
    terms: spec.terms,
    notes:
      'Black press news-index terms. No positive class by design: matches classify weak ' +
      '(candidate_only) and route to relevance_review as leadOnly.',
  });
}

export type BlackPressRankedLead = {
  readonly candidateId: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly outletId?: string;
  readonly signalStrength: DiscoveryCandidateRecord['signals']['strength'];
  readonly obscurityScore: number;
  readonly obscurityBand: ObscurityAssessment['band'];
  readonly fitness: typeof BLACK_PRESS_SOURCE_FITNESS;
  readonly route: typeof BLACK_PRESS_LEAD_ROUTE;
};

export type BlackPressCampaignResult = {
  readonly kind: typeof BLACK_PRESS_CAMPAIGN_KIND;
  readonly theme: BlackPressCampaignTheme;
  readonly outletIds: readonly string[];
  readonly campaign: DiscoveryCampaignResult;
  /** Obscurity-ranked research-eligible leads (all leadOnly → relevance_review). */
  readonly ranked: readonly BlackPressRankedLead[];
  readonly obscurity: readonly ObscurityAssessment[];
  /** Primary-source follow-ups cited by articles (LOC, NARA, NPS, …). */
  readonly authorityFollowUps: readonly AuthorityFollowUpLead[];
  readonly yield: CampaignYieldSummary;
  readonly editorialResults?: readonly EditorialReviewResult[];
  readonly completedAt: string;
};

export type RunBlackPressCampaignInput = {
  /** Seeded outlets (typically parsed from fixtures/black-press-outlets.v1.json). */
  readonly outlets: readonly BlackPressOutlet[];
  /** Ephemeral OCR bundles keyed by outlet id. Never persisted beyond snippets. */
  readonly issueOcrByOutletId: ReadonlyMap<string, readonly BlackPressIssueOcr[]>;
  readonly stampedAt: string;
  readonly completedAt: string;
  /** Theme query pack key (default 'redlining'). Ignored when `pack` is supplied. */
  readonly theme?: BlackPressCampaignTheme;
  readonly pack?: QueryPack;
  readonly campaignId?: string;
  readonly runId?: string;
  readonly maxCandidates?: number;
  /** Custom mention extraction; defaults to the deterministic fixture adapter. */
  readonly adapter?: BlackPressAdapter;
  readonly sourceRegistry?: SourceRegistryStore;
  readonly operatorActor?: AuditActor;
  /** Reference corpus for obscurity IDF (defaults to empty catalog). */
  readonly obscurityCorpus?: ObscurityReferenceCorpus;
  /** Optional catalog profiles for soft propose/review match (never hard-exclude). */
  readonly catalogProfiles?: readonly ResolutionProfile[];
  readonly editorialHook?: CampaignEditorialHook;
  readonly enableRelevancePartition?: boolean;
};

/**
 * Run-scoped in-memory policy approval so the campaign can process fixture
 * batches. The durable registration (`registerBlackPressSource`) stays
 * `disabled` — this mirrors ensureApprovedRssRegistry in rss-campaign.ts and
 * never flips any persisted registry state.
 */
function ensureApprovedBlackPressRegistry(
  store: SourceRegistryStore,
  now: string,
): SourceRegistryEntry {
  const existing = store.get('reg_black_press');
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  if (!existing) {
    registerBlackPressSource(store, { createdAt: now });
  }
  return approveSourcePolicy(store, {
    id: 'reg_black_press',
    approvedBy: 'black-press-campaign',
    approvedAt: now,
  });
}

function outletIdOf(candidate: DiscoveryCandidateRecord): string | undefined {
  const outletId = candidate.adapterRecord.payload?.outletId;
  return typeof outletId === 'string' ? outletId : undefined;
}

function toRankedLead(
  candidate: DiscoveryCandidateRecord,
  assessment: ObscurityAssessment,
): BlackPressRankedLead {
  const outletId = outletIdOf(candidate);
  return {
    candidateId: candidate.id,
    ...(candidate.adapterRecord.title !== undefined
      ? { title: candidate.adapterRecord.title }
      : {}),
    ...(candidate.adapterRecord.canonicalUrl !== undefined
      ? { canonicalUrl: candidate.adapterRecord.canonicalUrl }
      : {}),
    ...(outletId !== undefined ? { outletId } : {}),
    signalStrength: candidate.signals.strength,
    obscurityScore: assessment.score,
    obscurityBand: assessment.band,
    fitness: BLACK_PRESS_SOURCE_FITNESS,
    route: BLACK_PRESS_LEAD_ROUTE,
  };
}

/** Join full ephemeral OCR text per stable identifier prefix for authority harvest. */
function ocrTextByOutlet(
  issueOcrByOutletId: ReadonlyMap<string, readonly BlackPressIssueOcr[]>,
): ReadonlyMap<string, string> {
  const byOutlet = new Map<string, string>();
  for (const [outletId, issues] of issueOcrByOutletId) {
    const text = issues.flatMap((issue) => issue.pages.map((page) => page.text)).join('\n\n');
    byOutlet.set(outletId, text);
  }
  return byOutlet;
}

/**
 * Run a fixture-first Black-press discovery campaign.
 * Private candidates only — leads route to relevance_review; never publishes.
 */
export async function runBlackPressCampaign(
  input: RunBlackPressCampaignInput,
): Promise<BlackPressCampaignResult> {
  assertCampaignCannotPublish();

  const theme: BlackPressCampaignTheme = input.theme ?? 'redlining';
  const pack = input.pack ?? buildBlackPressQueryPack(theme, input.stampedAt);
  const adapter = input.adapter ?? createFixtureBlackPressAdapter({});
  const sourceRegistry = input.sourceRegistry ?? createInMemorySourceRegistry();
  const registryEntry = ensureApprovedBlackPressRegistry(sourceRegistry, input.stampedAt);
  const runId = input.runId ?? `run_black_press_${input.stampedAt}`;

  const outletsById = new Map(input.outlets.map((outlet) => [outlet.id, outlet]));
  const outletIds: string[] = [];
  const mentions: BlackPressOcrMention[] = [];

  for (const [outletId, issues] of input.issueOcrByOutletId) {
    if (!outletsById.has(outletId)) {
      throw new Error(`OCR supplied for unseeded outlet "${outletId}"; seed it in outlets first`);
    }
    outletIds.push(outletId);
    for (const issueOcr of issues) {
      mentions.push(...(await adapter.extractMentions(issueOcr)));
    }
  }

  if (mentions.length === 0) {
    throw new Error('Black-press campaign extracted no mentions from the supplied issue OCR');
  }

  // Normalize + dedupe by stable identifier; pipeline dedupes again by content hash.
  const records = normalizeBlackPressMentions({
    mentions,
    registryEntry,
    runId,
    capturedAt: input.stampedAt,
    outletsById,
  });

  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_black_press_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates: input.maxCandidates ?? DEFAULT_MAX_CANDIDATES,
        maxQuarantined: DEFAULT_MAX_QUARANTINED,
        maxDeadLetter: DEFAULT_MAX_DEAD_LETTER,
        maxRetriesPerCandidate: DEFAULT_MAX_RETRIES_PER_CANDIDATE,
      },
      boundaries: { countries: ['US'], adapterIds: [BLACK_PRESS_ADAPTER_ID] },
      continueOnQuarantine: true,
    }),
    records,
    pack,
    runContext: {
      runId,
      adapterId: BLACK_PRESS_ADAPTER_ID,
      startedAt: input.stampedAt,
      entityKind: pack.entityKind,
      theme: pack.theme,
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
    enabled: input.enableRelevancePartition === true,
  });

  // Authority harvest (harvestAuthorityFollowUpsForCandidate pattern): the
  // article's cited primary sources become follow-up leads; ephemeral OCR text
  // is passed per candidate for richer extraction and never persisted.
  const ocrByOutlet = ocrTextByOutlet(input.issueOcrByOutletId);
  const authorityFollowUps: AuthorityFollowUpLead[] = [];
  for (const candidate of survivors) {
    const outletId = outletIdOf(candidate);
    const sourceText = outletId !== undefined ? ocrByOutlet.get(outletId) : undefined;
    authorityFollowUps.push(
      ...harvestAuthorityFollowUpsForCandidate({
        candidate,
        harvestedAt: input.completedAt,
        ...(sourceText !== undefined ? { sourceText } : {}),
      }),
    );
  }

  // Obscurity scoring on research-eligible leads, ranked most-obscure first.
  const corpus: ObscurityReferenceCorpus = input.obscurityCorpus ?? { catalogTitles: [] };
  const assessmentsById = new Map<string, ObscurityAssessment>();
  const candidatesById = new Map<string, DiscoveryCandidateRecord>();
  for (const candidate of partition.researchEligible) {
    candidatesById.set(candidate.id, candidate);
    assessmentsById.set(
      candidate.id,
      scoreObscurity({ candidate, corpus, assessedAt: input.completedAt }),
    );
  }
  const rankedAssessments = rankByObscurity([...assessmentsById.values()]);
  const ranked = rankedAssessments.map((assessment) => {
    const candidate = candidatesById.get(assessment.candidateId);
    if (!candidate) {
      throw new Error(`Obscurity assessment for unknown candidate ${assessment.candidateId}`);
    }
    return toRankedLead(candidate, assessment);
  });

  const yieldSummary = summarizeCampaignYield({
    campaign,
    graylistedCount: partition.graylisted.length,
    researchEligibleCount: partition.researchEligible.length,
  });

  const rankedCandidates = rankedAssessments
    .map((assessment) => candidatesById.get(assessment.candidateId))
    .filter((candidate): candidate is DiscoveryCandidateRecord => candidate !== undefined);
  const editorialResults = await runOptionalEditorialHook(
    input.editorialHook,
    rankedCandidates.map(toEditorialLeadPreview),
  );

  return {
    kind: BLACK_PRESS_CAMPAIGN_KIND,
    theme,
    outletIds,
    campaign,
    ranked,
    obscurity: rankedAssessments,
    authorityFollowUps,
    yield: yieldSummary,
    ...(editorialResults.length > 0 ? { editorialResults } : {}),
    completedAt: input.completedAt,
  };
}
