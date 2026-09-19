/**
 * Model routing policy. Codifies, in one reviewed module, which model tier
 * each research lane uses instead of leaving it to scattered `EDITORIAL_LLM_PROVIDER` /
 * `OPENROUTER_MODELS` / `STORY_REWRITE_MODEL(S)` env defaults (see `llm-provider.ts` and
 * `story-rewrite.ts`, which remain the actual HTTP clients this module wraps).
 *
 * Tier names mirror `research.runs.mode` (`supabase/migrations/20260721041950_research_kernel_ledger.sql`)
 * so a run's mode and its model tier are the same vocabulary end to end:
 *   deterministic | local-triage | free-batch | paid-research | quality-prose |
 *   independent-review | trusted-session
 *
 * Verification/second-opinion independence: already requires producer and approver
 * lineages to differ before automated promotion. `pickIndependentVerifierModel` reuses that
 * constraint at the routing layer (never suggest a verifier from the producer's own model
 * family) instead of duplicating a separate lineage check.
 */
import type { LlmCompletionRequest, LlmCompletionResult, LlmProvider } from './llm-provider.js';
import {
  createHybridLlmProvider,
  createOpenRouterLlmProvider,
  resolveOpenRouterModels,
} from './llm-provider.js';

/** Matches `research.runs.mode` exactly; do not add a tier without a matching mode value. */
export type RoutingTier =
  | 'deterministic'
  | 'local-triage'
  | 'free-batch'
  | 'paid-research'
  | 'quality-prose'
  | 'independent-review'
  | 'trusted-session';

/**
 * Research lanes as named by `.claude/skills/blackstory/*` and the operator-cli commands that
 * back them (`cli.ts`: research-intake, discovery-run, editorial-run/enrichment-run,
 * story-research-run). `theme-study` and `case-drafting` do not yet call an LLM through this
 * module (theme-study drafts via the editorial bridge already covered by editorial-enrichment;
 * case-drafting is a pure deterministic evaluation per its skill doc) but still declare a tier
 * so a future call site has one obvious place to look.
 */
export type ResearchLane =
  | 'research-intake'
  | 'discovery-run'
  | 'editorial-enrichment'
  | 'entity-depth-enrichment'
  | 'story-craft'
  | 'theme-study'
  | 'case-drafting';

export type LaneRoutingPolicy = {
  readonly lane: ResearchLane;
  readonly tier: RoutingTier;
  readonly rationale: string;
  /** Confidence threshold below which a free-tier result escalates to paid-research. */
  readonly escalateBelowConfidence?: number;
};

/**
 * The routing table. One row per lane; nothing here reads an env var directly — env vars
 * (`OPENROUTER_MODELS`, `OLLAMA_MODEL`, etc.) still supply *which* models sit in a tier's
 * roster (see `rosterForTier`), but *which tier a lane gets* is decided here, not by whatever
 * happens to be set in the shell.
 */
export const LANE_ROUTING_POLICY: Readonly<Record<ResearchLane, LaneRoutingPolicy>> = Object.freeze(
  {
    'research-intake': {
      lane: 'research-intake',
      tier: 'local-triage',
      rationale:
        'Mechanical extraction/dedup of a submitted URL/topic into a proposal — free roster ' +
        'with local Ollama failover is sufficient; no editorial judgment is made here.',
    },
    'discovery-run': {
      lane: 'discovery-run',
      tier: 'local-triage',
      rationale:
        'Bounded adapter-candidate classification against an existing batch — mechanical, ' +
        'free roster + Ollama failover; escalation is unnecessary because BB-039 bounds are ' +
        'deterministic regardless of model quality.',
    },
    'editorial-enrichment': {
      lane: 'editorial-enrichment',
      tier: 'free-batch',
      rationale:
        'Editorial judge (keep/weed + draft prose) runs on the free roster by default; a low ' +
        'confidence score or a disagreement between two free-roster passes escalates the same ' +
        'item to paid-research rather than accepting a shaky free verdict.',
      escalateBelowConfidence: 0.6,
    },
    'entity-depth-enrichment': {
      lane: 'entity-depth-enrichment',
      tier: 'free-batch',
      rationale:
        'repo-n7p6.4 (WS4): drafting short cited prose from evidence already captured by WS3 is ' +
        'bounded extraction, not open-ended judgment — free/cheap roster, same tier as editorial ' +
        'enrichment. Escalation is per-item on quarantine (deterministic validator rejection), not ' +
        'confidence-scored, so it is handled by the harness rather than escalateBelowConfidence.',
    },
    'story-craft': {
      lane: 'story-craft',
      tier: 'quality-prose',
      rationale:
        'Multi-page, methodology-cited longform prose (900-1500 words, citation-gated) needs ' +
        'the strongest paid roster; free models were not built for this length/quality bar.',
    },
    'theme-study': {
      lane: 'theme-study',
      tier: 'quality-prose',
      rationale:
        'Theme-impact narrative synthesis across a multi-source evidence graph is deep research ' +
        'synthesis, not mechanical classification — paid roster.',
    },
    'case-drafting': {
      lane: 'case-drafting',
      tier: 'deterministic',
      rationale:
        'evaluateEvidenceChecklist/buildResearchCasePreview (packages/domain/src/research-case/' +
        'workflow.ts) are pure deterministic functions today; no model call exists on this lane.',
    },
  },
);

/**
 * Free roster + local Ollama failover. `OPENROUTER_MODELS` is the source of truth for which
 * free models are current (see `.env.example`); this module never hardcodes a free roster.
 */
export function rosterForTier(
  tier: RoutingTier,
  options: {
    readonly paidRoster?: readonly string[];
    readonly freeRoster?: readonly string[];
  } = {},
): readonly string[] {
  switch (tier) {
    case 'local-triage':
    case 'free-batch':
      return resolveOpenRouterModels(
        options.freeRoster !== undefined ? { models: options.freeRoster } : {},
      );
    case 'quality-prose':
    case 'paid-research':
    case 'independent-review':
      // Story rewrite uses the configured reviewer roster. Reassess model fitness and current
      // provider prices before paid dispatch.
      return options.paidRoster ?? [];
    case 'deterministic':
    case 'trusted-session':
      return [];
  }
}

/**
 * Builds the provider for a lane per the routing table. `paidRoster`/`freeRoster` let callers
 * pass the actual current env-configured rosters (e.g. `DEFAULT_STORY_REWRITE_MODELS`) instead
 * of this module guessing; it never invents model names.
 */
export function createLaneProvider(
  lane: ResearchLane,
  options: {
    readonly apiKey?: string;
    readonly ollamaModel?: string;
    readonly ollamaBaseUrl?: string;
    readonly paidRoster?: readonly string[];
    readonly freeRoster?: readonly string[];
    readonly fetchImpl?: typeof fetch;
  } = {},
): LlmProvider {
  const policy = LANE_ROUTING_POLICY[lane];
  const commonOverrides = {
    ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
  };
  switch (policy.tier) {
    case 'local-triage':
      return createHybridLlmProvider({
        ...commonOverrides,
        models: rosterForTier(policy.tier, options),
        ...(options.ollamaModel !== undefined ? { ollamaModel: options.ollamaModel } : {}),
        ...(options.ollamaBaseUrl !== undefined ? { baseUrl: options.ollamaBaseUrl } : {}),
      });
    case 'free-batch':
      return createOpenRouterLlmProvider({
        ...commonOverrides,
        models: rosterForTier(policy.tier, options),
      });
    case 'quality-prose':
    case 'paid-research':
    case 'independent-review':
      return createOpenRouterLlmProvider({
        ...commonOverrides,
        models: rosterForTier(policy.tier, options),
      });
    case 'deterministic':
    case 'trusted-session':
      throw new Error(`lane ${lane} has no model call (tier=${policy.tier})`);
  }
}

export type EnrichmentVerdict = {
  readonly confidence: number;
  readonly decision: string;
};

/**
 * Free-tier escalation: a lane with `escalateBelowConfidence` (today: editorial-enrichment)
 * escalates when the free verdict's confidence is below threshold, or when two free-roster
 * passes disagree on `decision` (the "disagreement" half of the acceptance criteria).
 */
export function shouldEscalateToPaid(
  lane: ResearchLane,
  verdict: EnrichmentVerdict,
  secondOpinion?: EnrichmentVerdict,
): boolean {
  const policy = LANE_ROUTING_POLICY[lane];
  if (policy.escalateBelowConfidence === undefined) return false;
  if (verdict.confidence < policy.escalateBelowConfidence) return true;
  if (secondOpinion && secondOpinion.decision !== verdict.decision) return true;
  return false;
}

function modelFamily(modelId: string): string {
  // e.g. "deepseek/deepseek-v3.2" -> "deepseek"; "moonshotai/kimi-k2.5" -> "moonshotai".
  return modelId.split('/')[0]?.toLowerCase() ?? modelId.toLowerCase();
}

/**
 * Verification/second-opinion routing: picks a model independent of the producer, per the
 * requirement that producer and approver lineages differ. Throws rather than silently
 * falling back to the producer's own family, which is the failure mode exists to
 * prevent for automated promotion.
 */
export function pickIndependentVerifierModel(
  producerModelId: string,
  candidateRoster: readonly string[],
): string {
  const producerFamily = modelFamily(producerModelId);
  const independent = candidateRoster.find((model) => modelFamily(model) !== producerFamily);
  if (!independent) {
    throw new Error(
      `no model in the candidate roster is independent of producer family "${producerFamily}" ` +
        '(repo-4sg5 requires producer and approver lineages to differ)',
    );
  }
  return independent;
}

export type RoutedCompletion = LlmCompletionResult & {
  readonly lane: ResearchLane;
  readonly tier: RoutingTier;
  readonly costUsd: number | null;
};

/**
 * Wraps any provider's `.complete()` so every call made "through this module" carries the lane,
 * tier, and a cost estimate alongside the raw completion — the shape `logModelInvocation`
 * (`model-invocation-log.ts`) writes to `research.model_invocations`.
 */
export function withLaneMetadata(
  lane: ResearchLane,
  provider: LlmProvider,
): {
  complete(request: LlmCompletionRequest): Promise<RoutedCompletion>;
} {
  const tier = LANE_ROUTING_POLICY[lane].tier;
  return {
    async complete(request) {
      const result = await provider.complete(request);
      return {
        ...result,
        lane,
        tier,
        costUsd: result.accounting?.costUsd ?? null,
      };
    },
  };
}
