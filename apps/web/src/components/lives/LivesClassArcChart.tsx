/**
 * The middle-band class share for each group, decade by decade. The decade the appendix's Decade
 * control picked is marked with a copper rule. The emphasized group's line is ink; the others are
 * the neutral comparison. Each column's values are in a keyboard-reachable tip.
 *
 * Nothing is bridged. A line breaks where its group was not published and where class was
 * measured differently from the decade before; a run the emphasized group was not published in
 * is hatched and labeled, and a change of measure is a labeled rule.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesAreaBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { formatLivesPercent } from '../../lib/lives/lives-format';
import {
  Band,
  Dot,
  EndLabels,
  Lines,
  Mark,
  Plot,
  Rule,
  Tip,
  bandLayout,
  categoryTicks,
  valueScale,
  type LinePoint,
} from '../data/chart-kit';
import { drawnValue } from './lives-chart-utils';

void React;

export type LivesClassArcChartProps = {
  readonly bundle: LivesAreaBundle;
  readonly emphasis: LivesLens;
  readonly selectedDecade: number;
};

export function LivesClassArcChart({ bundle, emphasis, selectedDecade }: LivesClassArcChartProps) {
  const decades = bundle.decades;

  const share = (lens: LivesLens, index: number) =>
    drawnValue(decades[index]!.classShares[lens].middle);
  const values = LIVES_LENSES.flatMap((lens) =>
    decades.map((_, index) => share(lens, index)).filter((v): v is number => v !== null),
  );

  const { top, ticks } = valueScale(Math.max(...values), (value) => `${value}%`);
  const y = (value: number) => (value / top) * 100;
  const { center, width } = bandLayout(decades.length);
  const selected = decades.find((entry) => entry.decade === selectedDecade) ?? decades.at(-1)!;
  const selectedIndex = decades.indexOf(selected);

  // Spans of decades the emphasized group was not published in, each labeled once.
  const gaps: { from: number; to: number }[] = [];
  decades.forEach((_, index) => {
    if (share(emphasis, index) !== null) return;
    const previous = gaps.at(-1);
    if (previous && previous.to === index - 1) previous.to = index;
    else gaps.push({ from: index, to: index });
  });

  const measureBreaks = decades.flatMap((decade, index) =>
    decade.boundaryFromPrevious === 'different_measure' && index > 0 ? [index] : [],
  );

  const lines = LIVES_LENSES.map((lens) => {
    const points: LinePoint[] = [];
    decades.forEach((decade, index) => {
      if (decade.boundaryFromPrevious === 'different_measure' && index > 0) points.push(null);
      const value = share(lens, index);
      points.push(value === null ? null : { x: center(index), y: y(value) });
    });
    return { id: lens, points, tone: lens === emphasis ? ('hi' as const) : ('lo' as const) };
  });

  const lastValues = LIVES_LENSES.flatMap((lens) => {
    for (let index = decades.length - 1; index >= 0; index -= 1) {
      const value = share(lens, index);
      if (value !== null) {
        return index === decades.length - 1
          ? [
              {
                id: lens,
                y: y(value),
                name: LIVES_LENS_LABELS[lens],
                value: formatLivesPercent(value),
                tone: lens === emphasis ? ('hi' as const) : ('lo' as const),
              },
            ]
          : [];
      }
    }
    return [];
  });

  return (
    <Plot
      label="Middle-band class share by decade"
      unit="Share in the middle class band, percent"
      size="md"
      endWidth="min(7rem, 22cqi)"
      yTicks={ticks}
      xTicks={categoryTicks(
        decades.map((decade) => decade.label),
        center,
        2,
      )}
    >
      {gaps.map((gap) => (
        <Band
          key={gap.from}
          from={center(gap.from) - width / 2}
          to={center(gap.to) + width / 2}
          kind="gap"
          label={gap === gaps[0] || gap.to - gap.from >= 1 ? 'Not published' : ''}
        />
      ))}
      {measureBreaks.map((index, order) => (
        <Rule
          key={`m-${index}`}
          at={center(index) - width / 2}
          // Two breaks a decade or two apart would print over each other; the first speaks for both.
          {...(order === 0 || index - measureBreaks[order - 1]! > 2
            ? { label: 'Measured differently', minor: order > 0 }
            : {})}
        />
      ))}
      <Rule at={center(selectedIndex)} kind="current" />
      <Lines series={lines} />
      {decades.map((decade, index) => {
        const rows = LIVES_LENSES.map((lens) => {
          const value = share(lens, index);
          return {
            value: value === null ? 'Not published' : formatLivesPercent(value),
            label: LIVES_LENS_LABELS[lens],
            tone: lens === emphasis ? ('hi' as const) : ('lo' as const),
          };
        });
        const highest = Math.max(0, ...LIVES_LENSES.map((lens) => share(lens, index) ?? 0).map(y));
        const isSelected = index === selectedIndex;
        return (
          <Mark
            key={decade.decade}
            x={center(index)}
            width={width}
            first={index === 0}
            crosshair
            selected={isSelected}
            tipY={highest}
            ariaLabel={`${decade.label}: ${rows.map((row) => `${row.label} ${row.value}`).join(', ')}`}
            tip={<Tip title={decade.label} rows={rows} />}
          >
            {LIVES_LENSES.map((lens) => {
              const value = share(lens, index);
              return value === null ? null : (
                <Dot
                  key={lens}
                  x={50}
                  y={y(value)}
                  tone={lens === emphasis ? 'hi' : 'lo'}
                  size={isSelected && lens === emphasis ? 'lg' : 'sm'}
                />
              );
            })}
          </Mark>
        );
      })}
      <EndLabels items={lastValues} />
    </Plot>
  );
}
