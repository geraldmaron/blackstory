/**
 * A drawn diagram of how completely the census named each group in a decade.
 * Heights are visibility, not population counts.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesDecadeBundle,
  type LivesHispanicCounting,
} from '@repo/domain/statistics/lives';
import { LivesCountNotes } from './LivesCountNotes';

void React;

const HISPANIC_SIGHT: Readonly<
  Record<LivesHispanicCounting, { readonly fill: number; readonly label: string }>
> = {
  not_counted: { fill: 8, label: 'Not named' },
  mexican_race: { fill: 42, label: 'Mexican as a race' },
  proxies: { fill: 55, label: 'Surname and birthplace' },
  sample_question: { fill: 72, label: 'Sample question' },
  counted: { fill: 100, label: 'Named on every form' },
};

export type LivesCountSightProps = {
  readonly decade: LivesDecadeBundle;
};

export function LivesCountSight({ decade }: LivesCountSightProps) {
  const hispanic = HISPANIC_SIGHT[decade.hispanicCounting];
  const columns = LIVES_LENSES.map((lens) => {
    if (lens === 'hispanic') {
      return { lens, fill: hispanic.fill, label: hispanic.label };
    }
    return { lens, fill: 100, label: 'Named' };
  });

  return (
    <section className="lives-sight" aria-labelledby="lives-count-heading">
      <h3 id="lives-count-heading">What the count could see in the {decade.label}</h3>
      <p className="lives-sight__reading">
        Column height is how completely the census named the group, not how many people it counted.
        Hispanic Americans: {hispanic.label}.
      </p>
      <svg className="lives-sight__drawing" viewBox="0 0 360 180" role="img" aria-hidden="true">
        <rect x="0" y="0" width="360" height="180" fill="var(--ds-canvas)" />
        {columns.map((column, index) => {
          const x = 24 + index * 116;
          const barH = (column.fill / 100) * 120;
          const y = 140 - barH;
          return (
            <g key={column.lens}>
              <rect
                x={x}
                y="20"
                width="88"
                height="120"
                fill="none"
                stroke="var(--ds-rule)"
                strokeWidth="1"
              />
              <rect
                x={x}
                y={y}
                width="88"
                height={barH}
                fill={column.lens === 'hispanic' ? 'var(--ds-viz-2)' : 'var(--ds-viz-1)'}
                opacity={column.fill < 100 ? 0.55 : 0.85}
              />
              <text
                x={x + 44}
                y="158"
                textAnchor="middle"
                fill="var(--ds-ink)"
                fontFamily="var(--ds-font-sans)"
                fontSize="12"
              >
                {LIVES_LENS_LABELS[column.lens]}
              </text>
              <text
                x={x + 44}
                y="174"
                textAnchor="middle"
                fill="var(--ds-ink-muted)"
                fontFamily="var(--ds-font-mono)"
                fontSize="9"
              >
                {column.label}
              </text>
            </g>
          );
        })}
      </svg>
      <LivesCountNotes notes={decade.countNotes} decadeLabel={decade.label} omitHeading />
    </section>
  );
}
