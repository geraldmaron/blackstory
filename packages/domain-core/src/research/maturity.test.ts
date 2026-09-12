/**
 * The evidence-semantics corpus.
 *
 * Twelve cases that pin what independence, fitness and maturity MEAN. The parity harness in
 * apps/web asserts that two implementations of the record tier agree; it cannot say whether the
 * shared rule is right. These say what right is.
 *
 * Each case is named for the thing it would let through if it were deleted.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveSourceLineage } from '../claims/lineage.ts';
import type { SourceClass } from '../claims/source-fitness.ts';
import type { ClaimSnapshot, EvidenceSnapshot, RecordSnapshot } from './deficits.ts';
import { detectDeficits, enrichmentPriority } from './deficits.ts';
import { assessResearchMaturity, blockersToNextState, describeMaturity } from './maturity.ts';

const FULLY_ASSESSED = [
  'directness',
  'entityMatchQuality',
  'temporalProximity',
  'geographicPrecision',
  'extractionQuality',
];

function evidence(
  sourceClass: SourceClass,
  url: string | undefined,
  overrides: Partial<EvidenceSnapshot> = {},
): EvidenceSnapshot {
  return {
    sourceId: url ?? `${sourceClass}-source`,
    url,
    sourceClass,
    lineage: resolveSourceLineage({ url, ...(overrides.lineage ? {} : {}) }),
    hasSelector: true,
    captured: true,
    documentDate: '1882-01-17',
    assessedDimensions: FULLY_ASSESSED,
    ...overrides,
  };
}

function claim(
  id: string,
  assertionClass: ClaimSnapshot['assertionClass'],
  ev: readonly EvidenceSnapshot[],
  overrides: Partial<ClaimSnapshot> = {},
): ClaimSnapshot {
  return {
    id,
    text: `claim ${id}`,
    assertionClass,
    inPublicSummary: true,
    evidence: ev,
    ...overrides,
  };
}

function record(
  claims: readonly ClaimSnapshot[],
  overrides: Partial<RecordSnapshot> = {},
): RecordSnapshot {
  return {
    entityId: 'ent_test',
    entityKind: 'person',
    claims,
    contradictionSearchRun: true,
    priorArtSearchRun: true,
    placeReceipt: true,
    relationshipsWithoutEvidence: 0,
    released: true,
    ...overrides,
  };
}

function assess(rec: RecordSnapshot, overrides: Record<string, unknown> = {}) {
  return assessResearchMaturity({
    record: rec,
    identityResolved: true,
    evaluatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  });
}

const codes = (items: readonly { code: string }[]): string[] => items.map((i) => i.code);

// ---------------------------------------------------------------- Case A

test('Case A: a Wikipedia-only summary claim caps at seeded and is P1', () => {
  const rec = record([
    claim('c1', 'biographical_fact', [
      evidence('wikipedia_bridge', 'https://en.wikipedia.org/wiki/Someone'),
    ]),
  ]);
  const result = assess(rec);

  assert.equal(result.maturity, 'seeded');
  assert.ok(codes(result.evidenceDeficits).includes('wikipedia_only_summary_claim'));
  assert.ok(codes(result.evidenceDeficits).includes('bridge_only_entity'));
  assert.equal(enrichmentPriority(result.evidenceDeficits, { released: false }), 'P1');
});

test('Case A: two Wikipedia spellings still do not corroborate each other', () => {
  // The whole point. Adding a URL must not clear the deficit.
  const rec = record([
    claim('c1', 'biographical_fact', [
      evidence('wikipedia_bridge', 'https://en.wikipedia.org/wiki/Someone'),
      evidence('wikipedia_bridge', 'https://en.m.wikipedia.org/wiki/Someone'),
      evidence('wikidata_bridge', 'https://www.wikidata.org/wiki/Q1'),
    ]),
  ]);
  const result = assess(rec);
  assert.equal(result.maturity, 'seeded');
  assert.ok(codes(result.evidenceDeficits).includes('bridge_only_entity'));
});

// ---------------------------------------------------------------- Case B

test('Case B: one wire story on three hosts is one lineage once provenance records it', () => {
  const wire = 'ap-1963-march';
  const threeHosts = [
    'https://a.example.com/x',
    'https://b.example.com/y',
    'https://c.example.org/z',
  ];
  const ev = threeHosts.map((url) => ({
    ...evidence('contemporaneous_newspaper', url),
    lineage: resolveSourceLineage({ url, upstreamWorkId: wire }),
  }));
  const rec = record([claim('c1', 'invention_attribution', ev)]);
  const deficits = detectDeficits(rec);

  assert.ok(
    codes(deficits).includes('single_lineage_high_impact_claim'),
    'three copies of one story must not read as corroboration',
  );
});

// ---------------------------------------------------------------- Case C

test('Case C: two independently created documents at one archive can be two lineages', () => {
  const ev = [
    {
      ...evidence('archival_manuscript', 'https://www.loc.gov/collections/one/'),
      lineage: resolveSourceLineage({
        url: 'https://www.loc.gov/collections/one/',
        independentCreation: { documentId: 'ms-1' },
      }),
    },
    {
      ...evidence('archival_manuscript', 'https://www.loc.gov/collections/two/'),
      lineage: resolveSourceLineage({
        url: 'https://www.loc.gov/collections/two/',
        independentCreation: { documentId: 'ms-2' },
      }),
    },
  ];
  const rec = record([claim('c1', 'invention_attribution', ev)]);
  const deficits = detectDeficits(rec);
  assert.equal(
    codes(deficits).includes('single_lineage_high_impact_claim'),
    false,
    'confirmed independent creation at one repository is corroboration',
  );
});

test('Case C: the same two documents without that confirmation stay one lineage', () => {
  const ev = [
    evidence('archival_manuscript', 'https://www.loc.gov/collections/one/'),
    evidence('archival_manuscript', 'https://www.loc.gov/collections/two/'),
  ];
  const rec = record([claim('c1', 'invention_attribution', ev)]);
  assert.ok(codes(detectDeficits(rec)).includes('single_lineage_high_impact_claim'));
});

// ---------------------------------------------------------------- Case D

test('Case D: a patent and its mirror are one technical lineage', () => {
  const ev = [
    evidence('patent_specification', 'https://patents.google.com/patent/US252386A/en'),
    evidence('patent_specification', 'https://ppubs.uspto.gov/x?patentNumber=252386'),
  ];
  const rec = record([claim('c1', 'invention_attribution', ev)]);
  assert.ok(
    codes(detectDeficits(rec)).includes('single_lineage_high_impact_claim'),
    'reading one patent twice is not corroboration',
  );
});

// ---------------------------------------------------------------- Case I

test('Case I: a patent supports the technical claim and never the community-identity gate', () => {
  const patent = evidence('patent_specification', 'https://patents.google.com/patent/US252386A/en');
  const rec = record([claim('c1', 'record_fact', [patent], { inPublicSummary: true })], {
    requiresCommunityIdentityReceipt: true,
    requiresTechnicalReceipt: true,
  });
  const result = assess(rec);

  // The technical claim itself is fine: a patent is authoritative for what it records.
  assert.equal(codes(result.evidenceDeficits).includes('claim_source_unfit_for_claim'), false);
  assert.equal(
    codes(result.evidenceDeficits).includes('invention_claim_without_technical_receipt'),
    false,
  );
  // And the relevance gate is shut.
  assert.ok(codes(result.evidenceDeficits).includes('missing_identity_receipt'));
  assert.ok(codes(result.evidenceDeficits).includes('patent_used_as_racial_identity_evidence'));
  assert.ok(result.blockers.some((b) => b.gate === 'sources_fit_their_claims'));
});

test('Case I: a Baker-era compilation opens the gate the patent cannot', () => {
  const rec = record(
    [
      claim('c1', 'record_fact', [
        evidence('patent_specification', 'https://patents.google.com/patent/US252386A/en'),
        evidence('historical_compilation', 'https://www.uspto.gov/baker-list'),
      ]),
    ],
    { requiresCommunityIdentityReceipt: true, requiresTechnicalReceipt: true },
  );
  const deficits = detectDeficits(rec);
  assert.equal(codes(deficits).includes('missing_identity_receipt'), false);
  assert.equal(codes(deficits).includes('patent_used_as_racial_identity_evidence'), false);
});

// ---------------------------------------------------------------- Case J

test('Case J: an unpatented innovation can mature on archival evidence alone', () => {
  // Banneker's clock. No patent exists and none is required.
  const rec = record(
    [
      claim('c1', 'technical_scope', [
        evidence('archival_manuscript', 'https://www.loc.gov/item/banneker-1/'),
        evidence('peer_reviewed_scholarship', 'https://doi.org/10.2307/2717721'),
      ]),
      claim('c2', 'biographical_fact', [
        evidence('institutional_biography', 'https://www.si.edu/banneker'),
      ]),
    ],
    { requiresTechnicalReceipt: true },
  );
  const deficits = detectDeficits(rec);
  assert.equal(
    codes(deficits).includes('invention_claim_without_technical_receipt'),
    false,
    'archival and scholarly records satisfy the technical receipt where no patent exists',
  );
});

// ---------------------------------------------------------------- Case K

test('Case K: a superlative a secondary source asserts and no institution researched is blocked', () => {
  const rec = record([
    claim('c1', 'superlative', [
      evidence('modern_reputable_secondary', 'https://www.example-history.com/first'),
    ]),
  ]);
  const result = assess(rec);
  assert.ok(codes(result.evidenceDeficits).includes('superlative_without_institutional_support'));
  assert.ok(result.blockers.some((b) => b.gate === 'superlatives_scoped'));
});

test('Case K: scholarship that studied the ordering clears the superlative gate', () => {
  const rec = record([
    claim('c1', 'superlative', [
      evidence('peer_reviewed_scholarship', 'https://doi.org/10.2307/2717721'),
      evidence('institutional_biography', 'https://www.si.edu/x'),
    ]),
  ]);
  const deficits = detectDeficits(rec);
  assert.equal(codes(deficits).includes('superlative_without_institutional_support'), false);
});

// ---------------------------------------------------------------- Case L

test('Case L: an unresolved contradiction caps maturity and is never averaged away', () => {
  const rec = record([
    claim(
      'c1',
      'invention_attribution',
      [
        evidence('peer_reviewed_scholarship', 'https://doi.org/10.1/a'),
        evidence('scholarly_book_or_history', 'https://doi.org/10.2/b'),
      ],
      { unresolvedContradiction: true },
    ),
  ]);
  const result = assess(rec);

  assert.ok(codes(result.evidenceDeficits).includes('unresolved_contradiction'));
  assert.ok(result.blockers.some((b) => b.gate === 'contradiction_search_complete'));
  // Two strong independent lineages would otherwise reach corroborated; the disagreement caps it.
  assert.equal(result.maturity, 'grounded');
});

// ---------------------------------------------------------------- Maturity mechanics

test('a record with two fit independent lineages and no deficits reaches deep_research', () => {
  // The ladder must be climbable, or every record sits at seeded and the model says nothing.
  const rec = record([
    claim('c1', 'invention_attribution', [
      evidence('patent_file_wrapper', 'https://catalog.archives.gov/id/12345'),
      evidence('peer_reviewed_scholarship', 'https://doi.org/10.2307/2717721'),
    ]),
  ]);
  const result = assess(rec);
  assert.equal(result.maturity, 'deep_research');
  assert.deepEqual(codes(result.evidenceDeficits), []);
});

test('reference needs a review by someone other than the producer', () => {
  const rec = record([
    claim('c1', 'invention_attribution', [
      evidence('patent_file_wrapper', 'https://catalog.archives.gov/id/12345'),
      evidence('peer_reviewed_scholarship', 'https://doi.org/10.2307/2717721'),
    ]),
  ]);

  const selfReviewed = assess(rec, {
    independentReview: {
      reviewerActorId: 'actor-1',
      producerActorId: 'actor-1',
      correctionForcingFindings: 0,
    },
  });
  assert.equal(selfReviewed.maturity, 'deep_research');
  assert.ok(selfReviewed.blockers.some((b) => b.gate === 'independently_reviewed'));

  const reviewed = assess(rec, {
    independentReview: {
      reviewerActorId: 'actor-2',
      producerActorId: 'actor-1',
      correctionForcingFindings: 0,
    },
  });
  assert.equal(reviewed.maturity, 'reference');
});

test('an unresolved correction-forcing finding keeps a record below reference', () => {
  const rec = record([
    claim('c1', 'invention_attribution', [
      evidence('patent_file_wrapper', 'https://catalog.archives.gov/id/12345'),
      evidence('peer_reviewed_scholarship', 'https://doi.org/10.2307/2717721'),
    ]),
  ]);
  const result = assess(rec, {
    independentReview: {
      reviewerActorId: 'actor-2',
      producerActorId: 'actor-1',
      correctionForcingFindings: 1,
    },
  });
  assert.equal(result.maturity, 'deep_research');
});

test('an open mandatory evidence need keeps a record below reference', () => {
  const rec = record([
    claim('c1', 'invention_attribution', [
      evidence('patent_file_wrapper', 'https://catalog.archives.gov/id/12345'),
      evidence('peer_reviewed_scholarship', 'https://doi.org/10.2307/2717721'),
    ]),
  ]);
  const result = assess(rec, {
    openMandatoryNeeds: ['development-site'],
    independentReview: {
      reviewerActorId: 'actor-2',
      producerActorId: 'actor-1',
      correctionForcingFindings: 0,
    },
  });
  assert.equal(result.maturity, 'deep_research');
  assert.ok(result.blockers.some((b) => b.gate === 'no_open_mandatory_needs'));
});

test('a blocker low on the ladder caps the record however much depth sits above it', () => {
  // Depth built on an unsupported summary is depth on sand.
  const rec = record([
    claim('c1', 'biographical_fact', [
      evidence('wikipedia_bridge', 'https://en.wikipedia.org/wiki/X'),
    ]),
    claim('c2', 'technical_scope', [
      evidence('patent_specification', 'https://patents.google.com/patent/US1/en'),
      evidence('peer_reviewed_scholarship', 'https://doi.org/10.9/z'),
    ]),
  ]);
  assert.equal(assess(rec).maturity, 'seeded');
});

test('an unresearched record is P0 only when its published prose overstates its evidence', () => {
  const thin = record(
    [
      claim('c1', 'biographical_fact', [
        evidence('wikipedia_bridge', 'https://en.wikipedia.org/wiki/X'),
      ]),
    ],
    { released: true },
  );
  assert.equal(assess(thin).priority, 'P0');

  const sameButUnreleased = record(
    [
      claim('c1', 'biographical_fact', [
        evidence('wikipedia_bridge', 'https://en.wikipedia.org/wiki/X'),
      ]),
    ],
    { released: false },
  );
  assert.equal(assess(sameButUnreleased).priority, 'P1');
});

test('maturity is described as blockers to the next state, never as a number', () => {
  const rec = record([
    claim('c1', 'superlative', [
      evidence('modern_reputable_secondary', 'https://www.example-history.com/first'),
    ]),
  ]);
  const result = assess(rec);
  const description = describeMaturity(result);
  assert.match(description, /blocker/u);
  assert.doesNotMatch(description, /\d+\s*\/\s*\d+/u, 'no score-like rendering');
  assert.ok(blockersToNextState(result).length > 0);
});

test('an unassessed confidence dimension is reported rather than defaulted quietly', () => {
  const rec = record([
    claim('c1', 'biographical_fact', [
      evidence('institutional_biography', 'https://www.si.edu/x', {
        assessedDimensions: ['directness'],
      }),
    ]),
  ]);
  const deficits = detectDeficits(rec);
  const generic = deficits.find((d) => d.code === 'generic_confidence_dimension');
  assert.ok(generic !== undefined);
  assert.match(generic.explanation, /temporalProximity/u);
});

test('a source with no recorded document date is flagged, because system time is not document time', () => {
  const rec = record([
    claim('c1', 'chronology', [
      evidence('contemporaneous_newspaper', 'https://example.com/a', { documentDate: undefined }),
    ]),
  ]);
  assert.ok(codes(detectDeficits(rec)).includes('missing_creation_or_publication_date'));
});

test('lineage inferred from a host is flagged as a guess, not reported as a finding', () => {
  const rec = record([
    claim('c1', 'biographical_fact', [
      evidence('institutional_biography', 'https://www.example.org/bio'),
    ]),
  ]);
  assert.ok(codes(detectDeficits(rec)).includes('host_based_lineage_suspect'));

  const fromWork = record([
    claim('c1', 'record_fact', [
      evidence('patent_specification', 'https://patents.google.com/patent/US252386A/en'),
    ]),
  ]);
  assert.equal(codes(detectDeficits(fromWork)).includes('host_based_lineage_suspect'), false);
});

test('a record built entirely from one importer is one source family, not many sources', () => {
  const ev = ['https://a.example.gov/1', 'https://b.example.gov/2'].map((url) =>
    evidence('institutional_biography', url, { importerFamily: 'nrhp-bulk' }),
  );
  const rec = record([claim('c1', 'biographical_fact', ev)]);
  assert.ok(codes(detectDeficits(rec)).includes('importer_source_monoculture'));
});

test('three sources of one document class are a monoculture', () => {
  const ev = ['https://a.example.org/1', 'https://b.example.org/2', 'https://c.example.org/3'].map(
    (url) => evidence('modern_reputable_secondary', url),
  );
  const rec = record([claim('c1', 'biographical_fact', ev)]);
  assert.ok(codes(detectDeficits(rec)).includes('source_type_monoculture'));
});

test('a broken source on published prose is a correction risk', () => {
  const rec = record([
    claim('c1', 'biographical_fact', [
      evidence('institutional_biography', 'https://gone.example.org/x', { broken: true }),
    ]),
  ]);
  const deficits = detectDeficits(rec);
  const broken = deficits.find((d) => d.code === 'broken_source');
  assert.ok(broken !== undefined);
  assert.equal(broken.correctionRisk, true);
});

test('two independent lineages are necessary and not sufficient for a high-impact claim', () => {
  // Both independent, neither fit to settle an attribution.
  const rec = record([
    claim('c1', 'invention_attribution', [
      evidence('modern_reputable_secondary', 'https://a.example.com/x'),
      evidence('contemporaneous_newspaper', 'https://b.example.org/y'),
    ]),
  ]);
  const result = assess(rec);
  assert.ok(
    result.blockers.some((b) => b.gate === 'high_impact_corroborated'),
    'independence without fitness is not corroboration',
  );
});
