/**
 * The decade spine: Black share of the U.S. population as one slim strip across every census,
 * with the peak, the low point and the latest value labeled on the line. It opens the census
 * figures; the detailed share chart with its full axis sits directly beside it.
 */
import React, { type ReactNode } from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { ShareLine } from './BlackPopulationShareChart';
import { DataChartFrame } from './DataChartFrame';
import { formatSharePct } from './chart-utils';

void React;

export type PopulationDecadeSpineProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
  readonly reading?: ReactNode;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

export function PopulationDecadeSpine({
  rows,
  sources,
  reading,
  span,
  id,
}: PopulationDecadeSpineProps) {
  if (rows.length < 2) return null;

  return (
    <DataChartFrame
      title="Black share of the U.S. population at each census, 1790 to 2020"
      {...(reading !== undefined ? { reading } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={
        'Black share of the U.S. total at each census. The shaded span marks the 2000 switch to ' +
        '“Black alone” when people could mark more than one race, and the line breaks there.'
      }
      sources={sources}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Black share of U.S. population by decade</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">{row.decade}</th>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ShareLine rows={rows} size="sm" annotateExtremes />
    </DataChartFrame>
  );
}
