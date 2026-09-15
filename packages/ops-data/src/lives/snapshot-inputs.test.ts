import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  edtfYear,
  mapApplicabilityRow,
  mapCountNoteRow,
  mapCoverageRow,
  mapObservationRow,
  recordHrefForEntity,
} from './snapshot-inputs.js';

test('numeric columns returned as strings become numbers and count margins carry through', () => {
  const mapped = mapObservationRow({
    metric_id: 'lives-homeownership',
    jurisdiction_id: 'state:48',
    reference_period: '2019-2023',
    race_ethnicity_slice: 'hispanic',
    estimate: '58.1',
    numerator: '1200',
    denominator: '2065',
    source: 'ACS 2019-2023 B25003I',
    source_url: 'https://api.census.gov/data/2023/acs/acs5',
    metadata: { numeratorMoe: '40', denominatorMoe: 51, note: 'x' },
  });
  assert.equal(mapped.estimate, 58.1);
  assert.equal(mapped.numerator, 1200);
  assert.equal(mapped.denominator, 2065);
  assert.deepEqual(mapped.metadata, { numeratorMoe: 40, denominatorMoe: 51 });
});

test('rows without margins or counts map to nulls', () => {
  const mapped = mapObservationRow({
    metric_id: 'lives-literacy',
    jurisdiction_id: 'state:28',
    reference_period: '1900',
    race_ethnicity_slice: 'negro',
    estimate: 52,
    numerator: null,
    denominator: null,
    source: 'Census 1900',
    source_url: 'https://www.census.gov/',
    metadata: null,
  });
  assert.equal(mapped.numerator, null);
  assert.equal(mapped.metadata, null);
});

test('a count note needs at least one citation with a web address', () => {
  const row = {
    id: 'note-1930-mexican',
    decade: 1930,
    applies_to: ['hispanic', 'bogus'],
    area_ids: null,
    heading: 'Counted as a race, once',
    body: 'In 1930 the census listed Mexican as a race.',
    citations: [{ label: 'National Archives', url: 'https://www.archives.gov/' }, { label: 'bad' }],
  };
  const mapped = mapCountNoteRow(row);
  assert.deepEqual(mapped?.appliesTo, ['hispanic']);
  assert.deepEqual(mapped?.areaIds, []);
  assert.equal(mapped?.citations.length, 1);
  assert.equal(mapCountNoteRow({ ...row, citations: [{ label: 'x', url: 'ftp://x' }] }), null);
  assert.equal(mapCountNoteRow({ ...row, citations: null }), null);
});

test('coverage overrides skip malformed entries', () => {
  const entries = mapCoverageRow({
    decade: 1950,
    coverage: [
      { key: 'homeownership', lens: 'hispanic', state: 'not_measured', reason: 'Not tabulated.' },
      { key: 'urban', lens: 'black_nh', state: 'suppressed', reason: 'old slice' },
      { key: 'urban', lens: 'all', state: 'pending', reason: 'bad state' },
      'nonsense',
    ],
  });
  assert.deepEqual(entries, [
    {
      decade: 1950,
      key: 'homeownership',
      lens: 'hispanic',
      state: 'not_measured',
      reason: 'Not tabulated.',
    },
  ]);
  assert.deepEqual(mapCoverageRow({ decade: 1950, coverage: {} }), []);
});

test('applicability rows read in-force years from EDTF and keep the href', () => {
  const mapped = mapApplicabilityRow({
    id: 'fha-1968-us',
    entity_id: 'ent_law_fair_housing_act_1968',
    jurisdiction_id: 'nation:US',
    scope_level: 'federal',
    in_force_from_edtf: '1968-04-11',
    in_force_to_edtf: null,
    groups_named: null,
    applies_to_slices: ['all'],
    life_domains: ['housing'],
    text_posture: 'protective',
    disputed: false,
    display_name: 'Fair Housing Act of 1968',
    kind: 'law',
    impact_statement: 'Made housing discrimination illegal in nearly every transaction.',
  });
  assert.equal(mapped.inForceFromYear, 1968);
  assert.equal(mapped.inForceToYear, null);
  assert.equal(mapped.entityHref, '/entity/ent_law_fair_housing_act_1968');
  assert.deepEqual(mapped.groupsNamed, []);
  assert.equal(edtfYear('1896'), 1896);
  assert.throws(() => edtfYear('abcd'));
});

test('a rule without a law snapshot links to its record page', () => {
  assert.equal(
    recordHrefForEntity('ent_case_shelley_v_kraemer_1948'),
    '/entity/ent_case_shelley_v_kraemer_1948',
  );
});
