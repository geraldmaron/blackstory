/**
 * Unified research-directive framework: plan → gather → extract → decide.
 *
 * Existing corsair / story / gap-fill scripts keep their own extract/decide
 * logic; this module formalizes the shared loop shape and supplies default
 * gather wiring so callers opt in incrementally instead of rewriting pipelines.
 */
import type { SafeFetchDependencies } from '@repo/security/url-safety';
import {
  formatGatheredSourceSnippets,
  gatherSourceSnippetsFromUrls,
  type GatheredSourceSnippet,
} from './research-source-gather.js';

export type ResearchDirectiveKind =
  | 'gap_fill'
  | 'targeted_brief'
  | 'relationship_chain'
  | 'story_research'
  | 'autonomous_discovery';

export type ResearchDirectivePlan<TSubject = unknown> = {
  readonly kind: ResearchDirectiveKind;
  readonly label: string;
  readonly subject: TSubject;
  readonly seedUrls?: readonly string[];
  readonly searchQueries?: readonly string[];
};

export type ResearchDirectiveGatherResult = {
  readonly sources: readonly GatheredSourceSnippet[];
  readonly formattedSnippets: readonly string[];
  readonly attemptedUrlCount: number;
  readonly fetchedUrlCount: number;
};

export type ResearchDirectiveContext = {
  readonly dependencies?: SafeFetchDependencies;
  readonly gatherConcurrency?: number;
  readonly nowIso?: string;
};

export type ResearchDirectiveHandlers<
  TSubject,
  TExtracted,
  TDecision,
> = {
  readonly plan: (
    subject: TSubject,
    context: ResearchDirectiveContext,
  ) => ResearchDirectivePlan<TSubject> | Promise<ResearchDirectivePlan<TSubject>>;
  readonly gather?: (
    plan: ResearchDirectivePlan<TSubject>,
    context: ResearchDirectiveContext,
  ) => ResearchDirectiveGatherResult | Promise<ResearchDirectiveGatherResult>;
  readonly extract: (
    input: {
      readonly plan: ResearchDirectivePlan<TSubject>;
      readonly gathered: ResearchDirectiveGatherResult;
    },
    context: ResearchDirectiveContext,
  ) => TExtracted | Promise<TExtracted>;
  readonly decide: (
    input: {
      readonly plan: ResearchDirectivePlan<TSubject>;
      readonly gathered: ResearchDirectiveGatherResult;
      readonly extracted: TExtracted;
    },
    context: ResearchDirectiveContext,
  ) => TDecision | Promise<TDecision>;
};

export type ResearchDirectiveRunResult<TSubject, TExtracted, TDecision> = {
  readonly kind: 'research.directive.run.v1';
  readonly plan: ResearchDirectivePlan<TSubject>;
  readonly gathered: ResearchDirectiveGatherResult;
  readonly extracted: TExtracted;
  readonly decision: TDecision;
  readonly completedAt: string;
};

/** Default gather: DNS-pinned fetch of `plan.seedUrls`. */
export async function defaultDirectiveGather(
  plan: ResearchDirectivePlan,
  context: ResearchDirectiveContext = {},
): Promise<ResearchDirectiveGatherResult> {
  const seedUrls = plan.seedUrls ?? [];
  const sources = await gatherSourceSnippetsFromUrls(seedUrls, {
    ...(context.dependencies ? { dependencies: context.dependencies } : {}),
    ...(context.gatherConcurrency !== undefined
      ? { concurrency: context.gatherConcurrency }
      : {}),
  });
  return {
    sources,
    formattedSnippets: formatGatheredSourceSnippets(sources),
    attemptedUrlCount: seedUrls.length,
    fetchedUrlCount: sources.filter((source) => source.fetched).length,
  };
}

/**
 * Runs one bounded research directive. Callers supply domain-specific
 * extract/decide handlers; gather defaults to real safe-fetch of seed URLs.
 */
export async function runResearchDirective<TSubject, TExtracted, TDecision>(
  subject: TSubject,
  handlers: ResearchDirectiveHandlers<TSubject, TExtracted, TDecision>,
  context: ResearchDirectiveContext = {},
): Promise<ResearchDirectiveRunResult<TSubject, TExtracted, TDecision>> {
  const completedAt = context.nowIso ?? new Date().toISOString();
  const plan = await handlers.plan(subject, context);
  const gather =
    handlers.gather ??
    ((planned: ResearchDirectivePlan<TSubject>) => defaultDirectiveGather(planned, context));
  const gathered = await gather(plan, context);
  const extracted = await handlers.extract({ plan, gathered }, context);
  const decision = await handlers.decide({ plan, gathered, extracted }, context);
  return {
    kind: 'research.directive.run.v1',
    plan,
    gathered,
    extracted,
    decision,
    completedAt,
  };
}

export type TargetedBriefSubject = {
  readonly briefId: string;
  readonly title: string;
  readonly placeLabel: string;
  readonly seedUrls?: readonly string[];
  readonly searchQueries?: readonly string[];
};

export type TargetedBriefExtracted = {
  readonly subjectCount: number;
  readonly snippetCount: number;
};

export type TargetedBriefDecision = {
  readonly action: 'stage_for_review' | 'hold' | 'reject';
  readonly rationale: string;
};

/** Shared targeted-brief handlers — sundown-town county scripts compose on top. */
export function createTargetedBriefHandlers(): ResearchDirectiveHandlers<
  TargetedBriefSubject,
  TargetedBriefExtracted,
  TargetedBriefDecision
> {
  return {
    plan: (subject) => ({
      kind: 'targeted_brief',
      label: subject.briefId,
      subject,
      ...(subject.seedUrls ? { seedUrls: subject.seedUrls } : {}),
      ...(subject.searchQueries ? { searchQueries: subject.searchQueries } : {}),
    }),
    extract: ({ plan: _plan, gathered }) => ({
      subjectCount: 1,
      snippetCount: gathered.formattedSnippets.length,
    }),
    decide: ({ plan, gathered, extracted }) => {
      if (gathered.sources.length === 0) {
        return {
          action: 'hold',
          rationale: `No reachable sources for targeted brief "${plan.label}".`,
        };
      }
      if (extracted.snippetCount === 0) {
        return {
          action: 'hold',
          rationale: `Sources fetched for "${plan.label}" but none yielded usable text.`,
        };
      }
      return {
        action: 'stage_for_review',
        rationale: `Gathered ${extracted.snippetCount} real source excerpt(s) for "${plan.label}".`,
      };
    },
  };
}

export type SundownTownCountyBrief = {
  readonly state: string;
  readonly county?: string;
  readonly limit?: number;
};

export type SundownTownCandidateStub = {
  readonly name: string;
  readonly state: string;
  readonly county?: string;
  readonly confidenceCode?: number;
  readonly primaryUrl: string;
  readonly excerpt?: string;
};

export type SundownTownCountyExtracted = {
  readonly candidates: readonly SundownTownCandidateStub[];
};

export type SundownTownCountyDecision = TargetedBriefDecision & {
  readonly candidateCount: number;
};

export const TOUGALOO_GEOJSON_URL =
  'https://justice.tougaloo.edu/wp-json/sundowntowns/geojson' as const;

export const TOUGALOO_STATE_LIST_URL = (stateSlug: string): string =>
  `https://justice.tougaloo.edu/location/${stateSlug}/`;

type TougalooGeoFeature = {
  readonly properties?: {
    readonly name?: string;
    readonly state?: string;
    readonly confirmed?: number;
    readonly permalink?: string;
  };
};

/** Pure filter for Tougaloo GeoJSON features — county match is case-insensitive substring. */
export function filterSundownGeojsonFeatures(
  features: readonly TougalooGeoFeature[],
  input: SundownTownCountyBrief,
): readonly SundownTownCandidateStub[] {
  const stateNeedle = input.state.trim().toLowerCase();
  const countyNeedle = input.county?.trim().toLowerCase();
  const limit = input.limit ?? 50;
  const candidates: SundownTownCandidateStub[] = [];

  for (const feature of features) {
    const props = feature.properties;
    if (!props?.name || !props.state) continue;
    if (props.state.trim().toLowerCase() !== stateNeedle) continue;
    if (countyNeedle && !props.name.toLowerCase().includes(countyNeedle)) continue;
    const permalink = props.permalink?.trim();
    if (!permalink) continue;
    candidates.push({
      name: props.name.trim(),
      state: props.state.trim(),
      ...(input.county ? { county: input.county.trim() } : {}),
      ...(props.confirmed !== undefined ? { confidenceCode: props.confirmed } : {}),
      primaryUrl: permalink.startsWith('http')
        ? permalink
        : `https://justice.tougaloo.edu${permalink.startsWith('/') ? permalink : `/${permalink}`}`,
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

/** Heuristic parse of a Tougaloo town page's stripped text. */
export function parseSundownTownPageText(text: string): {
  readonly confidenceLabel?: string;
  readonly summary: string;
} {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const confidenceMatch = normalized.match(
    /Sundown Town in the Past\?\s*[:-]?\s*(Possible|Probable|Surely|Unlikely)/iu,
  );
  const confidenceLabel = confidenceMatch?.[1];
  const summary = normalized.slice(0, 600);
  return {
    ...(confidenceLabel ? { confidenceLabel } : {}),
    summary,
  };
}

export function createSundownTownCountyHandlers(
  geojsonFeatures: readonly TougalooGeoFeature[],
): ResearchDirectiveHandlers<
  SundownTownCountyBrief,
  SundownTownCountyExtracted,
  SundownTownCountyDecision
> {
  return {
    plan: (subject) => {
      const candidates = filterSundownGeojsonFeatures(geojsonFeatures, subject);
      return {
        kind: 'targeted_brief',
        label: `sundown-towns-${subject.state}${subject.county ? `-${subject.county}` : ''}`,
        subject,
        seedUrls: candidates.map((candidate) => candidate.primaryUrl),
        searchQueries: [
          `"sundown town" ${subject.county ?? ''} ${subject.state}`.replace(/\s+/gu, ' ').trim(),
        ],
      };
    },
    gather: (plan, context) => defaultDirectiveGather(plan, context),
    extract: ({ plan, gathered }) => {
      const brief = plan.subject;
      const baseCandidates = filterSundownGeojsonFeatures(geojsonFeatures, brief);
      const byUrl = new Map(gathered.sources.map((source) => [source.url, source]));
      const candidates = baseCandidates.map((candidate) => {
        const source = byUrl.get(candidate.primaryUrl);
        if (!source) return candidate;
        const parsed = parseSundownTownPageText(source.text);
        return {
          ...candidate,
          excerpt: parsed.summary,
        };
      });
      return { candidates };
    },
    decide: ({ plan, gathered, extracted }) => {
      if (gathered.fetchedUrlCount === 0) {
        return {
          action: 'hold',
          rationale: `No reachable sources for targeted brief "${plan.label}".`,
          candidateCount: extracted.candidates.length,
        };
      }
      if (gathered.formattedSnippets.length === 0) {
        return {
          action: 'hold',
          rationale: `Sources fetched for "${plan.label}" but none yielded usable text.`,
          candidateCount: extracted.candidates.length,
        };
      }
      return {
        action: 'stage_for_review',
        rationale: `Gathered ${gathered.formattedSnippets.length} real source excerpt(s) for "${plan.label}".`,
        candidateCount: extracted.candidates.length,
      };
    },
  };
}

/** Runs a county/state-targeted sundown-town brief through the shared directive loop. */
export async function runSundownTownCountyBrief(
  brief: SundownTownCountyBrief,
  geojsonFeatures: readonly TougalooGeoFeature[],
  context: ResearchDirectiveContext = {},
): Promise<
  ResearchDirectiveRunResult<SundownTownCountyBrief, SundownTownCountyExtracted, SundownTownCountyDecision>
> {
  return runResearchDirective(brief, createSundownTownCountyHandlers(geojsonFeatures), context);
}

/** Loads Tougaloo GeoJSON via caller-supplied fetch (entry scripts inject safe-fetch). */
export async function loadTougalooGeojsonFeatures(
  loadJson: () => Promise<{ readonly features?: readonly TougalooGeoFeature[] }>,
): Promise<readonly TougalooGeoFeature[]> {
  const payload = await loadJson();
  return payload.features ?? [];
}
