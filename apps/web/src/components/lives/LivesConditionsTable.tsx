import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesDecadeBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { LivesCellValue } from './LivesCellValue';

void React;

export type LivesConditionsTableProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
};

/**
 * Measured conditions for each group. Published tables do not cross income with other measures by race,
 * so conditions describe whole groups.
 */
export function LivesConditionsTable({ decade, emphasis }: LivesConditionsTableProps) {
  const visibleConditions = decade.conditions.filter((condition) =>
    LIVES_LENSES.some((lens) => {
      const cell = condition.cells[lens];
      return cell.state === 'published' || cell.state === 'wide_margin';
    }),
  );
  return (
    <table className="lives-table lives-table--conditions">
      <caption>Conditions for each group, {decade.label}</caption>
      <thead>
        <tr>
          <th scope="col">Measure</th>
          {LIVES_LENSES.map((lens) => (
            <th key={lens} scope="col" data-emphasis={lens === emphasis ? 'true' : undefined}>
              {LIVES_LENS_LABELS[lens]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleConditions.map((condition) => (
          <tr key={condition.key}>
            <th scope="row">
              {condition.label}
              <span className="lives-cell__definition">{condition.universe}</span>
            </th>
            {LIVES_LENSES.map((lens) => (
              <td key={lens} data-emphasis={lens === emphasis ? 'true' : undefined}>
                <LivesCellValue cell={condition.cells[lens]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
