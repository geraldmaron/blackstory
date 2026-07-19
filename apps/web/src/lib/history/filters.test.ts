/**
 * Unit tests for `/history` filter helpers: slug normalization, facet builders, and filter application.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyHistoryConnectionsFilter,
  applyHistoryStatusFilter,
  applyHistoryTopicFilter,
  buildHistoryStatusFacetOptions,
  buildHistoryTopicFacetOptions,
  statusLabelToSlug,
  trimHistoryEdgesToNodes,
} from './filters';

test('statusLabelToSlug produces stable hyphenated slugs', () => {
  assert.equal(statusLabelToSlug('Historic'), 'historic');
  assert.equal(
    statusLabelToSlug('Status not yet published for this record'),
    'status-not-yet-published-for-this-record',
  );
});

test('applyHistoryStatusFilter matches by slug case-insensitively', () => {
  const nodes = [{ statusLabel: 'Historic' }, { statusLabel: 'Active' }];
  const filtered = applyHistoryStatusFilter(nodes, 'historic');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.statusLabel, 'Historic');
});

test('applyHistoryTopicFilter matches topic tag membership', () => {
  const nodes = [{ topicTags: ['education', 'schools'] }, { topicTags: ['church'] }];
  const filtered = applyHistoryTopicFilter(nodes, 'education');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.topicTags[0], 'education');
});

test('applyHistoryConnectionsFilter separates connected and isolated nodes', () => {
  const nodes = [{ connectionCount: 2 }, { connectionCount: 0 }];
  assert.equal(applyHistoryConnectionsFilter(nodes, 'with').length, 1);
  assert.equal(applyHistoryConnectionsFilter(nodes, 'without').length, 1);
  assert.equal(applyHistoryConnectionsFilter(nodes, 'all').length, 2);
});

test('buildHistoryStatusFacetOptions aggregates counts before downstream filters', () => {
  const facets = buildHistoryStatusFacetOptions([
    { statusLabel: 'Historic' },
    { statusLabel: 'Historic' },
    { statusLabel: 'Active' },
  ]);
  assert.equal(facets[0]!.value, 'all');
  const historic = facets.find((entry) => entry.value === 'historic');
  assert.ok(historic);
  assert.equal(historic!.count, 2);
  assert.equal(historic!.label, 'Historic');
});

test('buildHistoryTopicFacetOptions aggregates tag counts', () => {
  const facets = buildHistoryTopicFacetOptions([
    { topicTags: ['education', 'schools'] },
    { topicTags: ['education'] },
  ]);
  const education = facets.find((entry) => entry.value === 'education');
  assert.ok(education);
  assert.equal(education!.count, 2);
});

test('trimHistoryEdgesToNodes keeps only edges with both endpoints visible', () => {
  const edges = [
    { fromEntityId: 'a', toEntityId: 'b' },
    { fromEntityId: 'a', toEntityId: 'c' },
  ];
  const trimmed = trimHistoryEdgesToNodes(edges, new Set(['a', 'b']));
  assert.equal(trimmed.length, 1);
  assert.equal(trimmed[0]!.toEntityId, 'b');
});
