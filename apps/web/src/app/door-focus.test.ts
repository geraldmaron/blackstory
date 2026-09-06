/**
 * Door focus: chapter / spotlight / fact → the one frame the shared plate holds.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORY_CHAPTERS } from '../lib/story/chapters';
import type { StoryFact } from '../lib/story/story-facts';
import { resolveDoorFocus } from './door-focus';

const SPOTLIGHT = {
  entityId: 'ent_test_001',
  name: 'Test Place',
  place: 'Birmingham, Alabama',
  era: '1960s',
  summary: 'A test summary.',
  evidenceCount: 2,
  kindLabel: 'place',
};

test('opening chapter frames the nation', () => {
  const opening = STORY_CHAPTERS.find((chapter) => chapter.id === 'cold-open');
  assert.ok(opening);
  const frame = resolveDoorFocus({
    chapter: opening,
    spotlight: null,
    fact: undefined,
    spotlightLngLat: null,
  });
  assert.equal(frame.focusEntityId, null);
  assert.equal(frame.placeLabel, 'United States');
  assert.deepEqual(frame.camera, {
    center: opening.camera.center,
    zoom: opening.camera.zoom,
    pitch: opening.camera.pitch,
    bearing: opening.camera.bearing,
  });
});

test('evidence chapter prefers the spotlight coordinate', () => {
  const evidence = STORY_CHAPTERS.find((chapter) => chapter.id === 'one-record');
  assert.ok(evidence);
  const frame = resolveDoorFocus({
    chapter: evidence,
    spotlight: SPOTLIGHT,
    fact: undefined,
    spotlightLngLat: [-86.81, 33.52],
  });
  assert.equal(frame.focusEntityId, 'ent_test_001');
  assert.match(frame.placeLabel, /Test Place/);
  assert.deepEqual(frame.camera.center, [-86.81, 33.52]);
  assert.ok(frame.camera.zoom >= 8.5);
  assert.equal(frame.camera.pitch, evidence.camera.pitch);
  assert.equal(frame.camera.bearing, evidence.camera.bearing);
});

test('a spotlight without a coordinate falls back to the chapter camera', () => {
  const evidence = STORY_CHAPTERS.find((chapter) => chapter.id === 'one-record');
  assert.ok(evidence);
  const frame = resolveDoorFocus({
    chapter: evidence,
    spotlight: SPOTLIGHT,
    fact: undefined,
    spotlightLngLat: null,
  });
  assert.equal(frame.focusEntityId, null);
  assert.deepEqual(frame.camera.center, evidence.camera.center);
  assert.equal(frame.camera.zoom, evidence.camera.zoom);
});

test('a rotating-fact chapter frames the fact and names its place', () => {
  const context = STORY_CHAPTERS.find((chapter) => chapter.rotatingFact);
  assert.ok(context);
  const fact = {
    camera: { center: [-73.94, 40.81] as const, zoom: 11 },
    placeLabel: 'Harlem, New York',
  } as unknown as StoryFact;
  const frame = resolveDoorFocus({
    chapter: context,
    spotlight: null,
    fact,
    spotlightLngLat: null,
  });
  assert.equal(frame.focusEntityId, null);
  assert.equal(frame.placeLabel, 'Harlem, New York');
  assert.deepEqual(frame.camera.center, [-73.94, 40.81]);
  assert.equal(frame.camera.zoom, 11);
  assert.equal(frame.camera.pitch, context.camera.pitch);
});
