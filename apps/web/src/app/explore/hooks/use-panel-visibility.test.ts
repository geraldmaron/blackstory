/**
 * Explore's layout switch: one query, shared with the camera padding, decides between the wide
 * column and the phone sheet.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPLORE_PHONE_MEDIA_QUERY } from './use-panel-visibility';

test('the bottom sheet runs through portrait tablets; the column floats from 1024px', () => {
  assert.equal(EXPLORE_PHONE_MEDIA_QUERY, '(max-width: 1023px)');
});
