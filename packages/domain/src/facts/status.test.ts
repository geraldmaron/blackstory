import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACT_STATUSES,
  assertFactResolutionBannerValid,
  assertFactStatusNeverResolvesTo404,
  isFactStatus,
  isPubliclyResolvableFactStatus,
  isSearchIndexableFactStatus,
} from './status.js';

test('isFactStatus recognizes every closed-vocab value', () => {
  for (const status of FACT_STATUSES) {
    assert.equal(isFactStatus(status), true);
  }
  assert.equal(isFactStatus('archived'), false);
});

test('deprecated and superseded stay publicly resolvable; draft/under_review do not', () => {
  assert.equal(isPubliclyResolvableFactStatus('published'), true);
  assert.equal(isPubliclyResolvableFactStatus('corrected'), true);
  assert.equal(isPubliclyResolvableFactStatus('superseded'), true);
  assert.equal(isPubliclyResolvableFactStatus('deprecated'), true);
  assert.equal(isPubliclyResolvableFactStatus('draft'), false);
  assert.equal(isPubliclyResolvableFactStatus('under_review'), false);
});

test('assertFactStatusNeverResolvesTo404 throws only for pre-publication statuses', () => {
  assert.doesNotThrow(() => assertFactStatusNeverResolvesTo404('deprecated'));
  assert.doesNotThrow(() => assertFactStatusNeverResolvesTo404('superseded'));
  assert.throws(() => assertFactStatusNeverResolvesTo404('draft'));
  assert.throws(() => assertFactStatusNeverResolvesTo404('under_review'));
});

test('only published/corrected are search-indexable', () => {
  assert.equal(isSearchIndexableFactStatus('published'), true);
  assert.equal(isSearchIndexableFactStatus('corrected'), true);
  assert.equal(isSearchIndexableFactStatus('superseded'), false);
  assert.equal(isSearchIndexableFactStatus('deprecated'), false);
  assert.equal(isSearchIndexableFactStatus('draft'), false);
});

test('assertFactResolutionBannerValid requires a reason and a supersededByFactId when superseded', () => {
  assert.throws(() => assertFactResolutionBannerValid({ status: 'superseded', reason: '' }));
  assert.throws(() =>
    assertFactResolutionBannerValid({
      status: 'superseded',
      reason: 'Replaced by a corrected record',
    }),
  );
  assert.doesNotThrow(() =>
    assertFactResolutionBannerValid({
      status: 'superseded',
      reason: 'Replaced by a corrected record',
      supersededByFactId: 'BB-F-000099',
    }),
  );
  assert.doesNotThrow(() =>
    assertFactResolutionBannerValid({
      status: 'deprecated',
      reason: 'Source found to be fabricated',
    }),
  );
});
