import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReleaseRowsDerivableFromCanonical } from './canonical-release-gate.js';

function writer(overrides: {
  readonly entities?: readonly Record<string, unknown>[];
  readonly locations?: readonly Record<string, unknown>[];
  readonly claims?: readonly Record<string, unknown>[];
}) {
  return {
    query: async (sql: string) => {
      if (sql.includes('FROM bb_canonical.entities')) {
        return { rows: overrides.entities ?? [], rowCount: 0 };
      }
      if (sql.includes('FROM bb_canonical.entity_locations')) {
        return { rows: overrides.locations ?? [], rowCount: 0 };
      }
      return { rows: overrides.claims ?? [], rowCount: 0 };
    },
  };
}

const publicRow = {
  entity_id: 'ent_1',
  display_name: 'Documented Place',
  kind: 'place',
  summary: 'A documented place.',
  lat: 38.9,
  lng: -77.01,
  taxonomy: { topics: ['education'] },
  claims: [
    {
      id: 'claim_1',
      predicate: 'documented_as',
      object: 'a school',
      confidenceLevel: 'high',
      citationSource: 'NPS',
      citationHref: 'https://www.nps.gov/example',
      citationLabel: 'NPS record',
    },
  ],
};

const canonical = {
  entities: [
    {
      id: 'ent_1',
      display_name: 'Documented Place',
      kind: 'place',
      kind_detail: {
        editorial: { summary: 'A documented place.' },
        classification: { taxonomy: { topics: ['education'] } },
      },
    },
  ],
  locations: [{ entity_id: 'ent_1', lat: 38.9, lng: -77.01 }],
  claims: [
    {
      id: 'claim_1',
      entity_id: 'ent_1',
      predicate: 'documented_as',
      object: 'a school',
      confidence: { level: 'high' },
      body: {
        citation: {
          source: 'NPS',
          href: 'https://www.nps.gov/example',
          label: 'NPS record',
        },
      },
    },
  ],
};

test('canonical release gate accepts a fully derivable row', async () => {
  await assert.doesNotReject(
    assertReleaseRowsDerivableFromCanonical(writer(canonical), [publicRow]),
  );
});

test('canonical release gate rejects malformed legacy claim objects', async () => {
  await assert.rejects(
    assertReleaseRowsDerivableFromCanonical(writer(canonical), [{ ...publicRow, claims: {} }]),
    /claims must be an array/,
  );
});

test('canonical release gate rejects changed claim text', async () => {
  await assert.rejects(
    assertReleaseRowsDerivableFromCanonical(writer(canonical), [
      {
        ...publicRow,
        claims: [{ ...publicRow.claims[0]!, object: 'a divergent assertion' }],
      },
    ]),
    /object diverges from canonical/,
  );
});
