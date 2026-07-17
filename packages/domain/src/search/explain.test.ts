/**
 * Tests for each result explains WHY it matched, in a short factual sentence never a
 * numeric score, never a redacted field.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExplanation } from './explain.js';
import type { SearchableEntityRecord } from './types.js';

const REC: SearchableEntityRecord = {
  id: 'e1',
  kind: 'school',
  displayName: 'Freedom School',
  nameLower: 'freedom school',
  aliases: ['colored school no. 1'],
  topicTags: ['education'],
  eraBuckets: ['1860s'],
  notabilityBasis: [{ criterion: 'community_anchor', note: 'basis', evidenceIds: ['ev-1'] }],
  notabilityLabels: ['A community anchor institution.'],
  recordMaturity: 'minimum_record',
  researchCoverage: 'partial',
  relatedCount: 3,
  claimCount: 2,
};

test('a name match explains "Matched on name"', () => {
  assert.equal(buildExplanation(REC, 'displayName', REC.displayName, 'freedom'), 'Matched on name.');
});

test('an alias match quotes the alias', () => {
  assert.equal(
    buildExplanation(REC, 'alias', 'colored school no. 1', 'colored'),
    'Matched alias "colored school no. 1".',
  );
});

test('a topic match names and capitalizes the topic', () => {
  assert.equal(buildExplanation(REC, 'topicTags', 'education', 'education'), 'Matched topic: Education.');
});

test('a summary match is described without echoing internal text', () => {
  assert.equal(buildExplanation(REC, 'summary', 'freedom', 'freedom'), 'Matched in the summary text.');
});

test('an empty query yields a neutral browse explanation', () => {
  assert.equal(buildExplanation(REC, 'displayName', REC.displayName, ''), 'Included in the current release.');
});

test('no explanation ever contains a numeric score, evidence count, or the word "score"', () => {
  const explanations = [
    buildExplanation(REC, 'displayName', REC.displayName, 'freedom'),
    buildExplanation(REC, 'topicTags', 'education', 'education'),
    buildExplanation(REC, 'summary', 'freedom', 'freedom'),
    buildExplanation(REC, 'displayName', REC.displayName, ''),
  ];
  for (const explanation of explanations) {
    assert.ok(!/\d/.test(explanation), `explanation leaked a digit: ${explanation}`);
    assert.ok(!/score/i.test(explanation), `explanation leaked "score": ${explanation}`);
  }
});
