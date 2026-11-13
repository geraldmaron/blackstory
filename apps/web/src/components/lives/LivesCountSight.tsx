/**
 * What the count could see in a decade: how completely the census named each group, as one bar
 * per group. Bar length is visibility on the form, not how many people were counted. The count
 * notes that explain each limit follow as a ruled list.
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
  not_counted: { fill: 0, label: 'Not named' },
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
  const rows = LIVES_LENSES.map((lens) =>
    lens === 'hispanic'
      ? { lens, fill: hispanic.fill, label: hispanic.label }
      : { lens, fill: 100, label: 'Named' },
  );

  return (
    <section className="lives-sight" aria-labelledby={`lives-count-heading-${decade.decade}`}>
      <h3 className="lives-sight__title" id={`lives-count-heading-${decade.decade}`}>
        What the count could see in the {decade.label}
      </h3>
      <p className="lives-sight__reading">
        Bar length is how completely the census named the group, not how many people it counted.
      </p>
      <ul className="ds-hbars lives-sight__bars">
        {rows.map((row) => (
          <li key={row.lens} className="ds-hbar">
            <span className="ds-hbar__label">{LIVES_LENS_LABELS[row.lens]}</span>
            <span
              className="ds-hbar__track"
              data-absent={row.fill === 0 ? 'true' : undefined}
              aria-hidden="true"
            >
              {row.fill > 0 ? (
                <span
                  className="ds-hbar__fill"
                  data-tone={row.fill < 100 ? 'mid' : 'hi'}
                  style={{ width: `${row.fill}%` }}
                />
              ) : null}
            </span>
            <span className="ds-hbar__value" data-absent="true">
              {row.label}
            </span>
          </li>
        ))}
      </ul>
      <LivesCountNotes notes={decade.countNotes} decadeLabel={decade.label} omitHeading />
    </section>
  );
}
