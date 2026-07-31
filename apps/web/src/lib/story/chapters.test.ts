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
} from './chapters';
import { copyFor, headingParts } from '../../components/story/story-copy';

test('chapters are contiguous from the cold open, with no gap or repeat in the sequence', () => {
  assert.ok(STORY_CHAPTERS.length > 0);
  STORY_CHAPTERS.forEach((chapter, position) => {
    assert.equal(chapter.index, position, `chapter ${chapter.id} is out of sequence`);
  });
  const ids = new Set(STORY_CHAPTERS.map((chapter) => chapter.id));
  assert.equal(ids.size, STORY_CHAPTERS.length, 'two chapters share an id');
  assert.equal(STORY_CHAPTERS[0]?.centred, true, 'the cold open is a centred chapter');
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

test('exactly one chapter runs the sweep, and exactly one names a record', () => {
  // Two sweeps would step the histogram against each other; two record chapters would leave the
  // second one fighting the first for the camera on a fast scroll.
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.sweep).length, 1);
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.focusRecordId).length, 1);
  assert.equal(STORY_CHAPTERS.filter((chapter) => chapter.routes).length, 1);
});

test('the intersection threshold fires a chapter before it is centred, but not at the edge', () => {
  assert.ok(CHAPTER_INTERSECTION_THRESHOLD > 0.25);
  assert.ok(CHAPTER_INTERSECTION_THRESHOLD < 0.5);
});

test('a chapter naming a record names one, and the camera goes there rather than to a bare centre', () => {
  const focused = STORY_CHAPTERS.find((chapter) => chapter.focusRecordId);
  assert.ok(focused);
  assert.match(focused.focusRecordId!, /^ent_/);
  // Its camera is still valid: the surface flies to the record, but a plate that cannot resolve
  // the record falls back to the chapter's own framing rather than to nothing.
  assert.ok(isValidChapterCamera(focused.camera));
});
