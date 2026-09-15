import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_DECENNIAL_DATASETS,
  buildDecennialObservations,
  decennialCoverageKey,
  expectedDecennialCoverage,
  livesDecennialExtractDefinition,
  readDecennialFileName,
  type LivesCensusYear,
  type LivesDecennialFile,
  type LivesGeographyLevel,
} from './decennial.js';

type Column = readonly [code: string, description: string, value: string];

const SPANISH_1980 = 'Spanish origin subtotal (subtotal of summaries 20-23)';
const WHITE_NOT_SPANISH_1980 =
  "White not of Spanish origin (on STF4B; not available for MCD's or CCD's under 2500";
const HISPANIC_1990 = 'Hispanic origin (of any race)';
const WHITE_NOT_HISPANIC_1990 = 'White, not of Hispanic origin';

function decennialFile(
  census: LivesCensusYear,
  level: LivesGeographyLevel,
  columns: readonly Column[],
  state = '48',
): LivesDecennialFile {
  const nation = level === 'nation';
  return {
    census,
    level,
    csv: [
      ['GISJOIN', 'YEAR', nation ? 'NATIONA' : 'STATEA', ...columns.map((c) => c[0])],
      [
        'GIS Join Match Code',
        'Data File Year',
        nation ? 'Nation Code' : 'State Code',
        ...columns.map((c) => c[1]),
      ],
      [
        nation ? 'G1' : `G${state}0`,
        String(census),
        nation ? '1' : state,
        ...columns.map((c) => c[2]),
      ],
    ],
  };
}

/** Columns for the same cells under several race or origin breakdowns, as NHGIS names them. */
function breakdownColumns(
  code: string,
  groups: readonly (readonly [suffix: string, label: string, values: readonly string[]])[],
  cells: readonly string[],
): Column[] {
  return groups.flatMap(([suffix, label, values]) =>
    cells.map((cell, index): Column => [
      `${code}${suffix}${String(index + 1).padStart(3, '0')}`,
      `Total area: ${label}: ${cell}`,
      values[index] ?? '',
    ]),
  );
}

function byMetric(file: LivesDecennialFile) {
  return buildDecennialObservations(file).map((o) => [
    o.metricId,
    o.raceEthnicitySlice,
    Math.round(o.estimate * 10) / 10,
  ]);
}

test('the extract asks each summary file for its tables, groups and geography levels', () => {
  const definition = livesDecennialExtractDefinition() as {
    datasets: Record<
      string,
      { dataTables: string[]; geogLevels: string[]; breakdownValues: string[] }
    >;
  };
  assert.deepEqual(
    Object.keys(definition.datasets).sort(),
    Object.keys(LIVES_DECENNIAL_DATASETS).sort(),
  );
  assert.deepEqual(definition.datasets['1980_STF4Pb']!.geogLevels, ['state']);
  assert.deepEqual(definition.datasets['1990_STF3']!.geogLevels, ['nation']);
  assert.deepEqual(definition.datasets['1990_STF2b']!.dataTables, ['NPB1', 'NHB2']);
  assert.deepEqual(definition.datasets['2000_SF1a']!.dataTables, [
    'NP008A',
    'NH014A',
    'NH015I',
    'NH015F',
  ]);
  assert.deepEqual(definition.datasets['2000_SF3a']!.geogLevels, ['nation', 'state']);
  assert.ok(definition.datasets['1990_STF4b']!.breakdownValues.includes('bs10.ch120'));
});

test('file names give the census year and geography level', () => {
  assert.deepEqual(readDecennialFileName('nhgis0021_csv/nhgis0021_ds125_1990_state.csv'), {
    census: 1990,
    level: 'state',
  });
  assert.equal(readDecennialFileName('nhgis0021_ds125_1990_state_codebook.txt'), null);
});

test('1990 population and urban shares read each breakdown against everyone', () => {
  const file = decennialFile(1990, 'state', [
    ['EWZ001', 'Total area: All races: Total', '1000'],
    ['EWZAAB001', 'Total area: Black: Total', '130'],
    ['EWZAAX001', 'Total area: Hispanic origin (of any race): Total', '150'],
    ['EWZABC001', 'Total area: White, not of Hispanic origin: Total', '700'],
    ['EWZABD001', 'Total area: Black, not of Hispanic origin: Total', '120'],
    ['EWZACG001', 'Urban: Hispanic origin (of any race): Total', '135'],
    ['EWZACL001', 'Urban: White, not of Hispanic origin: Total', '350'],
    ['EWZACM001', 'Urban: Black, not of Hispanic origin: Total', '108'],
  ]);
  assert.deepEqual(byMetric(file), [
    ['lives-population', 'black_nh', 12],
    ['lives-population', 'white_nh', 70],
    ['lives-population', 'hispanic', 15],
    ['lives-urban', 'black_nh', 90],
    ['lives-urban', 'white_nh', 50],
    ['lives-urban', 'hispanic', 90],
  ]);
  const [first] = buildDecennialObservations(file);
  assert.equal(first!.id, 'obs:lives-population:state:48:1990:black_nh');
  assert.equal(first!.referencePeriod, '1990');
  assert.equal(first!.boundaryVersion, 'state-1990');
  assert.equal(first!.marginOfError, null);
  assert.deepEqual([first!.numerator, first!.denominator], [120, 1000]);
  assert.equal(first!.metadata.nhgisTable, '1990_STF2b NPB1 (EWZ)');
  assert.match(first!.source, /^Census Bureau, 1990 Census Summary Tape File 2B/);
});

test('2000 population sums every Hispanic race cell and the whole table for everyone', () => {
  const file = decennialFile(2000, 'nation', [
    ['FMS001', 'Total area: Not Hispanic or Latino >> White alone', '600'],
    ['FMS002', 'Total area: Not Hispanic or Latino >> Black or African American alone', '120'],
    ['FMS003', 'Total area: Not Hispanic or Latino >> Asian alone', '40'],
    ['FMS008', 'Total area: Hispanic or Latino >> White alone', '100'],
    ['FMS009', 'Total area: Hispanic or Latino >> Black or African American alone', '10'],
    ['FMS013', 'Total area: Hispanic or Latino >> Some other race alone', '130'],
    ['FMSAA001', 'Urban: Not Hispanic or Latino >> White alone', '480'],
    ['FMSAA002', 'Urban: Not Hispanic or Latino >> Black or African American alone', '108'],
    ['FMSAA003', 'Urban: Not Hispanic or Latino >> Asian alone', '38'],
    ['FMSAA008', 'Urban: Hispanic or Latino >> White alone', '90'],
    ['FMSAA009', 'Urban: Hispanic or Latino >> Black or African American alone', '10'],
    ['FMSAA013', 'Urban: Hispanic or Latino >> Some other race alone', '100'],
  ]);
  const observations = buildDecennialObservations(file);
  const hispanic = observations.find(
    (o) => o.metricId === 'lives-population' && o.raceEthnicitySlice === 'hispanic',
  )!;
  assert.deepEqual([hispanic.numerator, hispanic.denominator], [240, 1000]);
  const urbanBlack = observations.find(
    (o) => o.metricId === 'lives-urban' && o.raceEthnicitySlice === 'black_nh',
  )!;
  assert.deepEqual([urbanBlack.numerator, urbanBlack.denominator], [108, 120]);
  assert.equal(urbanBlack.jurisdictionId, 'nation:US');
});

test('tenure reads a race written after the cell, a table for one group, and hyphenated labels', () => {
  const crossed = decennialFile(2000, 'state', [
    ['FLE001', 'Total area: Owner occupied >> White alone', '700'],
    ['FLE002', 'Total area: Owner occupied >> Black or African American alone', '45'],
    ['FLE008', 'Total area: Renter occupied >> White alone', '300'],
    ['FLE009', 'Total area: Renter occupied >> Black or African American alone', '55'],
    ['FLN001', 'Total area: Owner occupied', '600'],
    ['FLN002', 'Total area: Renter occupied', '200'],
  ]);
  assert.deepEqual(byMetric(crossed), [
    ['lives-homeownership', 'black_alone', 45],
    ['lives-homeownership', 'white_nh', 75],
  ]);
  const hyphenated = decennialFile(
    1980,
    'nation',
    breakdownColumns(
      'DCR',
      [
        ['AB', 'Black', ['40', '50', '10']],
        ['AR', SPANISH_1980, ['30', '60', '10']],
        ['AW', WHITE_NOT_SPANISH_1980, ['70', '25', '5']],
      ],
      ['Owner-occupied', 'Renter-occupied: With cash rent', 'Renter-occupied: No cash rent'],
    ),
  );
  assert.deepEqual(byMetric(hyphenated), [
    ['lives-homeownership', 'black', 40],
    ['lives-homeownership', 'white_nh', 70],
    ['lives-homeownership', 'hispanic', 30],
  ]);
});

test('a table that lacks one of its groups fails loudly', () => {
  const file = decennialFile(1980, 'state', [
    ['DCRAB001', 'Total area: Black: Owner-occupied', '40'],
    ['DCRAB002', 'Total area: Black: Renter-occupied: With cash rent', '60'],
  ]);
  assert.throws(() => buildDecennialObservations(file), /no cells for white_nh/);
});

test('unemployment counts the civilian labor force only, across sexes and ages', () => {
  const file = decennialFile(
    1990,
    'state',
    breakdownColumns(
      'FGI',
      [
        ['AAB', 'Black', ['5', '60', '20', '80', '100', '20']],
        ['AAX', HISPANIC_1990, ['0', '90', '10', '50', '90', '10']],
        ['ABR', WHITE_NOT_HISPANIC_1990, ['1', '95', '5', '40', '95', '5']],
      ],
      [
        'Male >> 16 to 19 years >> In labor force: In Armed Forces',
        'Male >> 16 to 19 years >> In labor force: Civilian: Employed',
        'Male >> 16 to 19 years >> In labor force: Civilian: Unemployed',
        'Male >> 16 to 19 years >> Not in labor force',
        'Female >> 16 to 19 years >> In labor force: Civilian: Employed',
        'Female >> 16 to 19 years >> In labor force: Civilian: Unemployed',
      ],
    ),
  );
  assert.deepEqual(byMetric(file), [
    ['lives-unemployed', 'black', 20],
    ['lives-unemployed', 'white_nh', 5],
    ['lives-unemployed', 'hispanic', 10],
  ]);
  const [black] = buildDecennialObservations(file);
  assert.deepEqual([black!.numerator, black!.denominator], [40, 200]);
});

test('high school completion counts four years of high school or more, and an unknown level fails loudly', () => {
  const levels = [
    'Male >> 25 to 44 years old >> Elementary (0 to 8 years)',
    'Male >> 25 to 44 years old >> High School: 1 to 3 years',
    'Male >> 25 to 44 years old >> High School: 4 years',
    'Male >> 25 to 44 years old >> College: 1 to 3 years',
    'Male >> 25 to 44 years old >> College: 4 or more years',
  ];
  const groups = [
    ['AA', 'White', ['5', '10', '45', '25', '15']],
    ['AB', 'Black', ['10', '20', '40', '20', '10']],
    ['AF', SPANISH_1980, ['30', '20', '30', '10', '10']],
  ] as const;
  assert.deepEqual(
    byMetric(decennialFile(1980, 'state', breakdownColumns('DX4', groups, levels))),
    [
      ['lives-high-school', 'black', 70],
      ['lives-high-school', 'white', 85],
      ['lives-high-school', 'hispanic', 50],
    ],
  );
  assert.throws(
    () =>
      buildDecennialObservations(
        decennialFile(1980, 'state', [
          ...breakdownColumns('DX4', groups, levels),
          ['DX4AB006', 'Total area: Black: Male >> 25 to 44 years old >> Trade school', '5'],
        ]),
      ),
    /unknown schooling level/,
  );
});

test('1980 family income brackets with hyphens load for each race, and a gap fails loudly', () => {
  const columns: Column[] = [
    ['DIM001', 'White >> Less than $5,000', '10'],
    ['DIM002', 'White >> $5,000-$7,499', '30'],
    ['DIM003', 'White >> $7,500 or more', '60'],
    ['DIM010', 'Black >> Less than $5,000', '40'],
    ['DIM011', 'Black >> $5,000-$7,499', '40'],
    ['DIM012', 'Black >> $7,500 or more', '20'],
  ];
  assert.deepEqual(byMetric(decennialFile(1980, 'state', columns)), [
    ['lives-income-bracket-0-5000', 'black', 40],
    ['lives-income-bracket-5000-7500', 'black', 40],
    ['lives-income-bracket-7500-open', 'black', 20],
    ['lives-income-bracket-0-5000', 'white', 10],
    ['lives-income-bracket-5000-7500', 'white', 30],
    ['lives-income-bracket-7500-open', 'white', 60],
  ]);
  assert.throws(
    () =>
      buildDecennialObservations(
        decennialFile(1980, 'state', [
          ...columns.slice(0, 3),
          ['DIM010', 'Black >> Less than $5,000', '40'],
          ['DIM011', 'Black >> $6,000-$7,499', '40'],
          ['DIM012', 'Black >> $7,500 or more', '20'],
        ]),
      ),
    /not contiguous/,
  );
});

test('the national median loads only at the nation, labeled for everyone', () => {
  const nation = buildDecennialObservations(
    decennialFile(1990, 'nation', [['E4U001', 'Median household income in 1989', '30056']]),
  );
  assert.deepEqual(
    nation.map((o) => [o.metricId, o.raceEthnicitySlice, o.estimate, o.jurisdictionId]),
    [['lives-income-median', 'all', 30056, 'nation:US']],
  );
  assert.deepEqual(
    buildDecennialObservations(
      decennialFile(2000, 'state', [['GMY001', 'Median income in 1999', '41000']]),
    ),
    [],
  );
});

test('an empty cell skips the place instead of loading a partial count', () => {
  const file = decennialFile(2000, 'state', [
    ['FLN001', 'Total area: Owner occupied', ''],
    ['FLN002', 'Total area: Renter occupied', '200'],
  ]);
  assert.deepEqual(buildDecennialObservations(file), []);
});

test('coverage keys match the places each table should fill', () => {
  const expected = new Map(expectedDecennialCoverage().map((entry) => [entry.key, entry.places]));
  assert.equal(expected.get('1980 1980_STF4Pb NTPB48 (DX4) lives-high-school hispanic'), 51);
  assert.equal(expected.get('2000 2000_SF3a NP053A (GMY) lives-income-median all'), 1);
  assert.equal(expected.get('1990 1990_STF4b NPB65 (FGU) lives-income-bracket-* white_nh'), 52);
  const observations = buildDecennialObservations(
    decennialFile(
      1990,
      'state',
      breakdownColumns(
        'FGU',
        [
          ['AAB', 'Black', ['20', '80']],
          ['AAX', HISPANIC_1990, ['30', '70']],
          ['ABR', WHITE_NOT_HISPANIC_1990, ['10', '90']],
        ],
        ['Less than $5,000', '$5,000 or more'],
      ),
    ),
  );
  assert.equal(observations.length, 6);
  for (const observation of observations)
    assert.ok(expected.has(decennialCoverageKey(observation)));
});
