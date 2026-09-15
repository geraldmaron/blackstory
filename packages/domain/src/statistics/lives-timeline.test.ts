import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JUXTAPOSITION_DISCLAIMER } from '../juxtaposition.js';
import {
  buildLivesRegionBundle,
  livesComparableChange,
  type BuildLivesRegionBundleInput,
  type LivesApplicabilityInput,
  type LivesRegionDecadeDefinitionInput,
} from './lives-timeline.js';

const jurisdictions = [
  { id: 'nation:US', name: 'United States', parentId: null },
  { id: 'state:17', name: 'Illinois', parentId: 'nation:US' },
  { id: 'state:48', name: 'Texas', parentId: 'nation:US' },
  { id: 'region:chicago-il', name: 'Chicago area', parentId: 'state:17' },
];

function definition(
  decade: number,
  overrides: Partial<LivesRegionDecadeDefinitionInput> = {},
): LivesRegionDecadeDefinitionInput {
  const regimes: Record<number, LivesRegionDecadeDefinitionInput['measurementRegime']> = {
    1880: 'occupational_strata',
    1930: 'occupational_strata',
    1950: 'sample_line_income',
    1960: 'constructed_household_income',
    1970: 'constructed_household_income',
  };
  return {
    regionId: 'region:chicago-il',
    decade,
    referencePeriod: String(decade),
    boundaryVersion: `region-chicago-il-${decade}`,
    measurementRegime: regimes[decade] ?? 'household_income',
    comparabilityNote: 'Cook and DuPage counties.',
    memberCountyFips: ['17031', '17043'],
    coverage: {},
    ...overrides,
  };
}

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

function build(overrides: Partial<BuildLivesRegionBundleInput> = {}) {
  return buildLivesRegionBundle({
    region: jurisdictions[3]!,
    jurisdictions,
    definitions: [definition(1880), definition(1950), definition(1960), definition(1970)],
    observations: [],
    applicability: [],
    frames: [],
    ...overrides,
  });
}

const decadeOf = (bundle: ReturnType<typeof build>, decade: number) =>
  bundle.decades.find((d) => d.decade === decade)!;

test('every decade 1870–2020 is present and carries the fixed disclaimer', () => {
  const bundle = build();
  assert.equal(bundle.decades.length, 16);
  assert.equal(bundle.decades[0]!.label, '1870s');
  assert.equal(bundle.disclaimer, JUXTAPOSITION_DISCLAIMER);
});

test('the 1890 gap is not measured and flagged on both sides', () => {
  const bundle = build();
  const gap = decadeOf(bundle, 1890);
  assert.equal(gap.regime, 'no_microdata');
  assert.equal(gap.classShares.black_nh.lower.state, 'not_measured');
  assert.equal(gap.boundaryFromPrevious, 'gap');
  assert.equal(decadeOf(bundle, 1900).boundaryFromPrevious, 'gap');
});

test('boundaries distinguish a different measure from a method note', () => {
  const bundle = build();
  assert.equal(decadeOf(bundle, 1940).boundaryFromPrevious, 'different_measure');
  assert.equal(decadeOf(bundle, 1970).boundaryFromPrevious, 'none');
  assert.equal(decadeOf(bundle, 1980).boundaryFromPrevious, 'method_note');
  assert.equal(decadeOf(bundle, 2010).boundaryFromPrevious, 'method_note');
});

test('published and wide-margin observations pass through with n, margin and source', () => {
  const bundle = build({
    observations: [
      {
        metricId: 'ipums-lives-class-share-lower',
        boundaryVersion: 'region-chicago-il-1960',
        raceEthnicitySlice: 'black_nh',
        estimate: 41.2,
        marginOfError: 3.1,
        source: 'IPUMS USA',
        sourceUrl: 'https://usa.ipums.org/',
        metadata: { unweightedN: 812, cellState: 'published' },
      },
      {
        metricId: 'ipums-lives-homeownership-middle',
        boundaryVersion: 'region-chicago-il-1960',
        raceEthnicitySlice: 'hispanic',
        estimate: 30,
        marginOfError: 12,
        source: 'IPUMS USA',
        sourceUrl: 'https://usa.ipums.org/',
        metadata: { unweightedN: 90, cellState: 'wide_margin' },
      },
    ],
  });
  const sixties = decadeOf(bundle, 1960);
  assert.deepEqual(sixties.classShares.black_nh.lower, {
    state: 'published',
    estimate: 41.2,
    marginOfError: 3.1,
    unweightedN: 812,
    source: { label: 'IPUMS USA', url: 'https://usa.ipums.org/' },
  });
  const homeownership = sixties.conditions.find((c) => c.key === 'homeownership')!;
  assert.equal(homeownership.cells.hispanic.middle.state, 'wide_margin');
  assert.equal(homeownership.cells.hispanic.middle.estimate, 30);
});

test('suppressed cells keep their reason and never an estimate', () => {
  const bundle = build({
    definitions: [
      definition(1950, {
        coverage: {
          'ipums-lives-class-share-upper|hispanic': {
            state: 'suppressed',
            reason: 'unweighted n 12 is below 50',
          },
        },
      }),
    ],
  });
  const cell = decadeOf(bundle, 1950).classShares.hispanic.upper;
  assert.equal(cell.state, 'suppressed');
  assert.equal(cell.estimate, undefined);
  assert.equal(cell.reason, 'unweighted n 12 is below 50');
});

test('unmeasured metrics, untabulated decades and unclassified income tiers are explicit', () => {
  const bundle = build();
  const fifties = decadeOf(bundle, 1950);
  assert.equal(
    fifties.conditions.find((c) => c.key === 'literacy')!.cells.white_nh.all.state,
    'not_measured',
  );
  assert.equal(fifties.classShares.white_nh.unclassified.state, 'not_measured');
  const eighties = decadeOf(bundle, 1880);
  assert.equal(
    eighties.conditions.find((c) => c.key === 'homeownership')!.cells.black_nh.all.state,
    'not_measured',
  );
  assert.equal(eighties.classShares.black_nh.unclassified.state, 'pending');
  assert.equal(decadeOf(bundle, 2000).classShares.black_nh.middle.state, 'pending');
});

test('rules resolve over ancestors and member counties by in-force overlap', () => {
  const bundle = build({
    applicability: [
      rule({
        id: 'brown',
        entityName: 'Brown v. Board of Education',
        inForceFromYear: 1954,
        lifeDomains: ['schooling'],
      }),
      rule({
        id: 'il',
        entityName: 'Illinois rule',
        jurisdictionId: 'state:17',
        scopeLevel: 'state',
        inForceFromYear: 1885,
      }),
      rule({
        id: 'tx',
        entityName: 'Texas rule',
        jurisdictionId: 'state:48',
        scopeLevel: 'state',
        inForceFromYear: 1900,
      }),
      rule({
        id: 'cook',
        entityName: 'Cook County rule',
        jurisdictionId: 'county:17031',
        scopeLevel: 'local',
        inForceFromYear: 1950,
      }),
      rule({ id: 'ended', entityName: 'Ended rule', inForceFromYear: 1930, inForceToYear: 1947 }),
      rule({
        id: 'hispanic-only',
        entityName: 'Hispanic rule',
        appliesToSlices: ['hispanic'],
        inForceFromYear: 1950,
      }),
    ],
  });
  const fifties = decadeOf(bundle, 1950);
  assert.deepEqual(
    fifties.rulesInForce.map((r) => r.id),
    ['hispanic-only', 'brown', 'il', 'cook'],
  );
  assert.deepEqual(fifties.rulesInForce.find((r) => r.id === 'hispanic-only')!.appliesTo, [
    'hispanic',
  ]);
  assert.deepEqual(fifties.rulesInForce.find((r) => r.id === 'brown')!.appliesTo, [
    'black_nh',
    'white_nh',
    'hispanic',
  ]);
  assert.equal(
    decadeOf(bundle, 1940).rulesInForce.some((r) => r.id === 'ended'),
    true,
  );
  assert.equal(
    decadeOf(bundle, 1940).rulesInForce.some((r) => r.id === 'cook'),
    false,
  );
});

test('a stored regime that contradicts the method is rejected', () => {
  assert.throws(
    () => build({ definitions: [definition(1950, { measurementRegime: 'household_income' })] }),
    /method binds sample_line_income/,
  );
});

test('changes are never computed across a regime boundary', () => {
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
      { decade: 1930, cell: published(40) },
      { decade: 1940, cell: published(35) },
    ),
    null,
  );
  assert.equal(
    livesComparableChange(
      { decade: 1960, cell: { state: 'suppressed', reason: 'n' } },
      { decade: 1970, cell: published(35) },
    ),
    null,
  );
});
