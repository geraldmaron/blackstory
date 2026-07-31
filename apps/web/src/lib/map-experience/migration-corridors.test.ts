/**
 * Guards the corridor dataset's honesty contract: seven documented streams, real metro anchors,
 * and the illustrative-not-individual note on every entry.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONUS_BOUNDS, MIGRATION_CORRIDORS, MIGRATION_CORRIDOR_NOTE } from './migration-corridors';

test('seven documented corridors ship', () => {
  assert.equal(MIGRATION_CORRIDORS.length, 7);
});

test('corridor ids are unique', () => {
  const ids = MIGRATION_CORRIDORS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every anchor sits inside CONUS', () => {
  for (const entry of MIGRATION_CORRIDORS) {
    for (const anchor of [entry.from, entry.to]) {
      const [longitude, latitude] = anchor.coordinates;
      assert.ok(
        longitude >= CONUS_BOUNDS.minLongitude && longitude <= CONUS_BOUNDS.maxLongitude,
        `${anchor.label} longitude ${longitude} outside CONUS`,
      );
      assert.ok(
        latitude >= CONUS_BOUNDS.minLatitude && latitude <= CONUS_BOUNDS.maxLatitude,
        `${anchor.label} latitude ${latitude} outside CONUS`,
      );
    }
  }
});

test('every corridor carries the honesty note', () => {
  for (const entry of MIGRATION_CORRIDORS) {
    assert.equal(entry.note, MIGRATION_CORRIDOR_NOTE);
    assert.ok(entry.note.length > 0);
  }
});

test('the honesty note names the aggregate framing', () => {
  assert.match(MIGRATION_CORRIDOR_NOTE, /illustrative/);
  assert.match(MIGRATION_CORRIDOR_NOTE, /Not individual paths\./);
  assert.ok(!MIGRATION_CORRIDOR_NOTE.includes('—'), 'copy law bans em dashes');
});

test('corridors are metro-to-metro and carry both labels', () => {
  for (const entry of MIGRATION_CORRIDORS) {
    assert.equal(entry.granularity, 'metro-to-metro');
    assert.ok(entry.from.label.includes(','), 'origin label names city and state');
    assert.ok(entry.to.label.includes(','), 'destination label names city and state');
  }
});

test('every corridor actually moves between two distinct metros', () => {
  for (const entry of MIGRATION_CORRIDORS) {
    assert.notDeepEqual(entry.from.coordinates, entry.to.coordinates);
    assert.notEqual(entry.from.label, entry.to.label);
  }
});

test('the documented northbound and westbound streams are all present', () => {
  const pairs = MIGRATION_CORRIDORS.map((entry) => `${entry.from.label} -> ${entry.to.label}`);
  for (const expected of [
    'New Orleans, Louisiana -> Chicago, Illinois',
    'Jackson, Mississippi -> Chicago, Illinois',
    'Birmingham, Alabama -> Detroit, Michigan',
    'Atlanta, Georgia -> New York, New York',
    'Houston, Texas -> Los Angeles, California',
    'Charleston, South Carolina -> Philadelphia, Pennsylvania',
    'Memphis, Tennessee -> St. Louis, Missouri',
  ]) {
    assert.ok(pairs.includes(expected), `missing corridor ${expected}`);
  }
});
