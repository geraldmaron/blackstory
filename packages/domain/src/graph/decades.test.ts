/**
 * Tests for per-decade view materialization buckets an
 * entity into EVERY decade of its active span (derived from status/statusHistory and
 * start/end fields), never only the decade of creation/founding. Also covers acceptance
 * criterion 3's per-decade node/edge sets and all-time union view.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentStatus, type StatusHistoryEntry, type EntityStatusValue } from '../entity-status.js';
import type { EntityRelationship } from '../relationship.js';
import {
  buildAllTimeView,
  buildDecadeViews,
  deriveActiveDecadeBuckets,
} from './decades.js';
import { GRAPH_GOLD_FIXTURES } from './fixtures.js';

function rel(overrides: Partial<EntityRelationship> & Pick<EntityRelationship, 'id' | 'fromEntityId' | 'toEntityId' | 'type'>): EntityRelationship {
  return {
    evidenceIds: ['ev-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The CRITICAL proof: an entity founded in one decade and still active appears in every
// subsequent published decade view up to the "still active" cutoff not only its founding decade.
// ---------------------------------------------------------------------------

test('an entity founded in the 1950s with an open-ended (still active) status appears in EVERY decade through the cutoff, not just its founding decade', () => {
  // Real statusHistory shape: founded 1957, open-ended (still active) record.
  const statusHistory: readonly StatusHistoryEntry<EntityStatusValue>[] = [
    { status: 'active', validFrom: '1957', validTo: null, datePrecision: 'year', basisClaimIds: ['c1'] },
  ];
  // Caller resolves statusHistory into EraSpan windows (this module never re-derives logic).
  const activeSpans = statusHistory.map((entry) => ({
    validFrom: entry.validFrom!,
    validTo: entry.validTo,
    datePrecision: entry.datePrecision,
  }));

  const buckets = deriveActiveDecadeBuckets(
    { entityId: 'gg-org-league', activeSpans },
    { stillActiveCutoff: '2026' },
  );

  // NOT just ["1950s"] every decade from founding through the cutoff.
  assert.deepEqual(buckets, [
    '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s',
  ]);
  assert.ok(buckets.length > 1, 'a still-active entity must span more than its founding decade alone');
});

test('WITHOUT a stillActiveCutoff, an open-ended span resolves to only its founding decade (documents the failure mode this option prevents)', () => {
  const buckets = deriveActiveDecadeBuckets({
    entityId: 'gg-org-league',
    activeSpans: [{ validFrom: '1957', validTo: null, datePrecision: 'year' }],
  });
  assert.deepEqual(buckets, ['1950s']);
});

test('a closed (non-open-ended) span buckets only its actual active decades, no more', () => {
  const buckets = deriveActiveDecadeBuckets(
    {
      entityId: 'gg-place-historic-town',
      activeSpans: [{ validFrom: '1880', validTo: '1962', datePrecision: 'year' }],
    },
    { stillActiveCutoff: '2026' },
  );
  assert.deepEqual(buckets, [
    '1880s', '1890s', '1900s', '1910s', '1920s', '1930s', '1940s', '1950s', '1960s',
  ]);
  assert.ok(!buckets.includes('2020s'), 'a closed span must not extend to the present cutoff');
});

test('multiple disjoint active windows union into one decade-bucket set', () => {
  const buckets = deriveActiveDecadeBuckets({
    entityId: 'gg-institution-reopened',
    activeSpans: [
      { validFrom: '1900', validTo: '1920', datePrecision: 'year' },
      { validFrom: '1980', validTo: '1990', datePrecision: 'year' },
    ],
  });
  assert.deepEqual(buckets, ['1900s', '1910s', '1920s', '1980s', '1990s']);
});

// ---------------------------------------------------------------------------
// per-decade node/edge sets + all-time union view.
// ---------------------------------------------------------------------------

test('buildDecadeViews places the still-active org in every decade view through the cutoff, and the single-decade event in only its own decade', () => {
  const entities = [
    GRAPH_GOLD_FIXTURES.decadeBucketing.stillActiveOrg,
    GRAPH_GOLD_FIXTURES.decadeBucketing.singleDecadeEvent,
  ];
  const relationships = [
    rel({
      id: 'r-participated',
      fromEntityId: 'gg-org-league',
      toEntityId: 'gg-event-rally',
      type: 'participated_in',
      temporal: { validFrom: '1963', validTo: '1963' },
    }),
  ];

  const views = buildDecadeViews({ entities, relationships }, { stillActiveCutoff: '2026' });
  const byDecade = new Map(views.map((v) => [v.decade, v]));

  // The org (founded 1957, still active) is present in the 1960s AND far beyond.
  assert.ok(byDecade.get('1960s')?.nodeIds.includes('gg-org-league'));
  assert.ok(byDecade.get('2020s')?.nodeIds.includes('gg-org-league'));
  // The event is only ever active in the 1960s.
  assert.ok(byDecade.get('1960s')?.nodeIds.includes('gg-event-rally'));
  assert.ok(!byDecade.get('2020s')?.nodeIds.includes('gg-event-rally'));

  // The participated_in edge only appears in decades where BOTH endpoints are present AND its
  // own temporal window overlaps i.e. only 1960s, not 2020s (event isn't a 2020s node at all).
  assert.ok(byDecade.get('1960s')?.edgeIds.includes('r-participated'));
  assert.ok(!(byDecade.get('2020s')?.edgeIds.includes('r-participated') ?? false));
});

test('buildDecadeViews output is sorted/deterministic and re-runnable', () => {
  const entities = [GRAPH_GOLD_FIXTURES.decadeBucketing.stillActiveOrg];
  const relationships: readonly EntityRelationship[] = [];
  const first = buildDecadeViews({ entities, relationships }, { stillActiveCutoff: '2000' });
  const second = buildDecadeViews({ entities, relationships }, { stillActiveCutoff: '2000' });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((v) => v.decade),
    [...first.map((v) => v.decade)].sort(),
  );
});

test('buildAllTimeView unions every decade view into one deduplicated, sorted node/edge set', () => {
  const decadeViews = buildDecadeViews(
    {
      entities: [GRAPH_GOLD_FIXTURES.decadeBucketing.stillActiveOrg],
      relationships: [],
    },
    { stillActiveCutoff: '1980' },
  );
  const allTime = buildAllTimeView(decadeViews);
  assert.deepEqual(allTime.nodeIds, ['gg-org-league']);
  assert.deepEqual(allTime.nodeIds, [...new Set(allTime.nodeIds)]); // deduplicated
});

// Sanity: confirms this test exercises the real currentStatus derivation (never
// reimplemented locally) so the "still active" premise above is grounded in the real function.
test('sanity: currentStatus derives "active" from the same open-ended record used above', () => {
  const statusHistory: readonly StatusHistoryEntry<EntityStatusValue>[] = [
    { status: 'active', validFrom: '1957', validTo: null, datePrecision: 'year', basisClaimIds: ['c1'] },
  ];
  assert.equal(currentStatus(statusHistory), 'active');
});
