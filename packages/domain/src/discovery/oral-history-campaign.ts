/**
 * Oral History Pipeline discovery campaign.
 *
 * Walks seeded oral-history collections (LOC American Folklife Center / Civil Rights History
 * Project, StoryCorps, UNC SOHP, Duke Behind the Veil, HBCU collections as they are confirmed)
 * via an injected `OralHistoryAdapter`, extracts person/place/event mentions from interview
 * transcripts/summaries, runs them through the standard discovery pipeline (ingestion → signals
 * → deduplication → boundary gate), scores survivors for catalog-relative obscurity
 * (`scoreObscurity`), and harvests outbound primary-source links cited in transcripts as
 * authority follow-ups. Mirrors `county-archive-campaign.ts` / `community-obscurity-campaign.ts`.
 *
 * Why this lane scores obscure: oral-history subjects — church mothers, midwives, freedom-school
 * teachers — almost never carry trusted identifiers (wikidata/loc/viaf/…), so
 * `identifierSparseness` boosts them, and the `community_oral` classification adds the
 * low-authority discovery boost. That is exactly the nooks-and-crannies yield this
 * methodology exists for.
 *
 * Invariants:
 * - Private candidates only. `assertCampaignCannotPublish()` runs before any yield. No public
 *   projection, release, or canonical write path exists here (ADR-009).
 * - Sources register DISABLED (`registerOralHistorySource`); the campaign approves policy at
 *   run time via `approveSourcePolicy`, exactly like the other fixture-first campaigns.
 * - Fixture-first: the campaign performs no network I/O. A live `OralHistoryAdapter` MUST use
 *   `@repo/security` safe-fetch. Tests inject an inline deterministic adapter.
 * - Dignity: snippets are capped and residential precision withheld at normalization; unknown
 *   living status is treated as living.
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
  ORAL_HISTORY_ADAPTER_ID,
  extractCitedUrlHints,
  normalizeOralHistoryMention,
  registerOralHistorySource,
  type OralHistoryAdapter,
  type OralHistoryMentionKind,
  type OralHistorySource,
  type OralHistoryTranscript,
} from '../adapters/oral-history/index.js';
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
import type {
  AuthorityFollowUpLead,
  DiscoveryCampaignResult,
  DiscoveryCandidateRecord,
} from './types.js';

export const ORAL_HISTORY_CAMPAIGN_KIND = 'oral-history-pipeline.v1' as const;

export type OralHistoryRankedLead = {
  readonly candidateId: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly mentionKind?: OralHistoryMentionKind;
  readonly collectionId?: string;
  readonly institution?: string;
  readonly obscurity: ObscurityAssessment;
  /** Primary-source links cited in the transcript near this mention (authority harvest). */
  readonly authorityFollowUpCount: number;
};

export type OralHistoryCampaignResult = {
  readonly kind: typeof ORAL_HISTORY_CAMPAIGN_KIND;
  readonly adapterId: typeof ORAL_HISTORY_ADAPTER_ID;
  readonly sourceIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly campaign: DiscoveryCampaignResult;
  readonly yield: CampaignYieldSummary;
  readonly ranked: readonly OralHistoryRankedLead[];
  readonly authorityFollowUps: readonly AuthorityFollowUpLead[];
  readonly editorialReviews: readonly EditorialReviewResult[];
  readonly disclaimer: typeof OBSCURITY_METHODOLOGY_DISCLAIMER;
  readonly completedAt: string;
};

export type RunOralHistoryCampaignInput = {
  /** Harvester over interviews. Inline/deterministic in tests; safe-fetch-backed in prod. */
  readonly adapter: OralHistoryAdapter;
  /** Seeded oral-history sources to walk. Defaults to `loadOralHistoryCollectionSeed()`. */
  readonly sources?: readonly OralHistorySource[];
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
  'oral-history',
  'fixtures',
  'oral-history-collections.v1.json',
);

/** Load the real oral-history collection seed shipped with the adapter fixtures. */
export function loadOralHistoryCollectionSeed(): readonly OralHistorySource[] {
  const parsed = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as {
    readonly sources?: readonly OralHistorySource[];
  };
  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error('oral-history-collections.v1.json has no sources');
  }
  return parsed.sources;
}

function defaultOralHistoryPack(createdAt: string): QueryPack {
  return buildQueryPack({
    id: 'qp-oral-history-pipeline',
    displayName: 'Oral History Pipeline discovery',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt,
    terms: [
      { text: 'NAACP', termClass: 'historical' },
      { text: 'freedom school', termClass: 'historical' },
      { text: 'sharecropping', termClass: 'historical' },
      { text: 'church', termClass: 'modern' },
      { text: 'school', termClass: 'modern' },
      { text: 'county', termClass: 'geographic' },
    ],
  });
}

function ensureApprovedOralHistorySource(
  store: SourceRegistryStore,
  source: OralHistorySource,
  now: string,
  approvedBy: string,
): SourceRegistryEntry {
  const existing = store.get(source.registryEntryId);
  if (existing?.registryState === 'approved' || existing?.registryState === 'canary') {
    return existing;
  }
  if (!existing) {
    registerOralHistorySource({ store, source, createdAt: now });
  }
  return approveSourcePolicy(store, {
    id: source.registryEntryId,
    approvedBy,
    approvedAt: now,
  });
}

/**
 * Run the Oral History Pipeline over seeded collections. Private candidates only.
 */
export async function runOralHistoryCampaign(
  input: RunOralHistoryCampaignInput,
): Promise<OralHistoryCampaignResult> {
  assertCampaignCannotPublish();

  const actor: AuditActor = input.operatorActor ?? {
    id: 'oral-history-campaign',
    type: 'system',
  };
  const runId = input.runId ?? `run_oral_history_${input.stampedAt}`;
  const sources = input.sources ?? loadOralHistoryCollectionSeed();
  const store = input.sourceRegistry ?? createInMemorySourceRegistry();

  const records: AdapterCandidateRecord[] = [];
  const sourceIds: string[] = [];
  const collectionIds: string[] = [];

  for (const source of sources) {
    const registryEntry = ensureApprovedOralHistorySource(store, source, input.stampedAt, actor.id);
    sourceIds.push(source.sourceId);

    for (const collection of source.collections) {
      collectionIds.push(collection.collectionId);
      const interviews = await input.adapter.listInterviews(collection);
      for (const interview of interviews) {
        // Transcript text is EPHEMERAL: used for mention extraction and cited-URL hints in
        // this call only; it is never persisted on a candidate.
        const transcript: OralHistoryTranscript = {
          interview,
          text: interview.transcriptText ?? interview.summary ?? '',
        };
        const mentions = await input.adapter.extractMentions(transcript);
        const transcriptLinkHints = extractCitedUrlHints(transcript.text);
        for (const mention of mentions) {
          records.push(
            normalizeOralHistoryMention({
              mention,
              interview,
              collection,
              registryEntry,
              runId,
              capturedAt: input.stampedAt,
              ...(transcriptLinkHints.length > 0 ? { extraLinkHints: transcriptLinkHints } : {}),
            }),
          );
        }
      }
    }
  }

  if (records.length === 0) {
    throw new Error('Oral History Pipeline campaign extracted no transcript mentions');
  }

  const maxCandidates = input.maxCandidates ?? 300;
  const boundedRecords = records.slice(0, maxCandidates);
  const pack = input.pack ?? defaultOralHistoryPack(input.stampedAt);

  const campaignInput: RunDiscoveryCampaignInput = {
    config: createDiscoveryCampaignConfig({
      campaignId: input.campaignId ?? `camp_oral_history_${input.stampedAt.slice(0, 10)}`,
      budget: {
        maxCandidates,
        maxQuarantined: 40,
        maxDeadLetter: 10,
        maxRetriesPerCandidate: 2,
      },
      boundaries: { countries: ['US'], adapterIds: [ORAL_HISTORY_ADAPTER_ID] },
      continueOnQuarantine: true,
    }),
    records: boundedRecords,
    pack,
    runContext: {
      runId,
      adapterId: ORAL_HISTORY_ADAPTER_ID,
      startedAt: input.stampedAt,
      entityKind: 'person',
      theme: 'civil_rights',
    },
    stampedAt: input.stampedAt,
    completedAt: input.completedAt,
    // Reuse authority-harvest: `community_oral` is a low-authority tier, so outbound
    // primary-source links (loc.gov, nps.gov, archives.gov, …) cited in transcripts become
    // follow-up evidence leads. The interview index is a discovery index, not a fact source.
    authorityHarvest: { enabled: true },
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

  const followUps = campaign.authorityFollowUps ?? [];
  const followUpCounts = new Map<string, number>();
  for (const lead of followUps) {
    followUpCounts.set(
      lead.parentCandidateId,
      (followUpCounts.get(lead.parentCandidateId) ?? 0) + 1,
    );
  }

  const ranked: OralHistoryRankedLead[] = rankedAssessments.map((obscurity) => {
    const candidate = byId.get(obscurity.candidateId)!;
    const payload = (candidate.adapterRecord.payload ?? {}) as {
      readonly mentionKind?: OralHistoryMentionKind;
      readonly collectionId?: string;
      readonly institution?: string;
    };
    return {
      candidateId: candidate.id,
      ...(candidate.adapterRecord.title !== undefined
        ? { title: candidate.adapterRecord.title }
        : {}),
      ...(candidate.adapterRecord.canonicalUrl !== undefined
        ? { canonicalUrl: candidate.adapterRecord.canonicalUrl }
        : {}),
      ...(payload.mentionKind !== undefined ? { mentionKind: payload.mentionKind } : {}),
      ...(payload.collectionId !== undefined ? { collectionId: payload.collectionId } : {}),
      ...(payload.institution !== undefined ? { institution: payload.institution } : {}),
      obscurity,
      authorityFollowUpCount: followUpCounts.get(candidate.id) ?? 0,
    };
  });

  const editorialReviews = await runOptionalEditorialHook(
    input.editorialHook,
    survivors.map(toEditorialLeadPreview),
  );

  return {
    kind: ORAL_HISTORY_CAMPAIGN_KIND,
    adapterId: ORAL_HISTORY_ADAPTER_ID,
    sourceIds,
    collectionIds,
    campaign,
    yield: yieldSummary,
    ranked,
    authorityFollowUps: followUps,
    editorialReviews,
    disclaimer: OBSCURITY_METHODOLOGY_DISCLAIMER,
    completedAt: input.completedAt,
  };
}
