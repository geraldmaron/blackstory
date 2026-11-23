/**
 * The figure registry (docs/ui/DESIGN.md section 9.5). A figure is an id, a headline that states
 * the finding, a data loader, its sources and limits, and up to three renderers: Portrait, Plain
 * and Numbers. `Figure` renders one by id; a story or a record page will embed the same entry.
 *
 * The id is the figure's address (`/data#D-01`) and never changes once published. Numbers and the
 * CSV are built from one column list over the same rows the two drawings read, so the three views
 * cannot disagree.
 */
import React, { cache, type ReactNode } from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { getNationalPopulationTimelineSnapshot } from '../../../lib/demographics/public-stats-source';
import { ShareLine } from '../BlackPopulationShareChart';
import { Bar, Mark, Plot, PointLabel, Tip, bandLayout } from '../chart-kit';
import { formatChartCount, formatPctValue, formatSharePct } from '../chart-utils';
import type { DataSourceRef } from '../SourceFootnote';
import {
  CoiledBarPortrait,
  StackedFieldsPortrait,
  type CoilPortraitItem,
  type PortraitTone,
} from './portraits';

void React;

export const FIGURE_VIEWS = ['portrait', 'plain', 'numbers'] as const;
export type FigureView = (typeof FIGURE_VIEWS)[number];

/** Plain is the default everywhere until the read test passes (docs/ui/read-test-figures.md). */
export const DEFAULT_FIGURE_VIEW: FigureView = 'plain';

export function parseFigureView(raw: string | readonly string[] | undefined): FigureView {
  const value = (typeof raw === 'string' ? raw : raw?.[0])?.trim().toLowerCase();
  return FIGURE_VIEWS.find((view) => view === value) ?? DEFAULT_FIGURE_VIEW;
}

export type FigureTable = {
  readonly columns: readonly string[];
  /** Each cell as the table prints it and as the CSV writes it. */
  readonly rows: readonly (readonly { readonly text: string; readonly csv: string }[])[];
};

export type FigureRows<Row> = {
  readonly rows: readonly Row[];
  readonly sources: readonly DataSourceRef[];
  /** When the series was last built (ISO). The citation's date, never the subject's. */
  readonly revised?: string;
};

export type LoadedFigure = {
  readonly headline: string;
  readonly sources: readonly DataSourceRef[];
  readonly revised?: string;
  /** A change of definition or denominator, said in every view. */
  readonly definitionChange?: string;
  readonly table: FigureTable;
  readonly plain: ReactNode;
  readonly portrait?: ReactNode;
};

type FigureColumn<Row> = {
  readonly label: string;
  readonly cell: (row: Row) => string;
  /** The raw value for the CSV, when the printed cell is formatted. */
  readonly csv?: (row: Row) => string | number;
};

type FigureSpec<Row> = {
  readonly id: string;
  /** What is plotted, plainly. */
  readonly title: string;
  /** What the years on the label mean. */
  readonly basis: string;
  /** What the series does and does not measure. */
  readonly limits: string;
  readonly loadRows: () => Promise<FigureRows<Row> | undefined>;
  /** The finding, one sentence with its numbers. */
  readonly headline: (rows: readonly Row[]) => string;
  readonly definitionChange?: (rows: readonly Row[]) => string | undefined;
  readonly columns: readonly FigureColumn<Row>[];
  readonly plain: (rows: readonly Row[]) => ReactNode;
  readonly portrait?: (rows: readonly Row[]) => ReactNode;
};

export type RegisteredFigure = {
  readonly id: string;
  readonly title: string;
  readonly basis: string;
  readonly limits: string;
  readonly load: () => Promise<LoadedFigure | undefined>;
};

function defineFigure<Row>(spec: FigureSpec<Row>) {
  const fromRows = (data: FigureRows<Row>): LoadedFigure => {
    const change = spec.definitionChange?.(data.rows);
    return {
      headline: spec.headline(data.rows),
      sources: data.sources,
      ...(data.revised === undefined ? {} : { revised: data.revised }),
      ...(change === undefined ? {} : { definitionChange: change }),
      table: {
        columns: spec.columns.map((column) => column.label),
        rows: data.rows.map((row) =>
          spec.columns.map((column) => ({
            text: column.cell(row),
            csv: String(column.csv ? column.csv(row) : column.cell(row)),
          })),
        ),
      },
      plain: spec.plain(data.rows),
      ...(spec.portrait ? { portrait: spec.portrait(data.rows) } : {}),
    };
  };
  return {
    id: spec.id,
    title: spec.title,
    basis: spec.basis,
    limits: spec.limits,
    fromRows,
    load: async () => {
      const data = await spec.loadRows();
      return data && data.rows.length > 0 ? fromRows(data) : undefined;
    },
  };
}

/** RFC 4180: quote a cell that holds a comma, a quote or a line break. */
export function figureCsv(table: FigureTable): string {
  const cell = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return [table.columns, ...table.rows.map((row) => row.map((entry) => entry.csv))]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}

/* —— the census timeline both figures read ——————————————————————————————————— */

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
  };
}

const censusCell = (row: TimelineRow) =>
  `${row.decade}${row.southernUndercountCaveat ? ' (undercount)' : ''}`;

function Swatch({ tone }: { readonly tone: PortraitTone }) {
  return <span className="ds-portrait__swatch" data-tone={tone} aria-hidden="true" />;
}

/* —— D-01: Black share of the U.S. population ————————————————————————————————— */

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
  title: 'Black share of the U.S. population at each census, 1790 to 2020',
  basis: '1790 to 2020, each census',
  limits:
    'The Black share of the total U.S. population in each census. The plain chart’s axis starts ' +
    'at zero. The 1870 census is a known Southern undercount. The census changed the category it ' +
    'counted under several times; Numbers lists the category for each year.',
  loadRows: () => timelineRows((rows) => rows),
  headline: (rows) => {
    const counted = rows.filter((row) => shareOfTotal(row) !== null);
    const by = (pick: (a: number, b: number) => boolean) =>
      counted.reduce((best, row) => (pick(shareOfTotal(row)!, shareOfTotal(best)!) ? row : best));
    const peak = by((a, b) => a > b);
    const low = by((a, b) => a < b);
    const last = counted.at(-1)!;
    const pct = (row: TimelineRow) => formatSharePct(row.blackPopulation, row.totalPopulation);
    return `The Black share of the country peaked at ${pct(peak)} in ${peak.decade}, fell to ${pct(low)} by ${low.decade}, and stood at ${pct(last)} in ${last.decade}`;
  },
  definitionChange: (rows) => {
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
  plain: (rows) => <ShareLine rows={rows} />,
  portrait: (rows) => {
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
  title: 'Free and enslaved shares of the Black population at each census, 1790 to 1860',
  basis: '1790 to 1860, each census',
  limits:
    'Free and enslaved people as each census counted them, as shares of the two added together. ' +
    'The census counted them apart only through 1860, the last census before emancipation. How ' +
    'the census classed people varied from one census to the next. This figure shows shares; ' +
    'the counts are in Numbers.',
  loadRows: () => timelineRows(splitSpan),
  headline: (rows) => {
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
  plain: (rows) => {
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
  portrait: (rows) => (
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

export const FIGURES = { 'D-01': D01, 'D-02': D02 } as const satisfies Record<
  string,
  RegisteredFigure
>;

export type FigureId = keyof typeof FIGURES;
