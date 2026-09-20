import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  LivesAreaBundle,
  LivesCell,
  LivesConditionKey,
  LivesDecade,
  LivesDecadeBundle,
  LivesRule,
  LivesWorldBeat,
} from '@repo/domain/statistics/lives';
import {
  LIVES_ERAS,
  LIVES_MILESTONES,
  buildLivesMilestonePanels,
  parseLivesMilestone,
  livesMilestonePeriod,
  livesMilestoneSpanLabel,
} from './lives-milestones';
import { RACE_ETHNICITY_DEFINITION_LABELS } from '@repo/domain/statistics/lives';

function cell(estimate?: number, withSource = true): LivesCell {
  return estimate === undefined
    ? { state: 'pending', reason: 'Not transcribed' }
    : {
        state: 'published',
        estimate,
        definitionLabel: 'Published definition',
        ...(withSource
          ? { sources: [{ label: 'Census table', url: 'https://www.census.gov/table' }] }
          : {}),
      };
}

function decade(
  year: LivesDecade,
  key: LivesConditionKey,
  values: { readonly black?: number; readonly white?: number; readonly hispanic?: number },
): LivesDecadeBundle {
  return {
    decade: year,
    label: `${year}s`,
    conditions: [
      {
        key,
        label: 'Owning their home',
        universe: 'Occupied homes',
        cells: {
          black: cell(values.black),
          white: cell(values.white),
          hispanic: cell(values.hispanic),
        },
      },
    ],
    countNotes: [],
    worldBeats: [],
    rulesInForce: [],
  } as unknown as LivesDecadeBundle;
}

function bundle(decades: readonly LivesDecadeBundle[]): LivesAreaBundle {
  return {
    areaId: 'nation:US',
    areaSlug: 'united-states',
    areaName: 'United States',
    areaKind: 'nation',
    decades,
    disclaimer: 'Comparison is not causation.',
  };
}

test('milestone parsing defaults to home and accepts a known key', () => {
  assert.equal(parseLivesMilestone(undefined).key, 'home');
  assert.equal(parseLivesMilestone('education').key, 'education');
  assert.equal(parseLivesMilestone('unknown').key, 'home');
});

test('an era uses its latest cited Black comparison and does not create blank panels', () => {
  const milestone = LIVES_MILESTONES[0]!;
  const panels = buildLivesMilestonePanels(
    bundle([
      decade(1900, 'homeownership', { black: 20, white: 45 }),
      decade(1920, 'homeownership', { black: 25, white: 52 }),
      decade(1930, 'homeownership', { black: 28 }),
      decade(1940, 'homeownership', { white: 60 }),
    ]),
    milestone,
  );

  assert.equal(panels.length, 1);
  assert.equal(panels[0]?.era.id, '1900-1930');
  assert.equal(panels[0]?.figure?.decade.decade, 1920);
  assert.deepEqual(
    panels[0]?.figure?.values.map((value) => value.lens),
    ['black', 'white'],
  );
});

test('uncited values are not publishable on the guided surface', () => {
  const uncited = decade(2020, 'homeownership', { black: 44, white: 73 });
  const condition = uncited.conditions[0]!;
  const withoutSources = {
    ...uncited,
    conditions: [
      {
        ...condition,
        cells: {
          ...condition.cells,
          black: cell(44, false),
        },
      },
    ],
  };
  assert.deepEqual(buildLivesMilestonePanels(bundle([withoutSources]), LIVES_MILESTONES[0]!), []);
});

test('distinct tables at one source URL survive deduplication', () => {
  const source = decade(2020, 'homeownership', { black: 44, white: 73 });
  const condition = source.conditions[0]!;
  const panels = buildLivesMilestonePanels(
    bundle([
      {
        ...source,
        conditions: [
          {
            ...condition,
            cells: {
              ...condition.cells,
              white: {
                ...condition.cells.white,
                sources: [{ label: 'White household table', url: 'https://www.census.gov/table' }],
              },
            },
          },
        ],
      },
    ]),
    LIVES_MILESTONES[0]!,
  );
  assert.equal(panels[0]?.figure?.sources.length, 2);
});

test('survey vintages are not mislabeled as a single census year', () => {
  const home = buildLivesMilestonePanels(
    bundle([decade(2020, 'homeownership', { black: 44, white: 73 })]),
    LIVES_MILESTONES[0]!,
  )[0]!;
  assert.equal(livesMilestonePeriod(home.figure!), '2019–2023 · ACS five-year estimate');
  const place = buildLivesMilestonePanels(
    bundle([decade(2020, 'urban', { black: 90, white: 73 })]),
    LIVES_MILESTONES[1]!,
  )[0]!;
  assert.equal(livesMilestonePeriod(place.figure!), '2020 · Census snapshot');
});

test('a nonwhite historical proxy cannot be presented as a Black-specific comparison', () => {
  const source = decade(1890, 'school_attendance', { black: 42, white: 59 });
  const condition = source.conditions[0]!;
  const proxy = {
    ...source,
    conditions: [
      {
        ...condition,
        cells: {
          ...condition.cells,
          black: {
            ...condition.cells.black,
            definitionLabel: RACE_ETHNICITY_DEFINITION_LABELS.nonwhite,
          },
        },
      },
    ],
  };
  assert.deepEqual(buildLivesMilestonePanels(bundle([proxy]), LIVES_MILESTONES[2]!), []);
});

function rule(name: string, year: number, lifeDomains: readonly string[]): LivesRule {
  return {
    id: `${name}-us`,
    entityId: `ent_${name}`,
    name,
    href: `/entity/ent_${name}`,
    scopeLevel: 'federal',
    jurisdictionLabel: 'Federal',
    inForceFromYear: year,
    inForceToYear: null,
    appliesTo: ['black', 'white', 'hispanic'],
    groupsNamed: [],
    lifeDomains,
    textPosture: 'protective',
    disputed: false,
    summary: null,
    description: `${name} described.`,
  };
}

test('every rule that began in an era reaches its panel, not only the first two by date', () => {
  const housing = [
    rule('GI Bill', 1944, ['housing', 'credit']),
    rule('Shelley v. Kraemer', 1948, ['housing']),
    rule('Jones v. Alfred H. Mayer Co.', 1968, ['housing']),
    rule('Fair Housing Act of 1968', 1968, ['housing', 'credit']),
  ];
  const panels = buildLivesMilestonePanels(
    bundle([
      {
        ...decade(1960, 'homeownership', { black: 38, white: 64 }),
        rulesInForce: [...housing, rule('Brown v. Board of Education', 1954, ['schooling'])],
      } as LivesDecadeBundle,
    ]),
    LIVES_MILESTONES[0]!,
  );
  assert.deepEqual(
    panels[0]?.rules.map((entry) => entry.name),
    ['GI Bill', 'Shelley v. Kraemer', 'Fair Housing Act of 1968', 'Jones v. Alfred H. Mayer Co.'],
  );
});

test('an era label names decades, so a rule from the last decade sits inside its heading', () => {
  const panels = buildLivesMilestonePanels(
    bundle([
      {
        ...decade(1880, 'school_attendance', { black: 38, white: 71 }),
        rulesInForce: [rule('Plessy v. Ferguson', 1896, ['schooling'])],
      } as LivesDecadeBundle,
    ]),
    LIVES_MILESTONES.find((milestone) => milestone.key === 'school')!,
  );
  assert.equal(panels[0]?.era.label, '1870s–1890s');
  assert.deepEqual(
    panels[0]?.rules.map((entry) => entry.name),
    ['Plessy v. Ferguson'],
  );
  for (const era of LIVES_ERAS) assert.match(era.label, /^\d{4}s–\d{4}s$/);
});

test('the header span is the visible panels, not a fixed range', () => {
  const panels = buildLivesMilestonePanels(
    bundle([
      decade(1980, 'unemployed', { black: 12, white: 6 }),
      decade(2020, 'unemployed', { black: 9, white: 4 }),
    ]),
    LIVES_MILESTONES.find((milestone) => milestone.key === 'work')!,
  );
  assert.equal(livesMilestoneSpanLabel(panels), '1970s to 2020s');
  assert.equal(livesMilestoneSpanLabel([]), null);
});

function account(id: string, domain: LivesWorldBeat['domain']): LivesWorldBeat {
  return {
    id,
    domain,
    claimType: 'testimony',
    heading: 'After freedom, no home to go to',
    body: 'Fountain Hughes described the years just after emancipation.',
    citations: [{ label: 'Library of Congress', url: 'https://www.loc.gov/item/x/' }],
    appliesTo: ['black'],
    unit: 'all',
    entities: [],
    speaker: {
      name: 'Fountain Hughes',
      place: 'Baltimore, Maryland',
      year: '1949',
      mediation: 'recorded-interview',
      mediatedBy: 'Hermond Norwood',
    },
    quote: 'We had nowhere or nothing.',
  };
}

function figurelessDecade(
  year: LivesDecade,
  extras: Partial<LivesDecadeBundle>,
): LivesDecadeBundle {
  return {
    ...decade(year, 'homeownership', {}),
    ...extras,
  } as LivesDecadeBundle;
}

test('an era with no figure renders only when it has prose plus an account or a rule', () => {
  const home = LIVES_MILESTONES[0]!;
  const withAccount = bundle([
    figurelessDecade(1880, { worldBeats: [account('1880-housing-hughes', 'housing')] }),
  ]);

  // Prose alone is not enough of a reason to open an era; neither is an account alone.
  assert.deepEqual(buildLivesMilestonePanels(withAccount, home), []);
  assert.deepEqual(
    buildLivesMilestonePanels(
      bundle([figurelessDecade(1880, {})]),
      home,
      new Map([['1870-1890', 'prose']]),
    ),
    [],
  );

  const panels = buildLivesMilestonePanels(withAccount, home, new Map([['1870-1890', 'prose']]));
  assert.equal(panels.length, 1);
  assert.equal(panels[0]?.figure, null);
  assert.equal(panels[0]?.narrative, 'prose');
  assert.equal(panels[0]?.accounts[0]?.speaker?.name, 'Fountain Hughes');
  // The pending cell's silence is this archive's, and the line says so.
  assert.match(panels[0]?.figureAbsence ?? '', /hasn’t been transcribed here yet/);
});

test('the census’s own reason is used when the census never asked', () => {
  const home = LIVES_MILESTONES[0]!;
  const never = figurelessDecade(1880, {
    worldBeats: [account('1880-housing-hughes', 'housing')],
  });
  const condition = never.conditions[0]!;
  const panels = buildLivesMilestonePanels(
    bundle([
      {
        ...never,
        conditions: [
          {
            ...condition,
            cells: {
              ...condition.cells,
              black: {
                state: 'not_measured',
                reason: 'The census first asked about tenure in 1890.',
              },
            },
          },
        ],
      } as LivesDecadeBundle,
    ]),
    home,
    new Map([['1870-1890', 'prose']]),
  );
  assert.equal(panels[0]?.figureAbsence, 'The census first asked about tenure in 1890.');
});

test('accounts are filed by topic, and a quoted account is never also the context beat', () => {
  const home = LIVES_MILESTONES[0]!;
  const panels = buildLivesMilestonePanels(
    bundle([
      {
        ...decade(1930, 'homeownership', { black: 25, white: 50 }),
        worldBeats: [
          account('1930-housing-account', 'housing'),
          account('1930-catchall-account', 'testimony'),
          account('1930-school-account', 'schooling'),
        ],
      } as LivesDecadeBundle,
    ]),
    home,
  );
  assert.deepEqual(
    panels[0]?.accounts.map((beat) => beat.id),
    ['1930-housing-account'],
  );
  assert.equal(panels[0]?.context, null);
});
