/**
 * Multi-decade class-share arc for Lives: middle-band share by race lens across decades.
 * Sits above the decade drill-in so Lived continues the time spine instead of opening as a
 * separate control panel.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesAreaBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { formatLivesPercent } from '../../lib/lives/lives-format';
import { DataChartFrame } from '../data/DataChartFrame';
import { niceMax, scaleLinear } from '../data/chart-utils';

void React;

export type LivesClassArcChartProps = {
  readonly bundle: LivesAreaBundle;
  readonly emphasis: LivesLens;
  readonly onSelectDecade?: (decade: number) => void;
  readonly selectedDecade?: number;
  readonly id?: string;
  readonly figureLabel?: string;
};

const WIDTH = 960;
const HEIGHT = 260;
const MARGIN = { top: 24, right: 20, bottom: 52, left: 48 } as const;
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

const LENS_CLASS: Readonly<Record<LivesLens, string>> = {
  black: 'ds-lives-arc__line--black',
  white: 'ds-lives-arc__line--white',
  hispanic: 'ds-lives-arc__line--hispanic',
};

function middleShare(bundle: LivesAreaBundle, lens: LivesLens, decadeIndex: number): number | null {
  const decade = bundle.decades[decadeIndex];
  if (!decade) return null;
  const cell = decade.classShares[lens].middle;
  if ((cell.state === 'published' || cell.state === 'wide_margin') && cell.estimate !== undefined) {
    return cell.estimate;
  }
  return null;
}

export function LivesClassArcChart({
  bundle,
  emphasis,
  onSelectDecade,
  selectedDecade,
  id,
  figureLabel,
}: LivesClassArcChartProps) {
  const decades = bundle.decades;
  if (decades.length < 2) return null;

  const publishedShares = LIVES_LENSES.flatMap((lens) =>
    decades
      .map((_, index) => middleShare(bundle, lens, index))
      .filter((v): v is number => v !== null),
  );
  if (publishedShares.length === 0) return null;

  const maxShare = niceMax(Math.max(...publishedShares, 1));
  const xScale = scaleLinear(0, decades.length - 1, MARGIN.left, MARGIN.left + PLOT_W);
  const yScale = scaleLinear(0, maxShare, MARGIN.top + PLOT_H, MARGIN.top);
  const labelEvery = decades.length > 12 ? 2 : 1;

  const readingDecade = decades.find((entry) => entry.decade === selectedDecade) ?? decades.at(-1)!;
  const emphasisCell = readingDecade.classShares[emphasis].middle;
  const emphasisShare =
    emphasisCell.estimate !== undefined
      ? formatLivesPercent(emphasisCell.estimate)
      : 'not published';

  return (
    <DataChartFrame
      title={`Middle-band share across the decades · ${bundle.areaName}`}
      {...(figureLabel !== undefined ? { figureLabel } : {})}
      {...(id !== undefined ? { id } : {})}
      reading={
        <>
          In the {readingDecade.label}, {LIVES_LENS_LABELS[emphasis]} middle-band share was{' '}
          {emphasisShare}. Lines skip decades the census did not publish for that group.
        </>
      }
      caption="Each line is one group’s middle class (or middle work) band as published that decade. Measurement regimes change; gaps in a line are missing publication, not zero."
      sourceLabel="U.S. Census Bureau"
      sourceUrl="https://www.census.gov"
      ariaLabel={`Middle-band class share by race across decades for ${bundle.areaName}`}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Middle-band share by decade and group</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              {LIVES_LENSES.map((lens) => (
                <th key={lens} scope="col">
                  {LIVES_LENS_LABELS[lens]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decades.map((decade, index) => (
              <tr key={decade.decade}>
                <th scope="row">{decade.label}</th>
                {LIVES_LENSES.map((lens) => {
                  const value = middleShare(bundle, lens, index);
                  return <td key={lens}>{value === null ? '—' : formatLivesPercent(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg
        className="ds-data-chart__svg ds-lives-arc"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        {LIVES_LENSES.map((lens) => {
          const points: string[] = [];
          decades.forEach((_, index) => {
            const value = middleShare(bundle, lens, index);
            if (value === null) return;
            points.push(`${xScale(index).toFixed(1)},${yScale(value).toFixed(1)}`);
          });
          if (points.length < 2) return null;
          return (
            <polyline
              key={lens}
              points={points.join(' ')}
              fill="none"
              className={`ds-lives-arc__line ${LENS_CLASS[lens]}`}
              data-emphasis={lens === emphasis ? 'true' : undefined}
            />
          );
        })}
        {decades.map((decade, index) => {
          const selected = decade.decade === selectedDecade;
          const value = middleShare(bundle, emphasis, index);
          return (
            <g key={decade.decade}>
              {onSelectDecade ? (
                <rect
                  x={xScale(index) - 10}
                  y={MARGIN.top}
                  width={20}
                  height={PLOT_H}
                  className="ds-lives-arc__hit"
                  onClick={() => onSelectDecade(decade.decade)}
                  role="presentation"
                />
              ) : null}
              {value !== null ? (
                <circle
                  cx={xScale(index)}
                  cy={yScale(value)}
                  r={selected ? 5 : 3}
                  className="ds-lives-arc__dot"
                  data-emphasis={selected ? 'true' : undefined}
                />
              ) : null}
              {index % labelEvery === 0 || index === decades.length - 1 ? (
                <text
                  x={xScale(index)}
                  y={HEIGHT - 16}
                  textAnchor="middle"
                  className="ds-lives-arc__tick"
                >
                  {String(decade.decade).slice(2)}s
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={MARGIN.left} y={MARGIN.top - 6} className="ds-lives-arc__axis">
          {maxShare.toFixed(0)}%
        </text>
      </svg>
      <ul className="ds-lives-arc__legend" aria-hidden="true">
        {LIVES_LENSES.map((lens) => (
          <li key={lens} data-emphasis={lens === emphasis ? 'true' : undefined}>
            <span className={`ds-lives-arc__swatch ${LENS_CLASS[lens]}`} />
            {LIVES_LENS_LABELS[lens]}
          </li>
        ))}
      </ul>
    </DataChartFrame>
  );
}
