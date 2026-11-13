/**
 * One chapter of the Door's guided walk as a docked card: progress, a heading, at most two
 * sentences, the chapter's figure (a record, the decade sweep, or its cited numbers), its citation
 * when it makes an outside claim, and the walk's controls. Every chapter is the same object in the
 * same place, so the map is what changes between steps, not the layout. The progress row and the
 * controls are pinned; only the body between them scrolls when a long record name needs the room.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui';
import type { StoryChapter } from '../lib/story/chapters';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';
import { copyFor, headingParts } from '../components/story/story-copy';
import { DoorRecordLink } from './door-record-link';

void React;

const RECORD_CHAPTER_ID = 'one-record';

export type DecadeRange = { readonly from: number; readonly to: number };

type Figure = { readonly value: string; readonly label: string };

export type ChapterBody = {
  readonly heading: string;
  readonly prose: string;
  readonly figures: readonly Figure[] | undefined;
  /** A real citation for an outside claim, or nothing. Never a note about the interface. */
  readonly cite: string | null;
};

/** What a walk chapter says: the chapter's own copy, its drawn fact, or the drawn record. */
export function chapterBody(
  chapter: StoryChapter,
  spotlight: StoryRecordSpotlight | null,
  fact: StoryFact | undefined,
  decadeRange: DecadeRange | null,
): ChapterBody | null {
  const copy = copyFor(chapter.id);
  if (!copy) return null;
  const { before, accent, after } = headingParts(copy);
  const heading = `${before}${accent}${after}`;

  if (chapter.id === RECORD_CHAPTER_ID && spotlight) {
    // The record block under the prose carries its own source count and link.
    return {
      heading,
      prose: 'Each pin opens into its record, and every claim on it carries a citation.',
      figures: undefined,
      cite: null,
    };
  }
  if (chapter.rotatingFact && fact) {
    return { heading, prose: fact.prose, figures: fact.figures, cite: fact.source };
  }
  if (chapter.sweep && decadeRange) {
    // The sweep readout is this chapter's figure: the range is printed on it.
    return { heading, prose: copy.prose, figures: undefined, cite: copy.cite ?? null };
  }
  if (chapter.stage === 'closing') {
    return { heading, prose: copy.prose, figures: undefined, cite: null };
  }
  return { heading, prose: copy.prose, figures: copy.facts, cite: copy.cite ?? null };
}

const DESTINATIONS = [
  { href: '/records', name: 'Records', line: 'Every record, searchable and sorted' },
  { href: '/stories', name: 'Stories', line: 'Chapters and entries built on the records' },
  { href: '/data', name: 'Data', line: 'Counts and charts, with their limits' },
] as const;

export type DoorWalkCardProps = {
  readonly chapter: StoryChapter;
  readonly body: ChapterBody;
  /** 1-based position among the walk's chapters, and how many there are. */
  readonly position: number;
  readonly total: number;
  readonly spotlight: StoryRecordSpotlight | null;
  readonly spotlightLocality: string | null;
  readonly spotlightHref: string | null;
  readonly decadeRange: DecadeRange | null;
  /** The decade the sweep has filled the plate to; null when no sweep is running. */
  readonly sweepDecade: number | null;
  readonly headingRef: React.Ref<HTMLHeadingElement>;
  readonly onGo: (position: number) => void;
  readonly onSkip: () => void;
};

export function DoorWalkCard({
  chapter,
  body,
  position,
  total,
  spotlight,
  spotlightLocality,
  spotlightHref,
  decadeRange,
  sweepDecade,
  headingRef,
  onGo,
  onSkip,
}: DoorWalkCardProps) {
  const isClose = chapter.stage === 'closing';
  const isRecord = chapter.id === RECORD_CHAPTER_ID && spotlight !== null;
  const headingId = `door-walk-heading-${chapter.id}`;

  // A body taller than the dock scrolls; until its end is in view it fades at the foot, so a
  // clipped line reads as "more below" rather than as cut copy.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === 'undefined') return;
    const mark = () => {
      body.dataset.more = String(body.scrollTop + body.clientHeight < body.scrollHeight - 1);
    };
    mark();
    const observer = new ResizeObserver(mark);
    observer.observe(body);
    for (const child of Array.from(body.children)) observer.observe(child);
    body.addEventListener('scroll', mark, { passive: true });
    return () => {
      observer.disconnect();
      body.removeEventListener('scroll', mark);
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' && position < total) {
      event.preventDefault();
      onGo(position + 1);
    } else if (event.key === 'ArrowLeft' && position > 1) {
      event.preventDefault();
      onGo(position - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onGo(0);
    }
  };

  return (
    <section
      className="ds-door-walk"
      aria-labelledby={headingId}
      aria-roledescription="walk step"
      onKeyDown={onKeyDown}
      data-chapter={chapter.id}
    >
      <div className="ds-door-walk__top">
        <div className="ds-door-walk__progress">
          <span className="ds-door-walk__steps" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => {
              const step = index + 1;
              const state = step < position ? 'done' : step === position ? 'current' : 'next';
              return <span key={step} className="ds-door-walk__step" data-state={state} />;
            })}
          </span>
          <p className="ds-door-walk__count">
            <span className="ds-visually-hidden">Step </span>
            {position} of {total}
          </p>
        </div>
        {isClose ? null : (
          <button type="button" className="ds-door-walk__skip" onClick={onSkip}>
            Skip to the map
          </button>
        )}
      </div>

      <div className="ds-door-walk__body" ref={bodyRef}>
        <h2 className="ds-door-walk__heading" id={headingId} ref={headingRef} tabIndex={-1}>
          {body.heading}
        </h2>
        <p className="ds-door-walk__prose">{body.prose}</p>

        {isRecord && spotlight ? (
          <div className="ds-door-walk__record">
            <p className="ds-door-walk__record-name">{spotlight.name}</p>
            <p className="ds-door-walk__record-meta">
              {spotlightLocality ?? spotlight.place}
              <span aria-hidden="true"> · </span>
              <span className="ds-door-walk__mono">{spotlight.era}</span>
            </p>
            <p className="ds-door-walk__record-line">{spotlight.summary}</p>
            <p className="ds-door-walk__record-foot">
              <span className="ds-door-walk__mono">
                {spotlight.evidenceCount === 1 ? '1 source' : `${spotlight.evidenceCount} sources`}
              </span>
              {spotlightHref ? (
                <DoorRecordLink className="ds-door-walk__link" href={spotlightHref}>
                  Open the record
                </DoorRecordLink>
              ) : null}
            </p>
          </div>
        ) : null}

        {chapter.sweep && decadeRange ? (
          <DecadeSweepReadout range={decadeRange} decade={sweepDecade} />
        ) : null}

        {body.figures && body.figures.length > 0 ? (
          <dl className="ds-door-walk__figures">
            {body.figures.map((figure) => (
              <div key={`${figure.label}-${figure.value}`} className="ds-door-walk__figure">
                <dt className="ds-door-walk__figure-label">{figure.label}</dt>
                <dd className="ds-door-walk__figure-value">{figure.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {isClose ? (
          <ul className="ds-door-walk__dest">
            {DESTINATIONS.map((destination) => (
              <li key={destination.href}>
                <Link className="ds-door-walk__dest-link" href={destination.href}>
                  <span className="ds-door-walk__dest-name">{destination.name}</span>
                  <span className="ds-door-walk__dest-line">{destination.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {body.cite ? <p className="ds-door-walk__cite">{body.cite}</p> : null}
      </div>

      <div className="ds-door-walk__controls">
        {/* On the first step there is nothing to go back to; "Skip to the map" is the one exit. */}
        {position > 1 ? (
          <Button variant="secondary" onClick={() => onGo(position - 1)}>
            Back
          </Button>
        ) : null}
        {isClose ? (
          <Button variant="primary" onClick={onSkip}>
            Explore the map
          </Button>
        ) : (
          <Button variant="primary" onClick={() => onGo(position + 1)}>
            Next
          </Button>
        )}
      </div>
    </section>
  );
}

/** The sweep made legible: which decade the plate has filled to, on a track of the whole range. */
function DecadeSweepReadout({
  range,
  decade,
}: {
  readonly range: DecadeRange;
  readonly decade: number | null;
}) {
  const span = Math.max(range.to - range.from, 10);
  const filled =
    decade === null ? 1 : Math.min(Math.max((decade - range.from + 10) / (span + 10), 0), 1);
  const label =
    decade === null
      ? `${range.from}s to ${range.to}s`
      : decade < range.from
        ? 'Cleared'
        : `${decade}s`;
  return (
    <div className="ds-door-walk__sweep">
      <span className="ds-visually-hidden">
        Records on the map run from the {range.from}s to the {range.to}s.
      </span>
      <span className="ds-door-walk__sweep-decade" aria-hidden="true">
        {label}
      </span>
      <span className="ds-door-walk__sweep-track" aria-hidden="true">
        <span className="ds-door-walk__sweep-fill" style={{ inlineSize: `${filled * 100}%` }} />
      </span>
    </div>
  );
}
