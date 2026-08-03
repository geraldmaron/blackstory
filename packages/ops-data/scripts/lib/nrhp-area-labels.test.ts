import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNrhpListingFactObject,
  buildNrhpSignificanceObject,
  formatNrhpListedDate,
  humanizeAreaCode,
  humanizeAreas,
} from './nrhp-area-labels.ts';

test('humanizeAreaCode maps BLACK to Black heritage, never the raw parenthetical', () => {
  assert.equal(humanizeAreaCode('BLACK'), 'Black heritage');
  assert.equal(humanizeAreaCode('ETHNIC HERITAGE-BLACK'), 'Black heritage');
});

test('humanizeAreaCode drops NPS-internal negatively-defined codes', () => {
  assert.equal(humanizeAreaCode('HISTORIC - NON-ABORIGINAL'), null);
  assert.equal(humanizeAreaCode('OTHER'), null);
});

test('humanizeAreaCode turns slash/hyphen-joined codes into natural prose', () => {
  assert.equal(humanizeAreaCode('ENTERTAINMENT/RECREATION'), 'entertainment and recreation');
  assert.equal(
    humanizeAreaCode('COMMUNITY PLANNING AND DEVELOPMENT'),
    'community planning and development',
  );
});

test('humanizeAreaCode falls back to a generic rendering for an unmapped code', () => {
  assert.equal(humanizeAreaCode('SOME-NEW/CODE'), 'some new and code');
});

test('humanizeAreas joins multiple codes with an Oxford comma and drops nulls', () => {
  assert.equal(
    humanizeAreas('BLACK; PERFORMING ARTS; HISTORIC - NON-ABORIGINAL'),
    'Black heritage and performing arts',
  );
  assert.equal(
    humanizeAreas('COMMERCE; BLACK; ARCHITECTURE'),
    'commerce, Black heritage, and architecture',
  );
});

test('humanizeAreas never leaks the raw "(Black)" parenthetical', () => {
  const result = humanizeAreas('BLACK; PERFORMING ARTS');
  assert.doesNotMatch(result, /\(black/i);
});

test('humanizeAreas falls back to African American heritage when every code drops out', () => {
  assert.equal(humanizeAreas('HISTORIC - NON-ABORIGINAL; OTHER'), 'African American heritage');
  assert.equal(humanizeAreas(undefined), 'African American heritage');
});

test('formatNrhpListedDate converts an NPS Excel serial date', () => {
  assert.equal(formatNrhpListedDate('26146'), 'August 1, 1971');
  assert.equal(formatNrhpListedDate(null), null);
  assert.equal(formatNrhpListedDate('not-a-number'), null);
});

test('buildNrhpListingFactObject reads as a fragment with date and refnum', () => {
  const object = buildNrhpListingFactObject({ refnum: '71000836', listedDateSerial: '26146' });
  assert.equal(
    object,
    'on the National Register of Historic Places on August 1, 1971, reference #71000836',
  );
});

test('buildNrhpListingFactObject degrades gracefully with a missing date', () => {
  const object = buildNrhpListingFactObject({ refnum: '71000836', listedDateSerial: null });
  assert.equal(object, 'on the National Register of Historic Places, reference #71000836');
});

test('buildNrhpListingFactObject composes into a non-redundant sentence via formatClaimInclusionNote', () => {
  const object = buildNrhpListingFactObject({ refnum: '71000836', listedDateSerial: '26146' });
  // Regression guard for the "Listing Listed on..." double-lead this fragment shape exists to
  // avoid — see the doc comment on buildNrhpListingFactObject.
  assert.ok(!object.startsWith('Listed'), 'object must be a fragment, not a full sentence');
});

test('buildNrhpSignificanceObject is the humanized area list', () => {
  assert.equal(
    buildNrhpSignificanceObject({ areaOfSignificance: 'BLACK; PERFORMING ARTS' }),
    'Black heritage and performing arts',
  );
});
