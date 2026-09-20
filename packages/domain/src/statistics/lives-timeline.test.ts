import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JUXTAPOSITION_DISCLAIMER } from '../juxtaposition.js';
import { incomeBracketSeriesId, workClassSeriesId } from './lives-metrics.js';
import { LIVES_NATIONAL, livesAreaBySlug } from './lives-regions.js';
import {
  buildLivesAreaBundle,
  livesComparableChange,
  type BuildLivesAreaBundleInput,
  type LivesApplicabilityInput,
  type LivesObservationInput,
} from './lives-timeline.js';

const texasOklahoma = livesAreaBySlug('texas-oklahoma')!;
const jurisdictions = [
  { id: 'nation:US', name: 'United States' },
  { id: 'state:40', name: 'Oklahoma' },
  { id: 'state:48', name: 'Texas' },
  { id: 'state:28', name: 'Mississippi' },
  { id: 'state:04', name: 'Arizona' },
];

function obs(
  overrides: Partial<LivesObservationInput> &
    Pick<LivesObservationInput, 'metricId' | 'jurisdictionId'>,
): LivesObservationInput {
  return {
    referencePeriod: '1960',
    raceEthnicitySlice: 'black',
    estimate: 0,
    numerator: 0,
    denominator: 0,
    source: 'U.S. Census Bureau',
    sourceUrl: 'https://www.census.gov/example',
    ...overrides,
  };
}

function build(overrides: Partial<BuildLivesAreaBundleInput> = {}) {
  return buildLivesAreaBundle({
    area: texasOklahoma,
    jurisdictions,
    observations: [],
    coverage: [],
    countNotes: [],
    applicability: [],
    frames: [],
    ...overrides,
  });
}

const decadeOf = (bundle: ReturnType<typeof build>, decade: number) =>
  bundle.decades.find((d) => d.decade === decade)!;
const condition = (bundle: ReturnType<typeof build>, decade: number, key: string) =>
  decadeOf(bundle, decade).conditions.find((c) => c.key === key)!;

test('every decade and lens is present, with the disclaimer and regime boundaries', () => {
  const bundle = build();
  assert.equal(bundle.decades.length, 16);
  assert.equal(bundle.disclaimer, JUXTAPOSITION_DISCLAIMER);
  assert.equal(decadeOf(bundle, 1940).boundaryFromPrevious, 'different_measure');
  assert.equal(decadeOf(bundle, 1970).boundaryFromPrevious, 'none');
  assert.equal(decadeOf(bundle, 2010).boundaryFromPrevious, 'method_note');
  assert.equal(condition(bundle, 1960, 'homeownership').cells.black.state, 'pending');
});

test('a region figure sums its member states and ignores states elsewhere', () => {
  const bundle = build({
    observations: [
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:48',
        numerator: 300,
        denominator: 1000,
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:40',
        numerator: 200,
        denominator: 1000,
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:28',
        numerator: 900,
        denominator: 1000,
      }),
    ],
  });
  const cell = condition(bundle, 1960, 'homeownership').cells.black;
  assert.equal(cell.state, 'published');
  assert.equal(cell.estimate, 25);
  assert.equal(cell.derived, true);
  assert.match(cell.definitionLabel!, /as the census recorded it/);
});

test('the national baseline prefers a published national figure', () => {
  const bundle = build({
    area: LIVES_NATIONAL,
    observations: [
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'nation:US',
        numerator: 380,
        denominator: 1000,
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:48',
        numerator: 1,
        denominator: 1000,
      }),
    ],
  });
  const cell = condition(bundle, 1960, 'homeownership').cells.black;
  assert.equal(cell.estimate, 38);
  assert.equal(cell.derived, false);
});

test('the most specific published definition stands for a lens', () => {
  const bundle = build({
    observations: [
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:48',
        raceEthnicitySlice: 'white',
        numerator: 700,
        denominator: 1000,
        referencePeriod: '1990',
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:48',
        raceEthnicitySlice: 'white_nh',
        numerator: 650,
        denominator: 1000,
        referencePeriod: '1990',
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:40',
        raceEthnicitySlice: 'white_nh',
        numerator: 700,
        denominator: 1000,
        referencePeriod: '1990',
      }),
    ],
  });
  const cell = condition(bundle, 1990, 'homeownership').cells.white;
  assert.equal(cell.estimate, 67.5);
  assert.equal(cell.definitionLabel, 'White, not Hispanic');
});

test('Hispanic figures are not measured where the census did not count Hispanic origin', () => {
  const bundle = build({
    countNotes: [
      {
        id: 'note-1920-hispanic',
        decade: 1920,
        appliesTo: ['hispanic'],
        areaIds: [],
        heading: 'Not counted',
        body: 'No category.',
        citations: [{ label: 'Pew', url: 'https://www.pewresearch.org/' }],
      },
    ],
  });
  const cell = condition(bundle, 1920, 'literacy').cells.hispanic;
  assert.equal(cell.state, 'not_measured');
  assert.match(cell.reason!, /did not count Hispanic Americans/);
  assert.equal(cell.noteId, 'note-1920-hispanic');
  assert.equal(decadeOf(bundle, 1920).countNotes.length, 1);
});

test('conditions outside the decades they were published are not measured', () => {
  const bundle = build();
  assert.equal(condition(bundle, 1960, 'literacy').cells.black.state, 'not_measured');
  assert.equal(condition(bundle, 1920, 'high_school').cells.white.state, 'not_measured');
});

test('partial coverage below the floor is withheld, and a proxy lists where it was counted', () => {
  const bundle = build({
    observations: [
      obs({
        metricId: 'lives-population',
        jurisdictionId: 'state:48',
        numerator: 900,
        denominator: 9000,
      }),
      obs({
        metricId: 'lives-population',
        jurisdictionId: 'state:40',
        numerator: 300,
        denominator: 3000,
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:40',
        numerator: 150,
        denominator: 600,
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:48',
        raceEthnicitySlice: 'spanish_surname',
        numerator: 400,
        denominator: 1000,
      }),
    ],
  });
  const black = condition(bundle, 1960, 'homeownership').cells.black;
  assert.equal(black.state, 'suppressed');
  assert.match(black.reason!, /only 25%/);
  const hispanic = condition(bundle, 1960, 'homeownership').cells.hispanic;
  assert.equal(hispanic.state, 'published');
  assert.deepEqual(hispanic.countedIn, ['Texas']);
});

test('small bases and wide ACS margins are withheld or flagged', () => {
  const small = build({
    observations: [
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:48',
        numerator: 100,
        denominator: 300,
      }),
      obs({
        metricId: 'lives-homeownership',
        jurisdictionId: 'state:40',
        numerator: 50,
        denominator: 100,
      }),
    ],
  });
  assert.equal(condition(small, 1960, 'homeownership').cells.black.state, 'suppressed');

  const acs = (numeratorMoe: number) =>
    build({
      observations: ['state:48', 'state:40'].map((id) =>
        obs({
          metricId: 'lives-homeownership',
          jurisdictionId: id,
          referencePeriod: '2019-2023',
          raceEthnicitySlice: 'black_alone',
          numerator: 5000,
          denominator: 10_000,
          metadata: { numeratorMoe, denominatorMoe: 100 },
        }),
      ),
    });
  assert.equal(condition(acs(300), 2020, 'homeownership').cells.black.state, 'published');
  assert.equal(condition(acs(2500), 2020, 'homeownership').cells.black.state, 'wide_margin');
  assert.equal(condition(acs(5000), 2020, 'homeownership').cells.black.state, 'suppressed');
});

test('income bands and the median ratio come from summed brackets and the national median', () => {
  const brackets = [
    [0, 10_000, 100],
    [10_000, 20_000, 100],
    [20_000, 40_000, 100],
    [40_000, null, 100],
  ] as const;
  const observations: LivesObservationInput[] = [
    obs({
      metricId: 'lives-income-median',
      jurisdictionId: 'nation:US',
      raceEthnicitySlice: null,
      estimate: 15_000,
    }),
    ...['state:48', 'state:40'].flatMap((id) =>
      brackets.map(([lower, upper, count]) =>
        obs({
          metricId: incomeBracketSeriesId(lower, upper),
          jurisdictionId: id,
          numerator: count * 10,
        }),
      ),
    ),
  ];
  const sixties = decadeOf(build({ observations }), 1960);
  const shares = sixties.classShares.black;
  assert.ok(Math.abs(shares.lower.estimate! - 25) < 1e-6);
  assert.ok(Math.abs(shares.middle.estimate! - 37.5) < 1e-6);
  assert.equal(shares.unclassified.state, 'not_measured');
  const ratio = sixties.conditions.find((c) => c.key === 'income_to_national_median')!.cells.black;
  assert.ok(Math.abs(ratio.estimate! - (100 * 20_000) / 15_000) < 1e-6);
});

test('work-based class shares sum published occupation counts', () => {
  const observations = ['state:48', 'state:40'].flatMap((id) => [
    obs({
      metricId: workClassSeriesId('lower'),
      jurisdictionId: id,
      referencePeriod: '1910',
      numerator: 700,
    }),
    obs({
      metricId: workClassSeriesId('middle'),
      jurisdictionId: id,
      referencePeriod: '1910',
      numerator: 200,
    }),
    obs({
      metricId: workClassSeriesId('upper'),
      jurisdictionId: id,
      referencePeriod: '1910',
      numerator: 50,
    }),
    obs({
      metricId: workClassSeriesId('unclassified'),
      jurisdictionId: id,
      referencePeriod: '1910',
      numerator: 50,
    }),
  ]);
  const shares = decadeOf(build({ observations }), 1910).classShares.black;
  assert.equal(shares.lower.estimate, 70);
  assert.equal(shares.unclassified.estimate, 5);
});

function rule(overrides: Partial<LivesApplicabilityInput>): LivesApplicabilityInput {
  return {
    id: 'rule',
    entityId: 'ent',
    entityName: 'Rule',
    entityHref: null,
    jurisdictionId: 'nation:US',
    scopeLevel: 'federal',
    inForceFromYear: 1900,
    inForceToYear: null,
    groupsNamed: [],
    appliesToSlices: ['all'],
    lifeDomains: ['housing'],
    textPosture: 'protective',
    disputed: false,
    summary: null,
    ...overrides,
  };
}

test('rules are federal plus the area’s member states, labeled by jurisdiction', () => {
  const applicability = [
    rule({ id: 'brown', entityName: 'Brown', inForceFromYear: 1954 }),
    rule({
      id: 'tx',
      entityName: 'Texas rule',
      jurisdictionId: 'state:48',
      scopeLevel: 'state',
      inForceFromYear: 1950,
    }),
    rule({
      id: 'ms',
      entityName: 'Mississippi rule',
      jurisdictionId: 'state:28',
      scopeLevel: 'state',
      inForceFromYear: 1950,
    }),
    rule({
      id: 'plessy',
      entityName: 'Plessy',
      inForceFromYear: 1896,
      inForceToYear: 1954,
      appliesToSlices: ['black'],
    }),
  ];
  const fifties = decadeOf(build({ applicability }), 1950);
  assert.deepEqual(
    fifties.rulesInForce.map((r) => r.id),
    ['plessy', 'brown', 'tx'],
  );
  assert.equal(fifties.rulesInForce.find((r) => r.id === 'tx')!.jurisdictionLabel, 'Texas');
  assert.equal(fifties.rulesInForce.find((r) => r.id === 'brown')!.jurisdictionLabel, 'Federal');
  assert.deepEqual(fifties.rulesInForce.find((r) => r.id === 'plessy')!.appliesTo, ['black']);
  const national = decadeOf(build({ area: LIVES_NATIONAL, applicability }), 1950);
  assert.equal(
    national.rulesInForce.some((r) => r.id === 'tx'),
    false,
  );
});

test('count notes can be limited to areas', () => {
  const countNotes = [
    {
      id: 'west-only',
      decade: 1960,
      appliesTo: ['hispanic' as const],
      areaIds: ['region:us-west'],
      heading: 'h',
      body: 'b',
      citations: [{ label: 'c', url: 'https://www.census.gov/' }],
    },
  ];
  assert.equal(decadeOf(build({ countNotes }), 1960).countNotes.length, 0);
  assert.equal(
    decadeOf(build({ area: livesAreaBySlug('west')!, countNotes }), 1960).countNotes.length,
    1,
  );
});

test('changes are never computed across a measurement boundary', () => {
  const published = (estimate: number) => ({ state: 'published' as const, estimate });
  assert.equal(
    livesComparableChange(
      { decade: 1960, cell: published(40) },
      { decade: 1970, cell: published(35) },
    ),
    -5,
  );
  assert.equal(
    livesComparableChange(
      { decade: 1980, cell: published(40) },
      { decade: 1990, cell: published(35) },
    ),
    null,
  );
});

test('only a note written for the group links from a missing figure the census never counted', () => {
  const citations = [{ label: 'Census', url: 'https://www.census.gov/' }];
  const bundle = build({
    countNotes: [
      {
        id: 'everyone-1950',
        decade: 1950,
        appliesTo: ['all'],
        areaIds: [],
        heading: 'h',
        body: 'b',
        citations,
      },
      {
        id: 'black-1950',
        decade: 1950,
        appliesTo: ['black'],
        areaIds: [],
        heading: 'h',
        body: 'b',
        citations,
      },
      {
        id: 'hispanic-1920',
        decade: 1920,
        appliesTo: ['all'],
        areaIds: [],
        heading: 'h',
        body: 'b',
        citations,
      },
    ],
  });
  const literacy1950 = condition(bundle, 1950, 'literacy').cells.black;
  assert.equal(literacy1950.state, 'not_measured');
  assert.equal(literacy1950.noteId, undefined);
  assert.equal(condition(bundle, 1920, 'literacy').cells.hispanic.noteId, undefined);
  assert.equal(decadeOf(bundle, 1950).countNotes.length, 2);
});

function nchs(
  metricId: string,
  year: string,
  estimate: number,
  populationLabel: string,
  populationBasis?: string,
): LivesObservationInput {
  return {
    id: `${metricId}:${year}:nation`,
    metricId,
    jurisdictionId: 'nation:US',
    referencePeriod: year,
    raceEthnicitySlice: null,
    estimate,
    source: 'NCHS, Death rates and life expectancy at birth',
    sourceUrl: 'https://data.cdc.gov/d/w9j2-ggv5',
    populationLabel,
    ...(populationBasis ? { populationBasis } : {}),
  };
}

const LE_BLACK = 'nchs-life-expectancy-birth-black-nation';
const LE_WHITE = 'nchs-life-expectancy-birth-white-nation';

test('an agency value series publishes for the nation in its own unit, with its own population label', () => {
  const bundle = build({
    area: LIVES_NATIONAL,
    observations: [nchs(LE_BLACK, '2000', 71.8, 'Black'), nchs(LE_WHITE, '2000', 77.3, 'White')],
  });
  const life = condition(bundle, 2000, 'life_expectancy');
  assert.equal(life.unit, 'years');
  assert.equal(life.cells.black.state, 'published');
  assert.equal(life.cells.black.estimate, 71.8);
  assert.equal(life.cells.black.definitionLabel, 'Black, all origins, as NCHS reported it');
  assert.deepEqual(life.cells.black.observationIds, [`${LE_BLACK}:2000:nation`]);
  // The gap is in years, never in percentage points.
  assert.equal(life.gap?.points, 5.5);
  assert.equal(life.gap?.unit, 'years');
  assert.match(life.gap?.formula ?? '', /in years/);
  // This series names no Hispanic figure, and says so rather than looking unfinished.
  assert.equal(life.cells.hispanic.state, 'not_measured');
});

test('the nonwhite years carry the proxy label, so they are never read as a Black figure', () => {
  const bundle = build({
    area: LIVES_NATIONAL,
    observations: [nchs(LE_BLACK, '1930', 48.1, 'nonwhite'), nchs(LE_WHITE, '1930', 61.4, 'White')],
  });
  const life = condition(bundle, 1930, 'life_expectancy');
  assert.equal(
    life.cells.black.definitionLabel,
    'Nonwhite: every group other than white, counted together',
  );
  // No Black and white gap is derived from a figure that is not a Black figure.
  assert.equal(life.gap, undefined);
});

test('from 2018 the label says non-Hispanic and one race, because NCHS changed the population', () => {
  const bundle = build({
    area: LIVES_NATIONAL,
    observations: [
      nchs(LE_BLACK, '2020', 71.5, 'non-Hispanic single-race Black'),
      nchs(LE_WHITE, '2020', 77.4, 'non-Hispanic single-race White'),
    ],
  });
  assert.equal(
    condition(bundle, 2020, 'life_expectancy').cells.black.definitionLabel,
    'Black, not Hispanic, one race, as NCHS reported it',
  );
});

test('a region never shows a national agency figure as its own', () => {
  const bundle = build({
    observations: [nchs(LE_BLACK, '2000', 71.8, 'Black'), nchs(LE_WHITE, '2000', 77.3, 'White')],
  });
  const cell = condition(bundle, 2000, 'life_expectancy').cells.black;
  assert.equal(cell.state, 'not_measured');
  assert.match(cell.reason ?? '', /whole country, not for regions/);
});

test('infant mortality says whose race classified the birth, and stops where the series stops', () => {
  const black = 'nchs-infant-mortality-black-nation';
  const white = 'nchs-infant-mortality-white-nation';
  const bundle = build({
    area: LIVES_NATIONAL,
    observations: [
      nchs(black, '1970', 33.3, 'Black', 'race of child'),
      nchs(white, '1970', 17.6, 'White', 'race of child'),
      nchs(black, '1980', 22.2, 'Black', 'race of mother'),
      nchs(white, '1980', 10.9, 'White', 'race of mother'),
    ],
  });
  assert.equal(
    condition(bundle, 1970, 'infant_mortality').cells.black.definitionLabel,
    'Black infants, by race of child',
  );
  assert.equal(
    condition(bundle, 1980, 'infant_mortality').cells.black.definitionLabel,
    'Black infants, by race of mother',
  );
  assert.equal(condition(bundle, 1980, 'infant_mortality').unit, 'per_1000');
  assert.equal(condition(bundle, 1980, 'infant_mortality').gap?.unit, 'per_1000');
  assert.equal(condition(bundle, 2020, 'infant_mortality').cells.black.state, 'not_measured');
});

test('an agency value with no stated population is not publishable', () => {
  const unlabeled = { ...nchs(LE_BLACK, '2000', 71.8, 'Black'), populationLabel: null };
  const bundle = build({ area: LIVES_NATIONAL, observations: [unlabeled] });
  assert.equal(condition(bundle, 2000, 'life_expectancy').cells.black.state, 'pending');
});
