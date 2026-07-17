/**
 * Unit tests for the seed graph substrate feeding the entity page.
 * Confirms `related`/`timeline` are genuinely DERIVED through the real domain graph-view builders
 * over typed edges not hand-typed final arrays and that status/sensitivity fixtures resolve
 * as expected.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGraphTimeline,
  currentStatusFor,
  relatedEntriesFor,
  relationshipSentence,
  sensitivityFor,
  statusHistoryFor,
  type TimelineRelatedEntry,
} from './entity-graph-seed';

test('relatedEntriesFor derives both directions of an adjacency from the raw typed edges', () => {
  const schoolRelated = relatedEntriesFor('ent_seed_school_001');
  assert.equal(schoolRelated.length, 2, 'school is located_at place (outgoing) and occurred_at target of the event (incoming)');
  const toPlace = schoolRelated.find((entry) => entry.id === 'ent_seed_place_001');
  assert.ok(toPlace);
  assert.equal(toPlace.type, 'located_at');
  assert.equal(toPlace.direction, 'outgoing');
  const fromEvent = schoolRelated.find((entry) => entry.id === 'ent_seed_event_001');
  assert.ok(fromEvent);
  assert.equal(fromEvent.direction, 'incoming');
});

test('relatedEntriesFor returns an empty list for an entity with no edges, never throws', () => {
  assert.deepEqual(relatedEntriesFor('ent_does_not_exist'), []);
});

test('currentStatusFor / statusHistoryFor derive status from the open-ended history, never an independent scalar', () => {
  assert.equal(currentStatusFor('ent_seed_school_001'), 'active');
  const history = statusHistoryFor('ent_seed_school_001');
  assert.equal(history?.length, 2);
  assert.equal(history?.[0]?.status, 'historic');
  assert.equal(history?.[1]?.status, 'active');
  // event kinds are statusless by design no history entry exists.
  assert.equal(currentStatusFor('ent_seed_event_001'), undefined);
  assert.equal(statusHistoryFor('ent_seed_event_001'), undefined);
});

test('sensitivityFor exposes the schema-only BB-090 flag, citing a real claim on the entity', () => {
  const sensitivity = sensitivityFor('ent_seed_place_001');
  assert.ok(sensitivity);
  assert.equal(sensitivity.class, 'contested_legacy');
  assert.deepEqual(sensitivity.basisClaimIds, ['claim_seed_005']);
  assert.equal(sensitivityFor('ent_seed_school_001'), undefined);
});

test('relationshipSentence produces the correct direction-aware sentence for a known edge type', () => {
  const outgoing: TimelineRelatedEntry = { id: 'x', type: 'located_at', direction: 'outgoing' };
  assert.equal(relationshipSentence(outgoing, 'A', 'B'), 'A is located at B.');
  const incoming: TimelineRelatedEntry = { id: 'x', type: 'located_at', direction: 'incoming' };
  assert.equal(relationshipSentence(incoming, 'A', 'B'), 'B is located at A.');
});

test('relationshipSentence falls back to a humanized generic template for an unmapped edge type', () => {
  const entry: TimelineRelatedEntry = { id: 'x', type: 'some_new_type', direction: 'outgoing' };
  assert.equal(relationshipSentence(entry, 'A', 'B'), 'A some new type B.');
});

test('buildGraphTimeline merges status-history and dated related-edge entries in chronological order', () => {
  const entitiesById = new Map([
    ['ent_seed_place_001', { displayName: 'Seed Historical Place' }],
  ]);
  const history = statusHistoryFor('ent_seed_school_001');
  const timeline = buildGraphTimeline(
    {
      id: 'ent_seed_school_001',
      displayName: 'Seed Freedmen School',
      ...(history !== undefined ? { statusHistory: history } : {}),
      related: relatedEntriesFor('ent_seed_school_001').filter((entry) => entry.timespan?.validFrom),
    },
    entitiesById,
  );
  const times = timeline.map((entry) => entry.time);
  assert.deepEqual(times, [...times].sort((a, b) => a.localeCompare(b)), 'timeline must be chronologically sorted');
  assert.ok(timeline.some((entry) => entry.time === '1868'));
  assert.ok(timeline.some((entry) => entry.time === '1954'));
});
