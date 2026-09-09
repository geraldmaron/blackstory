/**
 * One evidence rule, two implementations, and a test that fails when they part.
 *
 * A record's tier is computed in two places on purpose. `recordConfidenceTier`
 * (`@repo/public-contracts/evidence`) is what Explore, the record page and the phone call at read
 * time. `highestClaimConfidenceTier` (`@repo/domain`) restates it because `@repo/domain` takes no
 * dependency on the public contracts package, and it writes the `search_index` facet that
 * `/records` reads instead of hydrating full entities.
 *
 * That duplication is deliberate and documented at both sites. What was missing is any check that
 * the two agree, and the cost of the gap was real: when the rule changed on 2026-09-07 the code
 * was correct on every surface that computes, while `/records` kept serving a facet written under
 * the old rule. 4,152 of 4,167 records showed grade A for a day (repo-ngojq). Nothing failed,
 * because nothing was comparing anything.
 *
 * So this suite does not assert tiers. Hardcoded expectations on both sides drift together and
 * prove nothing, the same trap the `/records` filter-vocabulary drift suite calls out. It runs
 * both implementations over one generated corpus and asserts only that they return the same
 * answer, whatever that answer becomes.
 *
 * The corpus is flat-shape claims (`citationSource`) because that is the shape the facet path
 * actually sees. `recordConfidenceTier` additionally reads the nested wire shape
 * (`citation.source`) that `ClaimV1` and the phone use; `highestClaimConfidenceTier` never sees a
 * wire claim, so nested cases are not parity cases and belong to
 * `packages/public-contracts/src/evidence.test.ts` instead.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recordConfidenceTier } from '@repo/public-contracts/evidence';
import { highestClaimConfidenceTier } from '@repo/domain/publication/release-builder';

/** Levels the archive stores, plus the absent case a malformed claim produces. */
const LEVELS = ['high', 'medium', 'low', undefined] as const;

/**
 * Citation sets chosen to straddle every branch: no citation at all, one lineage, one publisher
 * spelled several ways, genuinely independent publishers, and the blank strings a bad ingest
 * writes. The names are the real spellings in `bb_public` today, not invented hosts.
 */
const CITATION_SETS: readonly (readonly (string | undefined)[])[] = [
  [],
  [undefined],
  [''],
  ['   '],
  ['wikipedia_api'],
  ['wikipedia_api', 'en.wikipedia.org', 'wikipedia.org', 'en.m.wikipedia.org'],
  ['npgallery.nps.gov'],
  ['www.nps.gov', 'nps.gov'],
  ['npgallery.nps.gov', 'nps.gov'],
  ['catalog.archives.gov', 'npgallery.nps.gov'],
  ['wikipedia_api', 'npgallery.nps.gov'],
  ['catalog.archives.gov', 'npgallery.nps.gov', 'en.wikipedia.org'],
  ['blackpast.org', 'britannica.com'],
  [undefined, 'npgallery.nps.gov'],
];

type FlatClaim = { readonly confidenceLevel?: string; readonly citationSource?: string };

function claimsFor(
  level: string | undefined,
  sources: readonly (string | undefined)[],
): FlatClaim[] {
  if (sources.length === 0) {
    return level === undefined ? [] : [{ confidenceLevel: level }];
  }
  return sources.map((source) => ({
    ...(level !== undefined ? { confidenceLevel: level } : {}),
    ...(source !== undefined ? { citationSource: source } : {}),
  }));
}

describe('evidence · the record tier rule does not drift between its two implementations', () => {
  it('agrees on every level and citation-set combination', () => {
    let compared = 0;
    for (const level of LEVELS) {
      for (const sources of CITATION_SETS) {
        const claims = claimsFor(level, sources);
        const label = `level=${String(level)} sources=[${sources.map(String).join(', ')}]`;
        assert.equal(
          recordConfidenceTier(claims),
          highestClaimConfidenceTier(claims),
          `public-contracts and domain disagree for ${label}`,
        );
        compared += 1;
      }
    }
    // A corpus that silently emptied would pass every assertion above.
    assert.equal(compared, LEVELS.length * CITATION_SETS.length);
  });

  it('agrees on mixed-strength records, where the cap and the maximum pull apart', () => {
    const mixed: readonly FlatClaim[][] = [
      [
        { confidenceLevel: 'low', citationSource: 'npgallery.nps.gov' },
        { confidenceLevel: 'high', citationSource: 'catalog.archives.gov' },
      ],
      [
        { confidenceLevel: 'high', citationSource: 'wikipedia_api' },
        { confidenceLevel: 'medium', citationSource: 'en.wikipedia.org' },
      ],
      [
        { confidenceLevel: 'medium', citationSource: 'blackpast.org' },
        { confidenceLevel: 'low', citationSource: 'britannica.com' },
      ],
      [{ confidenceLevel: 'high' }, { citationSource: 'npgallery.nps.gov' }],
    ];
    for (const claims of mixed) {
      assert.equal(
        recordConfidenceTier(claims),
        highestClaimConfidenceTier(claims),
        `public-contracts and domain disagree for ${JSON.stringify(claims)}`,
      );
    }
  });
});
