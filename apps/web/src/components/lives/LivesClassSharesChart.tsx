/**
 * Class shares for one decade: one 100% bar per group, its parts the class bands from the table
 * the census published that decade. The bands step from light (lower) to ink (upper); each part
 * prints its share when it has room, and every value is in the tooltip and the table. A group with
 * nothing published gets a hatched bar and the reason in words.
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
import { ChartMarks } from '../data/ChartMarks';
import { Tip } from '../data/chart-kit';
import { drawnValue } from './lives-chart-utils';

void React;

export const LIVES_BUCKET_LABELS: Readonly<Record<LivesClassBucket, string>> = {
  lower: 'Lower',
  middle: 'Middle',
  upper: 'Upper',
  unclassified: 'Unclassified',
};

const BUCKET_TONE: Readonly<Record<LivesClassBucket, 'lo' | 'mid' | 'hi' | 'none'>> = {
  lower: 'lo',
  middle: 'mid',
  upper: 'hi',
  unclassified: 'none',
};

export type LivesClassSharesChartProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
};

export function livesBucketsFor(decade: LivesDecadeBundle): readonly LivesClassBucket[] {
  return decade.regime === 'work_based'
    ? ['lower', 'middle', 'upper', 'unclassified']
    : ['lower', 'middle', 'upper'];
}

/**
 * The lower band, because the class arc above this chart already titles the middle band for the
 * same decade; one figure per number.
 */
export function livesClassSharesReading(decade: LivesDecadeBundle, emphasis: LivesLens): string {
  const lower = decade.classShares[emphasis].lower;
  const label = LIVES_LENS_LABELS[emphasis];
  const value = drawnValue(lower);
  if (value !== null) {
    return `${formatLivesPercent(value)} of ${label} ${decade.classLabel.toLowerCase()} sat in the lower band in the ${decade.label}`;
  }
  return `${label} lower-band share for the ${decade.label}: ${describeLivesCell(lower).text.toLowerCase()}`;
}

export function LivesClassSharesChart({ decade, emphasis }: LivesClassSharesChartProps) {
  const buckets = livesBucketsFor(decade);

  return (
    <>
      <p className="ds-plot__unit" aria-hidden="true">
        Share of each group, percent
        {buckets.map((bucket) => (
          <span key={bucket} className="ds-plot__key">
            <span
              className="ds-plot__swatch"
              data-tone={BUCKET_TONE[bucket] === 'none' ? 'lo' : BUCKET_TONE[bucket]}
              data-hatched={BUCKET_TONE[bucket] === 'none' ? 'true' : undefined}
            />
            {LIVES_BUCKET_LABELS[bucket]}
          </span>
        ))}
      </p>
      <ChartMarks label={`${decade.classLabel} by group`}>
        <ul className="lives-stacks">
          {LIVES_LENSES.map((lens, index) => {
            const shares = buckets.map((bucket) => ({
              bucket,
              value: drawnValue(decade.classShares[lens][bucket]),
            }));
            const hasAny = shares.some((part) => part.value !== null && part.value > 0);
            const summary = hasAny
              ? shares
                  .filter((part) => part.value !== null)
                  .map(
                    (part) =>
                      `${LIVES_BUCKET_LABELS[part.bucket]} ${formatLivesPercent(part.value!)}`,
                  )
                  .join(', ')
              : describeLivesCell(decade.classShares[lens].middle).text;
            return (
              <li
                key={lens}
                className="lives-stack"
                data-emphasis={lens === emphasis ? 'true' : undefined}
                data-mark=""
                tabIndex={index === 0 ? 0 : -1}
                aria-label={`${LIVES_LENS_LABELS[lens]}: ${summary}`}
                style={{ '--tip-y': '100%' } as React.CSSProperties}
              >
                <span className="lives-stack__label" aria-hidden="true">
                  {LIVES_LENS_LABELS[lens]}
                </span>
                <span
                  className="lives-stack__track"
                  data-absent={hasAny ? undefined : 'true'}
                  aria-hidden="true"
                >
                  {hasAny ? (
                    shares.map((part) =>
                      part.value === null || part.value <= 0 ? null : (
                        <span
                          key={part.bucket}
                          className="lives-stack__part"
                          data-tone={BUCKET_TONE[part.bucket]}
                          style={{ flexGrow: part.value, flexBasis: 0 }}
                        >
                          {part.value >= 12 ? formatLivesPercent(part.value) : null}
                        </span>
                      ),
                    )
                  ) : (
                    <span className="lives-stack__empty">
                      {describeLivesCell(decade.classShares[lens].middle).text}
                    </span>
                  )}
                </span>
                {hasAny ? (
                  <Tip
                    title={LIVES_LENS_LABELS[lens]}
                    rows={shares
                      .filter((part) => part.value !== null)
                      .map((part) => ({
                        value: formatLivesPercent(part.value!),
                        label: LIVES_BUCKET_LABELS[part.bucket],
                      }))}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </ChartMarks>
    </>
  );
}
