/**
 * Tests that a `successor_of` edge must never leak the superseded predecessor's own
 * statusHistory/condition designation onto the successor as the successor's CURRENT status —
 * it must surface only as linked historical context. Canonical case: a historical place is
 * annexed/renamed into a modern municipality.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentStatus } from '../entity-status.js';
import {
  buildSuccessionLinkedContext,
  buildSuccessorPublicView,
  resolveSuccessionEndpoints,
} from './succession.js';
import { GRAPH_GOLD_FIXTURES } from './fixtures.js';

const { edge, predecessorStatusHistory, successorStatusHistory } = GRAPH_GOLD_FIXTURES.succession;

test('successor_of direction: fromEntityId is the modern successor, toEntityId is the historical predecessor', () => {
  const endpoints = resolveSuccessionEndpoints(edge);
  assert.equal(endpoints.successorEntityId, 'gg-place-modern-city');
  assert.equal(endpoints.predecessorEntityId, 'gg-place-historic-town');
});

test('THE CRITICAL PROOF: the successor’s own current status is derived ONLY from its own statusHistory and does not equal the predecessor’s historic designation', () => {
  // The successor's current status comes from real currentStatus, applied ONLY to the
  // successor's OWN statusHistory array this test never passes the predecessor's array in.
  const successorCurrentStatus = currentStatus(successorStatusHistory);
  const predecessorCurrentDesignation = currentStatus(predecessorStatusHistory);

  assert.equal(successorCurrentStatus, 'active');
  // The predecessor's OWN current designation is "historic" proving the two are genuinely
  // different values in this scenario, so a passing comparison below is meaningful, not vacuous.
  assert.equal(predecessorCurrentDesignation, 'historic');
  assert.notEqual(successorCurrentStatus, predecessorCurrentDesignation);
});

test('buildSuccessionLinkedContext surfaces the predecessor’s designations tagged to the PREDECESSOR id, never the successor id', () => {
  const context = buildSuccessionLinkedContext(edge, predecessorStatusHistory);
  assert.equal(context.length, 2);
  for (const entry of context) {
    assert.equal(entry.predecessorEntityId, 'gg-place-historic-town');
    assert.notEqual(entry.predecessorEntityId, 'gg-place-modern-city');
    assert.match(entry.note, /never the successor entity's current status/);
  }
  const designations = context.map((c) => c.designation).sort();
  assert.deepEqual(designations, ['active', 'historic']);
});

test('buildSuccessionLinkedContext requires a successor_of edge (fails closed on any other type)', () => {
  assert.throws(
    () =>
      buildSuccessionLinkedContext(
        { type: 'located_at', fromEntityId: 'a', toEntityId: 'b' },
        predecessorStatusHistory,
      ),
    /requires a "successor_of" edge/,
  );
});

test('buildSuccessorPublicView keeps linkedHistoricalContext structurally separate from any status field — the shape has no "status" key at all', () => {
  const predecessorStatusHistoryById = new Map([
    ['gg-place-historic-town', predecessorStatusHistory],
  ]);
  const view = buildSuccessorPublicView(
    'gg-place-modern-city',
    [edge],
    predecessorStatusHistoryById,
  );

  assert.equal(view.successorEntityId, 'gg-place-modern-city');
  assert.equal(view.linkedHistoricalContext.length, 2);
  assert.ok(
    !('status' in view) && !('statusHistory' in view),
    'SuccessorPublicView must carry no status/statusHistory field — leakage would require one to exist',
  );
  for (const entry of view.linkedHistoricalContext) {
    assert.equal(entry.predecessorEntityId, 'gg-place-historic-town');
  }
});

test('buildSuccessorPublicView only attaches edges where the queried id is actually the successor side', () => {
  // Querying from the PREDECESSOR's own id must not accidentally pull in its own history as if
  // it were "linked context" about itself the function only matches edges whose successor
  // endpoint equals the queried id.
  const predecessorStatusHistoryById = new Map([
    ['gg-place-historic-town', predecessorStatusHistory],
  ]);
  const view = buildSuccessorPublicView(
    'gg-place-historic-town',
    [edge],
    predecessorStatusHistoryById,
  );
  assert.deepEqual(view.linkedHistoricalContext, []);
});

test('end-to-end scenario proof: querying the modern successor never returns "historic"/"annexed" as its own status', () => {
  // Simulates what a public entity-page builder would do: resolve the successor's OWN current
  // status via, and separately attach linked historical context. Assert the two never
  // collapse into the same field or value.
  const successorEntity = {
    id: 'gg-place-modern-city',
    statusHistory: successorStatusHistory, // the successor's OWN record only
  };
  const derivedPublicStatus = currentStatus(successorEntity.statusHistory);
  const linkedContext = buildSuccessionLinkedContext(edge, predecessorStatusHistory);

  assert.equal(derivedPublicStatus, 'active');
  assert.ok(
    !linkedContext.some(
      (entry) =>
        entry.designation === derivedPublicStatus &&
        entry.predecessorEntityId === successorEntity.id,
    ),
    'no linked-context entry may be misattributed to the successor id',
  );
  // The historic designation exists ONLY inside linkedContext, never as derivedPublicStatus.
  assert.ok(linkedContext.some((entry) => entry.designation === 'historic'));
  assert.notEqual(derivedPublicStatus, 'historic');
});
