/**
 * Story mode: scroll-driven cinema over the same persistent map plate.
 *
 * The chapters scroll; the map does not. An `IntersectionObserver` rooted on the story container
 * fires a chapter when it is 42% in view, and the chapter's camera spec drives the plate
 * (design-direction-v9-atlas.md §6).
 *
 * Reduced motion does not disable the story. Chapters still advance and the map still goes where
 * the chapter says; the camera cuts instead of flying and the kinetic type is off. Turning the
 * story off entirely would make a whole surface unavailable to a reader who asked for calm, which
 * is not what the preference means.
 */
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cx } from '@repo/ui';
import { CHAPTER_INTERSECTION_THRESHOLD, type StoryChapter } from '../../lib/story/chapters';
import { COLD_OPEN_WORDS, copyFor, headingParts } from './story-copy';
import type { StoryRecordSpotlight } from '../../lib/story/pick-story-record';
import type { StoryFact } from '../../lib/story/story-facts';
import './story-mode.css';

void React;

export type StoryModeProps = {
  readonly active: boolean;
  /**
   * The running order for this visit, from `pickStoryChapters`. Passed in rather than read from
   * `STORY_CHAPTERS` here: which chapters run varies per visit, and the surface has to roll once
   * and give the same answer to the renderer, the observer and the camera.
   */
  readonly chapters: readonly StoryChapter[];
  /** Runs when a chapter comes into view. The surface owns camera, routes, sweep and spotlight. */
  readonly onChapter: (chapter: StoryChapter) => void;
  readonly onOpenAtlas: () => void;
  readonly onNearMe?: () => void;
  readonly reducedMotion?: boolean;
  /**
   * The record the evidence chapter drew this visit. Absent when the release yielded no eligible
   * record, in which case the chapter falls back to its written copy rather than rendering a gap.
   */
  readonly recordSpotlight?: StoryRecordSpotlight | undefined;
  /** The fact each rotating-fact chapter drew this visit, by chapter id. Absent falls back. */
  readonly factByChapterId?: Readonly<Record<string, StoryFact>> | undefined;
  readonly className?: string;
};

/** The chapter whose body is a drawn record rather than written prose. */
const RECORD_CHAPTER_ID = 'one-record';

type ChapterBody = {
  readonly prose: string;
  readonly figures: readonly { readonly value: string; readonly label: string }[] | undefined;
  readonly cite: string;
};

/**
 * What a chapter actually says.
 *
 * Two chapters no longer carry fixed prose. Chapter 2 describes whichever record was drawn from the
 * release this visit, so its body is assembled from that record's own published fields rather than
 * written about one building. Chapter 3 shows one of twenty cited facts.
 *
 * Both fall back to the written copy when the draw came up empty — a release with no eligible
 * record, or a fact table that failed to resolve. A chapter that renders its fallback is still a
 * true chapter; a chapter that renders a blank is a bug the reader has to interpret.
 */
function chapterBody(
  chapter: StoryChapter,
  copy: ReturnType<typeof copyFor> & object,
  recordSpotlight: StoryRecordSpotlight | undefined,
  fact: StoryFact | undefined,
): ChapterBody {
  if (chapter.id === RECORD_CHAPTER_ID && recordSpotlight) {
    const sources =
      recordSpotlight.evidenceCount === 1 ? '1 source' : `${recordSpotlight.evidenceCount} sources`;
    return {
      prose: `${recordSpotlight.name}, in ${recordSpotlight.place}. ${recordSpotlight.summary} It is one pin, and you can read its citations before you decide to trust it.`,
      figures: [
        { value: recordSpotlight.place, label: 'where' },
        { value: recordSpotlight.era, label: 'when' },
        { value: sources, label: 'evidence on the record' },
      ],
      // Never a claim that the sources are good, only that they are there and readable. The
      // reader is being invited to check, which is the entire point of the chapter.
      cite: 'Drawn from the active release. Shown at the precision its sources support, and every citation opens on the record itself.',
    };
  }

  if (chapter.rotatingFact && fact) {
    return { prose: fact.prose, figures: fact.figures, cite: fact.source };
  }

  return { prose: copy.prose, figures: copy.facts, cite: copy.cite };
}

function ColdOpenHeading({ kinetic }: { readonly kinetic: boolean }) {
  return (
    <h1 className={cx('ds-story__cold', kinetic && 'ds-story__cold--kinetic')}>
      {COLD_OPEN_WORDS.map((word, index) => (
        <span key={word} className="ds-story__word" style={{ animationDelay: `${index * 130}ms` }}>
          {word}
        </span>
      ))}
    </h1>
  );
}

export function StoryMode({
  active,
  chapters,
  onChapter,
  onOpenAtlas,
  onNearMe,
  reducedMotion = false,
  recordSpotlight,
  factByChapterId,
  className,
}: StoryModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onChapterRef = useRef(onChapter);
  onChapterRef.current = onChapter;
  // The observer resolves an index back to a chapter, so it has to read the same running order the
  // renderer used rather than the authored pool.
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;

  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Most-visible wins. Two chapters can cross the threshold at once mid-scroll, and firing
        // both would hand the camera two destinations in the same frame.
        const winner = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!winner) return;
        const index = Number((winner.target as HTMLElement).dataset.chapter);
        const chapter = chaptersRef.current[index];
        if (chapter) onChapterRef.current(chapter);
      },
      { root, threshold: CHAPTER_INTERSECTION_THRESHOLD },
    );

    for (const section of root.querySelectorAll('[data-chapter]')) observer.observe(section);
    return () => observer.disconnect();
    // Re-observes when the running order changes: the sections themselves are different elements.
  }, [active, chapters]);

  const scrollToChapter = useCallback(
    (index: number) => {
      const root = rootRef.current;
      const target = root?.querySelector(`[data-chapter="${index}"]`);
      target?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [reducedMotion],
  );

  if (!active) return null;

  return (
    <div className={cx('ds-story', className)} ref={rootRef} id="ds-story">
      {chapters.map((chapter) => {
        const copy = copyFor(chapter.id);
        if (!copy) return null;
        const { before, accent, after } = headingParts(copy);
        const body = chapterBody(chapter, copy, recordSpotlight, factByChapterId?.[chapter.id]);

        return (
          <section
            key={chapter.id}
            className={cx('ds-story__chapter', chapter.centred && 'ds-story__chapter--centred')}
            data-chapter={chapter.index}
            aria-labelledby={`ds-story-heading-${chapter.id}`}
          >
            <div className="ds-story__card">
              {chapter.index === 0 ? (
                <>
                  <ColdOpenHeading kinetic={!reducedMotion} />
                  <span className="ds-visually-hidden" id={`ds-story-heading-${chapter.id}`}>
                    {COLD_OPEN_WORDS.join(' ')}
                  </span>
                </>
              ) : (
                <>
                  {chapter.centred ? null : (
                    <span className="ds-story__index" aria-hidden="true">
                      {String(chapter.index).padStart(2, '0')}
                    </span>
                  )}
                  {copy.kicker ? <p className="ds-story__kicker">{copy.kicker}</p> : null}
                  <h2 className="ds-story__heading" id={`ds-story-heading-${chapter.id}`}>
                    {before}
                    <em>{accent}</em>
                    {after}
                  </h2>
                </>
              )}

              <p className="ds-story__prose">{body.prose}</p>

              {body.figures ? (
                <dl className="ds-story__facts">
                  {body.figures.map((figure) => (
                    <div key={figure.label}>
                      <dt className="ds-story__fact-value">{figure.value}</dt>
                      <dd className="ds-story__fact-label">{figure.label}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <p className="ds-story__cite">{body.cite}</p>

              {chapter.index === 0 ? (
                <div className="ds-story__actions">
                  <button
                    type="button"
                    className="ds-story__action ds-story__action--primary"
                    onClick={() => scrollToChapter(1)}
                  >
                    Begin
                  </button>
                  <button type="button" className="ds-story__action" onClick={onOpenAtlas}>
                    Skip to the atlas
                  </button>
                </div>
              ) : null}

              {chapter.index === chapters.length - 1 ? (
                <div className="ds-story__actions">
                  <button
                    type="button"
                    className="ds-story__action ds-story__action--primary"
                    onClick={onOpenAtlas}
                  >
                    Open the atlas
                  </button>
                  {onNearMe ? (
                    <button type="button" className="ds-story__action" onClick={onNearMe}>
                      Find records near me
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
