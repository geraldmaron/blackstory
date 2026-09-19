/**
 * Stacked class-share bars for one decade. Tables remain the text alternative, not the first read.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesClassBucket,
  type LivesDecadeBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { describeLivesCell, formatLivesPercent } from '../../lib/lives/lives-format';
import { LivesClassSharesTable } from './LivesClassSharesTable';
import { LivesFigure } from './LivesFigure';

void React;

const BUCKET_LABELS: Readonly<Record<LivesClassBucket, string>> = {
  lower: 'Lower',
  middle: 'Middle',
  upper: 'Upper',
  unclassified: 'Unclassified',
};

export type LivesClassSharesChartProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
};

function bucketsFor(decade: LivesDecadeBundle): readonly LivesClassBucket[] {
  return decade.regime === 'work_based'
    ? ['lower', 'middle', 'upper', 'unclassified']
    : ['lower', 'middle', 'upper'];
}

function readingFor(decade: LivesDecadeBundle, emphasis: LivesLens): string {
  const middle = decade.classShares[emphasis].middle;
  const label = LIVES_LENS_LABELS[emphasis];
  if (middle.state === 'published' && middle.estimate !== undefined) {
    return `${formatLivesPercent(middle.estimate)} of ${label} ${decade.classLabel.toLowerCase()} sat in the middle band in the ${decade.label}.`;
  }
  const display = describeLivesCell(middle);
  return `${label} middle-band share for the ${decade.label}: ${display.text}.`;
}

export function LivesClassSharesChart({ decade, emphasis }: LivesClassSharesChartProps) {
  const buckets = bucketsFor(decade);
  const hasPublishedShare = LIVES_LENSES.some((lens) =>
    buckets.some((bucket) => {
      const cell = decade.classShares[lens][bucket];
      return cell.state === 'published' || cell.state === 'wide_margin';
    }),
  );
  if (!hasPublishedShare) return null;
  return (
    <LivesFigure
      title={`${decade.classLabel}, ${decade.label}`}
      reading={readingFor(decade, emphasis)}
      caption="Each bar is one group. Segments are class bands from the table the census published that decade, not a comparison of incomes across regimes."
      ariaLabel={`${decade.classLabel} shares for Black, white and Hispanic Americans in the ${decade.label}`}
      textAlternative={<LivesClassSharesTable decade={decade} emphasis={emphasis} />}
    >
      <div className="lives-stacks" role="img" aria-hidden="true">
        {LIVES_LENSES.map((lens) => {
          const shares = decade.classShares[lens];
          const hasAny = buckets.some((bucket) => {
            const cell = shares[bucket];
            return (
              (cell.state === 'published' || cell.state === 'wide_margin') &&
              cell.estimate !== undefined
            );
          });
          return (
            <div
              key={lens}
              className="lives-stack"
              data-emphasis={lens === emphasis ? 'true' : undefined}
            >
              <span className="lives-stack__label">{LIVES_LENS_LABELS[lens]}</span>
              <div className="lives-stack__track">
                {hasAny ? (
                  buckets.map((bucket) => {
                    const cell = shares[bucket];
                    const value =
                      (cell.state === 'published' || cell.state === 'wide_margin') &&
                      cell.estimate !== undefined
                        ? cell.estimate
                        : 0;
                    if (value <= 0) return null;
                    return (
                      <span
                        key={bucket}
                        className="lives-stack__fill"
                        data-bucket={bucket}
                        style={{ flexGrow: value, flexBasis: 0 }}
                        title={`${BUCKET_LABELS[bucket]}: ${formatLivesPercent(value)}`}
                      >
                        {value >= 12 ? formatLivesPercent(value) : null}
                      </span>
                    );
                  })
                ) : (
                  <span className="lives-stack__empty">
                    {describeLivesCell(shares.middle).text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="lives-stack__legend" aria-hidden="true">
        {buckets.map((bucket) => (
          <li key={bucket} data-bucket={bucket}>
            {BUCKET_LABELS[bucket]}
          </li>
        ))}
      </ul>
    </LivesFigure>
  );
}
