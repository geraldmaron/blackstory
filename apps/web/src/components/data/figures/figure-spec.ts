/**
 * What a figure is (docs/ui/DESIGN.md section 9.5): an id, a headline that states the finding, its
 * sources and limits, and up to three renderers: Portrait, Plain and Numbers. Numbers and the CSV
 * are built from one column list over the same rows the drawings read, so the views cannot
 * disagree.
 *
 * This module has no data access, so a client component may build a figure from rows it already
 * holds (the Lives appendix does). The figures that load their own rows are in `registry.tsx`.
 */
import type { ReactNode } from 'react';
import type { DataSourceRef } from '../SourceFootnote';

export const FIGURE_VIEWS = ['portrait', 'plain', 'numbers'] as const;
export type FigureView = (typeof FIGURE_VIEWS)[number];

/** Plain is the default everywhere until the read test passes (docs/ui/read-test-figures.md). */
export const DEFAULT_FIGURE_VIEW: FigureView = 'plain';

const asView = (value: string | undefined): FigureView | undefined =>
  FIGURE_VIEWS.find((view) => view === value?.trim().toLowerCase());

/**
 * The `view` URL parameter: which view each figure on a page opens in. `D-01:portrait,D-09:numbers`
 * sets figures one by one; a bare `numbers` sets every figure that is not named. A figure that is
 * not named and has no bare view opens Plain.
 */
export type FigureViews = {
  readonly all: FigureView;
  readonly byId: Readonly<Record<string, FigureView>>;
};

export function parseFigureViews(raw: string | readonly string[] | undefined): FigureViews {
  const tokens = (typeof raw === 'string' ? [raw] : (raw ?? [])).flatMap((value) =>
    value.split(','),
  );
  let all = DEFAULT_FIGURE_VIEW;
  let bare = false;
  const byId: Record<string, FigureView> = {};
  for (const token of tokens) {
    const at = token.lastIndexOf(':');
    const view = asView(at === -1 ? token : token.slice(at + 1));
    if (!view) continue;
    if (at > 0) byId[token.slice(0, at).trim()] = view;
    else if (!bare) {
      all = view;
      bare = true;
    }
  }
  return { all, byId };
}

/** One figure's view, when a page holds a single figure or a caller only needs the bare value. */
export function parseFigureView(raw: string | readonly string[] | undefined): FigureView {
  return parseFigureViews(raw).all;
}

export function figureViewOf(views: FigureViews, id: string): FigureView {
  return views.byId[id] ?? views.all;
}

/**
 * The `view` value after one figure changes view, every other figure staying as it is. `undefined`
 * when nothing differs from Plain, so the default address carries no parameter.
 */
export function figureViewsParam(
  views: FigureViews,
  id: string,
  next: FigureView,
): string | undefined {
  const byId = { ...views.byId, [id]: next };
  const tokens = [
    ...(views.all === DEFAULT_FIGURE_VIEW ? [] : [views.all]),
    ...Object.entries(byId)
      .filter(([, view]) => view !== views.all)
      .map(([key, view]) => `${key}:${view}`),
  ];
  return tokens.length > 0 ? tokens.join(',') : undefined;
}

export type FigureTable = {
  readonly columns: readonly string[];
  /** Each cell as the table prints it and as the CSV writes it. */
  readonly rows: readonly (readonly { readonly text: string; readonly csv: string }[])[];
};

export type FigureRows<Row, Extra = undefined> = {
  readonly rows: readonly Row[];
  readonly sources: readonly DataSourceRef[];
  /** When the series was last built (ISO). The citation's date, never the subject's. */
  readonly revised?: string;
} & (Extra extends undefined ? { readonly extra?: undefined } : { readonly extra: Extra });

export type LoadedFigure = {
  /** What is plotted, plainly. */
  readonly title: string;
  /** What the years on the label mean. */
  readonly basis: string;
  /** What the series does and does not measure. */
  readonly limits: string;
  /** The finding, one sentence with its numbers. */
  readonly headline: string;
  readonly sources: readonly DataSourceRef[];
  readonly revised?: string;
  /** A change of definition or denominator, said in every view. */
  readonly definitionChange?: string;
  /** The published story behind the number, when there is one. */
  readonly chapterHref?: string;
  readonly table: FigureTable;
  readonly plain: ReactNode;
  readonly portrait?: ReactNode;
};

export type FigureColumn<Row> = {
  readonly label: string;
  readonly cell: (row: Row) => string;
  /** The raw value for the CSV, when the printed cell is formatted. */
  readonly csv?: (row: Row) => string | number;
};

type Said<Data> = string | ((data: Data) => string);

export type FigureSpec<Row, Extra = undefined> = {
  readonly id: string;
  /** A short name for a contents list. */
  readonly name: string;
  readonly title: Said<FigureRows<Row, Extra>>;
  readonly basis: Said<FigureRows<Row, Extra>>;
  readonly limits: Said<FigureRows<Row, Extra>>;
  readonly headline: (data: FigureRows<Row, Extra>) => string;
  readonly definitionChange?: (data: FigureRows<Row, Extra>) => string | undefined;
  readonly chapterHref?: (data: FigureRows<Row, Extra>) => string | undefined;
  readonly columns:
    readonly FigureColumn<Row>[] | ((data: FigureRows<Row, Extra>) => readonly FigureColumn<Row>[]);
  readonly plain: (data: FigureRows<Row, Extra>) => ReactNode;
  readonly portrait?: (data: FigureRows<Row, Extra>) => ReactNode;
};

/** A figure from rows already in hand. */
export function buildFigure<Row, Extra = undefined>(
  spec: FigureSpec<Row, Extra>,
  data: FigureRows<Row, Extra>,
): LoadedFigure {
  const say = (text: Said<FigureRows<Row, Extra>>) =>
    typeof text === 'string' ? text : text(data);
  const columns = typeof spec.columns === 'function' ? spec.columns(data) : spec.columns;
  const change = spec.definitionChange?.(data);
  const chapterHref = spec.chapterHref?.(data);
  return {
    title: say(spec.title),
    basis: say(spec.basis),
    limits: say(spec.limits),
    headline: spec.headline(data),
    sources: data.sources,
    ...(data.revised === undefined ? {} : { revised: data.revised }),
    ...(change === undefined ? {} : { definitionChange: change }),
    ...(chapterHref === undefined ? {} : { chapterHref }),
    table: {
      columns: columns.map((column) => column.label),
      rows: data.rows.map((row) =>
        columns.map((column) => ({
          text: column.cell(row),
          csv: String(column.csv ? column.csv(row) : column.cell(row)),
        })),
      ),
    },
    plain: spec.plain(data),
    ...(spec.portrait ? { portrait: spec.portrait(data) } : {}),
  };
}

export type RegisteredFigure = {
  readonly id: string;
  readonly name: string;
  readonly load: () => Promise<LoadedFigure | undefined>;
};

/** A figure that loads its own rows. Nothing to draw (no rows, or a failed read) is `undefined`. */
export function defineFigure<Row, Extra = undefined>(
  spec: FigureSpec<Row, Extra> & {
    readonly loadRows: () => Promise<FigureRows<Row, Extra> | undefined>;
  },
) {
  const fromRows = (data: FigureRows<Row, Extra>) => buildFigure(spec, data);
  return {
    id: spec.id,
    name: spec.name,
    /** True when a Portrait form was built for this figure. */
    hasPortrait: spec.portrait !== undefined,
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
