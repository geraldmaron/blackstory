import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesClassBucket,
  type LivesDecadeBundle,
  type LivesLens,
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
  readonly emphasis: LivesLens;
  readonly selectedTier: 'all' | 'lower' | 'middle' | 'upper';
};

/**
 * Share of each group in each class band. All three groups are always shown; the lens emphasizes a row,
 * the chosen tier a column, and each row names the definition its figures used.
 */
export function LivesClassSharesTable({
  decade,
  emphasis,
  selectedTier,
}: LivesClassSharesTableProps) {
  const buckets: readonly LivesClassBucket[] =
    decade.regime === 'work_based'
      ? ['lower', 'middle', 'upper', 'unclassified']
      : ['lower', 'middle', 'upper'];
  return (
    <table className="lives-table lives-table--shares">
      <caption>
        {decade.classLabel}: share of each group, {decade.label}
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
        {LIVES_LENSES.map((lens) => {
          const definition = buckets
            .map((bucket) => decade.classShares[lens][bucket].definitionLabel)
            .find(Boolean);
          return (
            <tr key={lens} data-emphasis={lens === emphasis ? 'true' : undefined}>
              <th scope="row">
                {LIVES_LENS_LABELS[lens]}
                {lens === emphasis ? <span className="lives-sr-only"> (selected)</span> : null}
                {definition ? <span className="lives-cell__definition">{definition}</span> : null}
              </th>
              {buckets.map((bucket) => (
                <td key={bucket} data-emphasis={bucket === selectedTier ? 'true' : undefined}>
                  <LivesCellValue cell={decade.classShares[lens][bucket]} />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
