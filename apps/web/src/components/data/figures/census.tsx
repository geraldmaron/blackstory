/**
 * The census figures, `D-01` to `D-05`: the Black share of the country, the free and enslaved
 * shares to 1860, the count at each census, the change between recent censuses, and the states
 * that gained and lost the most. All read the one national timeline snapshot.
 */
import React, { cache } from 'react';
import { US_STATES } from '@repo/domain/map/geography';
import {
  buildStateFipsNameMap,
  type NationalPopulationTimelineRow,
} from '@repo/domain/statistics/public-data-summaries';
import {
  getNationalPopulationTimelineSnapshot,
  getStatePopulationChanges,
} from '../../../lib/demographics/public-stats-source';
import { ShareLine } from '../BlackPopulationShareChart';
import { Bar, Mark, Plot, PointLabel, Tip, bandLayout } from '../chart-kit';
import { formatChartCount, formatPctValue, formatSharePct } from '../chart-utils';
import { PopulationByDecadeChart } from '../PopulationByDecadeChart';
import { timelineChangeStripItems } from '../population-change';
import {
  StatePopulationShiftChart,
  formatSignedPp,
  signedCount,
  stateShiftRows,
} from '../StatePopulationShiftChart';
import type { StateShiftBarRow } from '../state-population-shift';
import { defineFigure, type FigureRows } from './figure-spec';
import {
  CoiledBarPortrait,
  StackedFieldsPortrait,
  type CoilPortraitItem,
  type PortraitTone,
} from './portraits';

void React;

/* —— the census timeline ——————————————————————————————————— */

type TimelineRow = NationalPopulationTimelineRow;

const loadTimeline = cache(async () => {
  try {
    return (await getNationalPopulationTimelineSnapshot()) ?? undefined;
  } catch {
    return undefined;
  }
});

async function timelineRows(
  pick: (rows: readonly TimelineRow[]) => readonly TimelineRow[],
): Promise<FigureRows<TimelineRow> | undefined> {
  const timeline = await loadTimeline();
  if (!timeline) return undefined;
  const rows = pick(timeline.rows);
  const used = new Set(rows.map((row) => row.sourceId));
  return {
    rows,
    sources: timeline.sources
      .filter((source) => used.has(source.sourceId))
      .map((source) => ({ label: source.label, url: source.sourceUrl })),
    revised: timeline.generatedAt,
    built: timeline.generatedAt,
  };
}

const censusCell = (row: TimelineRow) =>
  `${row.decade}${row.southernUndercountCaveat ? ' (undercount)' : ''}`;

function Swatch({ tone }: { readonly tone: PortraitTone }) {
  return <span className="ds-portrait__swatch" data-tone={tone} aria-hidden="true" />;
}

/* —— D-01: Black share of the U.S. population ————————————————————————————————— */

/** Every row of the census timeline is the whole country. */
const NATION = () => ({ level: 'nation' }) as const;

/** `null` when the census total is missing: a gap, never a zero. */
function shareOfTotal(row: TimelineRow): number | null {
  return row.totalPopulation > 0 ? (row.blackPopulation / row.totalPopulation) * 100 : null;
}

function shareTone(rows: readonly TimelineRow[], index: number): PortraitTone {
  const share = shareOfTotal(rows[index]!);
  const before = index > 0 ? shareOfTotal(rows[index - 1]!) : null;
  // A census with no comparable census before it: the first, or the first under a new definition.
  if (share === null || before === null || rows[index]!.opensDefinitionBoundary) return 'ink';
  return share > before ? 'copper' : 'sand';
}

export const D01 = defineFigure<TimelineRow>({
  id: 'D-01',
  coverage: NATION,
  name: 'Share of the nation',
  title: 'Black share of the U.S. population at each census, 1790 to 2020',
  basis: '1790 to 2020, each census',
  limits:
    'The Black share of the total U.S. population in each census. The plain chart’s axis starts ' +
    'at zero. The 1870 census is a known Southern undercount. The census changed the category it ' +
    'counted under several times; Numbers lists the category for each year.',
  loadRows: () => timelineRows((rows) => rows),
  headline: ({ rows }) => {
    const counted = rows.filter((row) => shareOfTotal(row) !== null);
    const by = (pick: (a: number, b: number) => boolean) =>
      counted.reduce((best, row) => (pick(shareOfTotal(row)!, shareOfTotal(best)!) ? row : best));
    const peak = by((a, b) => a > b);
    const low = by((a, b) => a < b);
    const last = counted.at(-1)!;
    const pct = (row: TimelineRow) => formatSharePct(row.blackPopulation, row.totalPopulation);
    return `The Black share of the country peaked at ${pct(peak)} in ${peak.decade}, fell to ${pct(low)} by ${low.decade}, and stood at ${pct(last)} in ${last.decade}`;
  },
  definitionChange: ({ rows }) => {
    const boundary = rows.find((row, index) => index > 0 && row.opensDefinitionBoundary);
    return boundary
      ? `From ${boundary.decade} the census counts “Black alone,” because people could mark more than one race. Shares on either side of ${boundary.decade} are not measured the same way.`
      : undefined;
  },
  columns: [
    { label: 'Census', cell: censusCell },
    {
      label: 'Black population',
      cell: (row) => formatChartCount(row.blackPopulation),
      csv: (row) => row.blackPopulation,
    },
    {
      label: 'Total population',
      cell: (row) => formatChartCount(row.totalPopulation),
      csv: (row) => row.totalPopulation,
    },
    {
      label: 'Black share of total',
      cell: (row) => formatSharePct(row.blackPopulation, row.totalPopulation),
    },
    { label: 'Census category', cell: (row) => row.raceCategoryLabel },
  ],
  plain: ({ rows }) => <ShareLine rows={rows} />,
  portrait: ({ rows }) => {
    const items: CoilPortraitItem[] = rows.map((row, index) => ({
      key: row.decade,
      value: shareOfTotal(row),
      text: formatSharePct(row.blackPopulation, row.totalPopulation),
      tone: shareTone(rows, index),
      breakBefore: index > 0 && row.opensDefinitionBoundary,
    }));
    const boundary = rows.find((row, index) => index > 0 && row.opensDefinitionBoundary);
    return (
      <CoiledBarPortrait
        id="D-01"
        label={`One bar from ${rows[0]!.decade} to ${rows.at(-1)!.decade}. Each stretch is one census and its length is the Black share of the U.S. population that year. Every value is in Numbers.`}
        items={items}
      >
        <p>
          One bar, read from the top left. Each stretch is one census, and its length is the Black
          share of the U.S. population that year.
        </p>
        <ul>
          <li>
            <Swatch tone="sand" /> The share fell from the census before
          </li>
          <li>
            <Swatch tone="copper" /> The share rose from the census before
          </li>
          <li>
            <Swatch tone="ink" /> No comparable census before it
          </li>
          {boundary ? (
            <li>
              <span className="ds-portrait__break-mark" aria-hidden="true" /> The break before{' '}
              {boundary.decade}: a new definition
            </li>
          ) : null}
        </ul>
      </CoiledBarPortrait>
    );
  },
});

/* —— D-02: free and enslaved shares of the Black population ——————————————————— */

type Split = { readonly free: number; readonly enslaved: number } | null;

function splitOf(row: TimelineRow): Split {
  return row.freeBlackPopulation === null || row.enslavedBlackPopulation === null
    ? null
    : { free: row.freeBlackPopulation, enslaved: row.enslavedBlackPopulation };
}

const splitPct = (row: TimelineRow, part: 'free' | 'enslaved') => {
  const split = splitOf(row);
  return split ? formatSharePct(split[part], split.free + split.enslaved) : 'no data';
};

const splitCount = (row: TimelineRow, part: 'free' | 'enslaved') => {
  const split = splitOf(row);
  return split ? formatChartCount(split[part]) : 'no data';
};

/** The censuses from the first to the last that counted the two apart; one between them that did
 *  not is kept, and drawn as a gap. */
function splitSpan(rows: readonly TimelineRow[]): readonly TimelineRow[] {
  const first = rows.findIndex((row) => splitOf(row) !== null);
  const last = rows.reduce((found, row, index) => (splitOf(row) !== null ? index : found), -1);
  return first === -1 ? [] : rows.slice(first, last + 1);
}

export const D02 = defineFigure<TimelineRow>({
  id: 'D-02',
  coverage: NATION,
  name: 'Free and enslaved, to 1860',
  title: 'Free and enslaved shares of the Black population at each census, 1790 to 1860',
  basis: '1790 to 1860, each census',
  limits:
    'Free and enslaved people as each census counted them, as shares of the two added together. ' +
    'The census counted them apart only through 1860, the last census before emancipation. How ' +
    'the census classed people varied from one census to the next. This figure shows shares; ' +
    'the counts are in Numbers.',
  loadRows: () => timelineRows(splitSpan),
  headline: ({ rows }) => {
    const shares = rows.flatMap((row) => {
      const split = splitOf(row);
      return split ? [(split.enslaved / (split.free + split.enslaved)) * 100] : [];
    });
    return `At every census from ${rows[0]!.decade} to ${rows.at(-1)!.decade}, between ${formatPctValue(Math.min(...shares))} and ${formatPctValue(Math.max(...shares))} of the Black people counted were enslaved`;
  },
  columns: [
    { label: 'Census', cell: (row) => row.decade },
    {
      label: 'Free',
      cell: (row) => splitCount(row, 'free'),
      csv: (row) => splitOf(row)?.free ?? 'no data',
    },
    {
      label: 'Enslaved',
      cell: (row) => splitCount(row, 'enslaved'),
      csv: (row) => splitOf(row)?.enslaved ?? 'no data',
    },
    { label: 'Free share', cell: (row) => splitPct(row, 'free') },
    { label: 'Enslaved share', cell: (row) => splitPct(row, 'enslaved') },
    { label: 'Census category', cell: (row) => row.raceCategoryLabel },
  ],
  plain: ({ rows }) => {
    const { center, width } = bandLayout(rows.length);
    return (
      <Plot
        label="Free and enslaved shares of the Black population at each census"
        unit="Percent of the Black people counted"
        size="md"
        keys={[
          { label: 'Enslaved', tone: 'mid' },
          { label: 'Free', tone: 'lo', hatched: true },
        ]}
        yTicks={[0, 25, 50, 75, 100].map((at) => ({ at, label: `${at}%` }))}
        xTicks={rows.map((row, index) => ({ at: center(index), label: row.decade }))}
      >
        {rows.map((row, index) => {
          const split = splitOf(row);
          if (!split) {
            return (
              <PointLabel key={row.decade} x={center(index)} y={50}>
                no data
              </PointLabel>
            );
          }
          const enslaved = (split.enslaved / (split.free + split.enslaved)) * 100;
          return (
            <Mark
              key={row.decade}
              x={center(index)}
              width={width}
              first={index === 0}
              tipY={100}
              ariaLabel={`${row.decade}: enslaved ${splitPct(row, 'enslaved')}, free ${splitPct(row, 'free')}`}
              tip={
                <Tip
                  title={`${row.decade} census`}
                  rows={[
                    { value: splitPct(row, 'enslaved'), label: 'enslaved', tone: 'mid' },
                    { value: splitPct(row, 'free'), label: 'free', tone: 'lo' },
                  ]}
                />
              }
            >
              <Bar height={enslaved} tone="mid" />
              <Bar offset={enslaved} height={100 - enslaved} tone="lo" hatched />
            </Mark>
          );
        })}
      </Plot>
    );
  },
  portrait: ({ rows }) => (
    <StackedFieldsPortrait
      label={`One column for each census from ${rows[0]!.decade} to ${rows.at(-1)!.decade}, divided by area into the free share above and the enslaved share below. Every value is in Numbers.`}
      columns={rows.map((row) => {
        const split = splitOf(row);
        return {
          key: row.decade,
          parts: (['free', 'enslaved'] as const).map((part) => ({
            id: part,
            value: split ? split[part] : null,
            text: splitPct(row, part),
            tone: part === 'free' ? ('sand' as const) : ('ink' as const),
          })),
        };
      })}
    >
      <p>
        Each column is every Black person the census counted that year, divided by area into two
        fields.
      </p>
      <ul>
        <li>
          <Swatch tone="sand" /> Free
        </li>
        <li>
          <Swatch tone="ink" /> Enslaved
        </li>
      </ul>
    </StackedFieldsPortrait>
  ),
});

/* —— D-03: the count at each census ———————————————————————————————————————————— */

/** 41,341,383 gives "41.3". */
function millions(value: number): string {
  return (value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

const partCell = (value: number | null) => (value === null ? 'no data' : formatChartCount(value));

export const D03 = defineFigure<TimelineRow>({
  id: 'D-03',
  coverage: NATION,
  name: 'Population by census',
  title: 'Black population at each census, 1790 to 2020',
  basis: '1790 to 2020, each census',
  limits:
    'Enslaved and free counts are stacked for 1790 to 1860; together they are the Black ' +
    'total. From 1870 the census gives one Black total. From 2000 the count is “Black alone,” ' +
    'when people could mark more than one race, so counts before and after are not a perfect ' +
    'match. The 1870 count is a known Southern undercount.',
  loadRows: () => timelineRows((rows) => rows),
  headline: ({ rows }) => {
    const first = rows[0]!;
    const last = rows.at(-1)!;
    return `From ${formatChartCount(first.blackPopulation)} Black people in ${first.decade} to ${millions(last.blackPopulation)} million in ${last.decade}`;
  },
  columns: [
    { label: 'Census', cell: censusCell },
    {
      label: 'Black population',
      cell: (row) => formatChartCount(row.blackPopulation),
      csv: (row) => row.blackPopulation,
    },
    {
      label: 'Free',
      cell: (row) => partCell(row.freeBlackPopulation),
      csv: (row) => row.freeBlackPopulation ?? 'no data',
    },
    {
      label: 'Enslaved',
      cell: (row) => partCell(row.enslavedBlackPopulation),
      csv: (row) => row.enslavedBlackPopulation ?? 'no data',
    },
    {
      label: 'Total population',
      cell: (row) => formatChartCount(row.totalPopulation),
      csv: (row) => row.totalPopulation,
    },
    {
      label: 'Black share of total',
      cell: (row) => formatSharePct(row.blackPopulation, row.totalPopulation),
    },
    { label: 'Census category', cell: (row) => row.raceCategoryLabel },
  ],
  plain: ({ rows }) => <PopulationByDecadeChart rows={rows} />,
});

/* —— D-04: change between recent censuses ————————————————————————————————————— */

type DeltaRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly change: number;
};

/** First census year in a delta label ("Black population, 1990 to 2000" gives 1990). */
function deltaStart(label: string): string | undefined {
  return label.match(/\b(1[789]\d\d|20\d\d)\b/)?.[1];
}

/**
 * The change figure's finding: whether growth slowed or quickened from one census gap to the
 * next. The values themselves are printed in the figure, so the finding compares them instead.
 */
export function deltaTrendReading(
  items: readonly { readonly label: string; readonly change: number }[],
): string | undefined {
  if (items.length < 2) return undefined;
  const values = items.map((item) => item.change);
  const from = deltaStart(items[0]!.label);
  const slowed = values.every((value, index) => index === 0 || value < values[index - 1]!);
  const quickened = values.every((value, index) => index === 0 || value > values[index - 1]!);
  if (!from || (!slowed && !quickened)) return undefined;
  return `Growth ${slowed ? 'slowed' : 'quickened'} each decade since ${from}`;
}

export const D04 = defineFigure<DeltaRow>({
  id: 'D-04',
  coverage: NATION,
  name: 'Recent change',
  title: 'Change in the Black population between recent censuses',
  basis: ({ rows }) =>
    `${deltaStart(rows[0]!.label) ?? ''} to ${rows.at(-1)!.id.split('-')[1] ?? ''}, census to census`,
  limits:
    'Absolute change in the Black population between adjacent censuses, with the change in share ' +
    'of the U.S. total in percentage points. A change that crosses the 2000 definition line is ' +
    'labeled, not smoothed.',
  loadRows: async () => {
    const timeline = await loadTimeline();
    if (!timeline) return undefined;
    const recent = timeline.changes.slice(-3);
    const sources = timeline.sources.map((source) => ({
      label: source.label,
      url: source.sourceUrl,
    }));
    return {
      rows: timelineChangeStripItems(recent, sources[0] ?? { label: '', url: '' }, 3).map(
        (item, index) => ({
          id: item.id,
          label: item.label,
          value: item.value,
          note: item.note,
          change: recent[index]!.growth.absoluteChange,
        }),
      ),
      sources,
      revised: timeline.generatedAt,
      built: timeline.generatedAt,
    };
  },
  headline: ({ rows }) => {
    const latest = rows.at(-1)!;
    return deltaTrendReading(rows) ?? `${latest.label}: ${latest.value}`;
  },
  columns: [
    { label: 'Censuses', cell: (row) => row.label },
    { label: 'Change', cell: (row) => row.value, csv: (row) => row.change },
    { label: 'Note', cell: (row) => row.note },
  ],
  plain: ({ rows }) => (
    <ol className="ds-deltas">
      {rows.map((row) => (
        <li key={row.id} className="ds-delta">
          <span className="ds-delta__label">{row.label}</span>
          <span className="ds-delta__value">{row.value}</span>
          {row.note ? <p className="ds-delta__note">{row.note}</p> : null}
        </li>
      ))}
    </ol>
  ),
});

/* —— D-05: the states that gained and lost the most —————————————————————————— */

const SHIFT = { from: '2010', to: '2020' } as const;
const STATE_NAME_BY_FIPS = buildStateFipsNameMap(US_STATES);

export const D05 = defineFigure<StateShiftBarRow>({
  id: 'D-05',
  // One row a state, and only the states in the figure: a state it leaves out is not covered.
  coverage: ({ rows }) => ({ level: 'state', states: rows.map((row) => row.stateName) }),
  focus: {
    is: (row, state) => row.stateName === state,
    reading: (row) =>
      `${row.stateName}: ${signedCount(row.blackAbsoluteChange)} Black residents, ${SHIFT.from} to ${SHIFT.to}.`,
  },
  name: 'State gains and losses',
  title: `Where the Black population rose or fell, ${SHIFT.from} to ${SHIFT.to}`,
  basis: `${SHIFT.from} to ${SHIFT.to}`,
  limits:
    `The states and territories with the largest gains and losses in Black population between ` +
    `${SHIFT.from} and ${SHIFT.to}, sorted from largest gain to largest loss. Share change, in ` +
    `the table, is percentage points of each state’s total population.`,
  loadRows: async () => {
    const [timeline, changes] = await Promise.all([
      loadTimeline(),
      getStatePopulationChanges(SHIFT.from, SHIFT.to).catch(() => undefined),
    ]);
    if (!timeline || !changes) return undefined;
    return {
      rows: stateShiftRows(changes, STATE_NAME_BY_FIPS),
      sources: timeline.sources.map((source) => ({ label: source.label, url: source.sourceUrl })),
      revised: timeline.generatedAt,
      built: timeline.generatedAt,
    };
  },
  headline: ({ rows }) => {
    // Sorted from largest gain to largest loss.
    const gain = rows[0]!.blackAbsoluteChange > 0 ? rows[0] : undefined;
    const loss = rows.at(-1)!.blackAbsoluteChange < 0 ? rows.at(-1) : undefined;
    return [
      gain
        ? `${gain.stateName} added the most Black residents, ${formatChartCount(gain.blackAbsoluteChange)}`
        : '',
      loss
        ? `${loss.stateName} lost the most, ${formatChartCount(Math.abs(loss.blackAbsoluteChange))}`
        : '',
    ]
      .filter(Boolean)
      .join('; ');
  },
  columns: [
    { label: 'State or territory', cell: (row) => row.stateName },
    {
      label: 'Black population change',
      cell: (row) => signedCount(row.blackAbsoluteChange),
      csv: (row) => row.blackAbsoluteChange,
    },
    {
      label: 'Share change (pp)',
      cell: (row) => formatSignedPp(row.shareChangePp),
      csv: (row) => Math.round(row.shareChangePp * 100) / 100,
    },
  ],
  plain: ({ rows, focus }) => (
    <StatePopulationShiftChart
      fromDecade={SHIFT.from}
      toDecade={SHIFT.to}
      rows={rows}
      {...(focus ? { marked: focus } : {})}
    />
  ),
});
