import React from 'react';
import {
  LIVES_GROUP_LABELS,
  LIVES_GROUP_SLICES,
  type LivesDecadeBundle,
  type LivesGroupSlice,
  type LivesTierKey,
} from '@repo/domain/statistics/lives';
import { LivesCellValue } from './LivesCellValue';

void React;

const TIER_PHRASE: Readonly<Record<LivesTierKey, string>> = {
  all: 'all adults in each group',
  lower: 'adults in the lower tier',
  middle: 'adults in the middle tier',
  upper: 'adults in the upper tier',
};

export type LivesConditionsTableProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesGroupSlice;
  readonly tier: LivesTierKey;
};

/** Measured conditions within one tier, with all three groups side by side. */
export function LivesConditionsTable({ decade, emphasis, tier }: LivesConditionsTableProps) {
  return (
    <table className="lives-table lives-table--conditions">
      <caption>
        Conditions for {TIER_PHRASE[tier]}, {decade.label}
      </caption>
      <thead>
        <tr>
          <th scope="col">Measure</th>
          {LIVES_GROUP_SLICES.map((slice) => (
            <th key={slice} scope="col" data-emphasis={slice === emphasis ? 'true' : undefined}>
              {LIVES_GROUP_LABELS[slice]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {decade.conditions.map((condition) => (
          <tr key={condition.key}>
            <th scope="row">{condition.label}</th>
            {LIVES_GROUP_SLICES.map((slice) => (
              <td key={slice} data-emphasis={slice === emphasis ? 'true' : undefined}>
                <LivesCellValue cell={condition.cells[slice][tier]} unit={condition.unit} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
