/**
 * Unit tests for the home headline subject morph: its copy, order and timing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HERO_HEADLINE_FINAL_PHASE_ID,
  HERO_HEADLINE_PHASES,
  HERO_HEADLINE_TRAILER,
  getHeroHeadlinePhaseById,
  getHeroHeadlinePhaseByIndex,
  getHeroHeadlinePhaseIndexById,
  heroHeadlinePhaseStartMs,
  resolveHeroHeadlinePhaseIndex,
} from './hero-headline-morph';

test('phases read History, His story, Her story, Your story, Their story, BlackStory', () => {
  assert.deepEqual(
    HERO_HEADLINE_PHASES.map((phase) => phase.subjectLabel),
    ['History', 'His story', 'Her story', 'Your story', 'Their story', 'BlackStory'],
  );
  assert.equal(HERO_HEADLINE_FINAL_PHASE_ID, 'black-story');
  assert.equal(
    getHeroHeadlinePhaseById('black-story').accessibleLabel,
    'BlackStory happened here.',
  );
});

test('every label ends with the trailer, and the rendered parts spell the label', () => {
  for (const phase of HERO_HEADLINE_PHASES) {
    assert.equal(phase.accessibleLabel, `${phase.subjectLabel}${HERO_HEADLINE_TRAILER}`);
    if (!phase.storySplit) continue;
    const gap = phase.wordmark ? '' : ' ';
    assert.equal(phase.subjectLabel, `${phase.prefix}${gap}${phase.storyInitial}tory`);
  }
});

test('only the final phase is one word in the wordmark type, with a capital S', () => {
  for (const phase of HERO_HEADLINE_PHASES) {
    const isFinal = phase.id === HERO_HEADLINE_FINAL_PHASE_ID;
    assert.equal(phase.wordmark, isFinal);
    assert.equal(phase.storyInitial, isFinal ? 'S' : 's');
  }
});

test('reduced motion lands straight on BlackStory', () => {
  const finalIndex = getHeroHeadlinePhaseIndexById('black-story');
  assert.equal(resolveHeroHeadlinePhaseIndex(0, true), finalIndex);
  assert.equal(resolveHeroHeadlinePhaseIndex(0, false), 0);
});

test('each phase starts at its cumulative boundary and the last one holds', () => {
  let startMs = 0;
  for (let index = 0; index < HERO_HEADLINE_PHASES.length; index += 1) {
    assert.equal(heroHeadlinePhaseStartMs(index), startMs);
    if (index > 0) assert.equal(resolveHeroHeadlinePhaseIndex(startMs - 1, false), index - 1);
    assert.equal(resolveHeroHeadlinePhaseIndex(startMs, false), index);
    const phase = HERO_HEADLINE_PHASES[index]!;
    startMs += phase.transitionMs + phase.dwellMs;
  }
  const finalIndex = HERO_HEADLINE_PHASES.length - 1;
  assert.equal(resolveHeroHeadlinePhaseIndex(Number.MAX_SAFE_INTEGER, false), finalIndex);
  assert.equal(getHeroHeadlinePhaseByIndex(HERO_HEADLINE_PHASES.length), undefined);
});
