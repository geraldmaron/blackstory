/**
 * `pickWinnerChapterIndex` is the part of `useChapterObserver` provable without a DOM: the rule
 * that decides which chapter a batch of intersection entries commits to. The settle-window
 * debounce that sits on top of it is exercised in the browser (both scrollytelling surfaces route
 * through this one function), not re-created here against a fake `IntersectionObserver` and a fake
 * React effect — that would prove the test harness, not the rule.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chapterInViewFromRects,
  pickWinnerChapterIndex,
  type ChapterIntersectionEntry,
} from './use-chapter-observer';

function entry(
  chapterIndex: number,
  intersectionRatio: number,
  isIntersecting = true,
): ChapterIntersectionEntry {
  return { chapterIndex, intersectionRatio, isIntersecting };
}

test('an empty batch picks nothing', () => {
  assert.equal(pickWinnerChapterIndex([]), null);
});

test('a batch with nothing intersecting picks nothing', () => {
  // Fires on the way out of every chapter too, not only on the way in.
  assert.equal(pickWinnerChapterIndex([entry(0, 0.9, false), entry(1, 0.5, false)]), null);
});

test('the single intersecting chapter wins', () => {
  assert.equal(pickWinnerChapterIndex([entry(2, 0.6)]), 2);
});

test('two chapters crossing threshold in the same batch: the more-visible one wins', () => {
  // The exact case the comment on the source calls out: firing both would hand the camera two
  // destinations in the same frame.
  assert.equal(pickWinnerChapterIndex([entry(0, 0.3), entry(1, 0.7)]), 1);
  assert.equal(pickWinnerChapterIndex([entry(0, 0.7), entry(1, 0.3)]), 0);
});

test('a non-intersecting entry never outranks an intersecting one, regardless of ratio', () => {
  assert.equal(pickWinnerChapterIndex([entry(0, 0.95, false), entry(1, 0.1, true)]), 1);
});

test('the chapter in view from rects is the most-visible one past the threshold (repo-27uao)', () => {
  // A 900px viewport scrolled so chapter 2 fills it and chapter 3's top 200px show.
  const rects = [
    { chapterIndex: 0, top: -1800, bottom: -900 },
    { chapterIndex: 1, top: -900, bottom: 0 },
    { chapterIndex: 2, top: 0, bottom: 700 },
    { chapterIndex: 3, top: 700, bottom: 1600 },
  ];
  assert.equal(chapterInViewFromRects(rects, 900), 2);
  // Nothing far enough in: the caller keeps its opening chapter.
  assert.equal(chapterInViewFromRects([{ chapterIndex: 4, top: 800, bottom: 1700 }], 900), null);
  assert.equal(chapterInViewFromRects(rects, 0), null);
  // At the top of the page the opening chapter wins outright.
  assert.equal(
    chapterInViewFromRects(
      [
        { chapterIndex: 0, top: 0, bottom: 900 },
        { chapterIndex: 1, top: 900, bottom: 1800 },
      ],
      900,
    ),
    0,
  );
});
