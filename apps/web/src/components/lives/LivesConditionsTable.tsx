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
  readonly tierSelected: boolean;
};

/**
 * Measured conditions for each group. Published tables do not cross income with other measures by race,
 * so conditions describe whole groups; when a tier is chosen the caption says why they do not change.
 */
export function LivesConditionsTable({
  decade,
  emphasis,
  tierSelected,
}: LivesConditionsTableProps) {
  return (
    <table className="lives-table lives-table--conditions">
      <caption>
        Conditions for each group, {decade.label}
        {tierSelected ? (
          <span className="lives-table__note">
            {' '}
            The census did not publish these by class, so they describe the whole group.
          </span>
        ) : null}
      </caption>
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
        {decade.conditions.map((condition) => (
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
