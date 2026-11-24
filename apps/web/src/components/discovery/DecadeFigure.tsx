/**
 * The Archive timeline's figure: the filtered records by decade, on a true time scale, so a
 * century with no records takes a century's width. A bar is a link to its decade's rows below.
 * Hand-drawn in HTML and CSS; presentation only. The counts are the timeline's own
 * (`lib/discovery/collection-chronology.ts`): a record is counted once, in the earliest decade
 * the archive documents it in, which is the band it sits in under the figure.
 */
import React from 'react';
import { ExhibitFrame } from '@repo/ui';
import { decadeLabel } from '../../lib/discovery/collection-period';

void React;

export type DecadeFigureProps = {
  /** Decades that hold records, with where each one's rows start. */
  readonly decades: readonly {
    readonly decade: number;
    readonly count: number;
    readonly href: string;
  }[];
  readonly undated: number;
  /** Decades whose rows are on the page being read. */
  readonly onPage: ReadonlySet<number>;
};

const n = (value: number) => value.toLocaleString('en-US');
const records = (value: number) => (value === 1 ? 'record' : 'records');

export function DecadeFigure({ decades, undated, onPage }: DecadeFigureProps) {
  if (decades.length < 2) return null;
  const byDecade = new Map(decades.map((item) => [item.decade, item]));
  const first = decades[0]!.decade;
  const last = decades[decades.length - 1]!.decade;
  const peak = Math.max(...decades.map((item) => item.count));
  const busiest = decades.find((item) => item.count === peak)!;
  const axis: number[] = [];
  for (let decade = first; decade <= last; decade += 10) axis.push(decade);

  return (
    <ExhibitFrame
      id="archive-decades"
      kind="figure"
      basis="records by earliest documented decade"
      className="ds-decade-figure"
      receipt={
        <p className="ds-decade-figure__note">
          Each bar is a decade, as tall as the records first documented in it. The{' '}
          {decadeLabel(busiest.decade)} hold the most, {n(peak)}.
          {undated > 0
            ? ` ${n(undated)} ${undated === 1 ? 'has' : 'have'} no recorded decade and ${undated === 1 ? 'is' : 'are'} not drawn.`
            : ''}{' '}
          A decade is the archive’s earliest record of a subject, not the date of an event.
        </p>
      }
    >
      <ol
        className="ds-decade-figure__bars"
        style={{ '--decades': axis.length } as React.CSSProperties}
      >
        {axis.map((decade) => {
          const item = byDecade.get(decade);
          const label = decadeLabel(decade);
          // The two ends and the century starts carry the axis labels.
          // A century too near an end would print over that end's label.
          const tick =
            decade === first ||
            decade === last ||
            (decade % 100 === 0 && decade - first >= 40 && last - decade >= 40);
          return (
            <li key={decade} className="ds-decade-figure__slot">
              {item ? (
                <a
                  className="ds-decade-figure__bar"
                  href={item.href}
                  title={`${label}: ${n(item.count)} ${records(item.count)}`}
                  aria-current={onPage.has(decade) ? 'true' : undefined}
                  style={{ '--share': item.count / peak } as React.CSSProperties}
                >
                  <span className="ds-visually-hidden">
                    {label}, {n(item.count)} {records(item.count)}
                  </span>
                </a>
              ) : (
                <span className="ds-visually-hidden">{label}, no records</span>
              )}
              {tick ? (
                <span className="ds-decade-figure__tick" aria-hidden="true">
                  {decade}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ExhibitFrame>
  );
}
