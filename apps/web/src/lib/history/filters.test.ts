/**
 * Unit tests for `/history` filter helpers: slug normalization, facet builders, and filter application.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITY_KINDS } from '@repo/domain';
import {
  applyHistoryConnectionsFilter,
  applyHistoryKindFilter,
  applyHistoryStatusFilter,
  applyHistoryTopicFilter,
  buildHistoryKindCategoryFacetOptions,
  buildHistoryStatusFacetOptions,
  buildHistoryTopicFacetOptions,
  DEFAULT_HISTORY_FILTERS,
  HISTORY_FILTER_GROUPS,
  HISTORY_KIND_CATEGORIES,
  HISTORY_KIND_TO_CATEGORY,
  historyKindToRecordsKind,
  historyKindsForCategory,
  isHistoryKindCategory,
  statusLabelToSlug,
  trimHistoryEdgesToNodes,
} from './filters';

test('HISTORY_FILTER_GROUPS covers every non-sort facet exactly once', () => {
  const grouped = Object.values(HISTORY_FILTER_GROUPS).flatMap((group) => group.facets);
  // Sort is result ordering, deliberately excluded from the filter groups.
  assert.deepEqual([...grouped].sort(), ['connections', 'era', 'kind', 'status', 'topic']);
  assert.equal(new Set(grouped).size, grouped.length, 'no facet appears in two groups');
});

test('HISTORY_FILTER_GROUPS groups era + status together and defers topics', () => {
  assert.deepEqual([...HISTORY_FILTER_GROUPS.timeContext.facets].sort(), ['era', 'status']);
  assert.deepEqual(HISTORY_FILTER_GROUPS.recordType.facets, ['kind']);
  assert.deepEqual(HISTORY_FILTER_GROUPS.relationships.facets, ['connections']);
  assert.equal(HISTORY_FILTER_GROUPS.topics.advanced, true);
});

test('historyKindToRecordsKind remaps history-only categories at the redirect boundary', () => {
  assert.equal(historyKindToRecordsKind('law'), 'sources');
  assert.equal(historyKindToRecordsKind('works'), 'sources');
  assert.equal(historyKindToRecordsKind('people'), 'people');
  assert.equal(historyKindToRecordsKind('place'), 'place');
  assert.equal(historyKindToRecordsKind('all'), 'all');
  assert.equal(historyKindToRecordsKind(''), '');
});

test('every canonical entity kind maps to exactly one consolidated category', () => {
  for (const kind of ENTITY_KINDS) {
    const categoryId = HISTORY_KIND_TO_CATEGORY[kind];
    assert.ok(categoryId, `kind "${kind}" is not assigned to any category`);
    const owners = HISTORY_KIND_CATEGORIES.filter((category) =>
      (category.kinds as readonly string[]).includes(kind),
    );
    assert.equal(owners.length, 1, `kind "${kind}" must belong to exactly one category`);
  }
  // No category references a kind outside the canonical vocabulary.
  for (const category of HISTORY_KIND_CATEGORIES) {
    for (const kind of category.kinds) {
      assert.ok(
        (ENTITY_KINDS as readonly string[]).includes(kind),
        `category "${category.id}" references non-canonical kind "${kind}"`,
      );
    }
  }
});

test('historyKindToRecordsKind remaps history-only categories at the redirect boundary', () => {
  assert.equal(historyKindToRecordsKind('law'), 'sources');
  assert.equal(historyKindToRecordsKind('works'), 'sources');
  assert.equal(historyKindToRecordsKind('people'), 'people');
  assert.equal(historyKindToRecordsKind('place'), 'place');
  assert.equal(historyKindToRecordsKind('all'), 'all');
  assert.equal(historyKindToRecordsKind(''), '');
});

test('category ids and raw kinds are distinguishable', () => {
  assert.equal(isHistoryKindCategory('organizations'), true);
  assert.equal(isHistoryKindCategory('place'), false);
  assert.equal(isHistoryKindCategory('all'), false);
  assert.deepEqual([...historyKindsForCategory('organizations')].sort(), [
    'institution',
    'organization',
    'school',
  ]);
  assert.deepEqual(historyKindsForCategory('nope'), []);
});

test('buildHistoryKindCategoryFacetOptions rolls raw kinds up by category with summed counts', () => {
  const options = buildHistoryKindCategoryFacetOptions([
    { kind: 'school' },
    { kind: 'institution' },
    { kind: 'organization' },
    { kind: 'person' },
    { kind: 'place' },
  ]);
  assert.equal(options[0]!.value, 'all');
  const organizations = options.find((entry) => entry.value === 'organizations');
  assert.ok(organizations);
  assert.equal(organizations!.count, 3);
  // Categories with zero records in the slice are omitted (no events/law/works here).
  assert.equal(
    options.some((entry) => entry.value === 'events'),
    false,
  );
  // Declared category order is preserved (people before places before organizations).
  const ordered = options.filter((entry) => entry.value !== 'all').map((entry) => entry.value);
  assert.deepEqual(ordered, ['people', 'places', 'organizations']);
});

test('applyHistoryKindFilter matches a category by any member kind, and raw kinds exactly', () => {
  const nodes = [
    { kind: 'school' },
    { kind: 'institution' },
    { kind: 'person' },
    { kind: 'place' },
  ];
  const orgs = applyHistoryKindFilter(nodes, {
    ...DEFAULT_HISTORY_FILTERS,
    kind: 'organizations',
  });
  assert.deepEqual(orgs.map((node) => node.kind).sort(), ['institution', 'school']);
  const rawSchools = applyHistoryKindFilter(nodes, { ...DEFAULT_HISTORY_FILTERS, kind: 'school' });
  assert.equal(rawSchools.length, 1);
  assert.equal(rawSchools[0]!.kind, 'school');
  const all = applyHistoryKindFilter(nodes, { ...DEFAULT_HISTORY_FILTERS, kind: 'all' });
  assert.equal(all.length, 4);
});

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
