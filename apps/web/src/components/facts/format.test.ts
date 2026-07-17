import assert from 'node:assert/strict';
import { test } from 'node:test';
import { humanizeToken, mapConfidenceToUiLevel, statusBannerTitle } from './format';

test('humanizeToken formats claim and confidence tokens', () => {
  assert.equal(humanizeToken('single-source'), 'Single Source');
  assert.equal(humanizeToken('place-designation'), 'Place Designation');
});

test('statusBannerTitle returns titles only for public resolution states', () => {
  assert.equal(statusBannerTitle('corrected'), 'Corrected fact record');
  assert.equal(statusBannerTitle('published'), undefined);
});

test('mapConfidenceToUiLevel maps grades to UI confidence levels', () => {
  assert.equal(mapConfidenceToUiLevel('established'), 'high');
  assert.equal(mapConfidenceToUiLevel('contested'), 'low');
});
