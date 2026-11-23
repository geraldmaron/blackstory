/**
 * Which figures a record gets, what its scope label says, and what the receipt says about the
 * build of the data (docs/ui/DESIGN.md sections 9.3 and 9.5, controls from review rows 5 and 7).
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { DATA_PAGE_INDICATOR_FIXTURE_BUNDLE as BUNDLE } from '@repo/domain/statistics/data-page-series';
import { D05 } from './census';
import { FigureBody } from './FigureBody';
import {
  coverageFromGeography,
  figureAsOf,
  figuresForRecord,
  recordScope,
  seriesScope,
} from './figure-coverage';
import type { FigureFacts } from './figure-spec';
import { FIGURES } from './registry';
import { pairData, seriesData } from './indicators';
import { formatRecordDate } from '../../patterns/format-record-date';

void React;

const STATE_ROWS = [
  { stateFips: '13', stateName: 'Georgia', blackAbsoluteChange: 364_271, shareChangePp: 0.6 },
  { stateFips: '17', stateName: 'Illinois', blackAbsoluteChange: -58_225, shareChangePp: -0.4 },
];

/** The registry's coverage as the live series state it, in registry order. */
const FACTS: readonly FigureFacts[] = [
  { id: 'D-01', coverage: { level: 'nation' } },
  { id: 'D-05', coverage: { level: 'state', states: ['Georgia', 'Illinois', 'Maryland'] } },
  { id: 'D-07', coverage: { level: 'nation' }, themeId: 'wealth_gap' },
  {
    id: 'D-10',
    coverage: { level: 'county', county: 'Cook County', state: 'Illinois' },
    themeId: 'redlining',
  },
  {
    id: 'D-11',
    coverage: { level: 'county', county: 'Cook County', state: 'Illinois' },
    themeId: 'redlining',
  },
  { id: 'D-12', coverage: { level: 'nation' }, themeId: 'redlining' },
  { id: 'D-13', themeId: 'redlining' },
  { id: 'D-14', themeId: 'drug_policy_state' },
  { id: 'D-15', coverage: { level: 'state', states: ['Maryland'] }, themeId: 'drug_policy_state' },
];

const ids = (record: Parameters<typeof figuresForRecord>[0]) =>
  figuresForRecord(record, FACTS).map((pick) => pick.id);

test('a series’ own geography label is its coverage; an unmatched place covers nothing', () => {
  assert.deepEqual(coverageFromGeography('United States'), { level: 'nation' });
  assert.deepEqual(coverageFromGeography('United States (federal)'), { level: 'nation' });
  assert.deepEqual(coverageFromGeography('Maryland'), { level: 'state', states: ['Maryland'] });
  assert.deepEqual(coverageFromGeography('Cook County, Illinois'), {
    level: 'county',
    county: 'Cook County',
    state: 'Illinois',
  });
  assert.equal(coverageFromGeography('Somewhere'), undefined);
  // Parsed as a county named "Suburban Cook County", which no record's county is called.
  assert.deepEqual(
    figuresForRecord({ id: 'r', state: 'Illinois', county: 'Cook County' }, [
      { id: 'D-13', coverage: coverageFromGeography('Suburban Cook County, Illinois')! },
    ]),
    [],
  );
});

test('the fixture series place the registry figures where the coverage rule expects', async () => {
  const facts = async (
    id: keyof typeof FIGURES,
    data: Parameters<typeof D05.fromRows>[0] | object,
  ) => (FIGURES[id].fromRows as (rows: unknown) => { coverage?: unknown })(data).coverage;
  assert.deepEqual(await facts('D-10', seriesData(BUNDLE.cookHomeownership)!), {
    level: 'county',
    county: 'Cook County',
    state: 'Illinois',
  });
  assert.deepEqual(await facts('D-12', seriesData(BUNDLE.nationalHomeownershipLongArc)!), {
    level: 'nation',
  });
  assert.deepEqual(await facts('D-15', pairData(BUNDLE.imprisonmentComparison, 'pair')!), {
    level: 'state',
    states: ['Maryland'],
  });
  // The ratio restates its pair figure and is never placed on a record.
  assert.equal(await facts('D-14', pairData(BUNDLE.imprisonmentComparison, 'ratio')!), undefined);
  assert.deepEqual(await facts('D-05', { rows: STATE_ROWS, sources: [] }), {
    level: 'state',
    states: ['Georgia', 'Illinois'],
  });
});

test('a record gets a figure only where the figure’s rows cover it', () => {
  // A state the state-by-state figure holds.
  assert.deepEqual(ids({ id: 'r', state: 'Georgia' }), ['D-05']);
  // A state no figure holds: nothing, and never a national series in its place.
  assert.deepEqual(ids({ id: 'r', state: 'Ohio' }), []);
  // No state at all.
  assert.deepEqual(ids({ id: 'r' }), []);
  // One state's own series comes before the comparison of states.
  assert.deepEqual(ids({ id: 'r', state: 'Maryland' }), ['D-15', 'D-05']);
  // A county series needs the county: the state alone is not enough.
  assert.deepEqual(ids({ id: 'r', state: 'Illinois' }), ['D-05']);
  assert.deepEqual(ids({ id: 'r', state: 'Illinois', county: 'DuPage County' }), ['D-05']);
  // In the county: the two county series, and the limit of two drops the state comparison.
  assert.deepEqual(ids({ id: 'r', state: 'Illinois', county: 'Cook County' }), ['D-10', 'D-11']);
  // The same county name in another state is another county.
  assert.deepEqual(ids({ id: 'r', state: 'Georgia', county: 'Cook County' }), ['D-05']);
});

test('a national series is shown only on a federal law the figure is about', () => {
  const fairHousing = { id: 'ent_law_fair_housing_act_1968', nationwide: true };
  assert.deepEqual(ids(fairHousing), ['D-12']);
  assert.equal(figuresForRecord(fairHousing, FACTS)[0]!.scope.label, 'National series');
  // A federal law no theme lists gets nothing, though eleven national figures exist.
  assert.deepEqual(ids({ id: 'ent_law_other', nationwide: true }), []);
  // A place is not a jurisdiction: the same id without one gets nothing.
  assert.deepEqual(ids({ id: 'ent_law_fair_housing_act_1968' }), []);
});

test('a quiet record gets only a figure about its subject, in the quiet frame', () => {
  assert.deepEqual(ids({ id: 'r', state: 'Maryland', quiet: true }), []);
  assert.deepEqual(ids({ id: 'r', state: 'Illinois', county: 'Cook County', quiet: true }), []);
  const picks = figuresForRecord(
    { id: 'ent_law_fair_housing_act_1968', nationwide: true, quiet: true },
    FACTS,
  );
  assert.deepEqual(
    picks.map((pick) => [pick.id, pick.quiet]),
    [['D-12', true]],
  );
});

test('the scope label names the geography the rows cover, never the record', () => {
  const [state, compared] = figuresForRecord({ id: 'r', state: 'Maryland' }, FACTS);
  assert.equal(state!.scope.label, 'Statewide context: Maryland');
  assert.match(state!.scope.note, /the state as a whole, not this record/);
  assert.equal(state!.focus, undefined);
  assert.equal(compared!.scope.label, 'Statewide context: Maryland');
  assert.match(compared!.scope.note, /compares 3 states and territories/);
  assert.equal(compared!.focus, 'Maryland');
  const [county] = figuresForRecord({ id: 'r', state: 'Illinois', county: 'Cook County' }, FACTS);
  assert.equal(county!.scope.label, 'County context: Cook County, Illinois');
  assert.equal(recordScope({ level: 'nation' }, { id: 'r', state: 'Ohio' }), undefined);
  assert.equal(seriesScope({ level: 'nation' }).label, 'National series');
  assert.equal(
    seriesScope({ level: 'county', county: 'Cook County', state: 'Illinois' }).label,
    'County series: Cook County, Illinois',
  );
  assert.equal(
    seriesScope({ level: 'state', states: ['Maryland'] }).label,
    'State series: Maryland',
  );
});

test('the receipt dates the build, says when a story’s build has moved, and invents no date', () => {
  const july = '2026-07-22T00:00:00.000Z';
  const november = '2026-11-20T09:30:00.000Z';
  assert.equal(figureAsOf(undefined, undefined, formatRecordDate), undefined);
  assert.deepEqual(figureAsOf(july, undefined, formatRecordDate), {
    text: 'Figure as of July 22, 2026.',
    drifted: false,
  });
  assert.deepEqual(figureAsOf(july, july, formatRecordDate), {
    text: 'Figure as of July 22, 2026, the version this story was written against.',
    drifted: false,
  });
  const moved = figureAsOf(november, july, formatRecordDate)!;
  assert.equal(moved.drifted, true);
  assert.match(moved.text, /written against the figure as of July 22, 2026/);
  assert.match(moved.text, /rebuilt on November 20, 2026, and this drawing is the current figure/);
  // Two builds on one day are still two builds.
  assert.match(
    figureAsOf('2026-07-22T15:00:00.000Z', july, formatRecordDate)!.text,
    /rebuilt later that day, and this drawing is the current figure/,
  );
  // A source that keeps no build date: the story's date stands, and the page says what it cannot tell.
  assert.match(
    figureAsOf(undefined, july, formatRecordDate)!.text,
    /as of July 22, 2026\. Its source keeps no build date/,
  );
  // An unreadable stored date is not printed as one.
  assert.deepEqual(figureAsOf(july, 'last summer', formatRecordDate), {
    text: 'Figure as of July 22, 2026.',
    drifted: false,
  });
});

test('an embed states its scope first and in the label, marks the record’s state, and holds every view', () => {
  const data = D05.fromRows({ rows: STATE_ROWS, sources: [], focus: 'Georgia' });
  const markup = renderToStaticMarkup(
    <FigureBody
      id="D-05"
      data={data}
      view="plain"
      hrefs={{ portrait: '/data/D-05', plain: '/data/D-05', numbers: '/data/D-05' }}
      citeUrl="https://example.test/data/D-05"
      accessed="2026-11-23T00:00:00.000Z"
      elsewhere={{ href: '/data/D-05', label: 'This figure on its own page' }}
      scope={{ label: 'Statewide context: Georgia', note: 'It describes Georgia as a whole.' }}
      asOf="Figure as of July 22, 2026."
      inPlace
    />,
  );
  // The scope comes before the finding.
  assert.ok(markup.indexOf('Statewide context: Georgia') < markup.indexOf('id="D-05-finding"'));
  assert.match(markup, /Georgia: \+364,271 Black residents, 2010 to 2020\./);
  // And in the exhibit's own label, with the figure's years.
  assert.match(markup, /<span>Statewide context: Georgia · 2010 to 2020<\/span>/);
  // Both views are in the page; the switch is a radio group that needs no script or address.
  assert.match(markup, /role="radiogroup"/);
  assert.match(markup, /type="radio" name="view-D-05" checked="" value="plain"/);
  assert.match(markup, /data-figure-view="plain"/);
  assert.match(markup, /data-figure-view="numbers"/);
  assert.doesNotMatch(markup, /data-figure-view="portrait"/);
  // The record's state is marked in the chart and in the table, once each.
  assert.equal(markup.match(/data-focus=""/g)?.length, 2);
  assert.match(markup, /Figure as of July 22, 2026\./);
  assert.match(markup, /href="\/data\/D-05">This figure on its own page/);
  assert.match(markup, /ds-exhibit--full/);
});

test('a quiet embed uses the quiet frame; a figure on /data is unchanged by the embed props', () => {
  const data = D05.fromRows({ rows: STATE_ROWS, sources: [] });
  const base = {
    id: 'D-05',
    data,
    view: 'plain' as const,
    hrefs: { portrait: '/data', plain: '/data', numbers: '/data?view=numbers' },
    citeUrl: 'https://example.test/data/D-05',
    accessed: '2026-11-23T00:00:00.000Z',
  };
  assert.match(renderToStaticMarkup(<FigureBody {...base} inPlace quiet />), /ds-exhibit--quiet/);
  const page = renderToStaticMarkup(<FigureBody {...base} />);
  assert.doesNotMatch(page, /data-figure-view|data-focus|radiogroup|Figure as of|context:/);
  assert.match(page, /href="\/data\?view=numbers"/);
});
