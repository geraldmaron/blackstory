/**
 * Confirms the rotating fact table holds the constraints that make rotation safe: twenty distinct
 * entries, every one cited and placed, and a picker that covers the whole table.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORY_FACTS, pickStoryFact, storyFactById } from './story-facts';

test('there are twenty facts, each with a distinct id', () => {
  assert.equal(STORY_FACTS.length, 20);
  assert.equal(new Set(STORY_FACTS.map((fact) => fact.id)).size, 20);
});

test('every fact carries a source, because an uncited fact is the one thing this page cannot ship', () => {
  for (const fact of STORY_FACTS) {
    assert.ok(fact.source.length > 0, `${fact.id} has no source`);
    // A named work or agency publication, never "historians agree" or a bare year.
    assert.ok(fact.source.length > 12, `${fact.id} source is too thin to be a citation`);
    assert.ok(fact.prose.length > 80, `${fact.id} prose is too thin to be a chapter body`);
  }
});

test('every fact names a place the camera can go to, inside the map envelope', () => {
  for (const fact of STORY_FACTS) {
    const [lng, lat] = fact.camera.center;
    assert.ok(Number.isFinite(lng) && lng >= -180 && lng <= 180, `${fact.id} longitude`);
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, `${fact.id} latitude`);
    assert.ok(fact.camera.zoom > 0 && fact.camera.zoom <= 22, `${fact.id} zoom`);
    assert.ok(fact.placeLabel.length > 0, `${fact.id} has no spoken place label`);
  }
});

test('every fact camera sits over the United States, the only ground this archive maps', () => {
  for (const fact of STORY_FACTS) {
    const [lng, lat] = fact.camera.center;
    assert.ok(lng > -170 && lng < -60, `${fact.id} is outside the mapped longitudes`);
    assert.ok(lat > 18 && lat < 72, `${fact.id} is outside the mapped latitudes`);
  }
});

test('every fact shows at least two figures, and no more than three', () => {
  for (const fact of STORY_FACTS) {
    assert.ok(fact.figures.length >= 2, `${fact.id} has too few figures`);
    assert.ok(fact.figures.length <= 3, `${fact.id} has too many figures for the card`);
    for (const figure of fact.figures) {
      assert.ok(figure.value.length > 0 && figure.label.length > 0);
    }
  }
});

test('the picker reaches every fact and never falls off either end of the table', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    seen.add(pickStoryFact(i / 200).id);
  }
  assert.equal(seen.size, STORY_FACTS.length, 'some facts are unreachable');

  assert.equal(pickStoryFact(0).id, STORY_FACTS[0]!.id);
  assert.equal(pickStoryFact(0.999999).id, STORY_FACTS[STORY_FACTS.length - 1]!.id);
  // A roll of exactly 1, or a NaN from a bad caller, must still return a fact rather than crash
  // the only surface a first-time reader meets.
  assert.ok(pickStoryFact(1));
  assert.ok(pickStoryFact(Number.NaN));
});

test('a fact is findable by id, so a chapter can be linked to the fact it showed', () => {
  assert.equal(storyFactById('six-million')?.id, 'six-million');
  assert.equal(storyFactById('not-a-fact'), undefined);
});
