/**
 * Query generation from query packs for web-search adapters, geographically
 * seeded per state/county.
 *
 * CRITICAL constraint: `researchOnlyOffensive` terms must never
 * reach an external API. This module builds query text exclusively from
 * `toPublicSafeTerms(pack.terms)` (../../query-packs/terms.js), which already omits
 * `researchOnlyOffensive` entries, and then re-checks the built string against the pack's full
 * term list as defense in depth see `assertQueryTextHasNoResearchOnlyOffensiveTerms`, which is
 * also exported so callers of../fetch-search.ts and tests can assert the guarantee directly
 * rather than trusting it implicitly.
 */
import { toPublicSafeTerms } from '../../query-packs/terms.js';
import type { QueryPack } from '../../query-packs/types.js';

export type WebSearchGeographicSeed = {
  readonly state: string;
  readonly county?: string;
};

function collectResearchOnlyOffensiveTexts(pack: QueryPack): readonly string[] {
  return pack.terms
    .filter((term) => term.researchOnlyOffensive === true)
    .map((term) => term.text.trim().toLowerCase())
    .filter((text) => text.length > 0);
}

/**
 * Defense-in-depth check: throws if the constructed query text contains, verbatim
 * (case-insensitive substring), any of the pack's `researchOnlyOffensive` term text. Called
 * automatically by `buildWebSearchQueryTexts`; also exported so it can be asserted directly in
 * tests without going through the full builder.
 */
export function assertQueryTextHasNoResearchOnlyOffensiveTerms(queryText: string, pack: QueryPack): void {
  const lower = queryText.toLowerCase();
  for (const offensive of collectResearchOnlyOffensiveTexts(pack)) {
    if (lower.includes(offensive)) {
      throw new Error(
        `Constructed web-search query text contains a researchOnlyOffensive term from pack "${pack.id}"; ` +
          'these terms must never be sent to an external API (BB-075 acceptance criterion 3)',
      );
    }
  }
}

function quoteTerm(text: string): string {
  return text.includes(' ') ? `"${text}"` : text;
}

export type BuildWebSearchQueryTextsInput = {
  readonly pack: QueryPack;
  readonly geographicSeeds: readonly WebSearchGeographicSeed[];
  /** Cap on how many core (positive/alias) terms feed a single query string. Defaults to 3. */
  readonly maxCoreTerms?: number;
};

/**
 * Builds one query text per geographic seed, combining the pack's public-safe positive/alias
 * terms with the seed's state/county. `researchOnlyOffensive` terms never reach this function's
 * output see the module doc comment.
 */
export function buildWebSearchQueryTexts(input: BuildWebSearchQueryTextsInput): readonly string[] {
  const publicTerms = toPublicSafeTerms(input.pack.terms);
  const coreTerms = publicTerms
    .filter((term) => term.termClass === 'positive' || term.termClass === 'alias')
    .slice(0, input.maxCoreTerms ?? 3)
    .map((term) => term.text);

  if (coreTerms.length === 0) {
    throw new Error(
      `Query pack "${input.pack.id}" has no public-safe positive/alias terms to build a web-search query from`,
    );
  }
  if (input.geographicSeeds.length === 0) {
    throw new Error('At least one geographic seed (state/county) is required to build web-search queries');
  }

  const coreClause = coreTerms.length > 1 ? `(${coreTerms.map(quoteTerm).join(' OR ')})` : quoteTerm(coreTerms[0]!);

  return input.geographicSeeds.map((seed) => {
    const geoText = [seed.county, seed.state].filter((part) => Boolean(part && part.trim())).join(' ');
    const queryText = geoText ? `${coreClause} ${geoText}`.trim() : coreClause;
    assertQueryTextHasNoResearchOnlyOffensiveTerms(queryText, input.pack);
    return queryText;
  });
}
