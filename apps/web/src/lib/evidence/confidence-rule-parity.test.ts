/**
 * Verifies that both evidence-input projections agree on lineage keys and strongest level, and
 * that every surface uses the shared confidenceTierFromEvidenceInputs rule. Cache inputs rather
 * than a finished tier that can outlive the grading rule.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  confidenceTierFromEvidenceInputs,
  recordConfidenceTier,
  recordEvidenceInputs,
} from '@repo/public-contracts/evidence';
import { recordEvidenceInputs as domainEvidenceInputs } from '@repo/domain/publication/release-builder';

/** Levels the archive stores, plus the absent case a malformed claim produces. */
const LEVELS = ['high', 'medium', 'low', undefined] as const;

/**
 * Citation sets chosen to straddle every branch: no citation at all, one lineage, one publisher
 * spelled several ways, genuinely independent publishers, and the blank strings a bad ingest
 * writes. The names are the real spellings in `published` today, not invented hosts.
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

/**
 * Predicates that used to decide whether a claim is the record's own index row. Neither side
 * reads a predicate any more — `claimRole` alone decides — and keeping them in the corpus is what
 * would catch either side quietly reviving the bridge.
 */
const PREDICATES = [
  undefined,
  'listing',
  'significant for',
  'documented_site',
  'source states',
  'was lynched',
] as const;

/** Stated role, including absent — the case both sides must read as evidence. */
const CLAIM_ROLES = [undefined, 'record_index', 'evidence'] as const;

type FlatClaim = {
  readonly confidenceLevel?: string;
  readonly citationSource?: string;
  readonly predicate?: string;
  readonly claimRole?: string;
};

function claimsFor(
  level: string | undefined,
  sources: readonly (string | undefined)[],
  predicate: string | undefined,
  claimRole: string | undefined,
): FlatClaim[] {
  const base = {
    ...(level !== undefined ? { confidenceLevel: level } : {}),
    ...(predicate !== undefined ? { predicate } : {}),
    ...(claimRole !== undefined ? { claimRole } : {}),
  };
  if (sources.length === 0) {
    return level === undefined && predicate === undefined && claimRole === undefined ? [] : [base];
  }
  return sources.map((source) => ({
    ...base,
    ...(source !== undefined ? { citationSource: source } : {}),
  }));
}

/** Mixed-strength records, where the corroboration cap and the bare maximum pull apart. */
const MIXED: readonly FlatClaim[][] = [
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
  // The NRHP shape: index row, the nomination form it points at, and a Wikipedia mention.
  [
    {
      confidenceLevel: 'high',
      predicate: 'listing',
      claimRole: 'record_index',
      citationSource: 'catalog.archives.gov',
    },
    {
      confidenceLevel: 'high',
      predicate: 'significant for',
      claimRole: 'record_index',
      citationSource: 'catalog.archives.gov',
    },
    {
      confidenceLevel: 'high',
      predicate: 'source states',
      claimRole: 'evidence',
      citationSource: 'npgallery.nps.gov',
    },
    {
      confidenceLevel: 'medium',
      predicate: 'source states',
      claimRole: 'evidence',
      citationSource: 'en.wikipedia.org',
    },
  ],
  [
    { confidenceLevel: 'high', predicate: 'listing', citationSource: 'catalog.archives.gov' },
    {
      confidenceLevel: 'high',
      predicate: 'source states',
      citationSource: 'npgallery.nps.gov',
    },
    { confidenceLevel: 'high', predicate: 'source states', citationSource: 'blackpast.org' },
  ],
];

function everyCorpusCase(visit: (claims: FlatClaim[], label: string) => void): number {
  let visited = 0;
  for (const level of LEVELS) {
    for (const sources of CITATION_SETS) {
      for (const predicate of PREDICATES) {
        for (const claimRole of CLAIM_ROLES) {
          const label =
            `level=${String(level)} predicate=${String(predicate)} ` +
            `role=${String(claimRole)} sources=[${sources.map(String).join(', ')}]`;
          visit(claimsFor(level, sources, predicate, claimRole), label);
          visited += 1;
        }
      }
    }
  }
  return visited;
}

const CORPUS_SIZE = LEVELS.length * CITATION_SETS.length * PREDICATES.length * CLAIM_ROLES.length;

describe('evidence · the grading inputs do not drift between their two projections', () => {
  it('agrees on every level and citation-set combination', () => {
    const visited = everyCorpusCase((claims, label) => {
      assert.deepEqual(
        recordEvidenceInputs(claims),
        domainEvidenceInputs(claims),
        `public-contracts and domain project different inputs for ${label}`,
      );
    });
    // A corpus that silently emptied would pass every assertion above.
    assert.equal(visited, CORPUS_SIZE);
  });

  it('agrees on mixed-strength records, where the cap and the maximum pull apart', () => {
    for (const claims of MIXED) {
      assert.deepEqual(
        recordEvidenceInputs(claims),
        domainEvidenceInputs(claims),
        `public-contracts and domain project different inputs for ${JSON.stringify(claims)}`,
      );
    }
  });
});

describe('evidence · a cached projection grades exactly like the claims it came from', () => {
  it('agrees on every level and citation-set combination', () => {
    const visited = everyCorpusCase((claims, label) => {
      // What `/records` does: read the inputs the publisher cached, apply the one rule.
      assert.equal(
        confidenceTierFromEvidenceInputs(domainEvidenceInputs(claims)),
        recordConfidenceTier(claims),
        `the cached-input path and the live-claim path disagree for ${label}`,
      );
    });
    assert.equal(visited, CORPUS_SIZE);
  });

  it('agrees on mixed-strength records, where the cap and the maximum pull apart', () => {
    for (const claims of MIXED) {
      assert.equal(
        confidenceTierFromEvidenceInputs(domainEvidenceInputs(claims)),
        recordConfidenceTier(claims),
        `the cached-input path and the live-claim path disagree for ${JSON.stringify(claims)}`,
      );
    }
  });

  /**
   * The distinction the reader depends on, asserted end to end rather than by comment: a record
   * cited to nothing is reported unassessed, and a record cited only to Wikipedia is assessed and
   * graded low. Both come out of the same cached shape, so a projection that stopped recording
   * Wikipedia in `citedLineageKeys` would turn "graded low" into "not graded" here.
   */
  it('tells an unassessed record apart from a poorly supported one, through the cache', () => {
    const uncited: FlatClaim[] = [{ confidenceLevel: 'high' }];
    const wikipediaOnly: FlatClaim[] = [
      { confidenceLevel: 'medium', citationSource: 'wikipedia_api' },
    ];
    assert.equal(confidenceTierFromEvidenceInputs(domainEvidenceInputs(uncited)), 'unrated');
    assert.equal(confidenceTierFromEvidenceInputs(domainEvidenceInputs(wikipediaOnly)), 'low');
  });
});
