/**
 * Tests host classification and multi-source confidence heuristics.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySourceForConfidence,
  assessPublicationClaims,
  type ReviewedClaimAssessment,
  confidenceLevelForSource,
} from './confidence.ts';
import { setSourceRegisterForTesting, type SourceRegisterFile } from './source-register.ts';

const DC_PRESERVATION = 'https://historicsites.dcpreservation.org/site/123-example-historic-place';
const NPS_GOV = 'https://www.nps.gov/places/example-historic-site.htm';
const WIKIPEDIA = 'https://en.wikipedia.org/wiki/Example_Historic_Site';

test('classifySourceForConfidence maps curated heritage hosts to reputable_secondary', () => {
  assert.equal(classifySourceForConfidence(DC_PRESERVATION), 'reputable_secondary');
  assert.equal(
    classifySourceForConfidence('https://www.hmdb.org/m.asp?m=12345'),
    'reputable_secondary',
  );
  assert.equal(
    classifySourceForConfidence('https://digdc.dclibrary.org/islandora/object/pdc%3A123'),
    'reputable_secondary',
  );
  assert.equal(
    classifySourceForConfidence('https://www.blackpast.org/african-american-history/example/'),
    'reputable_secondary',
  );
});

const TEST_REGISTER: SourceRegisterFile = {
  version: 1,
  entries: [
    {
      host: 'test-archive.example',
      sourceClass: 'reputable_secondary',
      orgType: 'archive',
      label: 'Test State Archive',
      basis: {
        wikidata: 'Q1',
        officialWebsite: 'https://test-archive.example/',
        authorityIds: { lcnaf: 'n00000001' },
        instanceOf: ['Q166118'],
      },
      reviewedBy: 'test',
      reviewedAt: '2026-09-10T00:00:00.000Z',
      verifiedAt: '2026-09-10T00:00:00.000Z',
    },
    {
      // Deliberately a host the curated suffix list already calls reputable_secondary, so this
      // proves which one the classifier asks first.
      host: 'hmdb.org',
      sourceClass: 'news_reportage',
      orgType: 'news_publisher',
      label: 'Not really a newspaper — ordering fixture',
      basis: {
        wikidata: 'Q2',
        officialWebsite: 'https://hmdb.org/',
        authorityIds: { viaf: '2' },
        instanceOf: ['Q11032'],
      },
      reviewedBy: 'test',
      reviewedAt: '2026-09-10T00:00:00.000Z',
      verifiedAt: '2026-09-10T00:00:00.000Z',
    },
  ],
};

test('the classifier consults the source register, and consults it first', () => {
  setSourceRegisterForTesting(TEST_REGISTER);
  try {
    // A host nothing else recognizes: without the register it would be `unknown` (authority
    // 0.2), which is what put a state historical society below a crowd-edited marker database.
    assert.equal(classifySourceForConfidence('https://example.com/article'), 'unknown');
    assert.equal(
      classifySourceForConfidence('https://test-archive.example/collections/1'),
      'reputable_secondary',
    );
    // Subdomains of a registered host are covered; look-alikes are not.
    assert.equal(
      classifySourceForConfidence('https://digital.test-archive.example/item/9'),
      'reputable_secondary',
    );
    assert.equal(
      classifySourceForConfidence('https://test-archive.example.evil.example/item/9'),
      'unknown',
    );
    // The register outranks the curated suffix list, including when it grades a host DOWN.
    assert.equal(classifySourceForConfidence('https://www.hmdb.org/m.asp?m=1'), 'news_reportage');
  } finally {
    setSourceRegisterForTesting(undefined);
  }
});

test('classifySourceForConfidence keeps gov and wikipedia behavior', () => {
  assert.equal(classifySourceForConfidence(NPS_GOV), 'government_record');
  assert.equal(classifySourceForConfidence(WIKIPEDIA), 'reputable_secondary');
  assert.equal(classifySourceForConfidence('https://example.com/article'), 'unknown');
});

test('a US patent document grades government_record and high on any mirror, uspto.gov included', () => {
  // The lineage system already treats these as one work (packages/domain-core/src/claims/
  // lineage.ts); the confidence classification has to agree, or the same document grades
  // differently depending on which mirror happened to be fetched.
  assert.equal(
    classifySourceForConfidence('https://patents.google.com/patent/US252386A/en'),
    'government_record',
  );
  assert.equal(confidenceLevelForSource('https://patents.google.com/patent/US252386A/en'), 'high');
  assert.equal(
    classifySourceForConfidence('https://ppubs.uspto.gov/pubwebapp/rest/patents/html/252386'),
    'government_record',
  );
  assert.equal(
    classifySourceForConfidence('https://www.freepatentsonline.com/4723129.html'),
    'government_record',
  );
});

test('a patent mirror search page, listing, or home page is not a government record', () => {
  // Classifying the DOCUMENT, not the mirror: a search query names no document at all.
  assert.notEqual(
    classifySourceForConfidence('https://patents.google.com/?q=latimer'),
    'government_record',
  );
  assert.equal(classifySourceForConfidence('https://patents.google.com/?q=latimer'), 'unknown');
  assert.notEqual(classifySourceForConfidence('https://patents.google.com/'), 'government_record');
});

const entry = {
  id: 'entity-a',
  claims: [
    {
      predicate: 'founded',
      object: 'Founded in 1920',
      citationHref: NPS_GOV,
      citationSource: 'NPS',
      citationLabel: 'Record',
      confidenceLevel: 'high' as const,
    },
  ],
};
const reviewed: ReviewedClaimAssessment = {
  entityId: entry.id,
  claimId: 'claim-a',
  claimVersionId: 'version-a',
  predicate: 'founded',
  object: 'Founded in 1920',
  citationHrefs: [NPS_GOV],
  assessmentId: 'assessment-a',
  reviewDecisionId: 'review-a',
  assessment: {
    acceptanceProbability: 0.95,
    intervalLow: 0.8,
    intervalHigh: 0.99,
    sourceReliability: 0.9,
    entailment: 0.99,
    independence: 0.8,
    identityConfidence: 0.99,
    relevance: 1,
    researchCompleteness: 0.9,
    calibrationVersion: 'held-out-claims-v1',
  },
};

test('a government citation without independent claim assessment cannot authorize publication', () => {
  assert.equal(assessPublicationClaims(entry, []).ok, false);
});

test('exact reviewed claim is admitted only on its qualitative independent-review basis', () => {
  const result = assessPublicationClaims(entry, [reviewed]);
  assert.ok(result.ok);
  assert.equal(result.reviewBasis, 'independent_review');
  assert.equal('score' in result, false);
  assert.equal(result.claims[0]?.id, reviewed.claimId);
});

test('a plausible calibration label without held-out evidence remains inert', () => {
  const result = assessPublicationClaims(entry, [
    {
      ...reviewed,
      assessment: {
        ...reviewed.assessment,
        calibrationVersion: 'production-held-out-claims-2026-09-v4',
      },
    },
  ]);
  assert.ok(result.ok);
  assert.equal(result.reviewBasis, 'independent_review');
  assert.equal('score' in result, false);
});

test('a review cannot transfer to another entity, assertion, predicate, id or citation', () => {
  for (const change of [
    { entityId: 'entity-b' },
    { predicate: 'closed' },
    { object: 'Founded in 1930' },
    { citationHrefs: [WIKIPEDIA] },
  ]) {
    assert.equal(assessPublicationClaims(entry, [{ ...reviewed, ...change }]).ok, false);
  }
  assert.equal(
    assessPublicationClaims(
      { ...entry, claims: [{ ...entry.claims[0]!, id: 'unrelated-claim' }] },
      [reviewed],
    ).ok,
    false,
  );
});

test('one assessed claim does not cover another or uncited assertions', () => {
  for (const extra of [
    { ...entry.claims[0]!, object: 'Founded by Jane Doe' },
    {
      predicate: 'founded',
      object: 'Founded in 1920',
      citationSource: 'NPS',
      citationLabel: 'Record',
      confidenceLevel: 'high' as const,
    },
  ]) {
    assert.equal(
      assessPublicationClaims({ ...entry, claims: [...entry.claims, extra] }, [reviewed]).ok,
      false,
    );
  }
});

test('ambiguous or malformed assessments remain held', () => {
  assert.equal(assessPublicationClaims(entry, [reviewed, reviewed]).ok, false);
  for (const change of [
    { intervalLow: NaN },
    { intervalLow: 0.98 },
    { acceptanceProbability: 1.2 },
    { calibrationVersion: '' },
  ]) {
    assert.equal(
      assessPublicationClaims(entry, [
        { ...reviewed, assessment: { ...reviewed.assessment, ...change } },
      ]).ok,
      false,
    );
  }
});
