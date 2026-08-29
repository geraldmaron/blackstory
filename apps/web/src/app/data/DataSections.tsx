/**
 * Data page body: chart stack rendered through the v9 room kit.
 *
 * Each chart lives in its own card, and every card carries, in this order: the chart as static
 * SVG, a mono source label, a mono as-of line, a plain-language reading of what the chart does
 * and does not say, and a "Show the numbers" disclosure holding the table. No value is
 * hover-only or colour-only: every series here is readable from the disclosure table alone.
 *
 * The kind composition graph that design-direction-v9-surfaces.md originally sent here from
 * /history does not exist. `HistoryGraphPanel` was already a `@deprecated` pass-through with no
 * graph body, and the document's own correction (repo-92n2.27) records that it was deleted, not
 * moved, because the composition facet it would have shown already lives on /records as a
 * crawlable facet. The composition card below renders the unavailable state design law defines
 * for exactly this case: a source line and a Notice, never a fabricated chart.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import type {
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineRow,
  StatePopulationChange,
} from '@repo/domain/statistics/public-data-summaries';
import type { DataPageIndicatorBundle } from '@repo/domain/statistics/data-page-series';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataStatStrip } from '../../components/data/DataStatStrip';
import { GroupedBarIndicatorChart } from '../../components/data/GroupedBarIndicatorChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import { RacePairComparisonChart } from '../../components/data/RacePairComparisonChart';
import { StatePopulationShift } from '../../components/data/StatePopulationShift';
import { formatDataPageValue } from '../../components/data/chart-utils';
import type { DataSourceRef } from '../../components/data/SourceFootnote';
import { humanSourceLabel } from '../../components/data/SourceFootnote';
import '../../components/data/data-charts.css';
import { DATA_ORIENTATION_BEATS, DATA_PAGE_SECTIONS, DATA_SECTION_COPY } from './data-copy';
import {
  DataTable,
  Disclosure,
  GroupHeading,
  Note,
  Prose,
  UtilityCard,
  type DataTableColumn,
} from '../../components/room';

export type DataStatStripItem = {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly note?: string;
  readonly sources?: readonly DataSourceRef[];
};

export type DataSectionsProps = {
  readonly timelineRows: readonly NationalPopulationTimelineRow[];
  readonly chartSources: readonly DataSourceRef[];
  readonly changeStripItems: readonly DataStatStripItem[];
  readonly stateChanges: readonly StatePopulationChange[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
  readonly historicalStates: HistoricalStatePopulationCoverage | undefined;
  readonly indicators: DataPageIndicatorBundle;
  readonly populationGeneratedAt?: string | undefined;
};

function formatAsOf(value: string | undefined): string {
  if (!value) return 'Release date not recorded for this series';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sourceLabelLine(sources: readonly DataSourceRef[]): string {
  if (sources.length === 0) return 'Source not recorded for this series';
  const labels = sources.map((source) => humanSourceLabel(source.label));
  return Array.from(new Set(labels)).join('; ');
}

type ChartTable = {
  readonly caption: string;
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly Readonly<Record<string, ReactNode>>[];
};

/**
 * Every chart card, in order: chart (static SVG, rendered by the caller), source label, as-of
 * line, a plain-language limits sentence, then "Show the numbers".
 */
function ChartCard({
  id,
  kicker,
  title,
  sourceLabel,
  asOf,
  limits,
  table,
  children,
}: {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly sourceLabel: string;
  readonly asOf: string;
  readonly limits: ReactNode;
  readonly table: ChartTable | null;
  readonly children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <article className="ds-data-edition__panel" aria-labelledby={headingId} id={id}>
      <GroupHeading>
        <span id={headingId}>
          {kicker} · {title}
        </span>
      </GroupHeading>
      <UtilityCard>
        <div className="ds-data-edition__viz">{children}</div>
        <Note kind="SOURCE">{sourceLabel}</Note>
        <Note kind="AS OF">{asOf}</Note>
        <p>{limits}</p>
        <Disclosure summary="Show the numbers">
          {table ? (
            <DataTable caption={table.caption} columns={table.columns} rows={table.rows} />
          ) : (
            <p>
              No numeric series is attached to this card. See the kind facet on{' '}
              <Link href="/records">the record index</Link> for the counted breakdown.
            </p>
          )}
        </Disclosure>
      </UtilityCard>
    </article>
  );
}

function racePairRows(series: {
  readonly primary: {
    readonly label: string;
    readonly value: number;
    readonly unit: 'usd' | 'percent' | 'per_100k' | 'months';
  };
  readonly comparison: {
    readonly label: string;
    readonly value: number;
    readonly unit: 'usd' | 'percent' | 'per_100k' | 'months';
  };
}) {
  return [
    {
      group: series.primary.label,
      value: formatDataPageValue(series.primary.value, series.primary.unit),
    },
    {
      group: series.comparison.label,
      value: formatDataPageValue(series.comparison.value, series.comparison.unit),
    },
  ];
}

function groupedBarRows(series: {
  readonly unit: 'usd' | 'percent' | 'per_100k' | 'months';
  readonly series: readonly { readonly id: string; readonly label: string }[];
  readonly points: readonly {
    readonly period: string;
    readonly values: Readonly<Record<string, number>>;
  }[];
}) {
  return series.points.map((point) => {
    const row: Record<string, ReactNode> = { period: point.period };
    for (const def of series.series) {
      row[def.id] = formatDataPageValue(point.values[def.id] ?? 0, series.unit);
    }
    return row;
  });
}

export function DataSections({
  timelineRows,
  chartSources,
  changeStripItems,
  stateChanges,
  stateNameByFips,
  historicalStates,
  indicators,
  populationGeneratedAt,
}: DataSectionsProps) {
  const servedFromNote =
    indicators.servedFrom === 'fixture'
      ? 'Charts below use published reference figures, and name their sources.'
      : 'Charts below read published series when they are available, and name their sources.';

  return (
    <div className="ds-data-edition__stack">
      <article
        className="ds-data-edition__panel"
        aria-labelledby="orientation-heading"
        id="orientation"
      >
        <GroupHeading>
          <span id="orientation-heading">{DATA_SECTION_COPY.orientation.title}</span>
        </GroupHeading>
        <Prose>
          <p>
            {DATA_SECTION_COPY.orientation.lede} {servedFromNote}
          </p>
        </Prose>
        <ul className="ds-data-edition__beat-grid">
          {DATA_ORIENTATION_BEATS.map((beat) => (
            <li key={beat.kicker} className="ds-data-edition__beat">
              <p className="ds-data-edition__beat-kicker">{beat.kicker}</p>
              <p className="ds-data-edition__beat-body">{beat.body}</p>
            </li>
          ))}
        </ul>
        <nav className="ds-data-edition__nav" aria-labelledby="data-toc-title">
          <p className="ds-data-edition__nav-title" id="data-toc-title">
            On this page
          </p>
          <ul className="ds-data-edition__nav-list">
            {DATA_PAGE_SECTIONS.filter((section) => section.id !== 'orientation').map((section) => (
              <li key={section.id}>
                <a className="ds-data-edition__nav-link" href={`#${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="ds-data-edition__credit">
          Archive texture · symbolic atmosphere.{' '}
          <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
        </p>
      </article>

      <ChartCard
        id="population"
        kicker={DATA_SECTION_COPY.population.kicker}
        title={DATA_SECTION_COPY.population.title}
        sourceLabel={sourceLabelLine(chartSources)}
        asOf={formatAsOf(populationGeneratedAt)}
        limits={
          <>
            This chart shows how many Black Americans the decennial census counted each decade, 1790
            to 2020. Race categories on the census have changed, so a count in 1940 and a count in
            2020 are not the same measurement. The chart marks the 2000 boundary rather than
            smoothing across it, and it does not say why a state&apos;s count moved: that argument
            needs records, not a count.
          </>
        }
        table={
          timelineRows.length > 0
            ? {
                caption: 'Black population by decade, 1790 to 2020',
                columns: [
                  { key: 'decade', label: 'Decade' },
                  { key: 'black', label: 'Black population', numeric: true },
                  { key: 'total', label: 'Total population', numeric: true },
                  { key: 'share', label: 'Share', numeric: true },
                ],
                rows: timelineRows.map((row) => ({
                  decade: `${row.decade}${row.southernUndercountCaveat ? ' (undercount noted)' : ''}`,
                  black: row.blackPopulation.toLocaleString('en-US'),
                  total: row.totalPopulation.toLocaleString('en-US'),
                  share:
                    row.totalPopulation > 0
                      ? `${((row.blackPopulation / row.totalPopulation) * 100).toFixed(1)}%`
                      : '—',
                })),
              }
            : null
        }
      >
        {timelineRows.length > 0 ? (
          <>
            <PopulationByDecadeChart rows={timelineRows} sources={chartSources} />
            <BlackPopulationShareChart rows={timelineRows} sources={chartSources} />
            {changeStripItems.length > 0 ? (
              <DataStatStrip labelledBy="population-heading" items={changeStripItems} />
            ) : null}
            {stateChanges.length > 0 ? (
              <StatePopulationShift
                fromDecade="2010"
                toDecade="2020"
                changes={stateChanges}
                stateNameByFips={stateNameByFips}
                labelledBy="population-heading"
              />
            ) : null}
            {historicalStates ? (
              <DataStatStrip
                labelledBy="population-heading"
                sources={[
                  {
                    label: 'U.S. Census Bureau, Working Paper 56 (state tables 15 to 65)',
                    url: historicalStates.sourceUrl,
                  },
                ]}
                items={[
                  {
                    id: 'hist-state-rows',
                    value: historicalStates.rowCount.toLocaleString('en-US'),
                    label: 'State-by-decade records',
                    note: `${historicalStates.decadeMin} to ${historicalStates.decadeMax}`,
                  },
                  {
                    id: 'hist-state-count',
                    value: historicalStates.stateCount.toLocaleString('en-US'),
                    label: 'States and D.C. included',
                    note: 'Not every state appears in every decade',
                  },
                ]}
              />
            ) : null}
          </>
        ) : (
          <p className="ds-data-edition__empty">
            Census population figures are not available on this release. The place is the door
            back.
          </p>
        )}
      </ChartCard>

      <ChartCard
        id="wealth"
        kicker={DATA_SECTION_COPY.wealth.kicker}
        title={DATA_SECTION_COPY.wealth.title}
        sourceLabel={sourceLabelLine(indicators.wealthComparison.sources)}
        asOf={formatAsOf(indicators.generatedAt)}
        limits={
          <>
            Median family net worth from the Federal Reserve&apos;s triennial survey: a national
            juxtaposition, not a place-specific measurement. It names a gap; it does not name a
            cause. Reading a cause needs the statutes, deeds and underwriting records the archive
            holds elsewhere.
          </>
        }
        table={{
          caption: indicators.wealthComparison.title,
          columns: [
            { key: 'group', label: 'Group' },
            { key: 'value', label: 'Value', numeric: true },
          ],
          rows: racePairRows(indicators.wealthComparison),
        }}
      >
        <RacePairComparisonChart series={indicators.wealthComparison} />
        {indicators.wealthTrend ? (
          <GroupedBarIndicatorChart series={indicators.wealthTrend} />
        ) : null}
      </ChartCard>

      <ChartCard
        id="housing"
        kicker={DATA_SECTION_COPY.housing.kicker}
        title={DATA_SECTION_COPY.housing.title}
        sourceLabel={sourceLabelLine([
          ...indicators.cookHomeownership.sources,
          ...indicators.hmdaDenialRates.sources,
          ...indicators.costBurdenComparison.sources,
        ])}
        asOf={formatAsOf(indicators.generatedAt)}
        limits={
          <>
            Cook County is the first county spine: decennial homeownership, mortgage denial rates
            and HUD cost burden. These are published rates for the censuses and years shown, with
            nothing interpolated between them. A rate is only as good as the survey behind it; it
            does not trace an individual household&apos;s path.
          </>
        }
        table={{
          caption: indicators.cookHomeownership.title,
          columns: [
            { key: 'period', label: 'Period' },
            ...indicators.cookHomeownership.series.map((def) => ({
              key: def.id,
              label: def.label,
              numeric: true,
            })),
          ],
          rows: groupedBarRows(indicators.cookHomeownership),
        }}
      >
        <GroupedBarIndicatorChart series={indicators.cookHomeownership} />
        <GroupedBarIndicatorChart series={indicators.hmdaDenialRates} />
        <RacePairComparisonChart series={indicators.costBurdenComparison} />
      </ChartCard>

      <ChartCard
        id="justice"
        kicker={DATA_SECTION_COPY.justice.kicker}
        title={DATA_SECTION_COPY.justice.title}
        sourceLabel={sourceLabelLine([
          ...indicators.imprisonmentComparison.sources,
          ...indicators.federalDrugSentences.sources,
        ])}
        asOf={formatAsOf(indicators.generatedAt)}
        limits={
          <>
            State imprisonment rates and federal cocaine sentencing averages give context for
            drug-policy eras. They are not proof that any single law caused a number: that argument
            has to be made with the statute text and the record it produced.
          </>
        }
        table={{
          caption: indicators.imprisonmentComparison.title,
          columns: [
            { key: 'group', label: 'Group' },
            { key: 'value', label: 'Value', numeric: true },
          ],
          rows: racePairRows(indicators.imprisonmentComparison),
        }}
      >
        <RacePairComparisonChart series={indicators.imprisonmentComparison} />
        <GroupedBarIndicatorChart series={indicators.federalDrugSentences} />
      </ChartCard>

      <article className="ds-data-edition__panel" aria-labelledby="themes-heading" id="themes">
        <GroupHeading>
          <span id="themes-heading">{DATA_SECTION_COPY.themes.title}</span>
        </GroupHeading>
        <Prose>
          <p>{DATA_SECTION_COPY.themes.lede}</p>
        </Prose>
      </article>

      <article className="ds-data-edition__panel" aria-labelledby="next-heading" id="next">
        <GroupHeading>
          <span id="next-heading">{DATA_SECTION_COPY.next.title}</span>
        </GroupHeading>
        <Prose>
          <p>{DATA_SECTION_COPY.next.lede}</p>
        </Prose>
      </article>
    </div>
  );
}
