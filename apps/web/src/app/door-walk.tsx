/**
 * The Door's walk: the decade histogram, docked beside the map. Each step is a decade that has a
 * record to show: the map holds every record documented up to that decade (door-immersive.tsx)
 * and this card brings up one record from it, shown as its record page shows it
 * (`DoorRecordBlock`), its pin called out on the map. The histogram is the progress and the
 * control: its bars are the register's records per decade on a true time scale, the walked decades
 * in ink, the current one in copper, and a slider laid over it scrubs across time. Back / Next and
 * the arrow keys step; Escape returns to the opening. Every step is the same card in the same
 * place, so the map is what changes between steps, not the layout.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '@repo/ui';
import type { DecadeBar, DoorJourneyRecord } from './door-decade-walk';
import { DoorRecordBlock } from './door-record-block';

void React;

export type DoorWalkCardProps = {
  readonly record: DoorJourneyRecord;
  /** 1-based position among the stops. */
  readonly position: number;
  readonly stops: readonly DoorJourneyRecord[];
  readonly bars: readonly DecadeBar[];
  /** The histogram's prose caption (`decadeCaption`). */
  readonly caption: string;
  readonly headingRef: React.Ref<HTMLHeadingElement>;
  readonly onGo: (position: number) => void;
  readonly onSkip: () => void;
};

/** The stop a slider value lands on: the nearest decade with a record, in the direction moved. */
export function stopForDecade(
  stops: readonly { readonly decade: number }[],
  decade: number,
  from: number,
): number {
  if (stops.length === 0) return 0;
  const forward = decade >= from;
  if (forward) {
    const index = stops.findIndex((stop) => stop.decade >= decade);
    return (index === -1 ? stops.length - 1 : index) + 1;
  }
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    if (stops[index]!.decade <= decade) return index + 1;
  }
  return 1;
}

export function DoorWalkCard({
  record,
  position,
  stops,
  bars,
  caption,
  headingRef,
  onGo,
  onSkip,
}: DoorWalkCardProps) {
  const total = stops.length;
  const isLast = position >= total;
  const headingId = `door-walk-heading-${record.decade}`;
  const count = bars.find((bar) => bar.year === record.decade)?.count ?? 0;
  const peak = Math.max(1, ...bars.map((bar) => bar.count));
  const first = bars[0]?.year ?? record.decade;
  const last = bars.at(-1)?.year ?? record.decade;

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
    // The slider steps itself with the arrow keys.
    if (event.target instanceof HTMLInputElement) return;
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
      data-ground="ink"
      data-ground-fixed=""
      aria-labelledby={headingId}
      aria-roledescription="walk step"
      onKeyDown={onKeyDown}
    >
      <div className="ds-door-walk__top">
        <p className="ds-door-walk__count">
          <span className="ds-visually-hidden">Decade </span>
          {position} of {total}
        </p>
        <button type="button" className="ds-door-walk__skip" onClick={onSkip}>
          Skip to the map
        </button>
      </div>

      <figure className="ds-door-walk__axis" style={{ '--n': bars.length } as React.CSSProperties}>
        {/* A picture of the counts; the slider over it is the control and the caption says it. */}
        <ol className="ds-door-walk__bars" aria-hidden="true">
          {bars.map((bar) => (
            <li
              key={bar.year}
              className="ds-door-walk__bar"
              data-state={
                bar.year === record.decade
                  ? 'current'
                  : bar.year < record.decade
                    ? 'walked'
                    : 'ahead'
              }
              data-empty={bar.count === 0 ? 'true' : undefined}
              style={{ '--bar': bar.count / peak } as React.CSSProperties}
            >
              {bar.year % 100 === 0 ? (
                <span className="ds-door-walk__bar-year">{bar.year}</span>
              ) : null}
            </li>
          ))}
        </ol>
        {total > 1 && bars.length > 1 ? (
          <input
            type="range"
            className="ds-door-walk__scrub"
            min={first}
            max={last}
            step={10}
            value={record.decade}
            aria-label="Decade"
            aria-valuetext={`${record.decade}s, ${record.name}`}
            onChange={(event) =>
              onGo(stopForDecade(stops, Number(event.target.value), record.decade))
            }
          />
        ) : null}
        <figcaption className="ds-door-walk__caption">{caption}</figcaption>
      </figure>

      <div className="ds-door-walk__body" ref={bodyRef}>
        <h2 className="ds-door-walk__heading" id={headingId} ref={headingRef} tabIndex={-1}>
          {record.decade}s
        </h2>
        <p className="ds-door-walk__tally">
          {count.toLocaleString('en-US')} {count === 1 ? 'record' : 'records'} from the{' '}
          {record.decade}s. The map shows every record documented through them.
        </p>
        <DoorRecordBlock record={record} className="ds-door-walk__record" />
      </div>

      <div className="ds-door-walk__controls">
        {/* From the first decade, Back returns to the opening. */}
        <Button variant="secondary" onClick={() => onGo(position - 1)}>
          Back
        </Button>
        {isLast ? (
          <Button variant="primary" onClick={onSkip}>
            Explore the map
          </Button>
        ) : (
          <Button variant="primary" onClick={() => onGo(position + 1)}>
            Next decade
          </Button>
        )}
      </div>
    </section>
  );
}
