/**
 * Geographic Gap Scanner — research-directive preset for one priority county.
 *
 * Composes the shared plan → gather → extract → decide loop
 * (`createTargetedBriefHandlers` + `runResearchDirective`) with the coverage-gap
 * zones produced by `@repo/domain` `buildPriorityDiscoveryZones`. Additive module:
 * research-directive.ts is not modified.
 *
 * Invariants:
 *   * Research cannot publish (ADR-009). Decisions here are stage_for_review /
 *     hold / reject only — never a write to public projections or release tables.
 *   * Gathering uses the shared safe-fetch path (defaultDirectiveGather →
 *     @repo/security DNS-pinned fetch). No bare fetch().
 *   * A low coverage ratio is a prioritization signal, not a claim that history
 *     is absent — briefs stay evidence-before-assertion.
 */
import {
  createTargetedBriefHandlers,
  defaultDirectiveGather,
  runResearchDirective,
  type ResearchDirectiveContext,
  type ResearchDirectiveHandlers,
  type ResearchDirectiveRunResult,
  type TargetedBriefDecision,
  type TargetedBriefExtracted,
  type TargetedBriefSubject,
} from '../research-directive.js';

/**
 * Structural mirror of the domain `PriorityDiscoveryZone` (geographic-gap-scanner).
 * Declared structurally so this module stays additive until the discovery barrel
 * exports the type; zones from `buildPriorityDiscoveryZones` satisfy it as-is.
 */
export type GeographicGapZone = {
  readonly fips5: string;
  readonly countyLabel: string;
  readonly stateName?: string;
  readonly worstCoverageRatio: number;
  readonly worstDecade: number;
  readonly geographicHints: readonly {
    readonly text: string;
    readonly kind: 'state' | 'city' | 'region' | 'country' | 'unknown';
    readonly confidence: number;
  }[];
  readonly searchQueries: readonly string[];
};

export type GeographicGapBriefSubject = TargetedBriefSubject & {
  readonly fips5: string;
  readonly worstCoverageRatio: number;
  readonly worstDecade: number;
  readonly geographicHints: GeographicGapZone['geographicHints'];
};

export type GeographicGapExtracted = TargetedBriefExtracted & {
  readonly fips5: string;
  readonly geographicHintCount: number;
};

export type GeographicGapDecision = TargetedBriefDecision & {
  readonly fips5: string;
  readonly worstCoverageRatio: number;
};

/**
 * Builds the targeted-brief subject for one priority county. Seed URLs are
 * operator-curated (local archives, historical societies, digitized newspapers
 * for that county) — the scanner itself proposes places, never sources.
 */
export function buildGeographicGapBriefSubject(
  zone: GeographicGapZone,
  seedUrls: readonly string[] = [],
): GeographicGapBriefSubject {
  return {
    briefId: `geographic-gap-${zone.fips5}`,
    title:
      `Coverage gap: ${zone.countyLabel} ` +
      `(ratio ${zone.worstCoverageRatio} @ ${zone.worstDecade} census)`,
    placeLabel: zone.countyLabel,
    ...(seedUrls.length > 0 ? { seedUrls } : {}),
    searchQueries: zone.searchQueries,
    fips5: zone.fips5,
    worstCoverageRatio: zone.worstCoverageRatio,
    worstDecade: zone.worstDecade,
    geographicHints: zone.geographicHints,
  };
}

/**
 * plan → gather → extract → decide handlers for one priority-county brief.
 * Delegates to the shared targeted-brief handlers and annotates the result with
 * gap-scanner context (county FIPS, coverage ratio, hint count) so downstream
 * review queues can trace *why* this county was targeted.
 */
export function createGeographicGapBriefHandlers(): ResearchDirectiveHandlers<
  GeographicGapBriefSubject,
  GeographicGapExtracted,
  GeographicGapDecision
> {
  const base = createTargetedBriefHandlers();
  return {
    plan: async (subject, context) => {
      const planned = await base.plan(subject, context);
      return {
        ...planned,
        subject,
        label: subject.briefId,
        // Geographic hints steer query phrasing; they are place seeds, not facts.
        searchQueries: [
          ...(planned.searchQueries ?? []),
          ...subject.geographicHints
            .filter((hint) => hint.kind === 'region' || hint.kind === 'city')
            .map((hint) => `"${hint.text}" Black history archive`),
        ],
      };
    },
    gather: (plan, context) => defaultDirectiveGather(plan, context),
    extract: async ({ plan, gathered }, context) => {
      const baseExtracted = await base.extract(
        { plan, gathered },
        context,
      );
      return {
        ...baseExtracted,
        fips5: plan.subject.fips5,
        geographicHintCount: plan.subject.geographicHints.length,
      };
    },
    decide: async ({ plan, gathered, extracted }, context) => {
      const baseDecision = await base.decide(
        { plan, gathered, extracted },
        context,
      );
      // Stage/hold/reject only — research workers never publish (ADR-009).
      return {
        ...baseDecision,
        fips5: plan.subject.fips5,
        worstCoverageRatio: plan.subject.worstCoverageRatio,
      };
    },
  };
}

/** Runs one priority-county coverage-gap brief through the shared directive loop. */
export async function runGeographicGapCountyBrief(
  zone: GeographicGapZone,
  seedUrls: readonly string[] = [],
  context: ResearchDirectiveContext = {},
): Promise<
  ResearchDirectiveRunResult<
    GeographicGapBriefSubject,
    GeographicGapExtracted,
    GeographicGapDecision
  >
> {
  const subject = buildGeographicGapBriefSubject(zone, seedUrls);
  return runResearchDirective(subject, createGeographicGapBriefHandlers(), context);
}
