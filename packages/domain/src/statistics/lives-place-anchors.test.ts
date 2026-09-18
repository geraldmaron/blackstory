/**
 * Tests that every Lives region carries two or three place anchors for illustration only.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVES_AREAS } from './lives-regions.js';
import { livesPlaceAnchorsForArea } from './lives-place-anchors.js';

test('every area names two or three place anchors, never one', () => {
  for (const area of LIVES_AREAS) {
    const anchors = livesPlaceAnchorsForArea(area);
    assert.ok(
      anchors.length >= 2 && anchors.length <= 3,
      `${area.slug} has ${anchors.length} anchors; methodology requires 2–3`,
    );
    for (const anchor of anchors) {
      assert.ok(anchor.name.trim().length > 0);
      assert.ok(anchor.role.trim().length > 0);
    }
  }
});

test('Deep South and Midwest do not collapse to a single metro story', () => {
  const deep = livesPlaceAnchorsForArea({ id: 'region:us-deep-south' }).map((a) => a.name);
  const midwest = livesPlaceAnchorsForArea({ id: 'region:us-midwest' }).map((a) => a.name);
  assert.ok(deep.includes('Mississippi Delta'));
  assert.ok(deep.includes('Birmingham'));
  assert.ok(deep.includes('Miami'));
  assert.ok(midwest.includes('Bronzeville'));
  assert.ok(midwest.includes('Detroit'));
});
