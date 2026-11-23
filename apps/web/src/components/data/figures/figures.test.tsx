/**
 * Encoding tests for the Portrait forms (docs/ui/DESIGN.md section 9.5: a form whose encoding
 * cannot be tested is not built). Each is checked twice: on the geometry, and on the SVG the
 * component actually renders, so a drawing that drifts from its data fails here.
 *
 *   coiled bar      length along the bar is proportional to the value, within 0.5 percent
 *   stacked fields  area is proportional to the value, within 0.5 percent
 *   folded bars     length along each bar, turns included, is proportional to the value
 *   all             a missing value is a labeled gap, never a zero; every value is printed
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { coiledBar, foldedBars, polylineLength, stackedFields, type Point } from './geometry';
import { COIL_LAYOUTS, FIELD_LAYOUTS, FOLD_LAYOUTS } from './portraits';
import { DATA_PAGE_INDICATOR_FIXTURE_BUNDLE } from '@repo/domain/statistics/data-page-series';
import { D01, D02 } from './census';
import { seriesData } from './indicators';
import {
  FIGURES,
  FIGURE_IDS,
  figureCsv,
  figureViewOf,
  figureViewsParam,
  parseFigureView,
  parseFigureViews,
} from './registry';

void React;

const TOLERANCE = 0.005;

/** The census timeline as published on 2026-11-23: year, total, Black, free, enslaved. */
const CENSUS: readonly (readonly [number, number, number, number?, number?])[] = [
  [1790, 3929214, 757208, 59527, 697681],
  [1800, 5308483, 1002037, 108435, 893602],
  [1810, 7239881, 1377808, 186446, 1191362],
  [1820, 9638453, 1771656, 233634, 1538022],
  [1830, 12860702, 2328642, 319599, 2009043],
  [1840, 17063353, 2873648, 386293, 2487355],
  [1850, 23191876, 3638808, 434495, 3204313],
  [1860, 31443321, 4441830, 488070, 3953760],
  [1870, 38558371, 4880009],
  [1880, 50155783, 6580793],
  [1890, 62947714, 7488676],
  [1900, 75994575, 8833994],
  [1910, 91972266, 9827763],
  [1920, 105710620, 10463131],
  [1930, 122775046, 11891143],
  [1940, 131669275, 12865518],
  [1950, 150697361, 15042286],
  [1960, 179323175, 18871831],
  [1970, 203211926, 22580289],
  [1980, 226545805, 26495025],
  [1990, 248709873, 29986060],
  [2000, 285230516, 34961123],
  [2010, 312471327, 39390817],
  [2020, 334735155, 41332911],
];

const ROWS = CENSUS.map(
  ([year, total, black, free, enslaved]): NationalPopulationTimelineRow =>
    ({
      decade: String(year),
      year,
      totalPopulation: total,
      blackPopulation: black,
      freeBlackPopulation: free ?? null,
      enslavedBlackPopulation: enslaved ?? null,
      blackShareOfTotalPct: (black / total) * 100,
      raceCategoryLabel: year >= 2000 ? 'Black or African American alone' : 'Negro / Black',
      nationalSource: year >= 2000 ? 'census-county-sum' : 'twps0056',
      sourceId: 'us-census-historical-race-1790-1990',
      sourceUrl: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
      opensDefinitionBoundary: year === 2000,
      southernUndercountCaveat: year === 1870,
      hasFreeEnslavedSplit: free !== undefined,
    }) as NationalPopulationTimelineRow,
);

const SOURCES = [{ label: 'twps0056', url: 'https://www.census.gov/' }];
const share = (row: NationalPopulationTimelineRow) =>
  (row.blackPopulation / row.totalPopulation) * 100;

function pointsOf(d: string): Point[] {
  return [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

function attr(tag: string, name: string): string {
  return tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? '';
}

function svgs(markup: string): Record<'narrow' | 'wide', string> {
  const all = markup.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
  const pick = (size: string) => all.find((svg) => svg.includes(`data-layout="${size}"`)) ?? '';
  return { narrow: pick('narrow'), wide: pick('wide') };
}

function within(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= Math.abs(expected) * TOLERANCE;
}

/* —— coiled bar: length ——————————————————————————————————————————————————— */

test('coiled bar geometry: every stretch is as long as its value times the one scale', () => {
  for (const layout of Object.values(COIL_LAYOUTS)) {
    const geometry = coiledBar(
      ROWS.map((row) => ({ key: row.decade, value: share(row) })),
      layout,
    );
    assert.equal(geometry.stretches.length, ROWS.length);
    geometry.stretches.forEach((stretch, index) => {
      const expected = share(ROWS[index]!) * layout.unit;
      assert.ok(
        within(polylineLength(stretch.points), expected),
        `${stretch.key}: ${polylineLength(stretch.points)} is not ${expected}`,
      );
    });
    // Consecutive stretches meet end to start: one bar, no overlap and no hidden length.
    geometry.stretches.slice(1).forEach((stretch, index) => {
      const before = geometry.stretches[index]!.points.at(-1)!;
      assert.ok(
        Math.hypot(stretch.points[0]!.x - before.x, stretch.points[0]!.y - before.y) < 0.01,
      );
    });
  }
});

test('D-01 Portrait as rendered: drawn length over value is one constant, in both drawings', () => {
  const markup = renderToStaticMarkup(
    <>{D01.fromRows({ rows: ROWS, sources: SOURCES }).portrait}</>,
  );
  for (const [size, svg] of Object.entries(svgs(markup))) {
    const stretches = svg.match(/<path class="ds-portrait__stretch"[^>]*>/g) ?? [];
    assert.equal(stretches.length, ROWS.length, `${size}: one stretch for each census`);
    const unit = COIL_LAYOUTS[size as 'narrow' | 'wide'].unit;
    stretches.forEach((tag, index) => {
      const row = ROWS[index]!;
      assert.equal(attr(tag, 'data-stretch'), row.decade);
      // The value the mark claims is the row's own value, and its length is that value drawn.
      assert.ok(within(Number(attr(tag, 'data-value')), share(row)));
      const length = polylineLength(pointsOf(attr(tag, 'd')));
      assert.ok(within(length / share(row), unit), `${size} ${row.decade}: ${length / share(row)}`);
      // Printed on the mark, as the table prints it.
      assert.ok(svg.includes(`>${row.decade} ${share(row).toFixed(1)}%<`), `${row.decade} label`);
    });
    // The longest and shortest stretches are the highest and lowest shares.
    const lengths = stretches.map((tag) => polylineLength(pointsOf(attr(tag, 'd'))));
    assert.equal(ROWS[lengths.indexOf(Math.max(...lengths))]!.decade, '1790');
    assert.equal(ROWS[lengths.indexOf(Math.min(...lengths))]!.decade, '1930');
    // The 2000 definition change is a break in the bar: two lines, no stretch across it.
    assert.equal((svg.match(/class="ds-portrait__break"/g) ?? []).length, 2);
  }
  assert.match(markup, /The break before<!-- --> <!-- -->2000|The break before 2000/);
});

test('coiled bar: a census with no total is a gap that says "no data", not a zero', () => {
  const rows = ROWS.map((row) => (row.decade === '1890' ? { ...row, totalPopulation: 0 } : row));
  const figure = D01.fromRows({ rows, sources: SOURCES });
  const markup = renderToStaticMarkup(<>{figure.portrait}</>);
  for (const [size, svg] of Object.entries(svgs(markup))) {
    const gap = (svg.match(/<path class="ds-portrait__stretch"[^>]*>/g) ?? []).find(
      (tag) => attr(tag, 'data-stretch') === '1890',
    )!;
    assert.equal(attr(gap, 'data-tone'), 'gap');
    assert.equal(attr(gap, 'data-value'), 'none');
    // A gap has its own fixed length, so it can never be read as a small value.
    assert.ok(
      within(polylineLength(pointsOf(attr(gap, 'd'))), COIL_LAYOUTS[size as 'narrow' | 'wide'].gap),
    );
    assert.ok(svg.includes('>1890 no data<'));
  }
  // The census after a gap has nothing comparable before it.
  assert.match(markup, /data-stretch="1900"[^>]*data-tone="ink"/);
  // Plain breaks its line there too, and says so.
  const plain = renderToStaticMarkup(<>{figure.plain}</>);
  assert.match(plain, /no data/);
  assert.doesNotMatch(plain, /1890: 0\.0%/);
});

/* —— stacked fields: area ————————————————————————————————————————————————— */

test('stacked fields geometry: a part’s area is its share of a column, and columns are equal', () => {
  const split = ROWS.filter((row) => row.freeBlackPopulation !== null);
  for (const layout of Object.values(FIELD_LAYOUTS)) {
    const geometry = stackedFields(
      split.map((row) => ({
        key: row.decade,
        parts: [
          { id: 'free', value: row.freeBlackPopulation },
          { id: 'enslaved', value: row.enslavedBlackPopulation },
        ],
      })),
      layout,
    );
    const whole = geometry.columnWidth * layout.height;
    geometry.columns.forEach((column, index) => {
      const row = split[index]!;
      const sum = row.freeBlackPopulation! + row.enslavedBlackPopulation!;
      const areas = column.rects.map((rect) => rect.width * rect.height);
      assert.ok(within(areas[0]! + areas[1]!, whole), `${row.decade}: the column is the whole`);
      assert.ok(within(areas[0]! / whole, row.freeBlackPopulation! / sum));
      assert.ok(within(areas[1]! / whole, row.enslavedBlackPopulation! / sum));
      // The fields stack with no overlap and no space between them.
      assert.ok(Math.abs(column.rects[0]!.y + column.rects[0]!.height - column.rects[1]!.y) < 1e-9);
    });
  }
});

test('D-02 Portrait as rendered: drawn area over count is one constant per column', () => {
  const data = { rows: ROWS.slice(0, 8), sources: SOURCES };
  const markup = renderToStaticMarkup(<>{D02.fromRows(data).portrait}</>);
  for (const [size, svg] of Object.entries(svgs(markup))) {
    const fields = svg.match(/<rect class="ds-portrait__field"[^>]*>/g) ?? [];
    assert.equal(fields.length, 16, `${size}: two fields for each of eight censuses`);
    const area = (tag: string) => Number(attr(tag, 'width')) * Number(attr(tag, 'height'));
    const wholes: number[] = [];
    data.rows.forEach((row, index) => {
      const [free, enslaved] = [fields[index * 2]!, fields[index * 2 + 1]!];
      assert.equal(attr(free, 'data-field'), `${row.decade}:free`);
      assert.equal(attr(enslaved, 'data-field'), `${row.decade}:enslaved`);
      assert.equal(Number(attr(free, 'data-value')), row.freeBlackPopulation);
      assert.equal(Number(attr(enslaved, 'data-value')), row.enslavedBlackPopulation);
      assert.ok(
        within(
          area(free) / area(enslaved),
          row.freeBlackPopulation! / row.enslavedBlackPopulation!,
        ),
        `${size} ${row.decade}: ${area(free) / area(enslaved)}`,
      );
      wholes.push(area(free) + area(enslaved));
      const sum = row.freeBlackPopulation! + row.enslavedBlackPopulation!;
      for (const part of [row.freeBlackPopulation!, row.enslavedBlackPopulation!]) {
        assert.ok(svg.includes(`>${((part / sum) * 100).toFixed(1)}%<`), `${row.decade} label`);
      }
      assert.ok(svg.includes(`>${row.decade}<`));
    });
    for (const whole of wholes) assert.ok(within(whole, wholes[0]!), 'every column is one area');
  }
});

test('stacked fields: a census with no split is an empty column that says "no data"', () => {
  const rows = ROWS.slice(0, 8).map((row) =>
    row.decade === '1820' ? { ...row, freeBlackPopulation: null } : row,
  );
  const markup = renderToStaticMarkup(<>{D02.fromRows({ rows, sources: SOURCES }).portrait}</>);
  for (const svg of Object.values(svgs(markup))) {
    assert.equal((svg.match(/data-field="1820:/g) ?? []).length, 0);
    assert.equal((svg.match(/data-tone="gap"/g) ?? []).length, 2, 'the outline and its words');
    assert.match(svg, />no<\/tspan>.*>data<\/tspan>/s);
    assert.equal((svg.match(/<rect class="ds-portrait__field" data-field=/g) ?? []).length, 14);
  }
});

/* —— registry: headline, Numbers, CSV, the view parameter ——————————————————— */

test('headlines state the finding from the rows', () => {
  assert.equal(
    D01.fromRows({ rows: ROWS, sources: SOURCES }).headline,
    'The Black share of the country peaked at 19.3% in 1790, fell to 9.7% by 1930, and stood at 12.3% in 2020',
  );
  assert.equal(
    D02.fromRows({ rows: ROWS.slice(0, 8), sources: SOURCES }).headline,
    'At every census from 1790 to 1860, between 86.3% and 92.1% of the Black people counted were enslaved',
  );
});

test('the definition change is said in words for D-01 and absent where there is none', () => {
  assert.match(D01.fromRows({ rows: ROWS, sources: SOURCES }).definitionChange ?? '', /From 2000/);
  assert.equal(
    D02.fromRows({ rows: ROWS.slice(0, 8), sources: SOURCES }).definitionChange,
    undefined,
  );
});

test('Numbers and the CSV are the same rows the drawings read', () => {
  const { table } = D01.fromRows({ rows: ROWS, sources: SOURCES });
  assert.equal(table.rows.length, ROWS.length);
  const lines = figureCsv(table).split('\r\n');
  assert.equal(lines.length, ROWS.length + 1);
  assert.equal(
    lines[0],
    'Census,Black population,Total population,Black share of total,Census category',
  );
  assert.equal(lines[1], '1790,757208,3929214,19.3%,Negro / Black');
  assert.equal(lines[9], '1870 (undercount),4880009,38558371,12.7%,Negro / Black');
  table.rows.forEach((row, index) => {
    const cells = lines[index + 1]!.split(',');
    // The table prints 757,208 where the file writes 757208: the same number.
    row.forEach((cell, column) => assert.equal(cell.text.replace(/,/g, ''), cells[column]));
  });
  assert.equal(
    figureCsv({ columns: ['a'], rows: [[{ text: 'x', csv: 'he said "no", twice' }]] }),
    'a\r\n"he said ""no"", twice"',
  );
});

test('Plain is the default view; only the three names are accepted', () => {
  assert.equal(parseFigureView(undefined), 'plain');
  assert.equal(parseFigureView('Portrait'), 'portrait');
  assert.equal(parseFigureView(['numbers', 'plain']), 'numbers');
  assert.equal(parseFigureView('spiral'), 'plain');
});

/* —— folded bars: length ——————————————————————————————————————————————————— */

const RATIO = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthRatioLongArc!;
const RATIO_ID = RATIO.series[0]!.id;
const ratioOf = (index: number) => RATIO.points[index]!.values[RATIO_ID]!;

test('folded bar geometry: every bar is as long as its value times the one scale, turns included', () => {
  for (const layout of Object.values(FOLD_LAYOUTS)) {
    const geometry = foldedBars(
      RATIO.points.map((point) => ({ key: point.period, value: point.values[RATIO_ID] ?? null })),
      layout,
    );
    assert.equal(geometry.bars.length, RATIO.points.length);
    geometry.bars.forEach((bar, index) => {
      const expected = ratioOf(index) * layout.unit;
      assert.ok(
        within(polylineLength(bar.points), expected),
        `${bar.key}: ${polylineLength(bar.points)} is not ${expected}`,
      );
      // No run leaves the plot, so a value printed past a bar's end stays on the drawing.
      for (const point of bar.points) {
        assert.ok(
          point.x >= layout.gutter - 1e-9 && point.x <= layout.gutter + geometry.run + 1e-9,
        );
      }
      // Every bar starts at the one left edge, so bars compare by length from a common base.
      assert.equal(bar.points[0]!.x, layout.gutter);
    });
    // Only a bar longer than the run turns back; a bar that fits is one straight segment.
    geometry.bars.forEach((bar, index) => {
      assert.equal(bar.points.length > 2, ratioOf(index) * layout.unit > geometry.run, bar.key);
    });
    // Bars never share a row: each starts below the last run of the one before it.
    geometry.bars.slice(1).forEach((bar, index) => {
      const before = geometry.bars[index]!;
      const lowest = Math.max(...before.points.map((point) => point.y));
      assert.ok(bar.y - lowest >= layout.thickness + 3, `${bar.key} overlaps ${before.key}`);
    });
  }
});

test('D-09 Portrait as rendered: drawn length over value is one constant, in both drawings', () => {
  const figure = FIGURES['D-09'].fromRows(seriesData(RATIO)!);
  const markup = renderToStaticMarkup(<>{figure.portrait}</>);
  for (const [size, svg] of Object.entries(svgs(markup))) {
    const bars = svg.match(/<path class="ds-portrait__stretch"[^>]*>/g) ?? [];
    assert.equal(bars.length, RATIO.points.length, `${size}: one bar for each year measured`);
    const unit = FOLD_LAYOUTS[size as 'narrow' | 'wide'].unit;
    const lengths = bars.map((tag, index) => {
      const point = RATIO.points[index]!;
      assert.equal(attr(tag, 'data-bar'), point.period);
      assert.equal(Number(attr(tag, 'data-value')), ratioOf(index));
      const length = polylineLength(pointsOf(attr(tag, 'd')));
      assert.ok(within(length / ratioOf(index), unit), `${size} ${point.period}: ${length}`);
      // Printed at the bar's end as the table prints it, with its year at the start.
      assert.ok(svg.includes(`>${figure.table.rows[index]![1]!.text}<`), `${point.period} value`);
      assert.ok(svg.includes(`>${point.period}<`), `${point.period} year`);
      return length;
    });
    // The longest bar is the largest ratio and the shortest the smallest.
    const values = RATIO.points.map((_, index) => ratioOf(index));
    assert.equal(lengths.indexOf(Math.max(...lengths)), values.indexOf(Math.max(...values)));
    assert.equal(lengths.indexOf(Math.min(...lengths)), values.indexOf(Math.min(...values)));
    // The fill is the measured quantity: sand, with an ink outline under it.
    assert.equal((svg.match(/data-tone="sand"/g) ?? []).length, RATIO.points.length);
    assert.equal((svg.match(/class="ds-portrait__edge"/g) ?? []).length, RATIO.points.length);
  }
});

test('folded bars: a year with no value is a gap that says "no data", not a short bar', () => {
  const missing = {
    ...RATIO,
    points: RATIO.points.map((point, index) => (index === 3 ? { ...point, values: {} } : point)),
  };
  const figure = FIGURES['D-09'].fromRows(seriesData(missing)!);
  const year = missing.points[3]!.period;
  for (const [size, svg] of Object.entries(svgs(renderToStaticMarkup(<>{figure.portrait}</>)))) {
    const gap = (svg.match(/<path class="ds-portrait__stretch"[^>]*>/g) ?? []).find(
      (tag) => attr(tag, 'data-bar') === year,
    )!;
    assert.equal(attr(gap, 'data-tone'), 'gap');
    assert.equal(attr(gap, 'data-value'), 'none');
    assert.ok(
      within(polylineLength(pointsOf(attr(gap, 'd'))), FOLD_LAYOUTS[size as 'narrow' | 'wide'].gap),
    );
    assert.ok(svg.includes('>no data<'));
  }
  assert.equal(figure.table.rows[3]![1]!.text, 'no data');
  assert.equal(figureCsv(figure.table).split('\r\n')[4], `${year},no data`);
});

test('a folded bar is drawn only for one series; two series have no Portrait', () => {
  const two = seriesData(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.nationalHomeownershipLongArc)!;
  assert.equal(FIGURES['D-09'].fromRows(two).portrait, undefined);
});

/* —— the registry and the view parameter ——————————————————————————————————— */

test('only the figures whose form was built and tested have a Portrait', () => {
  // Plain and Numbers are every figure's; a Portrait is the exception and is listed here.
  assert.deepEqual(
    FIGURE_IDS.filter((id) => FIGURES[id].hasPortrait),
    ['D-01', 'D-02', 'D-09'],
  );
});

test('each figure keeps its own view in one URL parameter', () => {
  const views = parseFigureViews('D-01:portrait,D-09:numbers');
  assert.equal(figureViewOf(views, 'D-01'), 'portrait');
  assert.equal(figureViewOf(views, 'D-09'), 'numbers');
  assert.equal(figureViewOf(views, 'D-05'), 'plain');
  // Changing one figure leaves the others where they are; Plain everywhere carries no parameter.
  assert.equal(
    figureViewsParam(views, 'D-05', 'numbers'),
    'D-01:portrait,D-09:numbers,D-05:numbers',
  );
  assert.equal(figureViewsParam(views, 'D-01', 'plain'), 'D-09:numbers');
  assert.equal(figureViewsParam(parseFigureViews(undefined), 'D-01', 'plain'), undefined);
  // The page-wide form phase 6a shipped still opens every figure in that view.
  const all = parseFigureViews('numbers');
  assert.equal(figureViewOf(all, 'D-12'), 'numbers');
  assert.equal(figureViewsParam(all, 'D-12', 'plain'), 'numbers,D-12:plain');
  assert.equal(figureViewOf(parseFigureViews('numbers,D-12:plain'), 'D-12'), 'plain');
  // Anything unknown is dropped, never guessed.
  assert.deepEqual(parseFigureViews('D-01:spiral,weird').byId, {});
  assert.equal(parseFigureViews(['D-02:numbers', 'portrait']).all, 'portrait');
});
