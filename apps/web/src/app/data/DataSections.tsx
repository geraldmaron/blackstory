/**
 * `/data` body: the headline band, the section rail, four sections of figures, and the reading
 * rules.
 *
 * Every figure renders through `DataChartFrame`, which is the Data Figure anatomy: label, title,
 * reading, graphic, caption, source, numbers. This file decides which figures a section holds,
 * writes each figure's reading sentence from the data it was given, and places the figures in a
 * one- or two-column grid. It draws no chart of its own.
 *
 * The section carries the as-of date once, in its head. The figure carries the source, because
 * two figures in one section can come from two agencies and a source line that names both under
 * each is a source line that names neither.
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
import { GroupedBarIndicatorChart } from '../../components/data/GroupedBarIndicatorChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import {
  isRatioLabel,
  RacePairComparisonChart,
} from '../../components/data/RacePairComparisonChart';
import { StatePopulationShiftChart } from '../../components/data/StatePopulationShiftChart';
import { formatDataPageValue, formatSharePct } from '../../components/data/chart-utils';
import { rankStateMovers } from '../../components/data/population-change';
import type { DataSourceRef } from '../../components/data/SourceFootnote';
import '../../components/data/data-charts.css';
import {
  DATA_PAGE_SECTIONS,
  DATA_READING_LINKS,
  DATA_READING_RULES,
  DATA_SECTION_COPY,
  type DataPageSectionId,
} from './data-copy';
import { DataPageNav } from './DataPageNav';

void React;

export type DataHeadline = {
  readonly id: string;
  /** The number, already formatted. */
  readonly value: string;
  /** A short unit or qualifier printed small beside the value: "%", "×", "million". */
  readonly unit?: string;
  readonly label: string;
  readonly source: string;
  /** Anchor of the figure or section that carries this number. */
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

/* —— readings: one sentence per figure, written from the data ————————————— */

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

/* —— blocks ————————————————————————————————————————————————————————————————— */

function Headlines({ items }: { readonly items: readonly DataHeadline[] }) {
  if (items.length === 0) return null;
  return (
    <ol className="ds-data-headlines" aria-label="Headline figures">
      {items.map((item) => (
        <li key={item.id}>
          <a className="ds-data-headline" href={item.href}>
            <span className="ds-data-headline__value">
              {item.value}
              {item.unit ? <span className="ds-data-headline__unit">{item.unit}</span> : null}
            </span>
            <span className="ds-data-headline__label">{item.label}</span>
            <span className="ds-data-headline__source">{item.source}</span>
          </a>
        </li>
      ))}
    </ol>
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
  const headingId = `${id}-heading`;
  return (
    <section className="ds-data-section" id={id} aria-labelledby={headingId}>
      <header className="ds-data-section__head">
        <p className="ds-data-section__kicker">{copy.kicker}</p>
        <h2 className="ds-data-section__title" id={headingId}>
          {copy.title}
        </h2>
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

/** The change ledger: recent decade deltas as a figure body, so it carries the same anatomy. */
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

/* —— the page body —————————————————————————————————————————————————————————— */

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
      <Headlines items={headlines} />
      <DataPageNav sections={DATA_PAGE_SECTIONS} />

      <Section id="population" meta={[`As of ${populationAsOf}`, '1790 to 2020, every census']}>
        {hasPopulation ? (
          <div className="ds-data-section__figures">
            <PopulationByDecadeChart
              id="population-count"
              figureLabel="Figure 1"
              rows={timelineRows}
              sources={chartSources}
              reading={populationReading(timelineRows)}
            />
            <BlackPopulationShareChart
              id="population-share"
              figureLabel="Figure 2"
              span="half"
              rows={timelineRows}
              sources={chartSources}
              reading={shareReading(timelineRows)}
            />
            <DeltaFigure items={deltaItems} sources={chartSources} figureLabel="Figure 3" />
            {stateChanges.length > 0 ? (
              <StatePopulationShiftChart
                id="population-states"
                figureLabel="Figure 4"
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
            Census population figures are not available on this release. The indicator sections
            below are unaffected.
          </p>
        )}
      </Section>

      <Section id="wealth" meta={indicatorMeta}>
        <div className="ds-data-section__figures">
          <RacePairComparisonChart
            id="wealth-gap"
            figureLabel="Figure 5"
            span="half"
            series={indicators.wealthComparison}
            reading={pairReading(indicators.wealthComparison, 'held a median')}
          />
          {indicators.wealthTrend ? (
            <GroupedBarIndicatorChart
              id="wealth-trend"
              figureLabel="Figure 6"
              span="half"
              series={indicators.wealthTrend}
              reading={groupedReading(indicators.wealthTrend)}
            />
          ) : null}
        </div>
      </Section>

      <Section id="housing" meta={indicatorMeta}>
        <div className="ds-data-section__figures">
          <GroupedBarIndicatorChart
            id="housing-ownership"
            figureLabel="Figure 7"
            span="half"
            series={indicators.cookHomeownership}
            reading={groupedReading(indicators.cookHomeownership)}
          />
          <GroupedBarIndicatorChart
            id="housing-denials"
            figureLabel="Figure 8"
            span="half"
            series={indicators.hmdaDenialRates}
            reading={groupedReading(indicators.hmdaDenialRates)}
          />
          <RacePairComparisonChart
            id="housing-cost-burden"
            figureLabel="Figure 9"
            series={indicators.costBurdenComparison}
            reading={pairReading(indicators.costBurdenComparison, 'cost-burdened at')}
          />
        </div>
      </Section>

      <Section id="justice" meta={indicatorMeta}>
        <div className="ds-data-section__figures">
          <RacePairComparisonChart
            id="justice-imprisonment"
            figureLabel="Figure 10"
            span="half"
            series={indicators.imprisonmentComparison}
            reading={pairReading(indicators.imprisonmentComparison, 'imprisoned at')}
          />
          <GroupedBarIndicatorChart
            id="justice-sentences"
            figureLabel="Figure 11"
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
              <h3 className="ds-data-rule__kicker">{rule.kicker}</h3>
              <p className="ds-data-rule__body">{rule.body}</p>
            </li>
          ))}
        </ul>
        <p className="ds-data-reading__links">
          {DATA_READING_LINKS.map((link, index) => (
            <Link
              key={link.href}
              className={index === 0 ? 'ds-cta ds-cta--copper' : 'ds-cta ds-cta--quiet'}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </p>
      </Section>
    </>
  );
}
