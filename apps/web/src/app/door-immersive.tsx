/**
 * Door Immersive Journey: scroll chapters drive a layout zoom on the Albers pin plate.
 *
 * One visit rolls chapters / facts / spotlight on the server so SSR and hydrate match.
 * Document scroll so the wheel works over the map; IntersectionObserver updates plate focus.
 * Zoom uses width/height/left/top (not transform:scale) so the locator mask stays sharp.
 * Pins with public hrefs stay clickable. No MapLibre — cheap Rest Door.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BRAND_ASSETS } from '@repo/config';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { CHAPTER_INTERSECTION_THRESHOLD, type StoryChapter } from '../lib/story/chapters';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';
import { COLD_OPEN_WORDS, copyFor, headingParts } from '../components/story/story-copy';
import { PinPhotoLayer } from '../components/map-experience/PinPhotoLayer';
import { usePinPhotoHoverAnchor } from '../components/map-experience/use-pin-photo-hover';
import { ABOUT_SUPPORT_LINE } from './about/about-copy';
import { resolveDoorFocus, type DoorFocusFrame } from './door-focus';
import { FirstPaintPinPlate } from './first-paint-pin-plate';

void React;

const RECORD_CHAPTER_ID = 'one-record';

const DOOR_COLD_OPEN_PROSE =
  'Every record in this archive is tied to a place you can stand in. Scroll to move the field. Copper pins and any pin you can reach open a record.';

type ChapterBody = {
  readonly prose: string;
  readonly figures: readonly { readonly value: string; readonly label: string }[] | undefined;
  readonly cite: string;
};

function chapterBody(
  chapter: StoryChapter,
  recordSpotlight: StoryRecordSpotlight | null,
  fact: StoryFact | undefined,
): ChapterBody | null {
  const copy = copyFor(chapter.id);
  if (!copy) return null;

  if (chapter.id === 'cold-open') {
    return { prose: DOOR_COLD_OPEN_PROSE, figures: copy.facts, cite: copy.cite };
  }

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
      cite: 'Drawn from the active release. Shown at the precision its sources support, and every citation opens on the record itself.',
    };
  }

  if (chapter.rotatingFact && fact) {
    return { prose: fact.prose, figures: fact.figures, cite: fact.source };
  }

  return { prose: copy.prose, figures: copy.facts, cite: copy.cite };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export type DoorImmersiveProps = {
  readonly pins: ExploreMapFeatureCollection;
  readonly chapters: readonly StoryChapter[];
  readonly factByChapterId: Readonly<Record<string, StoryFact>>;
  readonly spotlight: StoryRecordSpotlight | null;
  readonly spotlightLngLat: readonly [number, number] | null;
  /** Opaque `pin-N` for the spotlight, resolved on the server so the catalog stays off `/`. */
  readonly spotlightPinId: string | null;
  readonly placeCount: string;
};

export function DoorImmersive({
  pins,
  chapters,
  factByChapterId,
  spotlight,
  spotlightLngLat,
  spotlightPinId,
  placeCount,
}: DoorImmersiveProps) {
  const journeyRef = useRef<HTMLDivElement | null>(null);
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;

  const pinFieldRef = useRef<HTMLElement | null>(null);
  const pinPhotoTarget = usePinPhotoHoverAnchor(pinFieldRef);

  const initialFocus = useMemo(
    () =>
      resolveDoorFocus({
        chapter: chapters[0]!,
        spotlight,
        fact: undefined,
        spotlightLngLat,
      }),
    [chapters, spotlight, spotlightLngLat],
  );

  const [focus, setFocus] = useState<DoorFocusFrame>(initialFocus);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const scope = journeyRef.current;
    if (!scope) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const winner = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!winner) return;
        const index = Number((winner.target as HTMLElement).dataset.chapter);
        const chapter = chaptersRef.current[index];
        if (!chapter) return;
        setFocus(
          resolveDoorFocus({
            chapter,
            spotlight,
            fact: factByChapterId[chapter.id],
            spotlightLngLat,
          }),
        );
      },
      {
        // Document scroll: observe against the viewport, not a nested scrollport.
        threshold: CHAPTER_INTERSECTION_THRESHOLD,
      },
    );

    for (const section of scope.querySelectorAll('[data-chapter]')) {
      observer.observe(section);
    }
    return () => observer.disconnect();
  }, [chapters, factByChapterId, spotlight, spotlightLngLat]);

  const focusPinId =
    focus.focusEntityId !== null && spotlight !== null && focus.focusEntityId === spotlight.entityId
      ? spotlightPinId
      : null;

  const scrollToChapter = useCallback(
    (index: number) => {
      const target = journeyRef.current?.querySelector(`[data-chapter="${index}"]`);
      target?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [reducedMotion],
  );

  /*
   * Layout zoom (width/height/left/top), not transform: scale.
   * CSS scale rasterizes the masked locator + pins into a bitmap and looks soft when zoomed.
   * Growing the board in layout keeps the locator mask crisp.
   */
  const boardStyle = {
    width: `${focus.scale * 100}%`,
    height: `${focus.scale * 100}%`,
    left: `calc(${focus.originX}% * (1 - ${focus.scale}))`,
    top: `calc(${focus.originY}% * (1 - ${focus.scale}))`,
    transition: reducedMotion
      ? 'none'
      : 'width 1.15s cubic-bezier(0.22, 1, 0.36, 1), height 1.15s cubic-bezier(0.22, 1, 0.36, 1), left 1.15s cubic-bezier(0.22, 1, 0.36, 1), top 1.15s cubic-bezier(0.22, 1, 0.36, 1)',
  } as const;

  return (
    <>
      <aside className="ds-door__field" aria-label="National pin field" ref={pinFieldRef}>
        <div className="ds-door__board-frame">
          <div className="ds-door__board-host">
            <div
              className={`ds-door__board${focus.scale > 1.05 ? ' is-zoomed' : ''}`}
              style={boardStyle}
            >
              <div className="ds-door__ground" aria-hidden="true">
                {/* Land colour via CSS mask (RecordLocator pattern); canvas shows through as field. */}
                <div className="ds-door__ground-map" />
              </div>
              <FirstPaintPinPlate pins={pins} linkRecords focusEntityId={focusPinId} />
            </div>
          </div>
        </div>
        <div className="ds-door__field-chrome">
          <p className="ds-door__field-caption">
            <span className="ds-door__legend ds-door__legend--ink" aria-hidden="true" />
            {placeCount} places · click a pin
            <span className="ds-door__legend ds-door__legend--walk" aria-hidden="true" />
            walk
          </p>
        </div>
        <p className="ds-door__live" aria-live="polite">
          {focus.placeLabel}
        </p>
      </aside>

      <div className="ds-door-journey" id="door-journey" ref={journeyRef}>
        {chapters.map((chapter) => {
          const copy = copyFor(chapter.id);
          const body = chapterBody(chapter, spotlight, factByChapterId[chapter.id]);
          if (!copy || !body) return null;
          const { before, accent, after } = headingParts(copy);
          const isOpen = chapter.index === 0;
          const isClose = chapter.index === chapters.length - 1;
          const side = chapter.centred ? 'centre' : chapter.index % 2 === 0 ? 'end' : 'start';
          const spotlightHref =
            chapter.id === RECORD_CHAPTER_ID && spotlight
              ? `/entity/${encodeURIComponent(spotlight.entityId)}`
              : null;

          return (
            <section
              key={chapter.id}
              id={isOpen ? 'door-open' : `door-chapter-${chapter.index}`}
              className={`ds-door-journey__chapter ds-door-journey__chapter--${side}${isOpen ? ' ds-door-journey__chapter--rest' : ''}`}
              data-chapter={chapter.index}
              aria-labelledby={`door-journey-heading-${chapter.id}`}
            >
              <div className="ds-door-journey__card">
                <div className="ds-door-journey__copy">
                  {isOpen ? (
                    <>
                      <p className="ds-door-journey__eyebrow">Place-connected archive</p>
                      <h1 id="door-brand" className="ds-door-journey__brand">
                        <span className="ds-door-journey__brand-sr">BlackStory</span>
                        <span className="ds-door-journey__lockup" aria-hidden="true">
                          {/* eslint-disable-next-line @next/next/no-img-element -- brand lockup */}
                          <img
                            className="ds-door-journey__lockup-img ds-door-journey__lockup-img--light"
                            src={BRAND_ASSETS.lockup.light}
                            alt=""
                            width={400}
                            height={102}
                            decoding="async"
                            fetchPriority="high"
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element -- brand lockup */}
                          <img
                            className="ds-door-journey__lockup-img ds-door-journey__lockup-img--dark"
                            src={BRAND_ASSETS.lockup.dark}
                            alt=""
                            width={400}
                            height={102}
                            decoding="async"
                          />
                        </span>
                      </h1>
                      <p className="ds-door-journey__support">History, pinned to place.</p>
                      <p className="ds-door-journey__pillars">{ABOUT_SUPPORT_LINE}</p>
                      <p className="ds-door-journey__presence">
                        <span className="ds-door-journey__presence-n">{placeCount}</span> places on
                        the field
                      </p>
                      <h2
                        className="ds-door-journey__cold"
                        id={`door-journey-heading-${chapter.id}`}
                      >
                        {COLD_OPEN_WORDS.map((word) => (
                          <span key={word}>{word} </span>
                        ))}
                      </h2>
                    </>
                  ) : (
                    <>
                      {chapter.centred ? null : (
                        <span className="ds-door-journey__index" aria-hidden="true">
                          {String(chapter.index).padStart(2, '0')}
                        </span>
                      )}
                      {copy.kicker ? (
                        <p className="ds-door-journey__kicker">{copy.kicker}</p>
                      ) : null}
                      <h2
                        className="ds-door-journey__heading"
                        id={`door-journey-heading-${chapter.id}`}
                      >
                        {before}
                        <em>{accent}</em>
                        {after}
                      </h2>
                    </>
                  )}

                  <p className="ds-door-journey__prose">{body.prose}</p>

                  {body.figures ? (
                    <dl className="ds-door-journey__facts">
                      {body.figures.map((figure) => (
                        <div key={`${figure.label}-${figure.value}`}>
                          <dt className="ds-door-journey__fact-value">{figure.value}</dt>
                          <dd className="ds-door-journey__fact-label">{figure.label}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  <p className="ds-door-journey__cite">{body.cite}</p>

                  {spotlightHref ? (
                    <p className="ds-door-journey__record">
                      <Link href={spotlightHref}>Open this record</Link>
                    </p>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className="ds-door-journey__actions">
                    <button
                      type="button"
                      className="ds-cta ds-cta--copper"
                      onClick={() => scrollToChapter(1)}
                    >
                      Begin
                    </button>
                    <Link className="ds-cta ds-cta--quiet" href="/explore">
                      Skip to Explore
                    </Link>
                  </div>
                ) : null}

                {isClose ? (
                  <div className="ds-door-journey__actions">
                    <Link className="ds-cta ds-cta--copper" href="/explore">
                      Open Explore
                    </Link>
                    <Link className="ds-cta ds-cta--ink" href="/records">
                      Browse records
                    </Link>
                    <button
                      type="button"
                      className="ds-cta ds-cta--quiet"
                      onClick={() => scrollToChapter(0)}
                    >
                      Back to the start
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <PinPhotoLayer target={pinPhotoTarget} photosUrl="/door/photos" />
    </>
  );
}
