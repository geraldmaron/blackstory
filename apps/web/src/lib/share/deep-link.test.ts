/**
 * The load-bearing assertion here is negative: no share link may ever carry camera state
 * (ADR-017). The round-trip tests exist so that rule cannot be satisfied by emitting nothing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildShareHref,
  buildShareSearchParams,
  FORBIDDEN_VIEWPORT_KEYS,
  parseShareSearchParams,
  type ShareDeepLink,
} from './deep-link';

const FULL: ShareDeepLink = {
  record: 'ag-gaston-motel',
  state: 'AL',
  era: 'civil-rights',
  grade: 'high',
  kind: 'place',
};

test('share link round-trips through parse', () => {
  assert.deepEqual(parseShareSearchParams(buildShareSearchParams(FULL)), FULL);
});

test('round-trip survives a leading question mark', () => {
  assert.deepEqual(parseShareSearchParams(`?${buildShareSearchParams(FULL)}`), FULL);
});

test('no viewport key can appear in the output', () => {
  const emitted = buildShareSearchParams(FULL);
  const params = new URLSearchParams(emitted);
  for (const forbidden of FORBIDDEN_VIEWPORT_KEYS) {
    assert.ok(!params.has(forbidden), `${forbidden} must never be emitted`);
  }
});

test('viewport params on an inbound URL are dropped, not carried forward', () => {
  const hostile = 'selected=ag-gaston-motel&lat=33.52&lng=-86.8&zoom=13.4&bearing=-18&pitch=52';
  const parsed = parseShareSearchParams(hostile);
  assert.deepEqual(parsed, { record: 'ag-gaston-motel' });

  const reEmitted = buildShareSearchParams(parsed);
  for (const forbidden of FORBIDDEN_VIEWPORT_KEYS) {
    assert.ok(!new URLSearchParams(reEmitted).has(forbidden));
  }
});

test('emitted params use the vocabulary /explore parses', () => {
  const params = new URLSearchParams(buildShareSearchParams(FULL));
  assert.equal(params.get('selected'), 'ag-gaston-motel');
  assert.equal(params.get('confidence'), 'high');
  assert.equal(params.get('state'), 'AL');
  assert.equal(params.get('era'), 'civil-rights');
  assert.equal(params.get('kind'), 'place');
  // The share-side field names must not leak onto the wire.
  assert.ok(!params.has('record'));
  assert.ok(!params.has('grade'));
});

test('empty and whitespace-only fields are omitted', () => {
  assert.equal(buildShareSearchParams({}), '');
  assert.equal(buildShareSearchParams({ record: '   ' }), '');
  assert.deepEqual(parseShareSearchParams(''), {});
});

test('href omits the query string when nothing is selected', () => {
  assert.equal(buildShareHref({}), '/explore');
  assert.equal(buildShareHref({ record: 'x' }), '/explore?selected=x');
  assert.equal(buildShareHref({ record: 'x' }, '/'), '/?selected=x');
});

test('values are URL encoded on the way out and decoded on the way back', () => {
  const tricky: ShareDeepLink = { record: 'a b&c=d', state: 'AL' };
  const emitted = buildShareSearchParams(tricky);
  assert.ok(!emitted.includes('a b'), 'space must be encoded');
  assert.deepEqual(parseShareSearchParams(emitted), tricky);
});
