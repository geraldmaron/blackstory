/**
 * Data chapter body: Counted → Lived (door into the Lives room) → Measured gaps → How to read.
 *
 * Every figure renders through `DataChartFrame` (DataFigure anatomy). This file decides order,
 * readings, and placement. It draws no chart of its own.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import type {
  NationalPopulationTimelineRow,
  StatePopulationChange,
} from '@repo/domain/statistics/public-data-summaries';
import type {
  DataPageGroupedBarSeries,
  DataPageIndicatorBundle,
  DataPageRacePairSeries,
} from '@repo/domain/statistics/data-page-series';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataChartFrame } from '../../components/data/DataChartFrame';
import { GapMagnitudeSight } from '../../components/data/GapMagnitudeSight';
import { GroupedBarIndicatorChart } from '../../components/data/GroupedBarIndicatorChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import { PopulationDecadeSpine } from '../../components/data/PopulationDecadeSpine';
import {
  isRatioLabel,
  RacePairComparisonChart,
} from '../../components/data/RacePairComparisonChart';
import { StatePopulationShiftChart } from '../../components/data/StatePopulationShiftChart';
import { TrendLineChart } from '../../components/data/TrendLineChart';
import { formatDataPageValue, formatSharePct } from '../../components/data/chart-utils';
import { rankStateMovers } from '../../components/data/population-change';
import type { DataSourceRef } from '../../components/data/SourceFootnote';
import '../../components/data/data-charts.css';
import {
  DATA_PAGE_SECTIONS,
  DATA_READING_LINKS,
  DATA_READING_RULES,
  DATA_SECTION_COPY,
  DATA_SOURCE_LIBRARY_HANDOFF,
  type DataPageSectionId,
} from './data-copy';
import { DataPageNav } from './DataPageNav';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import { RoomStats } from '../../components/room';

void React;

export type DataHeadline = {
  readonly id: string;
  readonly value: string;
  readonly unit?: string;
  readonly label: string;
  readonly source: string;
  readonly href: string;
};

export type DataDeltaItem = {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly note?: string;
};

export type DataSectionsProps = {
  readonly headlines: readonly DataHeadline[];
  readonly timelineRows: readonly NationalPopulationTimelineRow[];
  readonly chartSources: readonly DataSourceRef[];
  readonly deltaItems: readonly DataDeltaItem[];
  readonly stateChanges: readonly StatePopulationChange[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
  readonly indicators: DataPageIndicatorBundle;
  readonly populationAsOf: string;
  readonly indicatorsAsOf: string;
};

function formatMillions(value: number): string {
  return `${(value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million`;
}

function populationReading(rows: readonly NationalPopulationTimelineRow[]): ReactNode {
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return null;
  return (
    <>
      The {first.decade} census counted {first.blackPopulation.toLocaleString('en-US')} Black
      people. The {last.decade} census counted {formatMillions(last.blackPopulation)}, or{' '}
      {formatSharePct(last.blackPopulation, last.totalPopulation)} of the country.
    </>
  );
}

function shareReading(rows: readonly NationalPopulationTimelineRow[]): ReactNode {
  if (rows.length === 0) return null;
  const peak = rows.reduce((best, row) =>
    (row.blackShareOfTotalPct ?? 0) > (best.blackShareOfTotalPct ?? 0) ? row : best,
  );
  const trough = rows.reduce((best, row) =>
    (row.blackShareOfTotalPct ?? 100) < (best.blackShareOfTotalPct ?? 100) ? row : best,
  );
  const last = rows.at(-1)!;
  return (
    <>
      The share peaked at {formatSharePct(peak.blackPopulation, peak.totalPopulation)} in{' '}
      {peak.decade}, fell to {formatSharePct(trough.blackPopulation, trough.totalPopulation)} in{' '}
      {trough.decade}, and stood at {formatSharePct(last.blackPopulation, last.totalPopulation)} in{' '}
      {last.decade}.
    </>
  );
}

function stateShiftReading(
  changes: readonly StatePopulationChange[],
  stateNameByFips: Readonly<Record<string, string>>,
): ReactNode {
  const { gains, losses } = rankStateMovers(changes, 1);
  const gain = gains[0];
  const loss = losses[0];
  if (!gain && !loss) return null;
  const name = (fips: string) => stateNameByFips[fips] ?? `State ${fips}`;
  return (
    <>
      {gain ? (
        <>
          {name(gain.stateFips)} added the most Black residents,{' '}
          {gain.blackAbsoluteChange.toLocaleString('en-US')}.
        </>
      ) : null}
      {gain && loss ? ' ' : null}
      {loss ? (
        <>
          {name(loss.stateFips)} lost the most,{' '}
          {Math.abs(loss.blackAbsoluteChange).toLocaleString('en-US')}.
        </>
      ) : null}
    </>
  );
}

function pairReading(series: DataPageRacePairSeries, verb: string): ReactNode {
  const ratio = series.ratioValue;
  return (
    <>
      {series.primary.label} {verb} {formatDataPageValue(series.primary.value, series.primary.unit)}
      ; {series.comparison.label.charAt(0).toLowerCase() + series.comparison.label.slice(1)},{' '}
      {formatDataPageValue(series.comparison.value, series.comparison.unit)}
      {ratio !== undefined && isRatioLabel(series.ratioLabel) ? (
        <>
          . That is a ratio of {ratio.toLocaleString('en-US')} to 1 in {series.geographyLabel},{' '}
          {series.referencePeriod}.
        </>
      ) : ratio !== undefined ? (
        <>
          , a gap of {ratio.toLocaleString('en-US')} percentage points in {series.geographyLabel},{' '}
          {series.referencePeriod}.
        </>
      ) : (
        <>
          , in {series.geographyLabel}, {series.referencePeriod}.
        </>
      )}
    </>
  );
}

function groupedReading(series: DataPageGroupedBarSeries): ReactNode {
  const last = series.points.at(-1);
  const first = series.points[0];
  if (!last || !first) return null;
  const parts = series.series.map(
    (def) => `${def.label}, ${formatDataPageValue(last.values[def.id] ?? 0, series.unit)}`,
  );
  return (
    <>
      In {last.period}: {parts.join('; ')}. The series runs from {first.period} to {last.period} in{' '}
      {series.geographyLabel}.
    </>
  );
}

function OpeningBeat({ items }: { readonly items: readonly DataHeadline[] }) {
  return (
    <RoomStats
      label="Opening figures"
      stats={items.map((item) => ({
        id: item.id,
        value: item.value,
        unit: item.unit,
        label: item.label,
        source: item.source,
        href: item.href,
      }))}
    />
  );
}

function Section({
  id,
  meta,
  children,
}: {
  readonly id: DataPageSectionId;
  readonly meta: readonly string[];
  readonly children: ReactNode;
}) {
  const copy = DATA_SECTION_COPY[id];
  const sectionMeta = DATA_PAGE_SECTIONS.find((entry) => entry.id === id);
  const headingId = `${id}-heading`;
  return (
    <section className="ds-data-section" id={id} aria-labelledby={headingId}>
      <header className="ds-data-section__head">
        {/* The same chapter head as every other room: a plate, a kicker, a heading. An act on
            /data and a chapter on /methodology are one object, so they read from one rule set. */}
        <div className="ds-room-section__head">
          {sectionMeta ? (
            <span className="ds-room-section__plate" aria-hidden="true">
              <DestinationIcon id={sectionMeta.icon} size="lg" />
            </span>
          ) : null}
          <div className="ds-room-section__titles">
            <p className="ds-room-section__kicker">{copy.kicker}</p>
            <h2 className="ds-room-section__title ds-data-section__title" id={headingId}>
              {copy.title}
            </h2>
          </div>
        </div>
        <p className="ds-data-section__lede">{copy.lede}</p>
        {meta.length > 0 ? (
          <p className="ds-data-section__meta">
            {meta.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function DeltaFigure({
  items,
  sources,
  figureLabel,
}: {
  readonly items: readonly DataDeltaItem[];
  readonly sources: readonly DataSourceRef[];
  readonly figureLabel: string;
}) {
  if (items.length === 0) return null;
  const latest = items.at(-1)!;
  return (
    <DataChartFrame
      id="population-change"
      title="Change by decade, most recent censuses"
      figureLabel={figureLabel}
      span="half"
      reading={
        <>
          {latest.label}: {latest.value}.
        </>
      }
      caption="Absolute change in the Black population between adjacent censuses, with the change in share of the U.S. total in percentage points. A change that crosses the 2000 definition line is labeled, not smoothed."
      sources={sources}
      ariaLabel="Black population change between recent censuses"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Change by decade, most recent censuses</caption>
          <thead>
            <tr>
              <th scope="col">Decades</th>
              <th scope="col">Change</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.label}</th>
                <td>{item.value}</td>
                <td>{item.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ol className="ds-data-deltas" aria-hidden="true">
        {items.map((item) => (
          <li key={item.id} className="ds-data-delta">
            <span className="ds-data-delta__label">{item.label}</span>
            <span className="ds-data-delta__value">{item.value}</span>
            {item.note ? <p className="ds-data-delta__note">{item.note}</p> : null}
          </li>
        ))}
      </ol>
    </DataChartFrame>
  );
}

export function DataSections({
  headlines,
  timelineRows,
  chartSources,
  deltaItems,
  stateChanges,
  stateNameByFips,
  indicators,
  populationAsOf,
  indicatorsAsOf,
}: DataSectionsProps) {
  const hasPopulation = timelineRows.length > 0;
  const indicatorMeta = [`As of ${indicatorsAsOf}`];

  return (
    <>
      <OpeningBeat items={headlines} />
      <DataPageNav sections={DATA_PAGE_SECTIONS} />

      <Section id="counted" meta={[`As of ${populationAsOf}`, '1790 to 2020, every census']}>
        {hasPopulation ? (
          <div className="ds-data-section__figures">
            <PopulationDecadeSpine
              id="population-spine"
              figureLabel="Figure 1"
              rows={timelineRows}
              sources={chartSources}
              reading={shareReading(timelineRows)}
            />
            <PopulationByDecadeChart
              id="population-count"
              figureLabel="Figure 2"
              rows={timelineRows}
              sources={chartSources}
              reading={populationReading(timelineRows)}
            />
            <BlackPopulationShareChart
              id="population-share"
              figureLabel="Figure 3"
              span="half"
              rows={timelineRows}
              sources={chartSources}
              reading={shareReading(timelineRows)}
            />
            <DeltaFigure items={deltaItems} sources={chartSources} figureLabel="Figure 4" />
            {stateChanges.length > 0 ? (
              <StatePopulationShiftChart
                id="population-states"
                figureLabel="Figure 5"
                fromDecade="2010"
                toDecade="2020"
                changes={stateChanges}
                stateNameByFips={stateNameByFips}
                sources={chartSources}
                reading={stateShiftReading(stateChanges, stateNameByFips)}
              />
            ) : null}
          </div>
        ) : (
          <p className="ds-data-empty">
            Census population figures are not available on this release. The acts below are
            unaffected.
          </p>
        )}
      </Section>

      <Section id="lives" meta={['1870s to 2020s']}>
        <p className="ds-data-lives-entry">
          Follow one life question across changing census definitions, rules, and sourced accounts.
          Only evidence-backed comparisons appear in the guided experience.
        </p>
        <p className="ds-data-lives-entry__cta">
          <Link href="/lives">
            <DestinationIcon id="person" className="ds-kicker-glyph" />
            Open Lives
          </Link>
        </p>
      </Section>

      <Section id="gaps" meta={indicatorMeta}>
        <div className="ds-data-section__figures">
          <GapMagnitudeSight
            id="wealth-ratio-sight"
            figureLabel="Figure 6"
            series={indicators.wealthComparison}
            reading={pairReading(indicators.wealthComparison, 'held a median')}
          />
          <RacePairComparisonChart
            id="wealth-gap"
            figureLabel="Figure 7"
            span="half"
            series={indicators.wealthComparison}
            reading={pairReading(indicators.wealthComparison, 'held a median')}
          />
          {indicators.wealthTrend ? (
            <GroupedBarIndicatorChart
              id="wealth-trend"
              figureLabel="Figure 8"
              span="half"
              series={indicators.wealthTrend}
              reading={groupedReading(indicators.wealthTrend)}
            />
          ) : null}
          {indicators.wealthRatioLongArc ? (
            <TrendLineChart
              id="wealth-ratio-long-arc"
              figureLabel="Figure 9"
              series={indicators.wealthRatioLongArc}
              reading={groupedReading(indicators.wealthRatioLongArc)}
            />
          ) : null}
          <GroupedBarIndicatorChart
            id="housing-ownership"
            figureLabel="Figure 10"
            span="half"
            series={indicators.cookHomeownership}
            reading={groupedReading(indicators.cookHomeownership)}
          />
          <GroupedBarIndicatorChart
            id="housing-denials"
            figureLabel="Figure 11"
            span="half"
            series={indicators.hmdaDenialRates}
            reading={groupedReading(indicators.hmdaDenialRates)}
          />
          {indicators.nationalHomeownershipLongArc ? (
            <TrendLineChart
              id="housing-ownership-long-arc"
              figureLabel="Figure 12"
              series={indicators.nationalHomeownershipLongArc}
              reading={groupedReading(indicators.nationalHomeownershipLongArc)}
            />
          ) : null}
          <RacePairComparisonChart
            id="housing-cost-burden"
            figureLabel="Figure 13"
            series={indicators.costBurdenComparison}
            reading={pairReading(indicators.costBurdenComparison, 'cost-burdened at')}
          />
          <GapMagnitudeSight
            id="justice-ratio-sight"
            figureLabel="Figure 14"
            series={indicators.imprisonmentComparison}
            reading={pairReading(indicators.imprisonmentComparison, 'imprisoned at')}
          />
          <RacePairComparisonChart
            id="justice-imprisonment"
            figureLabel="Figure 15"
            span="half"
            series={indicators.imprisonmentComparison}
            reading={pairReading(indicators.imprisonmentComparison, 'imprisoned at')}
          />
          <GroupedBarIndicatorChart
            id="justice-sentences"
            figureLabel="Figure 16"
            span="half"
            series={indicators.federalDrugSentences}
            reading={groupedReading(indicators.federalDrugSentences)}
          />
        </div>
      </Section>

      <Section id="reading" meta={[]}>
        <ul className="ds-data-rules" aria-label="Rules for reading these figures">
          {DATA_READING_RULES.map((rule) => (
            <li key={rule.kicker} className="ds-data-rule">
              <h3 className="ds-data-rule__kicker">
                <DestinationIcon id={rule.icon} className="ds-kicker-glyph" />
                {rule.kicker}
              </h3>
              <p className="ds-data-rule__body">{rule.body}</p>
            </li>
          ))}
        </ul>
        <p className="ds-data-reading__handoff">
          <Link className="ds-cta ds-cta--copper" href={DATA_SOURCE_LIBRARY_HANDOFF.href}>
            <DestinationIcon id="source" />
            {DATA_SOURCE_LIBRARY_HANDOFF.label}
          </Link>
        </p>
        <p className="ds-data-reading__links">
          {DATA_READING_LINKS.map((link, index) => (
            <Link
              key={link.href}
              className={index === 0 ? 'ds-cta ds-cta--copper' : 'ds-cta ds-cta--quiet'}
              href={link.href}
            >
              <DestinationIcon id={link.icon} />
              {link.label}
            </Link>
          ))}
        </p>
      </Section>
    </>
  );
}
