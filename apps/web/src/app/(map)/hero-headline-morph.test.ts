/**
 * Unit tests for the home hero headline subject morph timing model and copy.
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
  historySplitHint,
  resolveHeroHeadlinePhaseIndex,
  storySuffix,
} from './hero-headline-morph';

const EXPECTED_PHASE_ORDER: readonly string[] = [
  'history',
  'his-story',
  'her-story',
  'their-story',
  'your-story',
  'black-story',
];

const EXPECTED_SUBJECT_LABELS: readonly string[] = [
  'History',
  'His Story',
  'Her Story',
  'Their Story',
  'Your Story',
  'Black Story',
];

/** Cumulative ms when each phase begins (transition + dwell of prior phases). */
const PHASE_START_MS: readonly number[] = [
  0, // history: transition 0, dwell 2400
  2400, // his-story: transition 1200, dwell 1800
  5400, // her-story: transition 800, dwell 1100
  7300, // their-story
  9200, // your-story
  11100, // black-story
];

test('phases appear in morph order with expected subject labels', () => {
  assert.deepEqual(
    HERO_HEADLINE_PHASES.map((phase) => phase.id),
    EXPECTED_PHASE_ORDER,
  );
  assert.deepEqual(
    HERO_HEADLINE_PHASES.map((phase) => phase.subjectLabel),
    EXPECTED_SUBJECT_LABELS,
  );
  assert.equal(HERO_HEADLINE_FINAL_PHASE_ID, 'black-story');
});

test('accessible labels include the happened-here trailer', () => {
  for (const phase of HERO_HEADLINE_PHASES) {
    assert.ok(phase.accessibleLabel.endsWith(HERO_HEADLINE_TRAILER));
    assert.equal(phase.accessibleLabel, `${phase.subjectLabel}${HERO_HEADLINE_TRAILER}`);
  }
});

test('only History omits the Story split; later phases share the Story suffix', () => {
  assert.equal(HERO_HEADLINE_PHASES[0]!.storySplit, false);
  assert.equal(HERO_HEADLINE_PHASES[0]!.prefix, '');

  for (const phase of HERO_HEADLINE_PHASES.slice(1)) {
    assert.equal(phase.storySplit, true);
    assert.equal(phase.subjectLabel, `${phase.prefix} ${storySuffix()}`);
  }
});

test('reduced motion resolves directly to the final Black Story phase', () => {
  const finalIndex = getHeroHeadlinePhaseIndexById('black-story');
  assert.equal(resolveHeroHeadlinePhaseIndex(0, true), finalIndex);
  assert.equal(resolveHeroHeadlinePhaseIndex(50_000, true), finalIndex);
});

test('elapsed zero starts on History', () => {
  assert.equal(resolveHeroHeadlinePhaseIndex(0, false), 0);
  assert.equal(getHeroHeadlinePhaseByIndex(0)?.id, 'history');
});

test('phase start times match cumulative transition + dwell schedule', () => {
  for (let index = 0; index < PHASE_START_MS.length; index += 1) {
    assert.equal(heroHeadlinePhaseStartMs(index), PHASE_START_MS[index]);
  }
});

test('History → His Story boundary at 2399 / 2400 ms', () => {
  const historyIndex = getHeroHeadlinePhaseIndexById('history');
  const hisStoryIndex = getHeroHeadlinePhaseIndexById('his-story');

  assert.equal(resolveHeroHeadlinePhaseIndex(2399, false), historyIndex);
  assert.equal(resolveHeroHeadlinePhaseIndex(2400, false), hisStoryIndex);
});

test('Black Story begins at 11100 ms', () => {
  const blackStoryIndex = getHeroHeadlinePhaseIndexById('black-story');

  assert.equal(resolveHeroHeadlinePhaseIndex(11100, false), blackStoryIndex);
  assert.equal(getHeroHeadlinePhaseById('black-story').prefix, 'Black');
});

test('large elapsed stays on Black Story', () => {
  const blackStoryIndex = getHeroHeadlinePhaseIndexById('black-story');

  assert.equal(resolveHeroHeadlinePhaseIndex(50_000, false), blackStoryIndex);
  assert.equal(resolveHeroHeadlinePhaseIndex(Number.MAX_SAFE_INTEGER, false), blackStoryIndex);
});

test('historySplitHint describes the shared-s History → His Story morph', () => {
  const hint = historySplitHint();
  assert.equal(hint.before, 'His');
  assert.equal(hint.after, 'tory');
  assert.equal(hint.sharedS, true);
});

test('cumulative timing lands mid-phase for Her Story at 5400 ms', () => {
  const herStoryIndex = getHeroHeadlinePhaseIndexById('her-story');
  const herStoryStartMs = PHASE_START_MS[herStoryIndex]!;
  const herStoryPhase = getHeroHeadlinePhaseById('her-story');

  assert.equal(herStoryStartMs, 5400);
  assert.equal(resolveHeroHeadlinePhaseIndex(herStoryStartMs, false), herStoryIndex);
  assert.equal(
    resolveHeroHeadlinePhaseIndex(
      herStoryStartMs + herStoryPhase.transitionMs + herStoryPhase.dwellMs - 1,
      false,
    ),
    herStoryIndex,
  );
  assert.equal(
    resolveHeroHeadlinePhaseIndex(
      herStoryStartMs + herStoryPhase.transitionMs + herStoryPhase.dwellMs,
      false,
    ),
    herStoryIndex + 1,
  );
});

test('phase lookup helpers guard invalid indices', () => {
  assert.equal(getHeroHeadlinePhaseByIndex(-1), undefined);
  assert.equal(getHeroHeadlinePhaseByIndex(HERO_HEADLINE_PHASES.length), undefined);
  assert.equal(getHeroHeadlinePhaseByIndex(0)?.id, 'history');
});
