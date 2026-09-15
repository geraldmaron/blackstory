import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  edtfYear,
  mapApplicabilityRow,
  mapDefinitionRow,
  mapObservationRow,
  recordHrefForEntity,
} from './lives-source';

test('definition rows default missing counties and coverage to empty', () => {
  const mapped = mapDefinitionRow({
    region_id: 'region:chicago-il',
    decade: 1960,
    reference_period: '1960',
    boundary_version: 'region-chicago-il-1960',
    measurement_regime: 'constructed_household_income',
    comparability_note: 'Cook and DuPage counties.',
    member_county_fips: null,
    coverage: null,
  });
  assert.deepEqual(mapped.memberCountyFips, []);
  assert.deepEqual(mapped.coverage, {});
  assert.equal(mapped.decade, 1960);
});

test('numeric columns returned as strings become numbers', () => {
  const mapped = mapObservationRow({
    metric_id: 'ipums-lives-class-share-lower',
    boundary_version: 'region-chicago-il-1960',
    race_ethnicity_slice: 'black_nh',
    estimate: '41.2',
    margin_of_error: '3.1',
    source: 'IPUMS USA',
    source_url: 'https://usa.ipums.org/',
    metadata: { unweightedN: 812, cellState: 'published' },
  });
  assert.equal(mapped.estimate, 41.2);
  assert.equal(mapped.marginOfError, 3.1);
  assert.equal(
    mapObservationRow({
      metric_id: 'm',
      boundary_version: 'b',
      race_ethnicity_slice: null,
      estimate: 1,
      margin_of_error: null,
      source: 's',
      source_url: 'https://x.gov',
      metadata: null,
    }).marginOfError,
    null,
  );
});

test('applicability rows read in-force years from EDTF and keep the href', () => {
  const mapped = mapApplicabilityRow(
    {
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
    },
    '/law/fair-housing-act',
  );
  assert.equal(mapped.inForceFromYear, 1968);
  assert.equal(mapped.inForceToYear, null);
  assert.equal(mapped.entityHref, '/law/fair-housing-act');
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
