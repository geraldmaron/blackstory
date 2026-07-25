/**
 * Tests for the ACS 5-year loads (`runAcsCountyLoad`, `runAcsTractLoad`). Injected fake
 * fetch replays the Census API's array-of-arrays shape including ACS sentinel values; no
 * network, no Firestore — same approach as ./load-cli.test.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACS5_2024_VINTAGE } from '@repo/domain';
import {
  runAcsCountyLoad,
  runAcsTractLoad,
  type AcsCountyWriter,
  type AcsTractStateWriter,
  type AcsWriteOutcome,
} from './acs-load-cli.js';
import {
  acsCountyProfileSchema,
  acsTractProfileSchema,
  type AcsCountyProfileDoc,
  type AcsTractProfileDoc,
} from './schema.js';

const VINTAGE = ACS5_2024_VINTAGE;

/** variables.json satisfying every starter spec's label (and concept where required). */
function fakeVariablesJson() {
  const variables: Record<string, { label: string; concept?: string }> = {
    B01003_001E: { label: 'Estimate!!Total' },
    B02001_001E: { label: 'Estimate!!Total:' },
    B02001_003E: { label: 'Estimate!!Total:!!Black or African American alone' },
    B19013_001E: { label: 'Estimate!!Median household income in the past 12 months' },
    B19013B_001E: {
      label: 'Estimate!!Median household income in the past 12 months',
      concept: 'Median Household Income (Black or African American Alone Householder)',
    },
    B25003_001E: { label: 'Estimate!!Total:' },
    B25003_002E: { label: 'Estimate!!Total:!!Owner occupied' },
    B25003_003E: { label: 'Estimate!!Total:!!Renter occupied' },
    B15003_001E: { label: 'Estimate!!Total:' },
    B15003_022E: { label: "Estimate!!Total:!!Bachelor's degree" },
    B15003_023E: { label: "Estimate!!Total:!!Master's degree" },
    B15003_024E: { label: 'Estimate!!Total:!!Professional school degree' },
    B15003_025E: { label: 'Estimate!!Total:!!Doctorate degree' },
  };
  return { variables };
}

const VARIABLE_IDS = VINTAGE.variables.map((spec) => spec.id);

function header(geo: 'county' | 'tract'): readonly string[] {
  return ['NAME', ...VARIABLE_IDS, 'state', 'county', ...(geo === 'tract' ? ['tract'] : [])];
}

/** A data row with every estimate = 100 except overrides by variable id. */
function dataRow(
  name: string,
  geo: readonly string[],
  overrides: Record<string, string | null> = {},
): readonly (string | null)[] {
  return [name, ...VARIABLE_IDS.map((id) => (id in overrides ? overrides[id]! : '100')), ...geo];
}

function createFakeFetch(geo: 'county' | 'tract', rows: readonly (readonly (string | null)[])[]) {
  return async (url: string) => {
    const payload = url.endsWith('/variables.json') ? fakeVariablesJson() : [header(geo), ...rows];
    return { ok: true, status: 200, json: async () => payload };
  };
}

function createCountyWriter(): AcsCountyWriter & { store: Map<string, AcsCountyProfileDoc> } {
  const store = new Map<string, AcsCountyProfileDoc>();
  return {
    store,
    async upsert(doc): Promise<AcsWriteOutcome> {
      const existing = store.get(doc.id);
      if (!existing) {
        store.set(doc.id, doc);
        return 'created';
      }
      if (existing.contentHash === doc.contentHash) return 'unchanged';
      store.set(doc.id, { ...doc, createdAt: existing.createdAt });
      return 'updated';
    },
  };
}

function createTractWriter(): AcsTractStateWriter & { store: Map<string, AcsTractProfileDoc> } {
  const store = new Map<string, AcsTractProfileDoc>();
  return {
    store,
    async applyState(_stateFips, docs) {
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      for (const doc of docs) {
        const existing = store.get(doc.id);
        if (!existing) {
          store.set(doc.id, doc);
          created += 1;
        } else if (existing.contentHash === doc.contentHash) {
          unchanged += 1;
        } else {
          store.set(doc.id, { ...doc, createdAt: existing.createdAt });
          updated += 1;
        }
      }
      return { created, updated, unchanged };
    },
  };
}

test('county load parses estimates, tracks states seen, and writes schema-valid docs', async () => {
  const writer = createCountyWriter();
  const summary = await runAcsCountyLoad({
    writer,
    fetchImpl: createFakeFetch('county', [
      dataRow('Cook County, Illinois', ['17', '031'], { B19013_001E: '78304' }),
      dataRow('Autauga County, Alabama', ['01', '001']),
    ]),
    now: () => '2026-07-18T00:00:00.000Z',
  });

  assert.equal(summary.created, 2);
  assert.deepEqual(summary.stateFipsSeen, ['01', '17']);
  const doc = writer.store.get('17031_2024')!;
  acsCountyProfileSchema.parse(doc);
  assert.equal(doc.estimates.medianHouseholdIncome, 78304);
  assert.equal(doc.suppressed.length, 0);
  assert.ok(!doc.sourceUrl.includes('key='));
  assert.equal(doc.sourceUrl, 'https://www.census.gov/programs-surveys/acs');
  assert.ok(!doc.sourceUrl.includes('api.census.gov'));
});

test('negative ACS sentinels land in suppressed, never in estimates', async () => {
  const writer = createCountyWriter();
  await runAcsCountyLoad({
    writer,
    fetchImpl: createFakeFetch('county', [
      dataRow('Loving County, Texas', ['48', '301'], {
        B19013B_001E: '-666666666',
        B19013_001E: null,
      }),
    ]),
  });

  const doc = writer.store.get('48301_2024')!;
  assert.equal(doc.estimates.medianHouseholdIncomeBlack, undefined);
  assert.equal(doc.estimates.medianHouseholdIncome, undefined);
  assert.deepEqual([...doc.suppressed].sort(), [
    'medianHouseholdIncome',
    'medianHouseholdIncomeBlack',
  ]);
  assert.equal(doc.estimates.totalPopulation, 100);
});

test('county re-run with unchanged data is all-unchanged', async () => {
  const writer = createCountyWriter();
  const options = {
    writer,
    fetchImpl: createFakeFetch('county', [dataRow('Autauga County, Alabama', ['01', '001'])]),
  };
  await runAcsCountyLoad({ ...options, now: () => '2026-07-18T00:00:00.000Z' });
  const second = await runAcsCountyLoad({ ...options, now: () => '2026-07-19T00:00:00.000Z' });
  assert.equal(second.unchanged, 1);
  assert.equal(second.created + second.updated, 0);
});

test('tract load fans out per state, keys docs by 11-digit GEOID, carries tractVintage', async () => {
  const writer = createTractWriter();
  const byState: Record<string, readonly (readonly (string | null)[])[]> = {
    '17': [
      dataRow('Census Tract 8391, Cook County, Illinois', ['17', '031', '839100']),
      dataRow('Census Tract 1, Cook County, Illinois', ['17', '031', '000100']),
    ],
    '01': [dataRow('Census Tract 201, Autauga County, Alabama', ['01', '001', '020100'])],
  };
  const fetchImpl = async (url: string) => {
    if (url.endsWith('/variables.json')) {
      return { ok: true, status: 200, json: async () => fakeVariablesJson() };
    }
    const state = /in=state%3A(\d{2})/.exec(url)?.[1] ?? '';
    return {
      ok: true,
      status: 200,
      json: async () => [header('tract'), ...(byState[state] ?? [])],
    };
  };

  const summary = await runAcsTractLoad({
    writer,
    stateFipsList: ['01', '17'],
    fetchImpl,
    delayMs: 0,
    now: () => '2026-07-18T00:00:00.000Z',
  });

  assert.equal(summary.totalDocs, 3);
  assert.equal(summary.failedStates.length, 0);
  const doc = writer.store.get('17031839100_2024')!;
  acsTractProfileSchema.parse(doc);
  assert.equal(doc.fips5, '17031');
  assert.equal(doc.tractVintage, '2020');
});

test('a state that keeps failing lands in failedStates without sinking the run', async () => {
  const writer = createTractWriter();
  const fetchImpl = async (url: string) => {
    if (url.endsWith('/variables.json')) {
      return { ok: true, status: 200, json: async () => fakeVariablesJson() };
    }
    if (url.includes('state%3A99')) return { ok: false, status: 500, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => [
        header('tract'),
        dataRow('Census Tract 201, Autauga County, Alabama', ['01', '001', '020100']),
      ],
    };
  };

  const summary = await runAcsTractLoad({
    writer,
    stateFipsList: ['01', '99'],
    fetchImpl,
    delayMs: 0,
    retries: 1,
  });

  assert.equal(summary.states.length, 1);
  assert.equal(summary.failedStates.length, 1);
  assert.equal(summary.failedStates[0]!.stateFips, '99');
  assert.equal(writer.store.size, 1);
});
