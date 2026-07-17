/**
 * Tests for BB-049 AC1: deterministic, auditable ranking by text relevance + connection strength
 * (not fame alone), with bounded misspelling tolerance that never fires below the fuzzy floor.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levenshtein, normalizeQuery, rankRecords } from './ranking.js';
import type { SearchableEntityRecord } from './types.js';

function record(
  overrides: Partial<SearchableEntityRecord> & Pick<SearchableEntityRecord, 'id' | 'displayName'>,
): SearchableEntityRecord {
  const displayName = overrides.displayName;
  return {
    kind: 'place',
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...overrides,
    id: overrides.id,
    displayName,
    nameLower: overrides.nameLower ?? displayName.toLowerCase(),
  };
}

test('exact name match ranks above a substring match', () => {
  const exact = record({ id: 'a1', displayName: 'School' });
  const substring = record({ id: 'b1', displayName: 'Old School House' });
  const ranked = rankRecords('school', [substring, exact]);
  assert.deepEqual(
    ranked.map((r) => r.record.id),
    ['a1', 'b1'],
  );
  assert.equal(ranked[0]?.matchedOn, 'displayName');
});

test('connection strength never overrides a stronger text tier', () => {
  // The substring record is far more connected, but the exact match must still win.
  const exact = record({ id: 'exact', displayName: 'School', relatedCount: 0 });
  const substring = record({ id: 'popular', displayName: 'Popular School Annex', relatedCount: 999 });
  const ranked = rankRecords('school', [substring, exact]);
  assert.deepEqual(
    ranked.map((r) => r.record.id),
    ['exact', 'popular'],
  );
});

test('equal text tier orders by relatedCount desc, then id asc', () => {
  const a = record({ id: 'z', displayName: 'North School', relatedCount: 2 });
  const b = record({ id: 'a', displayName: 'South School', relatedCount: 5 });
  const c = record({ id: 'c', displayName: 'West School', relatedCount: 5 });
  const ranked = rankRecords('school', [a, b, c]);
  // relatedCount desc => (b,c both 5) before (a=2); within the tie, id asc => a before c.
  assert.deepEqual(
    ranked.map((r) => r.record.id),
    ['a', 'c', 'z'],
  );
});

test('a single-typo query (distance <= 2, length >= 4) still matches via the fuzzy tier', () => {
  const rec = record({ id: 'r1', displayName: 'Rosewood' });
  const ranked = rankRecords('rosewod', [rec]); // one deleted letter, distance 1
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.record.id, 'r1');
  assert.equal(ranked[0]?.matchedOn, 'displayName');
});

test('a 2-char query is NOT fuzzy-matched (stays clear of BB-026 minQueryLength)', () => {
  const rec = record({ id: 'az', displayName: 'Az' }); // levenshtein('zz','az') === 1
  const ranked = rankRecords('zz', [rec]);
  assert.equal(ranked.length, 0);
});

test('alias substring match beats a summary match', () => {
  const aliasHit = record({ id: 'alias', displayName: 'Unrelated Name', aliases: ['freedom school'] });
  const summaryHit = record({
    id: 'summary',
    displayName: 'Another Name',
    summary: 'A school for freedmen in the district.',
  });
  const ranked = rankRecords('school', [summaryHit, aliasHit]);
  assert.deepEqual(
    ranked.map((r) => r.record.id),
    ['alias', 'summary'],
  );
  assert.equal(ranked[0]?.matchedOn, 'alias');
  assert.equal(ranked[1]?.matchedOn, 'summary');
});

test('empty query is browse-all: every record returned, ordered by connection strength then id', () => {
  const a = record({ id: 'a', displayName: 'One', relatedCount: 1 });
  const b = record({ id: 'b', displayName: 'Two', relatedCount: 9 });
  const ranked = rankRecords('', [a, b]);
  assert.deepEqual(
    ranked.map((r) => r.record.id),
    ['b', 'a'],
  );
});

test('normalizeQuery trims, lowercases, and collapses whitespace', () => {
  assert.equal(normalizeQuery('  Freedom   School '), 'freedom school');
});

test('levenshtein bails out early when the length gap exceeds max', () => {
  assert.equal(levenshtein('ab', 'abcdef', 2), 3); // returns max + 1 sentinel
  assert.equal(levenshtein('kitten', 'sitting', 3), 3);
  assert.equal(levenshtein('same', 'same', 2), 0);
});
