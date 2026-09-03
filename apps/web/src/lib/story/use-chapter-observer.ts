'use client';

/**
 * Shared chapter-crossing detector for both scrollytelling surfaces (`/`'s Door and Explore's
 * `StoryMode`). An `IntersectionObserver` over `[data-chapter]` sections picks the most-visible
 * chapter and, after a short settle window, hands it to the caller so the caller's own camera can
 * fly to it.
 *
 * The settle window is the fix for a real defect, not a stylistic debounce: scrolling fast crosses
 * several chapters' thresholds within one scroll gesture, and firing a flight per crossing means
 * each new flyTo interrupts the previous one still mid-curve. Two or three interrupted flights in
 * a row read as the camera lurching and contorting rather than following the reader — worse on the
 * Door, where gestures are otherwise locked and the reader has no way to grab the map and stop it.
 * Collapsing bursts to the chapter the scroll actually settles on removes the interrupted-flight
 * storm at the source, on both surfaces, from one place.
 */
import { useEffect, useRef } from 'react';
import { CHAPTER_INTERSECTION_THRESHOLD, type StoryChapter } from './chapters';

/** Long enough to absorb a fast scroll-past several chapters; short enough that a reader who
 * stops on a chapter still sees it commit as if it were immediate. */
export const CHAPTER_SETTLE_MS = 140;

/** The one field this module reads off a real `IntersectionObserverEntry`, structural so the
 * winner-picking rule below is provable over plain objects under `node:test` — no DOM, no real
 * `IntersectionObserver` required. */
export type ChapterIntersectionEntry = {
  readonly isIntersecting: boolean;
  readonly intersectionRatio: number;
  readonly chapterIndex: number;
};

/**
 * Most-visible wins. Two chapters can cross the threshold in the same observer batch mid-scroll,
 * and firing both would hand the camera two destinations in the same frame. Returns `null` when
 * nothing in the batch is intersecting (a batch can fire on the way out of every chapter too).
 */
export function pickWinnerChapterIndex(
  entries: readonly ChapterIntersectionEntry[],
): number | null {
  const winner = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  return winner ? winner.chapterIndex : null;
}

export type ChapterObserverOptions = {
  /** Set false to tear the observer down without unmounting the caller (StoryMode toggles this
   * off when the surface is not the active mode). Defaults to true. */
  readonly active?: boolean;
  /** `'document'` (default) observes against the viewport, for a surface where the document
   * itself scrolls (the Door). `'self'` observes against the container ref, for a surface whose
   * chapters scroll inside their own scrollport (Explore's `StoryMode`). */
  readonly scrollRoot?: 'document' | 'self';
};

/**
 * @param containerRef the element `[data-chapter]` sections are queried from
 * @param chapters the running order, read fresh on every call so a re-roll re-observes
 * @param onChapter called at most once per settled chapter, with the latest closure
 */
export function useChapterObserver(
  containerRef: { readonly current: HTMLElement | null },
  chapters: readonly StoryChapter[],
  onChapter: (chapter: StoryChapter) => void,
  options?: ChapterObserverOptions,
): void {
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;
  const onChapterRef = useRef(onChapter);
  onChapterRef.current = onChapter;
  const active = options?.active ?? true;
  const scrollRoot = options?.scrollRoot ?? 'document';

  useEffect(() => {
    const scope = containerRef.current;
    if (!active || !scope || typeof IntersectionObserver === 'undefined') return;

    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const index = pickWinnerChapterIndex(
          entries.map((entry) => ({
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            chapterIndex: Number((entry.target as HTMLElement).dataset.chapter),
          })),
        );
        if (index === null) return;
        const chapter = chaptersRef.current[index];
        if (!chapter) return;

        if (settleTimer !== undefined) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => onChapterRef.current(chapter), CHAPTER_SETTLE_MS);
      },
      {
        root: scrollRoot === 'self' ? scope : null,
        threshold: CHAPTER_INTERSECTION_THRESHOLD,
      },
    );

    for (const section of scope.querySelectorAll('[data-chapter]')) observer.observe(section);
    return () => {
      observer.disconnect();
      if (settleTimer !== undefined) clearTimeout(settleTimer);
    };
    // Re-observes when the running order changes: the sections themselves are different elements.
  }, [active, chapters, containerRef, scrollRoot]);
}
