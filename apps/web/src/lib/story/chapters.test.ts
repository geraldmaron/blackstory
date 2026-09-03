/**
 * Confirms the story sequence holds the guarantees `chapters.ts` was written as data to make
 * testable: every chapter has copy and a camera the plate will accept, the corridor chapter still
 * carries its honesty line, and no chapter asks the plate for a framing the dignity gate refuses.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHAPTER_INTERSECTION_THRESHOLD,
  CORRIDOR_CHAPTER_ID,
  CORRIDOR_HONESTY_LINE,
  STORY_CHAPTERS,
  chapterById,
  isValidChapterCamera,
  STORY_STAGE_ORDER,
} from './chapters';
import { copyFor, headingParts } from '../../components/story/story-copy';

test('chapters are contiguous from the cold open, with no gap or repeat in the sequence', () => {
  assert.ok(STORY_CHAPTERS.length > 0);
  STORY_CHAPTERS.forEach((chapter, position) => {
    assert.equal(chapter.index, position, `chapter ${chapter.id} is out of sequence`);
  });
  const ids = new Set(STORY_CHAPTERS.map((chapter) => chapter.id));
  assert.equal(ids.size, STORY_CHAPTERS.length, 'two chapters share an id');
  assert.equal(STORY_CHAPTERS[0]?.centered, true, 'the cold open is a centered chapter');
});

test('every chapter camera is inside the envelope MapLibre will accept', () => {
  for (const chapter of STORY_CHAPTERS) {
    assert.ok(
      isValidChapterCamera(chapter.camera),
      `${chapter.id} carries a camera the plate would refuse`,
    );
  }
});

test('every chapter has copy, so no chapter renders as an empty card', () => {
  // StoryMode returns null for a chapter with no copy — a missing entry would silently drop a
  // chapter out of the scroll while still counting toward the observer's indices.
  for (const chapter of STORY_CHAPTERS) {
    const copy = copyFor(chapter.id);
    assert.ok(copy, `${chapter.id} has no copy`);
    assert.ok(copy.prose.length > 0, `${chapter.id} has no prose`);
    assert.ok(copy.cite.length > 0, `${chapter.id} cites nothing`);
  }
});

test('every heading splits into three parts, so the accent has something to mark', () => {
  for (const chapter of STORY_CHAPTERS) {
    const copy = copyFor(chapter.id);
    if (!copy) continue;
    const { accent } = headingParts(copy);
    assert.ok(accent.length > 0, `${chapter.id} heading has no accent span`);
  }
});

test('the corridor chapter carries the honesty line from the corridor data, not a retyped copy', () => {
  const corridor = chapterById(CORRIDOR_CHAPTER_ID);
  assert.ok(corridor, 'the corridor chapter is missing from the sequence');
  assert.equal(corridor.routes, true, 'the corridor chapter does not draw the corridors');
  assert.ok(CORRIDOR_HONESTY_LINE.length > 0);

  const copy = copyFor(CORRIDOR_CHAPTER_ID);
  assert.ok(copy);
  const text = `${copy.prose} ${copy.cite}`;
  assert.ok(
    text.includes(CORRIDOR_HONESTY_LINE),
    'the corridor chapter must publish the corridor honesty line verbatim',
  );
});

test('exactly one chapter runs the sweep, draws a record, and draws the corridors', () => {
  // Two sweeps would step the histogram against each other; two record chapters would leave the
  // second one fighting the first for the camera on a fast scroll. Rotating-fact chapters are the
  // exception: a visit may run more than one, and `pickStoryChapters` gives each a distinct fact.
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.sweep).length, 1);
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.focusRandomRecord).length, 1);
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.routes).length, 1);
  assert.ok(STORY_CHAPTERS.filter((chapter) => chapter.rotatingFact).length >= 1);
});

test('every chapter declares a stage the running order knows how to place', () => {
  for (const chapter of STORY_CHAPTERS) {
    assert.ok(
      STORY_STAGE_ORDER.includes(chapter.stage),
      `${chapter.id} declares a stage the order does not know`,
    );
  }
  // Exactly one opening and one closing: they are the fixed framing every visit gets.
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.stage === 'opening').length, 1);
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.stage === 'closing').length, 1);
});

test('the intersection threshold fires a chapter before it is centered, but not at the edge', () => {
  assert.ok(CHAPTER_INTERSECTION_THRESHOLD > 0.25);
  assert.ok(CHAPTER_INTERSECTION_THRESHOLD < 0.5);
});

test('the record chapter keeps a valid fallback framing for a release with no eligible record', () => {
  const focused = STORY_CHAPTERS.find((chapter) => chapter.focusRandomRecord);
  assert.ok(focused);
  // The surface flies to whatever record was drawn. A release that yields none falls back to this
  // chapter's own framing rather than leaving the plate wherever the previous chapter left it.
  assert.ok(isValidChapterCamera(focused.camera));
});
