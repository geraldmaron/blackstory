import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNetworkFailureMessage } from './network-error';

test('recognizes each browser engine wording of a failed fetch', () => {
  assert.equal(isNetworkFailureMessage('Failed to fetch'), true);
  assert.equal(isNetworkFailureMessage('TypeError: Failed to fetch'), true);
  assert.equal(isNetworkFailureMessage('NetworkError when attempting to fetch resource.'), true);
  assert.equal(isNetworkFailureMessage('Load failed'), true);
  assert.equal(isNetworkFailureMessage('Network request failed'), true);
});

test('leaves server-reported auth errors alone', () => {
  assert.equal(isNetworkFailureMessage('Invalid login credentials'), false);
  assert.equal(isNetworkFailureMessage('Page load failed to render'), false);
  assert.equal(isNetworkFailureMessage(''), false);
  assert.equal(isNetworkFailureMessage(undefined), false);
});
