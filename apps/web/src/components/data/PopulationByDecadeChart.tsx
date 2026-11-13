/**
 * The Black population at every census, 1790 to 2020.
 *
 * For 1790 to 1860 each column is two parts that add up to the Black total: enslaved (solid, the
 * lower part) and free (hatched, on top). From 1870 the census gives one Black total, drawn in ink,
 * so no enslaved fill continues past emancipation. The span from 2000 is labeled as measured
 * differently ("Black alone"), and 1870 carries its documented Southern undercount on the chart.
 * The two early parts are too thin to label on the columns, so they are keyed beside the unit.
 */
import React, { type ReactNode } from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import {
  Band,
  Bar,
  Mark,
  Plot,
  PointLabel,
  Rule,
  Tip,
  bandLayout,
  categoryTicks,
  compactNumber,
  valueScale,
  type TipRow,
} from './chart-kit';
import { formatChartCount, formatSharePct } from './chart-utils';

void React;

export type PopulationByDecadeChartProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
  readonly reading?: ReactNode;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

export function PopulationByDecadeChart({
  rows,
  sources,
  reading,
  span,
  id,
}: PopulationByDecadeChartProps) {
  if (rows.length === 0) return null;

  const { top, ticks } = valueScale(
    Math.max(...rows.map((row) => row.blackPopulation)),
    compactNumber,
  );
  const { center, width } = bandLayout(rows.length);
  const y = (value: number) => (value / top) * 100;
  const boundary = rows.findIndex((row) => row.opensDefinitionBoundary);
  const lastSplit = rows.reduce(
    (found, row, index) => (row.enslavedBlackPopulation !== null ? index : found),
    -1,
  );
  const undercount = rows.findIndex((row) => row.southernUndercountCaveat);
  const last = rows.length - 1;

  return (
    <DataChartFrame
      title="Black population at each census, 1790 to 2020"
      {...(reading !== undefined ? { reading } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={
        'Enslaved and free counts are stacked for 1790 to 1860; together they are the Black ' +
        'total. From 1870 the census gives one Black total. From 2000 the count is “Black alone,” ' +
        'when people could mark more than one race, so counts before and after are not a perfect ' +
        'match. The 1870 count is a known Southern undercount.'
      }
      sources={sources}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Black population by decade, 1790 to 2020</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Black population</th>
              <th scope="col">Free</th>
              <th scope="col">Enslaved</th>
              <th scope="col">Total population</th>
              <th scope="col">Share</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">
                  {row.decade}
                  {row.southernUndercountCaveat ? ' (undercount)' : ''}
                </th>
                <td>{formatChartCount(row.blackPopulation)}</td>
                <td>
                  {row.freeBlackPopulation === null
                    ? 'N/A'
                    : formatChartCount(row.freeBlackPopulation)}
                </td>
                <td>
                  {row.enslavedBlackPopulation === null
                    ? 'N/A'
                    : formatChartCount(row.enslavedBlackPopulation)}
                </td>
                <td>{formatChartCount(row.totalPopulation)}</td>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
                <td>{row.raceCategoryLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <Plot
        label="Black population at each census"
        unit="Black population, people"
        size="lg"
        yWidth="2.75rem"
        {...(lastSplit > -1
          ? {
              keys: [
                { label: `Enslaved, to ${rows[lastSplit]!.decade}`, tone: 'mid' as const },
                { label: 'Free', tone: 'lo' as const, hatched: true },
              ],
            }
          : {})}
        yTicks={ticks}
        xTicks={categoryTicks(
          rows.map((row) => row.decade),
          center,
          3,
        )}
      >
        {boundary > 0 ? (
          <Band
            from={center(boundary) - width / 2}
            to={100}
            kind="break"
            label="“Black alone” from 2000"
          />
        ) : null}
        {undercount > -1 ? (
          <Rule at={center(undercount)} label={`${rows[undercount]!.decade} undercount`} />
        ) : null}
        {rows.map((row, index) => {
          const split = row.enslavedBlackPopulation !== null && row.freeBlackPopulation !== null;
          const tipRows: TipRow[] = split
            ? [
                {
                  value: formatChartCount(row.blackPopulation),
                  label: 'Black, total',
                  tone: 'none',
                },
                {
                  value: formatChartCount(row.enslavedBlackPopulation!),
                  label: 'enslaved',
                  tone: 'mid',
                },
                { value: formatChartCount(row.freeBlackPopulation!), label: 'free', tone: 'lo' },
              ]
            : [
                {
                  value: formatChartCount(row.blackPopulation),
                  label: `Black, ${formatSharePct(row.blackPopulation, row.totalPopulation)} of all`,
                  tone: 'hi',
                },
              ];
          return (
            <Mark
              key={row.decade}
              x={center(index)}
              width={width}
              first={index === 0}
              tipY={y(row.blackPopulation)}
              ariaLabel={`${row.decade}: ${tipRows.map((tip) => `${tip.label} ${tip.value}`).join(', ')}${row.southernUndercountCaveat ? ', a known undercount' : ''}`}
              tip={<Tip title={`${row.decade} census`} rows={tipRows} />}
            >
              {split ? (
                <>
                  <Bar height={y(row.enslavedBlackPopulation!)} tone="mid" />
                  <Bar
                    offset={y(row.enslavedBlackPopulation!)}
                    height={y(row.freeBlackPopulation!)}
                    tone="lo"
                    hatched
                  />
                </>
              ) : (
                <Bar height={y(row.blackPopulation)} tone="hi" />
              )}
            </Mark>
          );
        })}
        <PointLabel x={center(last)} y={y(rows[last]!.blackPopulation)} strong>
          {compactNumber(rows[last]!.blackPopulation)}
        </PointLabel>
      </Plot>
    </DataChartFrame>
  );
}
