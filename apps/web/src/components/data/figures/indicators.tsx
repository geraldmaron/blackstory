/**
 * The measured-gap figures, `D-06` to `D-16`: wealth, housing and justice as each agency published
 * them. All read the one indicator bundle. A series' own caption is its limits, printed verbatim.
 */
import React, { cache } from 'react';
import type {
  DataPageGroupedBarPoint,
  DataPageGroupedBarSeries,
  DataPageIndicatorBundle,
  DataPageRacePairSeries,
} from '@repo/domain/statistics/data-page-series';
import { getDataPageIndicatorBuild } from '../../../lib/demographics/data-page-indicators';
import { chapterHrefForTheme, formatDataPageValue } from '../chart-utils';
import { GapMagnitudeSight, hasRatio } from '../GapMagnitudeSight';
import { GroupedBarIndicatorChart } from '../GroupedBarIndicatorChart';
import { RacePairComparisonChart } from '../RacePairComparisonChart';
import { seriesSubtitle } from '../series-format';
import { TrendLineChart } from '../TrendLineChart';
import { coverageFromGeography } from './figure-coverage';
import { defineFigure, type FigureRows } from './figure-spec';
import { FoldedBarPortrait } from './portraits';

void React;

const loadIndicators = cache(async () => {
  try {
    return await getDataPageIndicatorBuild();
  } catch {
    return undefined;
  }
});

/* —— two groups, one measure, one place and period ——————————————————————————— */

type PairRow = { readonly label: string; readonly text: string; readonly raw: number };
type PairData = FigureRows<PairRow, DataPageRacePairSeries>;

const pairPoint = (point: DataPageRacePairSeries['primary']): PairRow => ({
  label: point.label,
  text: formatDataPageValue(point.value, point.unit),
  raw: point.value,
});

/** A pair series as a figure's rows. `ratio` is the unit drawing: nothing when no multiple is stated. */
export function pairData(
  series: DataPageRacePairSeries,
  kind: 'pair' | 'ratio',
  revised?: string,
  built?: string,
): PairData | undefined {
  if (
    kind === 'ratio'
      ? !hasRatio(series)
      : Math.max(series.primary.value, series.comparison.value) <= 0
  ) {
    return undefined;
  }
  const ratio = series.ratioValue;
  return {
    rows: [
      pairPoint(series.primary),
      pairPoint(series.comparison),
      ...(series.ratioLabel && ratio !== undefined
        ? [
            kind === 'ratio'
              ? { label: 'Ratio', text: `${ratio.toLocaleString('en-US')} to 1`, raw: ratio }
              : { label: series.ratioLabel, text: ratio.toLocaleString('en-US'), raw: ratio },
          ]
        : []),
    ],
    sources: series.sources,
    ...(revised === undefined ? {} : { revised }),
    ...(built === undefined ? {} : { built }),
    extra: series,
  };
}

async function pairRows(
  pick: (bundle: DataPageIndicatorBundle) => DataPageRacePairSeries,
  kind: 'pair' | 'ratio',
): Promise<PairData | undefined> {
  const loaded = await loadIndicators();
  return loaded
    ? pairData(pick(loaded.bundle), kind, loaded.bundle.generatedAt, loaded.builtAt)
    : undefined;
}

const PAIR_COLUMNS = [
  { label: 'Group', cell: (row: PairRow) => row.label },
  { label: 'Value', cell: (row: PairRow) => row.text, csv: (row: PairRow) => row.raw },
] as const;

const chapterOf = (data: { readonly extra: { readonly themeId?: string } }) =>
  chapterHrefForTheme(data.extra.themeId);

/** A series says where it was measured; the figure's coverage is read from that, never assumed. */
const placed = {
  coverage: (data: { readonly extra: { readonly geographyLabel: string } }) =>
    coverageFromGeography(data.extra.geographyLabel),
  themeId: (data: { readonly extra: { readonly themeId?: string } }) => data.extra.themeId,
};

/** The pair bars: both values, in the series' own words. */
function pairFigure(spec: {
  readonly id: string;
  readonly name: string;
  readonly pick: (bundle: DataPageIndicatorBundle) => DataPageRacePairSeries;
  /** "held a median" in "Black families held a median $44,900". */
  readonly verb: string;
}) {
  return defineFigure<PairRow, DataPageRacePairSeries>({
    id: spec.id,
    name: spec.name,
    title: ({ extra }) => `${extra.title} · ${extra.geographyLabel}, ${extra.referencePeriod}`,
    basis: ({ extra }) => extra.referencePeriod,
    limits: ({ extra }) => extra.caption,
    ...placed,
    loadRows: () => pairRows(spec.pick, 'pair'),
    headline: ({ extra }) =>
      `${extra.primary.label} ${spec.verb} ${formatDataPageValue(extra.primary.value, extra.primary.unit)}; ${extra.comparison.label}, ${formatDataPageValue(extra.comparison.value, extra.comparison.unit)}`,
    chapterHref: chapterOf,
    columns: PAIR_COLUMNS,
    // A ratio figure beside this one already states the gap, so it is said once.
    plain: ({ extra }) => <RacePairComparisonChart series={extra} showGap={!hasRatio(extra)} />,
  });
}

/** The ratio, made countable: the larger group as a multiple of the smaller. */
function ratioFigure(spec: {
  readonly id: string;
  readonly name: string;
  readonly pick: (bundle: DataPageIndicatorBundle) => DataPageRacePairSeries;
  /** "held {n} times the median wealth of", between the two group names. */
  readonly measure: string;
}) {
  return defineFigure<PairRow, DataPageRacePairSeries>({
    id: spec.id,
    name: spec.name,
    title: ({ extra }) =>
      `${extra.ratioLabel ?? extra.title} · ${extra.geographyLabel}, ${extra.referencePeriod}`,
    basis: ({ extra }) => extra.referencePeriod,
    limits: ({ extra }) => extra.caption,
    // No coverage: the ratio restates its pair figure, and a record embeds the pair, which prints
    // both values.
    themeId: placed.themeId,
    loadRows: () => pairRows(spec.pick, 'ratio'),
    headline: ({ extra }) => {
      const primaryLarger = extra.primary.value >= extra.comparison.value;
      const larger = primaryLarger ? extra.primary : extra.comparison;
      const smaller = primaryLarger ? extra.comparison : extra.primary;
      return `${larger.label} ${spec.measure.replace('{n}', (extra.ratioValue ?? 0).toLocaleString('en-US'))} ${smaller.label}`;
    },
    chapterHref: chapterOf,
    columns: PAIR_COLUMNS,
    plain: ({ extra }) => <GapMagnitudeSight series={extra} />,
  });
}

/* —— groups across periods ——————————————————————————————————————————————————— */

type SeriesData = FigureRows<DataPageGroupedBarPoint, DataPageGroupedBarSeries>;

/** A grouped series as a figure's rows: one row a period. */
export function seriesData(
  series: DataPageGroupedBarSeries | undefined,
  revised?: string,
  built?: string,
): SeriesData | undefined {
  if (!series || series.series.length === 0) return undefined;
  return {
    rows: series.points,
    sources: series.sources,
    ...(revised === undefined ? {} : { revised }),
    ...(built === undefined ? {} : { built }),
    extra: series,
  };
}

async function seriesRows(
  pick: (bundle: DataPageIndicatorBundle) => DataPageGroupedBarSeries | undefined,
): Promise<SeriesData | undefined> {
  const loaded = await loadIndicators();
  return loaded
    ? seriesData(pick(loaded.bundle), loaded.bundle.generatedAt, loaded.builtAt)
    : undefined;
}

/** The latest period, every group: "In 2022: Black families, $44,900; White families, $285,000". */
function latestReading({ rows, extra }: SeriesData): string {
  const last = rows.at(-1)!;
  const parts = extra.series.flatMap((def) => {
    const value = last.values[def.id];
    return value === undefined ? [] : [`${def.label}, ${formatDataPageValue(value, extra.unit)}`];
  });
  return `In ${last.period}: ${parts.join('; ')}`;
}

/** A two-group dollar trend's finding: whether the distance between them is wider at the end. */
export function gapTrendReading({ rows, extra }: SeriesData): string | undefined {
  const first = rows[0];
  const last = rows.at(-1);
  const [a, b] = extra.series;
  if (extra.unit !== 'usd' || !first || !last || first === last || !a || !b) return undefined;
  const gap = (point: DataPageGroupedBarPoint) => {
    const x = point.values[a.id];
    const y = point.values[b.id];
    return x === undefined || y === undefined ? undefined : Math.abs(x - y);
  };
  const before = gap(first);
  const after = gap(last);
  if (before === undefined || after === undefined || before === after) return undefined;
  return `The gap has ${after > before ? 'widened' : 'narrowed'} in dollars since ${first.period}`;
}

function seriesFigure(spec: {
  readonly id: string;
  readonly name: string;
  readonly pick: (bundle: DataPageIndicatorBundle) => DataPageGroupedBarSeries | undefined;
  readonly form: 'bars' | 'lines';
  readonly size?: 'md' | 'lg';
  readonly headline?: (data: SeriesData) => string | undefined;
  readonly portrait?: (data: SeriesData) => React.ReactNode;
}) {
  const Chart = spec.form === 'bars' ? GroupedBarIndicatorChart : TrendLineChart;
  return defineFigure<DataPageGroupedBarPoint, DataPageGroupedBarSeries>({
    id: spec.id,
    name: spec.name,
    title: ({ extra }) => seriesSubtitle(extra),
    basis: ({ rows }) => `${rows[0]!.period} to ${rows.at(-1)!.period}`,
    limits: ({ extra }) => extra.caption,
    ...placed,
    loadRows: () => seriesRows(spec.pick),
    headline: (data) => spec.headline?.(data) ?? latestReading(data),
    chapterHref: chapterOf,
    columns: ({ extra }) => [
      { label: 'Period', cell: (row) => row.period },
      ...extra.series.map((def) => ({
        label: def.label,
        cell: (row: DataPageGroupedBarPoint) => {
          const value = row.values[def.id];
          return value === undefined ? 'no data' : formatDataPageValue(value, extra.unit);
        },
        csv: (row: DataPageGroupedBarPoint) => row.values[def.id] ?? 'no data',
      })),
    ],
    plain: ({ extra }) => <Chart series={extra} size={spec.size ?? 'lg'} />,
    ...(spec.portrait ? { portrait: spec.portrait } : {}),
  });
}

/* —— the figures ————————————————————————————————————————————————————————————— */

export const D06 = ratioFigure({
  id: 'D-06',
  name: 'Wealth ratio',
  pick: (bundle) => bundle.wealthComparison,
  measure: 'held {n} times the median wealth of',
});

export const D07 = pairFigure({
  id: 'D-07',
  name: 'Median net worth',
  pick: (bundle) => bundle.wealthComparison,
  verb: 'held a median',
});

export const D08 = seriesFigure({
  id: 'D-08',
  name: 'Net worth since 1989',
  pick: (bundle) => bundle.wealthTrend,
  form: 'bars',
  headline: gapTrendReading,
});

/**
 * The one series here with an outlier a common axis cannot hold: 1860 is several times every later
 * year. The Portrait is the folded bar, one bar a year with its value printed, the long bar turning
 * back on itself at full length. It is built only for a single-series ratio.
 */
export const D09 = seriesFigure({
  id: 'D-09',
  name: 'Wealth ratio since 1860',
  pick: (bundle) => bundle.wealthRatioLongArc,
  form: 'lines',
  portrait: ({ rows, extra }) => {
    const def = extra.series[0];
    if (!def || extra.series.length !== 1) return undefined;
    return (
      <FoldedBarPortrait
        label={`One bar for each year measured from ${rows[0]!.period} to ${rows.at(-1)!.period}. Its length is the ${def.label} that year. Every value is in Numbers.`}
        items={rows.map((row) => {
          const value = row.values[def.id];
          return {
            key: row.period,
            value: value ?? null,
            text: value === undefined ? 'no data' : formatDataPageValue(value, extra.unit),
          };
        })}
      >
        <p>
          One bar for each year measured, read from the top. Its length is the ratio that year. A
          bar too long for the page turns back on itself and keeps its full length.
        </p>
        <p>The years are not evenly spaced. Each bar names its own.</p>
      </FoldedBarPortrait>
    );
  },
});

export const D10 = seriesFigure({
  id: 'D-10',
  name: 'Cook County homeownership',
  pick: (bundle) => bundle.cookHomeownership,
  form: 'bars',
  size: 'md',
});

export const D11 = seriesFigure({
  id: 'D-11',
  name: 'Mortgage denials',
  pick: (bundle) => bundle.hmdaDenialRates,
  form: 'bars',
  size: 'md',
});

export const D12 = seriesFigure({
  id: 'D-12',
  name: 'Homeownership since 1900',
  pick: (bundle) => bundle.nationalHomeownershipLongArc,
  form: 'lines',
});

export const D13 = pairFigure({
  id: 'D-13',
  name: 'Housing cost burden',
  pick: (bundle) => bundle.costBurdenComparison,
  verb: 'cost-burdened at',
});

export const D14 = ratioFigure({
  id: 'D-14',
  name: 'Imprisonment ratio',
  pick: (bundle) => bundle.imprisonmentComparison,
  measure: 'were imprisoned at {n} times the rate of',
});

export const D15 = pairFigure({
  id: 'D-15',
  name: 'Imprisonment rates',
  pick: (bundle) => bundle.imprisonmentComparison,
  verb: 'imprisoned at',
});

export const D16 = seriesFigure({
  id: 'D-16',
  name: 'Federal drug sentences',
  pick: (bundle) => bundle.federalDrugSentences,
  form: 'bars',
});
