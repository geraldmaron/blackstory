/**
 * Tests for the story-dimension taxonomy and the result-set-level violence-only-collapse
 * guard.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertResultsNotViolenceOnlyCollapse,
  classifyStoryDimensions,
  isViolenceOnlyCollapse,
} from './why-public-dimensions.js';

test('classifyStoryDimensions returns dimensions in canonical order, deduped', () => {
  const dimensions = classifyStoryDimensions([
    'The family founded a mutual aid society and organized a boycott.',
    'They also celebrated a jubilee festival every year.',
  ]);
  assert.deepEqual(dimensions, [
    'achievement',
    'joy',
    'family',
    'community',
    'institution_building',
    'resistance',
  ]);
});

test('classifyStoryDimensions returns an empty array for blank or unmatched text', () => {
  assert.deepEqual(classifyStoryDimensions([]), []);
  assert.deepEqual(classifyStoryDimensions(['   ', '']), []);
  assert.deepEqual(classifyStoryDimensions(['A record with no matched keyword content.']), []);
});

test('isViolenceOnlyCollapse is true only for a sole harm dimension', () => {
  assert.equal(isViolenceOnlyCollapse(['harm']), true);
  assert.equal(isViolenceOnlyCollapse(['harm', 'community']), false);
  assert.equal(isViolenceOnlyCollapse([]), false);
  assert.equal(isViolenceOnlyCollapse(['community']), false);
});

test('assertResultsNotViolenceOnlyCollapse passes when no entity is harm-classified', () => {
  assert.doesNotThrow(() =>
    assertResultsNotViolenceOnlyCollapse([['community'], ['achievement'], []]),
  );
});

test('assertResultsNotViolenceOnlyCollapse passes when at least one harm entity has balance', () => {
  assert.doesNotThrow(() =>
    assertResultsNotViolenceOnlyCollapse([['harm'], ['harm', 'community', 'resistance']]),
  );
});

test('assertResultsNotViolenceOnlyCollapse passes when the set mixes harm-only with non-harm entities', () => {
  assert.doesNotThrow(() => assertResultsNotViolenceOnlyCollapse([['harm'], ['achievement', 'joy']]));
});

test('assertResultsNotViolenceOnlyCollapse throws when every harm-classified entity in the set is harm-only', () => {
  assert.throws(
    () => assertResultsNotViolenceOnlyCollapse([['harm'], ['harm']]),
    /collapses Black history into violence-only content/,
  );
});
