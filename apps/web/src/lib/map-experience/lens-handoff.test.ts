import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLensHandoff, CausalReasonStringError } from './lens-handoff';

test('buildLensHandoff builds an Atlas href through buildExploreHref', () => {
  const handoff = buildLensHandoff(
    { state: 'AL', era: '1960s' },
    'Records in this jurisdiction and era.',
  );
  assert.match(handoff.href, /^\/\?/);
  assert.match(handoff.href, /state=AL/);
  assert.match(handoff.href, /era=1960s/);
  assert.equal(handoff.reason, 'Records in this jurisdiction and era.');
});

test('buildLensHandoff never emits a viewport key', () => {
  const handoff = buildLensHandoff({ state: 'AL' }, 'By jurisdiction.');
  assert.doesNotMatch(handoff.href, /lat=|lng=|zoom=/);
});

test('buildLensHandoff refuses a reason string that implies causation', () => {
  assert.throws(
    () => buildLensHandoff({ state: 'AL' }, 'Records here because of this event.'),
    CausalReasonStringError,
  );
});

test('buildLensHandoff refuses each causal phrase it guards against', () => {
  const causalReasons = [
    'This led to more records.',
    'Shown as a result of the ruling.',
    'Records that resulted in change.',
    'Therefore these records apply.',
  ];
  for (const reason of causalReasons) {
    assert.throws(() => buildLensHandoff({ state: 'AL' }, reason), CausalReasonStringError);
  }
});

test('buildLensHandoff accepts a plain descriptive reason naming jurisdiction and era', () => {
  const handoff = buildLensHandoff(
    { state: 'MS', era: '1950s' },
    'Records in this jurisdiction and era, explicitly not causation.',
  );
  assert.equal(handoff.reason, 'Records in this jurisdiction and era, explicitly not causation.');
});
