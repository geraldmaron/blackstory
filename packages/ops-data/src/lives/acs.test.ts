import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAcsObservations,
  combineMeasures,
  livesAcsTables,
  livesNhgisExtractDefinition,
  nhgisTableToAcs,
  parseCsv,
  readNhgisTableMeta,
  normalizeAcsLabel,
  parseIncomeBracketLabel,
  readAcsLabels,
  readAcsRows,
  readMeasure,
  type LivesAcsTable,
} from './acs.js';

const V2023 = { year: 2023, period: '2019-2023', boundaryYear: 2020 };

function labels(entries: Record<string, string>) {
  return readAcsLabels({
    variables: Object.fromEntries(
      Object.entries(entries).map(([name, label]) => [name, { label: `Estimate!!${label}` }]),
    ),
  });
}

test('labels from both vintages normalize to the same text', () => {
  assert.equal(normalizeAcsLabel('Estimate!!Total:!!Owner occupied'), 'Total!!Owner occupied');
  assert.equal(normalizeAcsLabel('Estimate!!Total!!Owner occupied'), 'Total!!Owner occupied');
});

test('every race table comes in black, white non-Hispanic and Hispanic versions', () => {
  const tables = livesAcsTables();
  assert.equal(tables.length, 14);
  assert.deepEqual(
    tables.filter((t) => t.kind === 'tenure').map((t) => [t.group, t.slice]),
    [
      ['B25003B', 'black_alone'],
      ['B25003H', 'white_nh'],
      ['B25003I', 'hispanic'],
    ],
  );
});

test('annotation codes become a zero or missing margin, and negative estimates are unreadable', () => {
  assert.deepEqual(readMeasure({ X_001E: '10', X_001M: '-555555555' }, 'X_001E'), {
    value: 10,
    moe: 0,
  });
  assert.deepEqual(readMeasure({ X_001E: '10', X_001M: '-222222222' }, 'X_001E'), {
    value: 10,
    moe: null,
  });
  assert.equal(readMeasure({ X_001E: '-666666666' }, 'X_001E'), null);
  assert.equal(readMeasure({ X_001E: null }, 'X_001E'), null);
});

test('a derived count carries the root-sum-of-squares margin', () => {
  const combined = combineMeasures([{ value: 100, moe: 6 }], [{ value: 10, moe: 8 }]);
  assert.equal(combined.value, 90);
  assert.equal(combined.moe, 10);
  assert.equal(combineMeasures([{ value: 1, moe: null }]).moe, null);
});

test('bracket labels parse to exclusive upper edges and an open top', () => {
  assert.deepEqual(parseIncomeBracketLabel('Total!!Less than $10,000'), { lower: 0, upper: 10000 });
  assert.deepEqual(parseIncomeBracketLabel('Total!!$10,000 to $14,999'), {
    lower: 10000,
    upper: 15000,
  });
  assert.deepEqual(parseIncomeBracketLabel('Total!!$200,000 or more'), {
    lower: 200000,
    upper: null,
  });
  assert.equal(parseIncomeBracketLabel('Total'), null);
});

test('tenure rows keep counts and margins, map states and the nation, and skip Puerto Rico', () => {
  const table: LivesAcsTable = {
    group: 'B25003B',
    kind: 'tenure',
    slice: 'black_alone',
    nationOnly: false,
  };
  const rows = readAcsRows([
    ['NAME', 'B25003B_001E', 'B25003B_001M', 'B25003B_002E', 'B25003B_002M', 'state'],
    ['Texas', '1000', '30', '420', '40', '48'],
    ['Puerto Rico', '50', '5', '20', '4', '72'],
    ['Wyoming', '0', '10', '0', '10', '56'],
  ]);
  const observations = buildAcsObservations({
    table,
    vintage: V2023,
    labels: labels({ B25003B_001E: 'Total:', B25003B_002E: 'Total:!!Owner occupied' }),
    rows,
  });
  assert.equal(observations.length, 1);
  const [texas] = observations;
  assert.equal(texas!.id, 'obs:lives-homeownership:state:48:2019-2023:black_alone');
  assert.equal(texas!.estimate, 42);
  assert.equal(texas!.numerator, 420);
  assert.deepEqual(texas!.metadata, { table: 'B25003B', numeratorMoe: 40, denominatorMoe: 30 });
  assert.equal(texas!.boundaryVersion, 'state-2020');
  assert.equal(texas!.sourceUrl, 'https://api.census.gov/data/2023/acs/acs5/groups/B25003B.html');
});

test('population shares come from one table for all three groups', () => {
  const observations = buildAcsObservations({
    table: { group: 'B03002', kind: 'population', slice: null, nationOnly: false },
    vintage: V2023,
    labels: labels({
      B03002_001E: 'Total:',
      B03002_003E: 'Total:!!Not Hispanic or Latino:!!White alone',
      B03002_004E: 'Total:!!Not Hispanic or Latino:!!Black or African American alone',
      B03002_012E: 'Total:!!Hispanic or Latino:',
    }),
    rows: [
      { B03002_001E: '200', B03002_003E: '100', B03002_004E: '50', B03002_012E: '40', us: '1' },
    ],
  });
  assert.deepEqual(
    observations.map((o) => [o.raceEthnicitySlice, o.estimate, o.jurisdictionId]),
    [
      ['black_nh', 25, 'nation:US'],
      ['white_nh', 50, 'nation:US'],
      ['hispanic', 20, 'nation:US'],
    ],
  );
});

test('high school completion is the total less both sexes without a diploma', () => {
  const [obs] = buildAcsObservations({
    table: { group: 'C15002I', kind: 'education', slice: 'hispanic', nationOnly: false },
    vintage: V2023,
    labels: labels({
      C15002I_001E: 'Total:',
      C15002I_003E: 'Total:!!Male:!!Less than high school diploma',
      C15002I_008E: 'Total:!!Female:!!Less than high school diploma',
    }),
    rows: [
      {
        C15002I_001E: '1000',
        C15002I_001M: '0',
        C15002I_003E: '150',
        C15002I_003M: '3',
        C15002I_008E: '100',
        C15002I_008M: '4',
        state: '06',
      },
    ],
  });
  assert.equal(obs!.numerator, 750);
  assert.equal(obs!.estimate, 75);
  assert.equal(obs!.metadata.numeratorMoe, 5);
});

test('unemployment uses the civilian labor force, and the 65-and-over labor force where no civilian split exists', () => {
  const [obs] = buildAcsObservations({
    table: { group: 'C23002B', kind: 'employment', slice: 'black_alone', nationOnly: false },
    vintage: V2023,
    labels: labels({
      C23002B_004E: 'Total:!!Male:!!16 to 64 years:!!In labor force:',
      C23002B_006E: 'Total:!!Male:!!16 to 64 years:!!In labor force:!!Civilian:',
      C23002B_008E: 'Total:!!Male:!!16 to 64 years:!!In labor force:!!Civilian:!!Unemployed',
      C23002B_011E: 'Total:!!Male:!!65 years and over:!!In labor force:',
      C23002B_013E: 'Total:!!Male:!!65 years and over:!!In labor force:!!Unemployed',
    }),
    rows: [
      {
        C23002B_004E: '110',
        C23002B_006E: '100',
        C23002B_008E: '8',
        C23002B_011E: '20',
        C23002B_013E: '2',
        state: '01',
      },
    ],
  });
  assert.equal(obs!.denominator, 120);
  assert.equal(obs!.numerator, 10);
});

test('income brackets become one observation each, and a gap in the layout fails loudly', () => {
  const bracketLabels = {
    B19001H_001E: 'Total:',
    B19001H_002E: 'Total:!!Less than $10,000',
    B19001H_003E: 'Total:!!$10,000 to $14,999',
    B19001H_004E: 'Total:!!$15,000 or more',
  };
  const table: LivesAcsTable = {
    group: 'B19001H',
    kind: 'income',
    slice: 'white_nh',
    nationOnly: false,
  };
  const rows = [
    {
      B19001H_001E: '100',
      B19001H_002E: '10',
      B19001H_003E: '30',
      B19001H_004E: '60',
      state: '48',
    },
  ];
  const observations = buildAcsObservations({
    table,
    vintage: V2023,
    labels: labels(bracketLabels),
    rows,
  });
  assert.deepEqual(
    observations.map((o) => [o.metricId, o.estimate]),
    [
      ['lives-income-bracket-0-10000', 10],
      ['lives-income-bracket-10000-15000', 30],
      ['lives-income-bracket-15000-open', 60],
    ],
  );
  assert.throws(() =>
    buildAcsObservations({
      table,
      vintage: V2023,
      labels: labels({ ...bracketLabels, B19001H_003E: 'Total:!!$11,000 to $14,999' }),
      rows,
    }),
  );
});

test('the national median loads only at the nation, labeled for everyone', () => {
  const table: LivesAcsTable = { group: 'B19013', kind: 'median', slice: 'all', nationOnly: true };
  const observations = buildAcsObservations({
    table,
    vintage: V2023,
    labels: labels({ B19013_001E: 'Median household income' }),
    rows: [
      { B19013_001E: '78538', B19013_001M: '121', us: '1' },
      { B19013_001E: '60000', state: '01' },
    ],
  });
  assert.equal(observations.length, 1);
  assert.equal(observations[0]!.raceEthnicitySlice, 'all');
  assert.equal(observations[0]!.marginOfError, 121);
  assert.equal(observations[0]!.metricId, 'lives-income-median');
});

test('CSV parsing keeps quoted commas and doubled quotes', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi"""\r\n1,,3\n'), [
    ['a', 'b, c', 'say "hi"'],
    ['1', '', '3'],
  ]);
});

test('an NHGIS extract becomes the Census shape, skipping the description row', () => {
  const meta = readNhgisTableMeta({
    name: 'C23002B',
    nhgisCode: 'AS6A',
    variables: [
      { description: 'Total', nhgisCode: 'AS6A001' },
      { description: 'Male: 16 to 64 years: In labor force', nhgisCode: 'AS6A004' },
      { description: 'Male: 16 to 64 years: In labor force: Civilian', nhgisCode: 'AS6A006' },
      {
        description: 'Male: 16 to 64 years: In labor force: Civilian: Unemployed',
        nhgisCode: 'AS6A008',
      },
    ],
  });
  const csv = parseCsv(
    [
      'GISJOIN,YEAR,STATEA,NATIONA,AS6AE001,AS6AE004,AS6AE006,AS6AE008,AS6AM001,AS6AM004,AS6AM006,AS6AM008',
      'GIS Join Match Code,Data File Year,State Code,Nation Code,Total,a,b,c,d,e,f,g',
      '"G480","2019-2023","48",,500,120,100,9,-555555555,10,11,3',
      '"G1","2019-2023",,"1",900,220,200,19,-555555555,20,21,4',
    ].join('\n'),
  );
  const converted = nhgisTableToAcs(meta, csv)!;
  assert.equal(
    converted.labels.get('C23002B_008E'),
    'Total!!Male!!16 to 64 years!!In labor force!!Civilian!!Unemployed',
  );
  assert.equal(converted.rows.length, 2);
  assert.equal(converted.rows[0]!.state, '48');
  assert.equal(converted.rows[1]!.us, '1');
  assert.equal(converted.rows[0]!.C23002B_006M, '11');
  const observations = buildAcsObservations({
    table: { group: 'C23002B', kind: 'employment', slice: 'black_alone', nationOnly: false },
    vintage: V2023,
    labels: converted.labels,
    rows: converted.rows,
  });
  assert.deepEqual(
    observations.map((o) => [o.jurisdictionId, o.numerator, o.denominator]),
    [
      ['state:48', 9, 100],
      ['nation:US', 19, 200],
    ],
  );
  assert.equal(nhgisTableToAcs({ ...meta, nhgisCode: 'ZZZZ' }, csv), null);
});

test('the extract asks each NHGIS dataset for its own tables at nation and state level', () => {
  const definition = livesNhgisExtractDefinition() as {
    datasets: Record<string, { dataTables: string[]; geogLevels: string[] }>;
  };
  assert.deepEqual(Object.keys(definition.datasets).sort(), [
    '2008_2012_ACS5a',
    '2008_2012_ACS5b',
    '2019_2023_ACS5a',
    '2019_2023_ACS5b',
  ]);
  assert.deepEqual(definition.datasets['2019_2023_ACS5a']!.dataTables, [
    'B03002',
    'B19013',
    'B25003B',
    'B25003H',
    'B25003I',
  ]);
  assert.equal(definition.datasets['2008_2012_ACS5b']!.dataTables.length, 9);
  assert.deepEqual(definition.datasets['2008_2012_ACS5b']!.geogLevels, ['nation', 'state']);
});
