import React from 'react';
import {
  LIVES_GROUP_LABELS,
  LIVES_GROUP_SLICES,
  type LivesClassBucket,
  type LivesDecadeBundle,
  type LivesGroupSlice,
} from '@repo/domain/statistics/lives';
import { LivesCellValue } from './LivesCellValue';

void React;

const BUCKET_LABELS: Readonly<Record<LivesClassBucket, string>> = {
  lower: 'Lower',
  middle: 'Middle',
  upper: 'Upper',
  unclassified: 'Unclassified',
};

export type LivesClassSharesTableProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesGroupSlice;
  readonly selectedTier: 'all' | 'lower' | 'middle' | 'upper';
};

/**
 * Share of each group in each class tier. All three groups are always shown; the lens only
 * emphasizes a row, and the chosen tier emphasizes a column.
 */
export function LivesClassSharesTable({
  decade,
  emphasis,
  selectedTier,
}: LivesClassSharesTableProps) {
  const buckets: readonly LivesClassBucket[] =
    decade.regime === 'occupational_strata'
      ? ['lower', 'middle', 'upper', 'unclassified']
      : ['lower', 'middle', 'upper'];
  return (
    <table className="lives-table lives-table--shares">
      <caption>
        {decade.classLabel}: share of adults in each group, {decade.label}
      </caption>
      <thead>
        <tr>
          <th scope="col">Group</th>
          {buckets.map((bucket) => (
            <th
              key={bucket}
              scope="col"
              data-emphasis={bucket === selectedTier ? 'true' : undefined}
            >
              {BUCKET_LABELS[bucket]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {LIVES_GROUP_SLICES.map((slice) => (
          <tr key={slice} data-emphasis={slice === emphasis ? 'true' : undefined}>
            <th scope="row">
              {LIVES_GROUP_LABELS[slice]}
              {slice === emphasis ? <span className="lives-sr-only"> (selected)</span> : null}
            </th>
            {buckets.map((bucket) => (
              <td key={bucket} data-emphasis={bucket === selectedTier ? 'true' : undefined}>
                <LivesCellValue cell={decade.classShares[slice][bucket]} unit="percent" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
