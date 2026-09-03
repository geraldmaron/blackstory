/**
 * Sheet sources and connections, derived from the history-graph edges the map already ships.
 *
 * The two assertions that matter to a reader: a source backing three relationships is listed
 * once (a bibliography, not a tally), and the connection carries the relation in words so the row
 * states what the archive documented rather than just naming a neighbouring record.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryEdgeView } from '../history/build-history-graph';
import {
  buildSheetConnections,
  buildSheetSources,
  edgesTouching,
  relationPhrase,
} from './build-sheet-detail';

function edge(over: Partial<HistoryEdgeView>): HistoryEdgeView {
  return {
    edgeId: 'e1',
    relationshipId: 'r1',
    type: 'founded_by',
    fromEntityId: 'ent_a',
    toEntityId: 'ent_b',
    fromDisplayName: 'Gaston Motel',
    toDisplayName: 'A.G. Gaston',
    evidenceCount: 1,
    citations: [{ id: 'src_1', label: 'National Register nomination' }],
    sentence: 'Gaston Motel was founded by A.G. Gaston.',
    ...over,
  };
}

test('edges are found in both directions', () => {
  const edges = [edge({}), edge({ edgeId: 'e2', fromEntityId: 'ent_c', toEntityId: 'ent_a' })];
  assert.equal(edgesTouching(edges, 'ent_a').length, 2);
  assert.equal(edgesTouching(edges, 'ent_z').length, 0);
});

test('the relation reads as words, not a slug', () => {
  assert.equal(relationPhrase('founded_by'), 'founded by');
  assert.equal(relationPhrase('DOCUMENTED-AT'), 'documented at');
});

test('a connection names the entity at the other end, whichever end that is', () => {
  const outbound = buildSheetConnections([edge({})], 'ent_a');
  assert.deepEqual(
    outbound.map((c) => [c.id, c.name, c.relation]),
    [['ent_b', 'A.G. Gaston', 'founded by']],
  );
  const inbound = buildSheetConnections([edge({})], 'ent_b');
  assert.deepEqual(
    inbound.map((c) => c.name),
    ['Gaston Motel'],
  );
});

test('the lookup supplies kind, tone and href when the plate is carrying that pin', () => {
  const [connection] = buildSheetConnections([edge({})], 'ent_a', () => ({
    name: 'A. G. Gaston',
    kind: 'person',
    mapTone: 'amber',
    href: '/entity/ent_b',
  }));
  assert.deepEqual(
    [connection?.name, connection?.kind, connection?.mapTone, connection?.href],
    ['A. G. Gaston', 'person', 'amber', '/entity/ent_b'],
  );
});

test('two relationships to the same record render one connection row', () => {
  const edges = [edge({}), edge({ edgeId: 'e2', type: 'documented_at' })];
  assert.equal(buildSheetConnections(edges, 'ent_a').length, 1);
});

test('a self-edge is never a connection', () => {
  assert.deepEqual(buildSheetConnections([edge({ toEntityId: 'ent_a' })], 'ent_a'), []);
});

test('a source backing several relationships is listed once, with its citing sentence', () => {
  const edges = [edge({}), edge({ edgeId: 'e2', toEntityId: 'ent_c', toDisplayName: 'Third' })];
  const sources = buildSheetSources(edges, 'ent_a');
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.title, 'National Register nomination');
  assert.match(sources[0]?.detail ?? '', /^Cited for: /);
});

test('a record with no edges gets no sources and no connections', () => {
  assert.deepEqual(buildSheetSources([edge({})], 'ent_z'), []);
  assert.deepEqual(buildSheetConnections([edge({})], 'ent_z'), []);
});
