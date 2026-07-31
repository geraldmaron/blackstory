/**
 * The dignity gate, exercised across the whole kind × tone grid.
 *
 * These assertions encode a rule the product cannot afford to get wrong once: the camera may
 * dramatise geography, never harm. A regression here is not a visual bug, it is the archive
 * performing a lynching as cinema.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ALL_CAMERA_MOVES,
  allowedMovesFor,
  isMoveAllowed,
  isViolenceAdjacent,
  type RecordLike,
} from './camera-dignity';
import type { CameraMove } from './camera-moves';

const KINDS = [
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'other',
] as const;

const TONES = [undefined, 'massacre', 'plantation', 'epicenter'] as const;

const DRAMATIC_MOVES: readonly CameraMove[] = ['push', 'orbit', 'trace', 'spotlight'];

function sorted(moves: ReadonlySet<CameraMove>): readonly string[] {
  return [...moves].sort();
}

test('a lynching record permits exactly wide, flyToRecord and tilt', () => {
  const record: RecordLike = { kind: 'event', topicTags: ['lynching'] };
  assert.deepEqual(sorted(allowedMovesFor(record)), ['flyToRecord', 'tilt', 'wide']);
});

test('no violence-adjacent record permits a dramatic move', () => {
  const violent: readonly RecordLike[] = [
    { kind: 'event', topicTags: ['lynching'] },
    { kind: 'event', topicTags: ['race-massacre'] },
    { kind: 'place', mapTone: 'massacre' },
    { kind: 'place', mapTone: 'plantation' },
    { kind: 'event', topicTags: ['riot'] },
    { kind: 'place', topicTags: ['sundown-town'] },
    { kind: 'place', topicTags: ['racial_violence'] },
    { kind: 'event', topicIds: ['documented_displacement'] },
    { kind: 'place', displayName: 'Tulsa Race Massacre site' },
    { kind: 'place', displayName: 'Whitney Plantation' },
  ];

  for (const record of violent) {
    assert.ok(
      isViolenceAdjacent(record),
      `${JSON.stringify(record)} must read as violence-adjacent`,
    );
    for (const move of DRAMATIC_MOVES) {
      assert.equal(
        isMoveAllowed(move, record),
        false,
        `${move} must be refused for ${JSON.stringify(record)}`,
      );
    }
  }
});

test('spotlight never appears for a person, across every tone', () => {
  for (const mapTone of TONES) {
    const record: RecordLike = { kind: 'person', ...(mapTone ? { mapTone } : {}) };
    assert.ok(
      !allowedMovesFor(record).has('spotlight'),
      `spotlight must be refused for a person with tone ${String(mapTone)}`,
    );
  }
});

test('kind by tone grid: violence-adjacent tones restrict, presence does not', () => {
  for (const kind of KINDS) {
    for (const mapTone of TONES) {
      const record: RecordLike = { kind, ...(mapTone ? { mapTone } : {}) };
      const allowed = allowedMovesFor(record);
      const violent = mapTone === 'massacre' || mapTone === 'plantation';

      // Arrival and framing are always available. A record you cannot fly to is unreachable.
      assert.ok(allowed.has('wide'), `${kind}/${mapTone}: wide must always be permitted`);
      assert.ok(
        allowed.has('flyToRecord'),
        `${kind}/${mapTone}: flyToRecord must always be permitted`,
      );
      assert.ok(allowed.has('tilt'), `${kind}/${mapTone}: tilt must always be permitted`);

      if (violent) {
        for (const move of DRAMATIC_MOVES) {
          assert.ok(!allowed.has(move), `${kind}/${mapTone}: ${move} must be refused`);
        }
      } else {
        assert.ok(allowed.has('push'), `${kind}/${mapTone}: push should be permitted`);
        assert.ok(allowed.has('orbit'), `${kind}/${mapTone}: orbit should be permitted`);
        assert.equal(
          allowed.has('spotlight'),
          kind !== 'person',
          `${kind}/${mapTone}: spotlight follows the person rule`,
        );
      }
    }
  }
});

test('an epicenter is presence, not harm, and keeps the full vocabulary', () => {
  const record: RecordLike = { kind: 'place', mapTone: 'epicenter' };
  assert.equal(isViolenceAdjacent(record), false);
  assert.equal(sorted(allowedMovesFor(record)).length, ALL_CAMERA_MOVES.length);
});

test('tone is resolved from topics when it is not precomputed', () => {
  assert.ok(isViolenceAdjacent({ kind: 'place', topicTags: ['plantation-economy'] }));
  assert.ok(isViolenceAdjacent({ kind: 'event', topicIds: ['massacre'] }));
  assert.equal(isViolenceAdjacent({ kind: 'place', topicTags: ['black-wall-street'] }), false);
});

test('an unclassified record keeps the full vocabulary except the person rule', () => {
  assert.equal(sorted(allowedMovesFor({ kind: 'place' })).length, ALL_CAMERA_MOVES.length);
  assert.equal(sorted(allowedMovesFor({})).length, ALL_CAMERA_MOVES.length);
  assert.equal(allowedMovesFor({ kind: 'person' }).has('spotlight'), false);
});

test('no record at all means the move is about geography and is permitted', () => {
  for (const move of ALL_CAMERA_MOVES) {
    assert.equal(isMoveAllowed(move, null), true);
    assert.equal(isMoveAllowed(move, undefined), true);
  }
});

test('matching is case insensitive, since topic slugs are not normalised upstream', () => {
  assert.ok(isViolenceAdjacent({ kind: 'event', topicTags: ['Lynching'] }));
  assert.ok(isViolenceAdjacent({ kind: 'event', topicIds: ['RACIAL_VIOLENCE'] }));
});
