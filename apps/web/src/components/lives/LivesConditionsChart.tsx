/**
 * Horizontal condition bars for one decade: one row per measure, three groups always on screen.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesDecadeBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { describeLivesCell } from '../../lib/lives/lives-format';
import { LivesConditionsTable } from './LivesConditionsTable';
import { LivesFigure } from './LivesFigure';

void React;

export type LivesConditionsChartProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly tierSelected: boolean;
};

function barWidth(estimate: number | undefined): number {
  if (estimate === undefined || estimate <= 0) return 0;
  return Math.min(100, estimate);
}

export function LivesConditionsChart({
  decade,
  emphasis,
  tierSelected,
}: LivesConditionsChartProps) {
  if (decade.conditions.length === 0) return null;
  const first = decade.conditions[0];
  const firstCell = first?.cells[emphasis];
  const firstDisplay = firstCell ? describeLivesCell(firstCell) : null;
  const reading =
    first && firstDisplay
      ? `${LIVES_LENS_LABELS[emphasis]} ${first.label.toLowerCase()} in the ${decade.label}: ${firstDisplay.text}.`
      : `Measured conditions for each group in the ${decade.label}.`;

  return (
    <LivesFigure
      title={`Conditions, ${decade.label}`}
      reading={reading}
      caption={
        tierSelected
          ? 'The census did not publish these by class, so they describe the whole group even when a tier is selected.'
          : 'Each row is one published measure. Bars are percentages; a missing bar means the census did not publish that cell.'
      }
      ariaLabel={`Living conditions for Black, white and Hispanic Americans in the ${decade.label}`}
      textAlternative={
        <LivesConditionsTable decade={decade} emphasis={emphasis} tierSelected={tierSelected} />
      }
    >
      <div className="lives-conditions" role="img" aria-hidden="true">
        {decade.conditions.map((condition) => (
          <div key={condition.key} className="lives-condition">
            <p className="lives-condition__label">
              {condition.label}
              <span className="lives-condition__universe">{condition.universe}</span>
            </p>
            {LIVES_LENSES.map((lens) => {
              const cell = condition.cells[lens];
              const display = describeLivesCell(cell);
              const width =
                cell.state === 'published' || cell.state === 'wide_margin'
                  ? barWidth(cell.estimate)
                  : 0;
              return (
                <div
                  key={lens}
                  className="lives-condition__row"
                  data-emphasis={lens === emphasis ? 'true' : undefined}
                >
                  <span className="lives-condition__group">{LIVES_LENS_LABELS[lens]}</span>
                  <div className="lives-condition__track">
                    {width > 0 ? (
                      <span
                        className="lives-condition__bar"
                        style={{ width: `${width}%` }}
                        title={`${LIVES_LENS_LABELS[lens]}: ${display.text}`}
                      />
                    ) : (
                      <span className="lives-condition__empty">{display.text}</span>
                    )}
                  </div>
                  <span className="lives-condition__value">{display.text}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </LivesFigure>
  );
}
