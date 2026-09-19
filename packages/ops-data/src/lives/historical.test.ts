import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LivesGeographyLevel } from './decennial.js';
import {
  LIVES_HISTORICAL_DATASETS,
  LIVES_HISTORICAL_MEASURES,
  buildHistoricalObservations,
  expectedHistoricalCoverage,
  historicalCoverageKey,
  livesHistoricalExtractDefinition,
  readHistoricalFileName,
  type LivesHistoricalCensus,
  type LivesHistoricalFile,
} from './historical.js';

type Column = readonly [code: string, description: string, value: string];

function historicalFile(
  census: LivesHistoricalCensus,
  level: LivesGeographyLevel,
  columns: readonly Column[],
  state = '48',
): LivesHistoricalFile {
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

function byMetric(files: readonly LivesHistoricalFile[]) {
  return buildHistoricalObservations(files).map((o) => [
    o.metricId,
    o.raceEthnicitySlice,
    Math.round(o.estimate * 10) / 10,
  ]);
}

/** 1870_cPAX carries the race table and the total, and is the only 1870 dataset in one file. */
const RACE_1870: Column[] = [
  ['AJ3001', 'Total', '1000'],
  ['AK3001', 'White', '800'],
  ['AK3002', 'Colored', '190'],
  ['AK3003', 'Chinese', '6'],
  ['AK3004', 'Indian', '4'],
];

const ATTENDING_1870: Column[] = [
  ['AJ5001', 'White >> Male', '100'],
  ['AJ5002', 'White >> Female', '90'],
  ['AJ5003', 'Colored >> Male', '20'],
  ['AJ5004', 'Colored >> Female', '10'],
];

const SCHOOL_AGE_1870: Column[] = [
  ['AMN001', 'White >> Male', '250'],
  ['AMN002', 'White >> Female', '250'],
  ['AMN003', 'Colored >> Male', '50'],
  ['AMN004', 'Colored >> Female', '50'],
];

test('the extract asks each published volume for its tables, breakdowns and geography levels', () => {
  const definition = livesHistoricalExtractDefinition() as {
    datasets: Record<
      string,
      { dataTables: string[]; geogLevels: string[]; breakdownValues?: string[] }
    >;
  };
  assert.deepEqual(
    Object.keys(definition.datasets).sort(),
    Object.keys(LIVES_HISTORICAL_DATASETS).sort(),
  );
  assert.deepEqual(definition.datasets['1870_cPAX']!.dataTables, ['NT4', 'NT1', 'NT11', 'NT16']);
  assert.deepEqual(definition.datasets['1870_sPHX']!.dataTables, ['NT41', 'NT47']);
  assert.deepEqual(definition.datasets['1960_cPop']!.geogLevels, ['nation', 'state']);
  // Only the 1970 datasets have breakdowns; the rest keep race inside the variable description.
  assert.equal(definition.datasets['1930_cAg']!.breakdownValues, undefined);
  assert.deepEqual(definition.datasets['1970_Cnt2']!.breakdownValues, ['bs01.ge000']);
  assert.ok(definition.datasets['1970_Cnt4Pb']!.breakdownValues!.includes('bs02.ch235'));
  // The 1970 sample file and the 1930 farm table carry their detail for states but not the nation.
  assert.deepEqual(definition.datasets['1970_Cnt4Pb']!.geogLevels, ['state']);
  assert.deepEqual(definition.datasets['1930_cAg']!.geogLevels, ['state']);
  assert.deepEqual(definition.datasets['1970_Cnt1']!.geogLevels, ['nation', 'state']);
  assert.ok(definition.datasets['1930_cFH']!.dataTables.includes('NT22'));
  assert.ok(definition.datasets['1930_cFH']!.dataTables.includes('NT17'));
});

test('file names give the census year and geography level, and skip years this loader does not read', () => {
  assert.deepEqual(readHistoricalFileName('nhgis0023_csv/nhgis0023_ds14_1870_state.csv'), {
    census: 1870,
    level: 'state',
  });
  assert.deepEqual(readHistoricalFileName('nhgis0023_ds94_1970_nation.csv'), {
    census: 1970,
    level: 'nation',
  });
  assert.equal(readHistoricalFileName('nhgis0023_ds14_1870_state_codebook.txt'), null);
  assert.equal(readHistoricalFileName('nhgis0023_ds120_1980_state.csv'), null);
});

test('1870 population shares read each race against the published total', () => {
  const file = historicalFile(1870, 'state', RACE_1870);
  assert.deepEqual(byMetric([file]), [
    ['lives-population', 'black', 19],
    ['lives-population', 'white', 80],
  ]);
  const [black] = buildHistoricalObservations([file]);
  assert.equal(black!.id, 'obs:lives-population:state:48:1870:black');
  assert.equal(black!.referencePeriod, '1870');
  assert.equal(black!.boundaryVersion, 'state-1870');
  assert.equal(black!.marginOfError, null);
  assert.deepEqual([black!.numerator, black!.denominator], [190, 1000]);
  assert.equal(black!.metadata.nhgisTable, '1870_cPAX NT4 (AK3) over 1870_cPAX NT1 (AJ3)');
  assert.match(black!.source, /^Census Bureau, 1870 Census, Population, Agriculture/);
  assert.match(black!.sourceUrl, /^https:\/\/www\.census\.gov\//);
  // 1870 counted Chinese and Indian in their own columns, so "Colored" there is Black.
  assert.match(black!.metadata.note!, /"Colored" in 1870 is Black/);
});

test('a cell whose published description has moved fails loudly, naming both texts', () => {
  const moved = historicalFile(1870, 'state', [
    ['AJ3001', 'Total', '1000'],
    ['AK3001', 'White', '800'],
    ['AK3002', 'Colored people', '190'],
  ]);
  assert.throws(
    () => buildHistoricalObservations([moved]),
    /1870_cPAX NT4 \(AK3\) AK3002: expected "Colored", found AK3002 "Colored people"/,
  );
});

test('school attendance divides one dataset by another, and needs both files to load', () => {
  const only = historicalFile(1870, 'state', [...RACE_1870, ...ATTENDING_1870]);
  assert.deepEqual(byMetric([only]), [
    ['lives-population', 'black', 19],
    ['lives-population', 'white', 80],
  ]);

  const both = [only, historicalFile(1870, 'state', SCHOOL_AGE_1870)];
  assert.deepEqual(byMetric(both), [
    ['lives-population', 'black', 19],
    ['lives-population', 'white', 80],
    ['lives-school-attendance', 'black', 30],
    ['lives-school-attendance', 'white', 38],
  ]);
  const attendance = buildHistoricalObservations(both).find(
    (o) => o.metricId === 'lives-school-attendance' && o.raceEthnicitySlice === 'black',
  )!;
  assert.deepEqual([attendance.numerator, attendance.denominator], [30, 100]);
  assert.equal(attendance.metadata.nhgisTable, '1870_cPAX NT11 (AJ5) over 1870_sPHX NT41 (AMN)');
  assert.match(attendance.datasetVintage, /^1870 Census, .* and 1870 Census, /);
});

test('an 1870 literacy rate is the complement of the published "cannot write" count', () => {
  const observations = buildHistoricalObservations([
    historicalFile(1870, 'nation', [
      ['AKA005', 'White >> 21 years of age and over >> Male', '100'],
      ['AKA011', 'Colored >> 21 years of age and over >> Male', '600'],
      ['AMT001', 'White', '1000'],
      ['AMT002', 'Colored', '1000'],
    ]),
  ]);
  assert.deepEqual(
    observations.map((o) => [o.raceEthnicitySlice, o.estimate, o.numerator, o.denominator]),
    [
      ['black', 40, 400, 1000],
      ['white', 90, 900, 1000],
    ],
  );
  assert.equal(observations[0]!.jurisdictionId, 'nation:US');
  assert.match(observations[0]!.metadata.universe!, /Males 21 years and over/);
});

test('1890 stores the all-non-white "Colored" school figure as nonwhite, never as black', () => {
  const observations = buildHistoricalObservations([
    historicalFile(1890, 'state', [
      ['AUM001', 'Total', '1000'],
      ['AVF001', 'Negro >> 1890', '150'],
      ['AVF002', 'Negro >> 1880', '120'],
      ['AV2001', 'Total', '820'],
      ['AVK005', 'Pupils >> White >> Male', '100'],
      ['AVK006', 'Pupils >> White >> Female', '100'],
      ['AVK007', 'Pupils >> Colored >> Male', '20'],
      ['AVK008', 'Pupils >> Colored >> Female', '20'],
      ['AUN001', 'White: Native-born >> Male', '100'],
      ['AUN002', 'White: Native-born >> Female', '100'],
      ['AUN003', 'White: Foreign-born >> Male', '25'],
      ['AUN004', 'White: Foreign-born >> Female', '25'],
      ['AUN005', 'Colored >> Male', '50'],
      ['AUN006', 'Colored >> Female', '50'],
    ]),
  ]);
  assert.deepEqual(
    observations.map((o) => [o.metricId, o.raceEthnicitySlice, o.estimate]),
    [
      ['lives-population', 'black', 15],
      ['lives-population', 'white', 82],
      ['lives-school-attendance', 'nonwhite', 40],
      ['lives-school-attendance', 'white', 80],
    ],
  );
  // The population share is a Negro column and is Black; the school figure is every non-white group.
  const school = observations.find((o) => o.metricId === 'lives-school-attendance')!;
  assert.equal(school.raceEthnicitySlice, 'nonwhite');
  assert.match(school.metadata.note!, /every non-white group counted together/);
  assert.equal(
    observations.some(
      (o) => o.metricId === 'lives-school-attendance' && o.raceEthnicitySlice === 'black',
    ),
    false,
  );
  // No 1890 measure asks for a Hispanic figure: the census did not publish one.
  assert.equal(
    LIVES_HISTORICAL_MEASURES.some(
      (measure) => measure.census < 1970 && measure.slice === 'spanish_origin',
    ),
    false,
  );
});

test('1970 family income bands parse their own bottom and top boundaries', () => {
  const bands = [
    'Under $1000 (includes $1-$999, none, and loss)',
    '$1000-$1999',
    '$2000-$2999',
    '$3000-$3999',
    '$4000-$4999',
    '$5000-$5999',
    '$6000-$6999',
    '$7000-$7999',
    '$8000-$8999',
    '$9000-$9999',
    '$10000-$11999',
    '$12000-$14999',
    '$15000-$24999',
    '$25000-$49999',
    '$50000 and over',
  ];
  const share = [40, 20, 10, 5, 5, 5, 3, 3, 2, 2, 2, 1, 1, 1, 0];
  const columns: Column[] = [];
  for (const [suffix, group] of [
    ['AB', 'Black'],
    ['AC', 'White'],
    ['AD', 'Spanish American (Hispanic)'],
  ] as const) {
    bands.forEach((band, index) => {
      columns.push([
        `C3T${suffix}${String(index + 1).padStart(3, '0')}`,
        `Total area: ${group}: ${band}`,
        // Every group's base is its own hundred families, so the Black shares read straight off
        // the bands. White and Hispanic carry their whole hundred in the first band; this test is
        // about the Black distribution, and they only have to give the denominator something real.
        String(group === 'Black' ? share[index]! : index === 0 ? 100 : 0),
      ]);
    });
  }

  const observations = buildHistoricalObservations([historicalFile(1970, 'state', columns)]);
  const black = observations.filter((o) => o.raceEthnicitySlice === 'black');
  assert.deepEqual(
    black.slice(0, 3).map((o) => [o.metricId, o.estimate]),
    [
      ['lives-income-bracket-0-1000', 40],
      ['lives-income-bracket-1000-2000', 20],
      ['lives-income-bracket-2000-3000', 10],
    ],
  );
  assert.equal(black.at(-1)!.metricId, 'lives-income-bracket-50000-open');
  assert.equal(black.at(-2)!.metricId, 'lives-income-bracket-25000-50000');
  assert.equal(black.length, 15);
  assert.deepEqual(
    [...new Set(observations.map((o) => o.raceEthnicitySlice))],
    ['black', 'white', 'spanish_origin'],
  );

  // A band whose published boundary has moved is caught before any of the bands are parsed.
  const moved = columns.map((column, index): Column =>
    index === 1 ? [column[0], 'Total area: Black: $1500-$1999', column[2]] : column,
  );
  assert.throws(
    () => buildHistoricalObservations([historicalFile(1970, 'state', moved)]),
    /C3T002: expected "Total area: Black: \$1000-\$1999", found C3TAB002 "Total area: Black: \$1500-\$1999"/,
  );
});

test('the 1970 whole area may be written with an empty name, as Count 2 writes it', () => {
  const races = [
    'White',
    'Negro',
    'Indian',
    'Japanese',
    'Chinese',
    'Filipino',
    'Hawaiian',
    'Korean',
    'Other',
  ];
  const counts = [400, 100, 0, 0, 0, 0, 0, 0, 0];
  const columns = ['Male', 'Female'].flatMap((sex, sexIndex) =>
    races.map((race, raceIndex): Column => [
      `CEB${String(sexIndex * races.length + raceIndex + 1).padStart(3, '0')}`,
      `: ${sex} >> ${race}`,
      String(counts[raceIndex]!),
    ]),
  );
  assert.deepEqual(byMetric([historicalFile(1970, 'state', columns)]), [
    ['lives-population', 'black', 20],
    ['lives-population', 'white', 80],
  ]);
});

test('a 1970 urban or race breakdown must be written out, never guessed from the whole area', () => {
  const relationship = [
    'Male primary individual',
    'Female primary individual',
    'Family head of household with male head',
    'Family head of household with female head',
    'Wife of head',
    'Child of head',
    'Other relative of head',
    'Nonrelative (includes roomer, boarder or lodger) of head of household',
    'Male inmate of institution',
    'Female inmate of institution',
    'Male in other group quarters',
    'Female in other group quarters',
  ];
  const block = (suffix: string, breakdown: string, first: number): Column[] =>
    relationship.map((cell, index): Column => [
      `C1V${suffix}${String(index + 1).padStart(3, '0')}`,
      `${breakdown}: ${cell}`,
      index === 0 ? String(first) : '0',
    ]);
  const columns = [
    ...block('', 'Total area: All races', 1000),
    ...block('AA', 'Total area: White', 800),
    ...block('AB', 'Total area: Black', 100),
    ...block('AC', 'Total area: Spanish American (Hispanic)', 50),
    ...block('AD', 'Urban: All races', 700),
    ...block('AE', 'Urban: White', 520),
    ...block('AF', 'Urban: Black', 90),
    ...block('AG', 'Urban: Spanish American (Hispanic)', 45),
  ];
  assert.deepEqual(byMetric([historicalFile(1970, 'state', columns)]), [
    ['lives-population', 'spanish_origin', 5],
    ['lives-urban', 'black', 90],
    ['lives-urban', 'white', 65],
    ['lives-urban', 'spanish_origin', 90],
  ]);

  // A file that carries only the whole area has no urban column to find, and says so.
  const wholeAreaOnly = columns.filter(([, description]) => !description.startsWith('Urban'));
  assert.throws(
    () => buildHistoricalObservations([historicalFile(1970, 'state', wholeAreaOnly)]),
    /expected "Urban: Black: Male primary individual"/,
  );
});

test('a historical state code is three digits, and a territory is not a present-day state', () => {
  const columns: Column[] = [
    ['AJ3001', 'Total', '1000'],
    ['AK3001', 'White', '800'],
    ['AK3002', 'Colored', '190'],
  ];
  // "090" is Connecticut and "095" is Dakota Territory: the trailing digit is the whole difference.
  const connecticut = historicalFile(1870, 'state', columns, '090');
  const dakota = historicalFile(1870, 'state', columns, '095');
  assert.deepEqual(
    buildHistoricalObservations([connecticut]).map((o) => o.jurisdictionId),
    ['state:09', 'state:09'],
  );
  assert.deepEqual(buildHistoricalObservations([dakota]), []);
  assert.deepEqual(
    buildHistoricalObservations([historicalFile(1870, 'state', columns, '720')]),
    [],
  );
});

test('a place with an empty cell or an empty base is skipped rather than half loaded', () => {
  assert.deepEqual(
    buildHistoricalObservations([
      historicalFile(1870, 'state', [
        ['AJ3001', 'Total', '1000'],
        ['AK3001', 'White', ''],
        ['AK3002', 'Colored', '190'],
      ]),
    ]).map((o) => o.raceEthnicitySlice),
    ['black'],
  );
  assert.deepEqual(
    buildHistoricalObservations([
      historicalFile(1870, 'state', [
        ['AJ3001', 'Total', '0'],
        ['AK3001', 'White', '0'],
        ['AK3002', 'Colored', '0'],
      ]),
    ]),
    [],
  );
});

test('every measure has a coverage key the run can check, and every slice is one the domain knows', () => {
  const expected = new Set(expectedHistoricalCoverage());
  assert.equal(expected.size, LIVES_HISTORICAL_MEASURES.length);
  assert.ok(expected.has('1930 1930_cFH NT8 (BGV) lives-homeownership black'));
  assert.ok(expected.has('1930 1930_cFH NT22 (BF1) lives-median-rent black'));
  assert.ok(expected.has('1930 1930_cFH NT16 (BFW) lives-median-home-value all'));
  assert.ok(expected.has('1970 1970_Cnt4Pb NT75 (C3T) lives-income-bracket-* spanish_origin'));
  for (const observation of buildHistoricalObservations([
    historicalFile(1870, 'state', RACE_1870),
  ])) {
    assert.ok(expected.has(historicalCoverageKey(observation)));
  }
  const slices = new Set(LIVES_HISTORICAL_MEASURES.map((measure) => measure.slice));
  assert.deepEqual([...slices].sort(), ['all', 'black', 'nonwhite', 'spanish_origin', 'white']);
});

test('1930 median rent and value are stored as printed dollars, never as a share', () => {
  const file = historicalFile(1930, 'nation', [
    ['BFX003', 'Median value of non-farm homes >> Negro', '2088'],
    ['BFW001', 'Median value of non-farm homes', '4778'],
    ['BF1003', 'Median monthly rent >> Negro', '13.22'],
    ['BF0001', 'Median monthly rent', '27.15'],
  ]);
  const observations = buildHistoricalObservations([file]);
  assert.deepEqual(
    observations.map((o) => [o.metricId, o.raceEthnicitySlice, o.estimate, o.denominator]),
    [
      ['lives-median-home-value', 'black', 2088, null],
      ['lives-median-home-value', 'all', 4778, null],
      ['lives-median-rent', 'black', 13.22, null],
      ['lives-median-rent', 'all', 27.15, null],
    ],
  );
});
