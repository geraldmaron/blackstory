/**
 * CDX-index query construction from BB-038 query packs (BB-075) -- geographically seeded per
 * state/county via caller-supplied seed hosts (see types.ts's module doc comment for why this
 * adapter does not invent domain names).
 *
 * CRITICAL constraint (bead acceptance criterion 3, shared with ../web-search/): the CDX
 * `filter` regex built from a query pack must never contain a `researchOnlyOffensive` term's
 * text. This module builds the filter pattern exclusively from
 * `toPublicSafeTerms(pack.terms)` (../../query-packs/terms.js), which already omits those terms.
 */
import { toPublicSafeTerms } from '../../query-packs/terms.js';
import type { QueryPack } from '../../query-packs/types.js';
import type { CommonCrawlQuery, CommonCrawlSeedTarget } from './types.js';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a CDX `filter=~url:<pattern>` regex alternation from the pack's public-safe
 * positive/alias/geographic term text. Returns `undefined` when the pack has no such terms
 * (callers then query the seed host unfiltered).
 */
export function buildCommonCrawlFilterPattern(pack: QueryPack): string | undefined {
  const safeTerms = toPublicSafeTerms(pack.terms).filter(
    (term) => term.termClass === 'positive' || term.termClass === 'alias' || term.termClass === 'geographic',
  );
  if (safeTerms.length === 0) {
    return undefined;
  }
  const escaped = [...new Set(safeTerms.map((term) => escapeRegExp(term.text.toLowerCase())))];
  return escaped.join('|');
}

/** Throws unless `seed.geographicLabel` matches a `geographic`-classed term in `pack`. */
export function assertSeedGeographicLabelMatchesPack(seed: CommonCrawlSeedTarget, pack: QueryPack): void {
  const geoTerms = pack.terms
    .filter((term) => term.termClass === 'geographic')
    .map((term) => term.text.trim().toLowerCase());
  if (!geoTerms.includes(seed.geographicLabel.trim().toLowerCase())) {
    throw new Error(
      `Common Crawl seed target geographicLabel "${seed.geographicLabel}" does not match any ` +
        `geographic term in query pack "${pack.id}"`,
    );
  }
}

/** Defense-in-depth: throws if the built filter pattern contains offensive term text verbatim. */
export function assertFilterPatternHasNoResearchOnlyOffensiveTerms(filterPattern: string, pack: QueryPack): void {
  const lower = filterPattern.toLowerCase();
  for (const term of pack.terms) {
    if (term.researchOnlyOffensive !== true) continue;
    const text = term.text.trim().toLowerCase();
    if (text && lower.includes(text)) {
      throw new Error(
        `Constructed Common Crawl CDX filter pattern contains a researchOnlyOffensive term from ` +
          `pack "${pack.id}"; these terms must never be sent to an external API (BB-075 acceptance criterion 3)`,
      );
    }
  }
}

export type BuildCommonCrawlQueriesInput = {
  readonly pack: QueryPack;
  readonly seedTargets: readonly CommonCrawlSeedTarget[];
  readonly crawlIds: readonly string[];
  readonly limit?: number;
};

/** Builds one CDX query per (crawlId x seedTarget) pair, all sharing the pack-derived filter pattern. */
export function buildCommonCrawlQueries(input: BuildCommonCrawlQueriesInput): readonly CommonCrawlQuery[] {
  if (input.seedTargets.length === 0) {
    throw new Error('At least one Common Crawl seed target is required');
  }
  if (input.crawlIds.length === 0) {
    throw new Error('At least one Common Crawl crawlId is required');
  }
  for (const seed of input.seedTargets) {
    assertSeedGeographicLabelMatchesPack(seed, input.pack);
  }

  const filterPattern = buildCommonCrawlFilterPattern(input.pack);
  if (filterPattern) {
    assertFilterPatternHasNoResearchOnlyOffensiveTerms(filterPattern, input.pack);
  }

  const queries: CommonCrawlQuery[] = [];
  for (const crawlId of input.crawlIds) {
    for (const seed of input.seedTargets) {
      queries.push({
        crawlId,
        seed,
        limit: input.limit ?? 1000,
        ...(filterPattern !== undefined ? { filterPattern } : {}),
      });
    }
  }
  return queries;
}
