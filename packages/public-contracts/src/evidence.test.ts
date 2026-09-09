/**
 * The evidence language both platforms print from. The two rules under test are the ones the
 * product keeps re-breaking: unrated is not a fourth grade, and a floor is a claim about assessed
 * strength that an unassessed record cannot satisfy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyEvidenceFloor,
  evidenceLabel,
  evidenceMeterLabel,
  floorLabel,
  gradeDescription,
  gradeForConfidence,
  gradeLabel,
  meetsEvidenceFloor,
  meterLevelForCoverage,
  meterLevelForTier,
  recordConfidenceTier,
} from './evidence.js';

test('a tier maps to one letter, and unrated to none', () => {
  assert.equal(gradeForConfidence('high'), 'A');
  assert.equal(gradeForConfidence('medium'), 'B');
  assert.equal(gradeForConfidence('low'), 'C');
  assert.equal(gradeForConfidence('unrated'), null);
  assert.equal(gradeForConfidence('nonsense'), null);
});

test('unrated fills no segment and prints a placeholder, never a D', () => {
  assert.equal(meterLevelForTier('unrated'), 0);
  assert.equal(gradeLabel(gradeForConfidence('unrated')), '·');
  assert.equal(gradeDescription(null), 'Evidence not graded');
});

test('the visible label carries the grade and, when known, the count', () => {
  assert.equal(evidenceLabel('high', 2), 'Grade A · 2 sources');
  assert.equal(evidenceLabel('low', 1), 'Grade C · 1 source');
  assert.equal(evidenceLabel('unrated', 0), 'Not graded · 0 sources');
  assert.equal(evidenceLabel('medium'), 'Grade B');
});

test('the spoken label says nothing about a count the surface does not have', () => {
  assert.equal(evidenceMeterLabel('high', 4), 'Evidence grade A, 4 sources');
  assert.equal(evidenceMeterLabel('high'), 'Evidence grade A');
  assert.equal(evidenceMeterLabel('high', -1), 'Evidence grade A');
});

test('coverage is a three-step scale of its own', () => {
  assert.equal(meterLevelForCoverage('substantial'), 3);
  assert.equal(meterLevelForCoverage('partial'), 2);
  assert.equal(meterLevelForCoverage('minimal'), 1);
});

test('a letter floor excludes ungraded records; any admits them', () => {
  assert.equal(meetsEvidenceFloor('unrated', 'any'), true);
  assert.equal(meetsEvidenceFloor('unrated', 'C'), false);
  assert.equal(meetsEvidenceFloor('high', 'B'), true);
  assert.equal(meetsEvidenceFloor('low', 'B'), false);
  assert.equal(floorLabel('any'), 'Any');
  assert.equal(floorLabel('A'), 'A only');
  assert.equal(floorLabel('B'), 'B and up');
});

test('the floor predicate keeps stronger grades rather than matching exactly', () => {
  const features = [
    { properties: { confidenceTier: 'high' as const } },
    { properties: { confidenceTier: 'medium' as const } },
    { properties: { confidenceTier: 'unrated' as const } },
  ];
  assert.deepEqual(applyEvidenceFloor(features, 'B'), [features[0], features[1]]);
  assert.equal(applyEvidenceFloor(features, 'any').length, 3);
});

test('recordConfidenceTier caps an uncorroborated record one grade below its strongest claim', () => {
  // The archive's real failure: one authoritative-looking source, graded A on its own say-so.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citationSource: 'wikipedia_api' },
      { confidenceLevel: 'high', citationSource: 'wikipedia_api' },
    ]),
    'medium',
  );
});

test('recordConfidenceTier keeps grade A once a second independent lineage corroborates', () => {
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citationSource: 'npgallery.nps.gov' },
      { confidenceLevel: 'high', citationSource: 'blackpast.org' },
    ]),
    'high',
  );
});

test('recordConfidenceTier does not let Wikipedia be the lineage that lifts a record to A', () => {
  // `claim-corroborate` lists counting Wikipedia as the second lineage under Never. It carried
  // 335 records to grade A before this (repo-goyut).
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citationSource: 'npgallery.nps.gov' },
      { confidenceLevel: 'medium', citationSource: 'en.wikipedia.org' },
    ]),
    'medium',
  );
  // Wikidata is the same lineage, not a third opinion.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citationSource: 'npgallery.nps.gov' },
      { confidenceLevel: 'high', citationSource: 'en.wikipedia.org' },
      { confidenceLevel: 'high', citationSource: 'wikidata.org' },
    ]),
    'medium',
  );
  // But a Wikipedia-only record has still been assessed. Graded low, never reported unrated.
  assert.equal(
    recordConfidenceTier([{ confidenceLevel: 'medium', citationSource: 'wikipedia_api' }]),
    'low',
  );
});

test('recordConfidenceTier does not let a record corroborate itself with its own index row', () => {
  // The real shape of nrhp-black-heritage-00000006: the listing and significance claims are the
  // NARA catalog row the record was seeded from, and the nomination form is the one document
  // anyone actually read. One corroborating lineage, so it cannot reach A (repo-6jizv).
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', predicate: 'listing', citationSource: 'catalog.archives.gov' },
      {
        confidenceLevel: 'high',
        predicate: 'significant for',
        citationSource: 'catalog.archives.gov',
      },
      {
        confidenceLevel: 'high',
        predicate: 'source states',
        citationSource: 'npgallery.nps.gov',
      },
      {
        confidenceLevel: 'medium',
        predicate: 'source states',
        citationSource: 'en.wikipedia.org',
      },
    ]),
    'medium',
  );
  // Two documents read, neither of them the index row: genuinely corroborated.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', predicate: 'listing', citationSource: 'catalog.archives.gov' },
      {
        confidenceLevel: 'high',
        predicate: 'source states',
        citationSource: 'npgallery.nps.gov',
      },
      { confidenceLevel: 'high', predicate: 'source states', citationSource: 'blackpast.org' },
    ]),
    'high',
  );
  // A record carrying nothing but its index row is graded, not reported unassessed.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', predicate: 'listing', citationSource: 'catalog.archives.gov' },
    ]),
    'medium',
  );
});

test('recordConfidenceTier believes claimRole over the predicate that stood in for it', () => {
  // The predicate list only ever described one publisher's vocabulary. A lane that states the
  // role outright must be graded by what it says, or the bridge silently mis-grades it.
  const statedEvidence = [
    // `listing` would read as provenance under the bridge; the role says otherwise.
    {
      confidenceLevel: 'high',
      predicate: 'listing',
      claimRole: 'evidence',
      citationSource: 'catalog.archives.gov',
    },
    {
      confidenceLevel: 'high',
      predicate: 'source states',
      claimRole: 'evidence',
      citationSource: 'npgallery.nps.gov',
    },
  ];
  assert.equal(recordConfidenceTier(statedEvidence), 'high');

  // And the reverse: a predicate the bridge would wave through, stated as the index row.
  const statedIndex = [
    {
      confidenceLevel: 'high',
      predicate: 'source states',
      claimRole: 'record_index',
      citationSource: 'catalog.archives.gov',
    },
    {
      confidenceLevel: 'high',
      predicate: 'source states',
      claimRole: 'evidence',
      citationSource: 'npgallery.nps.gov',
    },
  ];
  assert.equal(recordConfidenceTier(statedIndex), 'medium');
});

test('recordConfidenceTier does not let one publisher corroborate itself', () => {
  // Four spellings of Wikipedia are one lineage, not four sources.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citationSource: 'wikipedia_api' },
      { confidenceLevel: 'high', citationSource: 'wikipedia.org' },
      { confidenceLevel: 'high', citationSource: 'en.wikipedia.org' },
      { confidenceLevel: 'high', citationSource: 'en.m.wikipedia.org' },
    ]),
    'medium',
  );
  // Same for a bare subdomain prefix on any other host.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citationSource: 'www.nps.gov' },
      { confidenceLevel: 'high', citationSource: 'nps.gov' },
    ]),
    'medium',
  );
});

test('recordConfidenceTier reads the nested wire citation shape too', () => {
  // ClaimV1 and the phone's Claim nest what the projection keeps flat. Both must grade alike,
  // or the same record reads as two different assessments depending on the screen.
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citation: { source: 'blackpast.org' } },
      { confidenceLevel: 'high', citation: { source: 'npgallery.nps.gov' } },
    ]),
    'high',
  );
  assert.equal(
    recordConfidenceTier([
      { confidenceLevel: 'high', citation: { source: 'catalog.archives.gov' } },
    ]),
    'medium',
  );
});

test('recordConfidenceTier reports unrated for a record nobody assessed', () => {
  assert.equal(recordConfidenceTier([]), 'unrated');
  // A claim with no citation at all cannot be graded, and is not therefore a low grade.
  assert.equal(recordConfidenceTier([{ confidenceLevel: 'high' }]), 'unrated');
  assert.equal(recordConfidenceTier([{ citationSource: 'nps.gov' }]), 'unrated');
});

test('recordConfidenceTier floors at low rather than inventing a fourth grade', () => {
  assert.equal(
    recordConfidenceTier([{ confidenceLevel: 'low', citationSource: 'nps.gov' }]),
    'low',
  );
  assert.equal(
    recordConfidenceTier([{ confidenceLevel: 'medium', citationSource: 'nps.gov' }]),
    'low',
  );
});
