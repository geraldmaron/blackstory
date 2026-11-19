/**
 * The Records timeline: the same rows as the list, laid down the page as full-bleed decade bands.
 * Presentation only; grouping, order, totals and pages come from
 * `lib/discovery/collection-chronology.ts`.
 *
 * Each band is a color block (paper and ink alternating, sand for the page's busiest decades,
 * `bandTones`) with the decade as a display numeral that stays in view while its rows scroll, the
 * record count in mono, then the records as compact rows. A run of decades with no
 * records between two bands on the page is drawn as a gap on the axis and named, so a hole in the
 * archive reads as a hole rather than as two adjacent decades. A decade is an archive bucket, the
 * earliest one the archive documents a record in, not an event year. Records with no documented
 * decade sit in their own band after every dated one.
 */
import React, { type ReactNode } from 'react';
import { DisplayNumeral } from '@repo/ui';
import { decadeLabel } from '../../lib/discovery/collection-period';
import './records-chronology.css';

void React;

export type TimelineBand = {
  /** `null` is the undated band. */
  readonly decade: number | null;
  readonly anchor: string;
  /** Records of this decade across every page. */
  readonly total: number;
  /** The band began on an earlier page. */
  readonly continuedFrom: number | null;
  readonly rows: ReactNode;
};

export type RecordsTimelineProps = {
  readonly bands: readonly TimelineBand[];
};

function recordsPhrase(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'record' : 'records'}`;
}

function gapLabel(from: number, to: number): string {
  return from === to
    ? `No records in the ${decadeLabel(from)}`
    : `No records from the ${decadeLabel(from)} to the ${decadeLabel(to)}`;
}

export type BandTone = 'paper' | 'ink' | 'sand';

/**
 * Paper and ink alternate down the page; the busiest dated decades on the page (the top quarter by
 * record count, and only when they stand above the median) are sand. Tone encodes nothing a
 * reader must decode: the count is printed in every band.
 */
export function bandTones(bands: readonly Pick<TimelineBand, 'decade' | 'total'>[]): BandTone[] {
  const totals = bands
    .filter((band) => band.decade !== null)
    .map((band) => band.total)
    .sort((a, b) => a - b);
  const at = (q: number) => totals[Math.min(totals.length - 1, Math.floor(q * totals.length))] ?? 0;
  const busy = totals.length >= 4 && at(0.75) > at(0.5) ? at(0.75) : Number.POSITIVE_INFINITY;
  let alternate = 0;
  return bands.map((band) => {
    if (band.decade !== null && band.total >= busy) return 'sand';
    alternate += 1;
    return alternate % 2 === 1 ? 'paper' : 'ink';
  });
}

export function RecordsTimeline({ bands }: RecordsTimelineProps) {
  const tones = bandTones(bands);
  return (
    <div className="ds-records-timeline">
      {bands.map((band, index) => {
        const previous = bands[index - 1]?.decade;
        const gap =
          band.decade !== null && typeof previous === 'number' && band.decade - previous > 10
            ? gapLabel(previous + 10, band.decade - 10)
            : null;
        const label = band.decade === null ? 'Undated' : decadeLabel(band.decade);
        return (
          <React.Fragment key={band.anchor}>
            {gap === null ? null : (
              <p className="ds-records-timeline__gap">
                <span>{gap}</span>
              </p>
            )}
            <section
              className="ds-records-timeline__band"
              id={band.anchor}
              data-ground={tones[index]}
              data-undated={band.decade === null ? 'true' : undefined}
              aria-labelledby={`${band.anchor}-label`}
            >
              <header className="ds-records-timeline__mark">
                <h2 className="ds-records-timeline__year" id={`${band.anchor}-label`}>
                  {band.decade === null ? (
                    'Undated'
                  ) : (
                    <>
                      <span className="ds-visually-hidden">Documented in the </span>
                      <DisplayNumeral tone={tones[index] === 'ink' ? 'soft' : 'accent'}>
                        {label}
                      </DisplayNumeral>
                    </>
                  )}
                </h2>
                <p className="ds-records-timeline__total">{recordsPhrase(band.total)}</p>
                {band.continuedFrom === null ? null : (
                  <p className="ds-records-timeline__continued">
                    Continued from page {band.continuedFrom}
                  </p>
                )}
              </header>
              <ol className="ds-records-timeline__rows">{band.rows}</ol>
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
}
