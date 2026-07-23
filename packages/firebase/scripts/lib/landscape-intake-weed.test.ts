/**
 * Unit tests for landscape intake weed classification (Track C).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyLandscapeWeed,
  type LandscapeWeedRow,
} from './landscape-intake-weed.ts';

const baseRow = (overrides: Partial<LandscapeWeedRow> = {}): LandscapeWeedRow => ({
  id: 'dc-black-history-sites-b1',
  lane: 'dc-sites',
  displayName: 'Sample Site',
  status: 'pending',
  sourceCategory: 'Institution',
  lat: 38.9,
  lng: -77.03,
  canonicalUrl: 'https://historicsites.dcpreservation.org/items/show/1',
  ...overrides,
});

test('classifyLandscapeWeed dead-letters empty title', () => {
  const result = classifyLandscapeWeed({
    row: baseRow({ displayName: '   ' }),
    catalogDuplicate: false,
  });
  assert.equal(result?.action, 'dead_letter');
  assert.equal(result?.ruleId, 'empty_title');
});

test('classifyLandscapeWeed parks People category for privacy review', () => {
  const result = classifyLandscapeWeed({
    row: baseRow({ sourceCategory: 'People' }),
    catalogDuplicate: false,
  });
  assert.equal(result?.action, 'park');
  assert.equal(result?.ruleId, 'privacy_review_person');
});

test('classifyLandscapeWeed leaves catalog duplicate for Track B', () => {
  const result = classifyLandscapeWeed({
    row: baseRow(),
    catalogDuplicate: true,
  });
  assert.equal(result?.action, 'leave');
  assert.equal(result?.ruleId, 'catalog_duplicate');
});

test('classifyLandscapeWeed parks greenbook lane for living risk', () => {
  const result = classifyLandscapeWeed({
    row: baseRow({ lane: 'greenbook', sourceCategory: 'Tourist Home' }),
    catalogDuplicate: false,
  });
  assert.equal(result?.action, 'park');
  assert.equal(result?.ruleId, 'greenbook_living_risk');
});

test('classifyLandscapeWeed dead-letters mock packets', () => {
  const result = classifyLandscapeWeed({
    row: baseRow({ id: 'mock-fixture-001' }),
    catalogDuplicate: false,
  });
  assert.equal(result?.action, 'dead_letter');
  assert.equal(result?.ruleId, 'mock_test_packet');
});
