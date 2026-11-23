/**
 * Measured conditions for one decade as small multiples: one panel per measure, the same groups in
 * the same order in each, every bar on its measure's own scale. A group with nothing published in
 * any measure that decade is named once, above the panels, instead of a "not published" row in
 * every panel; a single missing cell is a hatched empty track with the reason beside it.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesDecadeBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { describeLivesCell, livesBarScaleNote, livesBarShare } from '../../lib/lives/lives-format';
import { ChartMarks } from '../data/ChartMarks';
import { drawnValue } from './lives-chart-utils';

void React;

export type LivesConditionsChartProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
};

/** The measures with at least one drawn value this decade. */
export function livesVisibleConditions(decade: LivesDecadeBundle) {
  return decade.conditions.filter((condition) =>
    LIVES_LENSES.some((lens) => drawnValue(condition.cells[lens]) !== null),
  );
}

export function LivesConditionsChart({ decade, emphasis }: LivesConditionsChartProps) {
  const visible = livesVisibleConditions(decade);

  const silent = LIVES_LENSES.filter((lens) =>
    visible.every((condition) => drawnValue(condition.cells[lens]) === null),
  );
  const lenses = LIVES_LENSES.filter((lens) => !silent.includes(lens));

  return (
    <>
      {silent.length > 0 ? (
        <p className="lives-conditions__silent">
          Not published for{' '}
          {silent.map((lens) => `${LIVES_LENS_LABELS[lens]} Americans`).join(' or ')} in the{' '}
          {decade.label}.
        </p>
      ) : null}
      <ChartMarks label={`Conditions by group, ${decade.label}`}>
        <div className="lives-conditions">
          {visible.map((condition, conditionIndex) => {
            const scale = livesBarScaleNote(condition.unit);
            return (
              <section key={condition.key} className="lives-condition" aria-label={condition.label}>
                <h4 className="lives-condition__title">{condition.label}</h4>
                <p className="lives-condition__universe">
                  {condition.universe}
                  {scale ? ` · ${scale}` : ''}
                </p>
                <ul className="ds-hbars">
                  {lenses.map((lens, lensIndex) => {
                    const cell = condition.cells[lens];
                    const value = drawnValue(cell);
                    const display = describeLivesCell(cell, condition.unit);
                    return (
                      <li
                        key={lens}
                        className="ds-hbar"
                        data-emphasis={lens === emphasis ? 'true' : undefined}
                        data-mark=""
                        tabIndex={conditionIndex === 0 && lensIndex === 0 ? 0 : -1}
                        aria-label={`${condition.label}, ${LIVES_LENS_LABELS[lens]}: ${display.text}${display.detail ? `, ${display.detail}` : ''}`}
                      >
                        <span className="ds-hbar__label" aria-hidden="true">
                          {LIVES_LENS_LABELS[lens]}
                        </span>
                        <span
                          className="ds-hbar__track"
                          data-absent={value === null ? 'true' : undefined}
                          aria-hidden="true"
                        >
                          {value === null ? null : (
                            <span
                              className="ds-hbar__fill"
                              data-tone={lens === emphasis ? 'hi' : 'lo'}
                              style={{ width: `${livesBarShare(value, condition.unit)}%` }}
                            />
                          )}
                        </span>
                        <span
                          className="ds-hbar__value"
                          data-absent={value === null ? 'true' : undefined}
                          aria-hidden="true"
                        >
                          {display.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </ChartMarks>
    </>
  );
}
