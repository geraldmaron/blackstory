/**
 * Tests for the codified per-kind content expectations and the deterministic audit evaluator.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITY_KINDS } from '../entity-kinds.js';
import {
  ARTICLE_CONTENT_EXPECTATIONS,
  CONTENT_EXPECTATIONS,
  CONTENT_EXPECTATIONS_SPEC_VERSION,
  countNarrativeParagraphs,
  evaluateContentExpectations,
  specForKind,
} from './index.js';

const PARA = 'A substantive paragraph of narrative prose that clears the forty character floor.';

test('every entity kind has a spec', () => {
  for (const kind of ENTITY_KINDS) {
    assert.equal(CONTENT_EXPECTATIONS[kind].appliesTo, kind);
  }
  assert.equal(ARTICLE_CONTENT_EXPECTATIONS.appliesTo, 'article');
  assert.equal(specForKind('article'), ARTICLE_CONTENT_EXPECTATIONS);
});

test('paragraph counting splits on blank lines and ignores fragments', () => {
  assert.equal(countNarrativeParagraphs([`${PARA}\n\n${PARA}`, undefined, 'stub']), 2);
  assert.equal(countNarrativeParagraphs([]), 0);
});

test('law with one thin paragraph, no impact statement, no cases fails with reasons', () => {
  const result = evaluateContentExpectations({
    id: 'law-1',
    kind: 'law',
    narrativeBlocks: [PARA],
    distinctSourceCount: 1,
    researchCoverage: 'minimal',
  });
  assert.equal(result.passed, false);
  assert.equal(result.specVersion, CONTENT_EXPECTATIONS_SPEC_VERSION);
  assert.deepEqual(result.failedCheckIds, [
    'narrative_paragraphs',
    'impact_statement',
    'case_references',
    'distinct_sources',
    'research_coverage',
  ]);
  for (const check of result.checks) assert.ok(check.reason.length > 0);
});

test('law meeting the full bar passes', () => {
  const result = evaluateContentExpectations({
    id: 'law-2',
    kind: 'law',
    narrativeBlocks: [`${PARA}\n\n${PARA}`],
    impactStatement: PARA,
    caseReferenceCount: 3,
    distinctSourceCount: 2,
    researchCoverage: 'substantial',
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.failedCheckIds, []);
});

test('place (historic site) requires a second source beyond Wikipedia', () => {
  const base = {
    id: 'place-1',
    kind: 'place' as const,
    narrativeBlocks: [PARA],
    researchCoverage: 'partial' as const,
  };
  const wikipediaOnly = evaluateContentExpectations({ ...base, distinctSourceCount: 1 });
  assert.deepEqual(wikipediaOnly.failedCheckIds, ['distinct_sources']);
  const withNrhp = evaluateContentExpectations({ ...base, distinctSourceCount: 2 });
  assert.equal(withNrhp.passed, true);
});

test('missing researchCoverage is treated as minimal, failing partial floors', () => {
  const result = evaluateContentExpectations({
    id: 'person-1',
    kind: 'person',
    narrativeBlocks: [PARA],
    distinctSourceCount: 1,
  });
  assert.deepEqual(result.failedCheckIds, ['research_coverage']);
});
