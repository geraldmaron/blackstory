/**
 * Door focus math: chapter cameras → Albers plate zoom frames.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORY_CHAPTERS } from '../lib/story/chapters';
import { resolveDoorFocus, zoomToPlateScale } from './door-focus';

test('national zoom stays at scale 1', () => {
  assert.equal(zoomToPlateScale(3.35), 1);
  assert.ok(zoomToPlateScale(3.3) <= 1.05);
});

test('closer zooms enlarge the plate without runaway scale', () => {
  assert.ok(zoomToPlateScale(5.1) > 1.4);
  assert.ok(zoomToPlateScale(13.4) <= 7.5);
  assert.equal(zoomToPlateScale(22), 7.5);
});

test('opening chapter frames the nation', () => {
  const opening = STORY_CHAPTERS.find((chapter) => chapter.id === 'cold-open');
  assert.ok(opening);
  const frame = resolveDoorFocus({
    chapter: opening,
    spotlight: null,
    fact: undefined,
    spotlightLngLat: null,
  });
  assert.equal(frame.scale, 1);
  assert.equal(frame.focusEntityId, null);
  assert.ok(frame.originX > 30 && frame.originX < 70);
});

test('evidence chapter prefers the spotlight coordinate', () => {
  const evidence = STORY_CHAPTERS.find((chapter) => chapter.id === 'one-record');
  assert.ok(evidence);
  const frame = resolveDoorFocus({
    chapter: evidence,
    spotlight: {
      entityId: 'ent_test_001',
      name: 'Test Place',
      place: 'Birmingham, Alabama',
      era: '1960s',
      summary: 'A test summary.',
      evidenceCount: 2,
      kindLabel: 'place',
    },
    fact: undefined,
    spotlightLngLat: [-86.81, 33.52],
  });
  assert.equal(frame.focusEntityId, 'ent_test_001');
  assert.ok(frame.scale > 2);
  assert.match(frame.placeLabel, /Test Place/);
});
