/**
 * Shared helpers for fixture-first discovery campaign runners.
 *
 * Challenges baked in:
 * - "Accepted" from `runDiscoveryCampaign` means boundary-pass, not research-worthy.
 *   Optional graylist parking partitions survivors after the gate.
 * - Snippet doctrine is enforced on adapter payloads before we trust yield numbers.
 * - Optional LLM/editorial is a post-rank hook only — never inside ingest.
 * - Discovery never publishes (`assertDiscoveryCannotPublish` on every summary).
 */
import {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
} from '../rights/evidence-pointer.js';
import { evaluateCandidateRelevance } from '../relevance/index.js';
import {
  FORBIDDEN_DISCOVERY_OPERATIONS,
  assertDiscoveryCannotPublish,
  type DiscoveryOperationAttempt,
} from './guard.js';
import {
  createInMemoryGraylistStore,
  parkCandidate,
  shouldPark,
  type GraylistEntry,
  type GraylistStore,
} from './graylist.js';
import type { DiscoveryCampaignResult, DiscoveryCandidateRecord } from './types.js';

export const CAMPAIGN_RUNNER_HELPERS_VERSION = 'campaign-runner-helpers.v1' as const;

export type CampaignYieldSummary = {
  readonly helpersVersion: typeof CAMPAIGN_RUNNER_HELPERS_VERSION;
  readonly accepted: number;
  readonly merged: number;
  readonly quarantined: number;
  readonly deadLetter: number;
  readonly survivors: number;
  readonly graylisted: number;
  readonly researchEligible: number;
};

export type EditorialLeadPreview = {
  readonly candidateId: string;
  readonly title?: string;
  readonly summary?: string;
  readonly canonicalUrl?: string;
};

export type EditorialReviewDecision = 'keep' | 'reject' | 'needs_evidence';

export type EditorialReviewResult = {
  readonly candidateId: string;
  readonly decision: EditorialReviewDecision;
  readonly reason: string;
};

/**
 * Optional post-rank editorial/LLM hook. Deterministic campaigns remain valid when omitted.
 * Implementations must not fetch, persist, or publish.
 */
export type CampaignEditorialHook = {
  readonly reviewTopN: number;
  readonly review: (
    leads: readonly EditorialLeadPreview[],
  ) => Promise<readonly EditorialReviewResult[]> | readonly EditorialReviewResult[];
};

/**
 * Boundary check before yielding campaign results.
 * - No attempt: confirms the forbidden-op set is armed (non-empty).
 * - With attempt: throws if that attempt is a forbidden publish operation.
 */
export function assertCampaignCannotPublish(
  attempt?: DiscoveryOperationAttempt,
): void {
  if (FORBIDDEN_DISCOVERY_OPERATIONS.length === 0) {
    throw new Error('Discovery publish guard is unconfigured');
  }
  if (attempt) {
    assertDiscoveryCannotPublish(attempt);
  }
}

function payloadSummary(candidate: DiscoveryCandidateRecord): string | undefined {
  const payload = candidate.adapterRecord.payload;
  if (!payload || typeof payload !== 'object') return undefined;
  const summary = (payload as { summary?: unknown }).summary;
  return typeof summary === 'string' ? summary : undefined;
}

/** Fail closed if any survivor carries an uncapped prose blob. */
export function assertSurvivorSnippetsCapped(
  candidates: readonly DiscoveryCandidateRecord[],
): void {
  for (const candidate of candidates) {
    const summary = payloadSummary(candidate) ?? candidate.adapterRecord.title ?? '';
    if (summary.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
      throw new Error(
        `Candidate ${candidate.id} summary exceeds ${MAX_EVIDENCE_SNIPPET_CHARACTERS} chars`,
      );
    }
    const words = summary.split(/\s+/u).filter(Boolean);
    if (words.length > MAX_EVIDENCE_SNIPPET_WORDS) {
      throw new Error(
        `Candidate ${candidate.id} summary exceeds ${MAX_EVIDENCE_SNIPPET_WORDS} words`,
      );
    }
  }
}

export function listCampaignSurvivors(
  campaign: DiscoveryCampaignResult,
): readonly DiscoveryCandidateRecord[] {
  return campaign.candidates.filter(
    (candidate) => candidate.status === 'accepted' || candidate.status === 'merged',
  );
}

export type PartitionByRelevanceInput = {
  readonly survivors: readonly DiscoveryCandidateRecord[];
  readonly assessedAt: string;
  readonly graylistStore?: GraylistStore;
  /** When false (default), skip relevance/graylist and treat all survivors as research-eligible. */
  readonly enabled?: boolean;
};

export type PartitionByRelevanceResult = {
  readonly researchEligible: readonly DiscoveryCandidateRecord[];
  readonly graylisted: readonly GraylistEntry[];
  readonly store: GraylistStore;
};

/**
 * Optional post-gate relevance partition. Challenges the assumption that boundary-accept
 * equals "show the operator." Weak leads park on the graylist for later corroboration.
 */
export function partitionSurvivorsByRelevance(
  input: PartitionByRelevanceInput,
): PartitionByRelevanceResult {
  const store = input.graylistStore ?? createInMemoryGraylistStore();
  if (input.enabled !== true) {
    return { researchEligible: input.survivors, graylisted: [], store };
  }

  const researchEligible: DiscoveryCandidateRecord[] = [];
  const graylisted: GraylistEntry[] = [];

  for (const candidate of input.survivors) {
    const assessment = evaluateCandidateRelevance({
      candidate,
      assessedAt: input.assessedAt,
    });
    if (shouldPark(assessment)) {
      graylisted.push(parkCandidate(store, candidate, assessment, input.assessedAt));
    } else {
      researchEligible.push(candidate);
    }
  }

  return { researchEligible, graylisted, store };
}

export function summarizeCampaignYield(input: {
  readonly campaign: DiscoveryCampaignResult;
  readonly graylistedCount?: number;
  readonly researchEligibleCount?: number;
}): CampaignYieldSummary {
  assertCampaignCannotPublish();
  const survivors = listCampaignSurvivors(input.campaign);
  assertSurvivorSnippetsCapped(survivors);

  const accepted = input.campaign.candidates.filter((c) => c.status === 'accepted').length;
  const merged = input.campaign.candidates.filter((c) => c.status === 'merged').length;
  const quarantined = input.campaign.candidates.filter((c) => c.status === 'quarantined').length;
  const deadLetter = input.campaign.candidates.filter((c) => c.status === 'dead_letter').length;
  const graylisted = input.graylistedCount ?? 0;
  const researchEligible = input.researchEligibleCount ?? survivors.length - graylisted;

  return {
    helpersVersion: CAMPAIGN_RUNNER_HELPERS_VERSION,
    accepted,
    merged,
    quarantined,
    deadLetter,
    survivors: survivors.length,
    graylisted,
    researchEligible,
  };
}

export async function runOptionalEditorialHook(
  hook: CampaignEditorialHook | undefined,
  leads: readonly EditorialLeadPreview[],
): Promise<readonly EditorialReviewResult[]> {
  if (!hook || hook.reviewTopN < 1 || leads.length === 0) return [];
  const slice = leads.slice(0, hook.reviewTopN);
  return await hook.review(slice);
}

export function toEditorialLeadPreview(
  candidate: DiscoveryCandidateRecord,
): EditorialLeadPreview {
  return {
    candidateId: candidate.id,
    ...(candidate.adapterRecord.title !== undefined
      ? { title: candidate.adapterRecord.title }
      : {}),
    ...(payloadSummary(candidate) !== undefined ? { summary: payloadSummary(candidate) } : {}),
    ...(candidate.adapterRecord.canonicalUrl !== undefined
      ? { canonicalUrl: candidate.adapterRecord.canonicalUrl }
      : {}),
  };
}
