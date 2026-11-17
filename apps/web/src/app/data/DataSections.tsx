/**
 * `/data` body: a sticky contents list on desktop beside the figures, grouped under plain section
 * headings: Population, Lives (a door into its own page), Measured gaps (wealth, housing, justice)
 * and How to read.
 *
 * Every figure renders through `DataChartFrame`. This file decides order, pairing and findings; it
 * draws no chart of its own. Two figures that show one series two ways (the ratio and the pair
 * bars, the share spine and the share line) sit side by side so they read as one comparison.
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
import { DisplayNumeral, SectionHeading, buttonClassName, cx } from '@repo/ui';
import { TrustSheet } from '../../components/trust';
import { BandArt, type BandArtMotif } from '../../components/atmosphere/BandArt';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataChartFrame } from '../../components/data/DataChartFrame';
import { DataContents, type ContentsGroup } from '../../components/data/DataContents';
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
import {
  DATA_FIGURE_NAMES,
  DATA_GAP_GROUPS,
  DATA_PAGE_SECTIONS,
  DATA_READING_LINKS,
  DATA_READING_RULES,
  DATA_SECTION_COPY,
  DATA_SOURCE_LIBRARY_HANDOFF,
  type DataPageSectionId,
} from './data-copy';

void React;

export type DataDeltaItem = {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly note?: string;
};

export type DataSectionsProps = {
  readonly timelineRows: readonly NationalPopulationTimelineRow[];
  readonly chartSources: readonly DataSourceRef[];
  readonly deltaItems: readonly DataDeltaItem[];
  readonly stateChanges: readonly StatePopulationChange[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
  readonly indicators: DataPageIndicatorBundle;
  readonly populationAsOf: string;
  readonly indicatorsAsOf: string;
};

/* —— findings: the sentence each figure leads with ———————————————————————————— */

/** 41,341,383 → "41.3". The one rounding for the population in millions, here and in the mast. */
export function millionsFigure(value: number): string {
  return (value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatMillions(value: number): string {
  return `${millionsFigure(value)} million`;
}

function populationReading(rows: readonly NationalPopulationTimelineRow[]): ReactNode {
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return null;
  return (
    <>
      From {first.blackPopulation.toLocaleString('en-US')} Black people in {first.decade} to{' '}
      {formatMillions(last.blackPopulation)} in {last.decade}
    </>
  );
}

function shareExtremes(rows: readonly NationalPopulationTimelineRow[]) {
  const peak = rows.reduce((best, row) =>
    (row.blackShareOfTotalPct ?? 0) > (best.blackShareOfTotalPct ?? 0) ? row : best,
  );
  const trough = rows.reduce((best, row) =>
    (row.blackShareOfTotalPct ?? 100) < (best.blackShareOfTotalPct ?? 100) ? row : best,
  );
  return { peak, trough, last: rows.at(-1)! };
}

function shareReading(rows: readonly NationalPopulationTimelineRow[]): ReactNode {
  if (rows.length === 0) return null;
  const { peak, trough, last } = shareExtremes(rows);
  return (
    <>
      The Black share of the country peaked at{' '}
      {formatSharePct(peak.blackPopulation, peak.totalPopulation)} in {peak.decade}, fell to{' '}
      {formatSharePct(trough.blackPopulation, trough.totalPopulation)} by {trough.decade}, and stood
      at {formatSharePct(last.blackPopulation, last.totalPopulation)} in {last.decade}
    </>
  );
}

/**
 * The census-by-census line's own finding: how many censuses since the low point raised the
 * share. The spine beside it already states the peak, the low and the latest value.
 */
export function shareRiseReading(rows: readonly NationalPopulationTimelineRow[]): ReactNode {
  if (rows.length < 2) return null;
  const { trough } = shareExtremes(rows);
  const since = rows.slice(rows.indexOf(trough));
  const steps = since.length - 1;
  if (steps < 1) return null;
  const share = (row: NationalPopulationTimelineRow) => row.blackPopulation / row.totalPopulation;
  const rises = since.slice(1).filter((row, index) => share(row) > share(since[index]!)).length;
  return rises === steps ? (
    <>The share has risen at every census since {trough.decade}</>
  ) : (
    <>
      The share rose at {rises} of the {steps} censuses since {trough.decade}
    </>
  );
}

/** First census year in a delta label ("Black population, 1990 to 2000" gives 1990). */
function deltaStart(label: string): string | undefined {
  return label.match(/\b(1[789]\d\d|20\d\d)\b/)?.[1];
}

/**
 * The change figure's finding: whether growth slowed or quickened from one census gap to the
 * next. The values themselves are printed in the figure, so the title compares them instead.
 */
export function deltaTrendReading(items: readonly DataDeltaItem[]): ReactNode {
  const values = items.map((item) => Number(item.value.replace(/[^\d.-]/g, '')));
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return null;
  const from = deltaStart(items[0]!.label);
  const slowed = values.every((value, index) => index === 0 || value < values[index - 1]!);
  const quickened = values.every((value, index) => index === 0 || value > values[index - 1]!);
  if (!from || (!slowed && !quickened)) return null;
  return (
    <>
      Growth {slowed ? 'slowed' : 'quickened'} each decade since {from}
    </>
  );
}

/** A two-group trend's finding: whether the distance between them is wider at the end. */
export function gapTrendReading(series: DataPageGroupedBarSeries): ReactNode {
  const first = series.points[0];
  const last = series.points.at(-1);
  const [a, b] = series.series;
  if (!first || !last || first === last || !a || !b) return null;
  const gap = (point: typeof first) => {
    const x = point.values[a.id];
    const y = point.values[b.id];
    return x === undefined || y === undefined ? undefined : Math.abs(x - y);
  };
  const before = gap(first);
  const after = gap(last);
  if (before === undefined || after === undefined || before === after) return null;
  return (
    <>
      The gap has {after > before ? 'widened' : 'narrowed'} in dollars since {first.period}
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
          {gain.blackAbsoluteChange.toLocaleString('en-US')}
        </>
      ) : null}
      {gain && loss ? '; ' : null}
      {loss ? (
        <>
          {name(loss.stateFips)} lost the most,{' '}
          {Math.abs(loss.blackAbsoluteChange).toLocaleString('en-US')}
        </>
      ) : null}
    </>
  );
}

/** The pair bars' finding: both values, in the series' own words. */
function pairReading(series: DataPageRacePairSeries, verb: string): ReactNode {
  return (
    <>
      {series.primary.label} {verb} {formatDataPageValue(series.primary.value, series.primary.unit)}
      ; {series.comparison.label},{' '}
      {formatDataPageValue(series.comparison.value, series.comparison.unit)}
    </>
  );
}

/** The ratio figure's finding: the larger group as a multiple of the smaller. */
function ratioReading(series: DataPageRacePairSeries, measure: string): ReactNode {
  const ratio = series.ratioValue;
  if (ratio === undefined) return null;
  const primaryLarger = series.primary.value >= series.comparison.value;
  const larger = primaryLarger ? series.primary : series.comparison;
  const smaller = primaryLarger ? series.comparison : series.primary;
  return (
    <>
      {larger.label} {measure.replace('{n}', ratio.toLocaleString('en-US'))} {smaller.label}
    </>
  );
}

function groupedReading(series: DataPageGroupedBarSeries): ReactNode {
  const last = series.points.at(-1);
  if (!last) return null;
  const parts = series.series.flatMap((def) => {
    const value = last.values[def.id];
    return value === undefined ? [] : [`${def.label}, ${formatDataPageValue(value, series.unit)}`];
  });
  return (
    <>
      In {last.period}: {parts.join('; ')}
    </>
  );
}

/**
 * A figure's one key number, set as a display numeral above its finding. The finding states the
 * same number in words, so the numeral is drawn, not read twice.
 */
function keyed(value: string | undefined, reading: ReactNode): ReactNode {
  if (value === undefined || reading === null || reading === undefined) return reading;
  return (
    <>
      <DisplayNumeral as="span" size="title" decorative className="ds-datafig__key">
        {value}
      </DisplayNumeral>
      {reading}
    </>
  );
}

function populationKey(rows: readonly NationalPopulationTimelineRow[]): string | undefined {
  const last = rows.at(-1);
  return last
    ? `${(last.blackPopulation / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
    : undefined;
}

function shareKey(rows: readonly NationalPopulationTimelineRow[]): string | undefined {
  if (rows.length === 0) return undefined;
  const { peak } = shareExtremes(rows);
  return formatSharePct(peak.blackPopulation, peak.totalPopulation);
}

function stateGainKey(changes: readonly StatePopulationChange[]): string | undefined {
  const gain = rankStateMovers(changes, 1).gains[0];
  return gain ? `+${gain.blackAbsoluteChange.toLocaleString('en-US')}` : undefined;
}

function pairKey(series: DataPageRacePairSeries): string {
  return formatDataPageValue(series.primary.value, series.primary.unit);
}

/** The latest value of the first series, as the grouped reading prints it. */
function groupedKey(series: DataPageGroupedBarSeries): string | undefined {
  const last = series.points.at(-1);
  const first = series.series[0];
  const value = last && first ? last.values[first.id] : undefined;
  return value === undefined ? undefined : formatDataPageValue(value, series.unit);
}

/* —— layout ——————————————————————————————————————————————————————————————— */

type FigureEntry = { readonly id: string; readonly node: ReactNode };

/**
 * The page changes ground between chapters (never more than about two screens on one plane): the
 * census and the measured gaps are reading sheets, and between them the door into Lives (copper) and the
 * reading rules are full-bleed bands. Inside a sheet a section opens on type and a heavy rule.
 */
const SECTION_BAND: Partial<Record<DataPageSectionId, 'sand' | 'copper'>> = {
  lives: 'copper',
  reading: 'sand',
};

const SECTION_ART: Partial<Record<DataPageSectionId, readonly BandArtMotif[]>> = {
  lives: ['weave', 'grain', 'decades'],
  reading: ['contours', 'grain'],
};

function Section({
  id,
  meta,
  children,
}: {
  readonly id: DataPageSectionId;
  readonly meta?: string;
  readonly children: ReactNode;
}) {
  const copy = DATA_SECTION_COPY[id];
  const band = SECTION_BAND[id];
  const body = (
    <>
      <header className="ds-data-section__head">
        <SectionHeading id={`${id}-heading`}>{copy.title}</SectionHeading>
        <p className="ds-data-section__lede">{copy.lede}</p>
        {meta ? <p className="ds-data-section__meta">{meta}</p> : null}
      </header>
      {children}
    </>
  );
  return band ? (
    <section
      className="ds-data-section ds-data-band"
      id={id}
      aria-labelledby={`${id}-heading`}
      data-ground={band}
    >
      {SECTION_ART[id] ? <BandArt motifs={SECTION_ART[id]} /> : null}
      <div className="ds-wrap ds-data-band__inner">{body}</div>
    </section>
  ) : (
    <section className="ds-data-section" id={id} aria-labelledby={`${id}-heading`}>
      {body}
    </section>
  );
}

function Figures({ entries }: { readonly entries: readonly FigureEntry[] }) {
  return <div className="ds-data-figures">{entries.map((entry) => entry.node)}</div>;
}

function DeltaFigure({
  items,
  sources,
}: {
  readonly items: readonly DataDeltaItem[];
  readonly sources: readonly DataSourceRef[];
}) {
  const latest = items.at(-1)!;
  return (
    <DataChartFrame
      id="population-change"
      title="Change in the Black population between recent censuses"
      span="half"
      reading={
        deltaTrendReading(items) ?? (
          <>
            {latest.label}: {latest.value}
          </>
        )
      }
      caption="Absolute change in the Black population between adjacent censuses, with the change in share of the U.S. total in percentage points. A change that crosses the 2000 definition line is labeled, not smoothed."
      sources={sources}
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
      <ol className="ds-deltas">
        {items.map((item) => (
          <li key={item.id} className="ds-delta">
            <span className="ds-delta__label">{item.label}</span>
            <span className="ds-delta__value">{item.value}</span>
            {item.note ? <p className="ds-delta__note">{item.note}</p> : null}
          </li>
        ))}
      </ol>
    </DataChartFrame>
  );
}

export function DataSections({
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
  const hasRatio = (series: DataPageRacePairSeries) =>
    series.ratioValue !== undefined && series.ratioValue > 0 && isRatioLabel(series.ratioLabel);
  const hasPoints = (
    series: DataPageGroupedBarSeries | undefined,
  ): series is DataPageGroupedBarSeries =>
    series !== undefined && series.points.length > 0 && series.series.length > 0;

  const population: FigureEntry[] = hasPopulation
    ? [
        {
          id: 'population-spine',
          node: (
            <PopulationDecadeSpine
              key="spine"
              id="population-spine"
              rows={timelineRows}
              sources={chartSources}
              reading={keyed(shareKey(timelineRows), shareReading(timelineRows))}
            />
          ),
        },
        {
          id: 'population-share',
          node: (
            <BlackPopulationShareChart
              key="share"
              id="population-share"
              span="half"
              rows={timelineRows}
              sources={chartSources}
              reading={shareRiseReading(timelineRows)}
            />
          ),
        },
        ...(deltaItems.length > 0
          ? [
              {
                id: 'population-change',
                node: <DeltaFigure key="change" items={deltaItems} sources={chartSources} />,
              },
            ]
          : []),
        {
          id: 'population-count',
          node: (
            <PopulationByDecadeChart
              key="count"
              id="population-count"
              rows={timelineRows}
              sources={chartSources}
              reading={keyed(populationKey(timelineRows), populationReading(timelineRows))}
            />
          ),
        },
        ...(stateChanges.length > 0
          ? [
              {
                id: 'population-states',
                node: (
                  <StatePopulationShiftChart
                    key="states"
                    id="population-states"
                    fromDecade="2010"
                    toDecade="2020"
                    changes={stateChanges}
                    stateNameByFips={stateNameByFips}
                    sources={chartSources}
                    reading={keyed(
                      stateGainKey(stateChanges),
                      stateShiftReading(stateChanges, stateNameByFips),
                    )}
                  />
                ),
              },
            ]
          : []),
      ]
    : [];

  const wealth: FigureEntry[] = [
    ...(hasRatio(indicators.wealthComparison)
      ? [
          {
            id: 'wealth-ratio-sight',
            node: (
              <GapMagnitudeSight
                key="wealth-ratio"
                id="wealth-ratio-sight"
                series={indicators.wealthComparison}
                reading={ratioReading(
                  indicators.wealthComparison,
                  'held {n} times the median wealth of',
                )}
              />
            ),
          },
        ]
      : []),
    {
      id: 'wealth-gap',
      node: (
        <RacePairComparisonChart
          key="wealth-gap"
          id="wealth-gap"
          span="half"
          series={indicators.wealthComparison}
          showGap={!hasRatio(indicators.wealthComparison)}
          reading={keyed(
            pairKey(indicators.wealthComparison),
            pairReading(indicators.wealthComparison, 'held a median'),
          )}
        />
      ),
    },
    ...(hasPoints(indicators.wealthTrend)
      ? [
          {
            id: 'wealth-trend',
            node: (
              <GroupedBarIndicatorChart
                key="wealth-trend"
                id="wealth-trend"
                series={indicators.wealthTrend}
                reading={
                  (indicators.wealthTrend.unit === 'usd'
                    ? gapTrendReading(indicators.wealthTrend)
                    : null) ?? groupedReading(indicators.wealthTrend)
                }
              />
            ),
          },
        ]
      : []),
    ...(hasPoints(indicators.wealthRatioLongArc)
      ? [
          {
            id: 'wealth-ratio-long-arc',
            node: (
              <TrendLineChart
                key="wealth-arc"
                id="wealth-ratio-long-arc"
                series={indicators.wealthRatioLongArc}
                reading={keyed(
                  groupedKey(indicators.wealthRatioLongArc),
                  groupedReading(indicators.wealthRatioLongArc),
                )}
              />
            ),
          },
        ]
      : []),
  ];

  const housing: FigureEntry[] = [
    ...(hasPoints(indicators.cookHomeownership)
      ? [
          {
            id: 'housing-ownership',
            node: (
              <GroupedBarIndicatorChart
                key="housing-ownership"
                id="housing-ownership"
                span="half"
                series={indicators.cookHomeownership}
                reading={keyed(
                  groupedKey(indicators.cookHomeownership),
                  groupedReading(indicators.cookHomeownership),
                )}
              />
            ),
          },
        ]
      : []),
    ...(hasPoints(indicators.hmdaDenialRates)
      ? [
          {
            id: 'housing-denials',
            node: (
              <GroupedBarIndicatorChart
                key="housing-denials"
                id="housing-denials"
                span="half"
                series={indicators.hmdaDenialRates}
                reading={keyed(
                  groupedKey(indicators.hmdaDenialRates),
                  groupedReading(indicators.hmdaDenialRates),
                )}
              />
            ),
          },
        ]
      : []),
    ...(hasPoints(indicators.nationalHomeownershipLongArc)
      ? [
          {
            id: 'housing-ownership-long-arc',
            node: (
              <TrendLineChart
                key="housing-arc"
                id="housing-ownership-long-arc"
                series={indicators.nationalHomeownershipLongArc}
                reading={keyed(
                  groupedKey(indicators.nationalHomeownershipLongArc),
                  groupedReading(indicators.nationalHomeownershipLongArc),
                )}
              />
            ),
          },
        ]
      : []),
    {
      id: 'housing-cost-burden',
      node: (
        <RacePairComparisonChart
          key="cost-burden"
          id="housing-cost-burden"
          series={indicators.costBurdenComparison}
          reading={keyed(
            pairKey(indicators.costBurdenComparison),
            pairReading(indicators.costBurdenComparison, 'cost-burdened at'),
          )}
        />
      ),
    },
  ];

  const justice: FigureEntry[] = [
    ...(hasRatio(indicators.imprisonmentComparison)
      ? [
          {
            id: 'justice-ratio-sight',
            node: (
              <GapMagnitudeSight
                key="justice-ratio"
                id="justice-ratio-sight"
                series={indicators.imprisonmentComparison}
                reading={ratioReading(
                  indicators.imprisonmentComparison,
                  'were imprisoned at {n} times the rate of',
                )}
              />
            ),
          },
        ]
      : []),
    {
      id: 'justice-imprisonment',
      node: (
        <RacePairComparisonChart
          key="justice-imprisonment"
          id="justice-imprisonment"
          span="half"
          series={indicators.imprisonmentComparison}
          showGap={!hasRatio(indicators.imprisonmentComparison)}
          reading={keyed(
            pairKey(indicators.imprisonmentComparison),
            pairReading(indicators.imprisonmentComparison, 'imprisoned at'),
          )}
        />
      ),
    },
    ...(hasPoints(indicators.federalDrugSentences)
      ? [
          {
            id: 'justice-sentences',
            node: (
              <GroupedBarIndicatorChart
                key="justice-sentences"
                id="justice-sentences"
                series={indicators.federalDrugSentences}
                reading={keyed(
                  groupedKey(indicators.federalDrugSentences),
                  groupedReading(indicators.federalDrugSentences),
                )}
              />
            ),
          },
        ]
      : []),
  ];

  const gapGroups = { wealth, housing, justice } as const;
  const named = (entries: readonly FigureEntry[]) =>
    entries.map((entry) => ({ id: entry.id, label: DATA_FIGURE_NAMES[entry.id] ?? entry.id }));
  const contents: ContentsGroup[] = DATA_PAGE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    figures:
      section.id === 'counted'
        ? named(population)
        : section.id === 'gaps'
          ? DATA_GAP_GROUPS.map((group) => ({ id: group.id, label: group.label }))
          : [],
  }));

  return (
    <>
      <TrustSheet>
        <div className="ds-data-layout">
          <div className="ds-data-layout__rail">
            <DataContents
              groups={contents}
              notes={[`Census as of ${populationAsOf}`, `Indicators as of ${indicatorsAsOf}`]}
            />
          </div>

          <div className="ds-data-layout__main">
            <Section id="counted" meta={`Census figures as of ${populationAsOf}`}>
              {hasPopulation ? (
                <Figures entries={population} />
              ) : (
                <p className="ds-data-empty">
                  Census population figures are not available in this release. The figures below are
                  unaffected.
                </p>
              )}
            </Section>
          </div>
        </div>
      </TrustSheet>

      <Section id="lives">
        <p className="ds-data-door">
          <Link className="ds-data-door__link" href="/lives">
            Open Lives
          </Link>
          <span className="ds-data-door__line">
            Every decade and region, with the cited tables.
          </span>
        </p>
      </Section>

      <TrustSheet>
        <Section id="gaps" meta={`Indicators as of ${indicatorsAsOf}`}>
          {DATA_GAP_GROUPS.map((group) => (
            <section
              key={group.id}
              id={group.id}
              className="ds-data-group"
              aria-labelledby={`${group.id}-heading`}
            >
              <h3 className="ds-data-group__title" id={`${group.id}-heading`}>
                {group.label}
              </h3>
              <Figures entries={gapGroups[group.id]} />
            </section>
          ))}
        </Section>
      </TrustSheet>

      <Section id="reading">
        <ul className="ds-data-rules">
          {DATA_READING_RULES.map((rule) => (
            <li key={rule.title} className="ds-data-rule">
              <h3 className="ds-data-rule__title">{rule.title}</h3>
              <p className="ds-data-rule__body">{rule.body}</p>
            </li>
          ))}
        </ul>
        <p className={cx('ds-data-reading__links')}>
          <Link className={buttonClassName('secondary')} href={DATA_SOURCE_LIBRARY_HANDOFF.href}>
            {DATA_SOURCE_LIBRARY_HANDOFF.label}
          </Link>
          {DATA_READING_LINKS.map((link) => (
            <Link key={link.href} className={buttonClassName('quiet')} href={link.href}>
              {link.label}
            </Link>
          ))}
        </p>
      </Section>
    </>
  );
}
